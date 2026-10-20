#requires -Version 5.1
<#
.SYNOPSIS
  Hero 视觉产线环境自检（S0 gate）：检查 Qwen-Image / 万相 2.7 云端 API 工具链与本地素材。

.DESCRIPTION
  - 只读检查：不调用付费生成接口（除非显式传 -ImageSmoke，且只生成 1 张 1024×1024，花费很小）。
  - 检查项：PowerShell / Node.js / npm / DASHSCOPE_API_KEY / DashScope Base URL 连通性 /
    Qwen 批量脚本 / design 参考素材 / 输出目录 / ffmpeg（可选）/ 提示词目录 / assets.json。
  - 所有网络探测 8 秒超时，命令探测 3 秒超时，不会卡住。
  - 密钥只判断「是否存在」，不打印值；ffmpeg 仅作可选备选，缺失只 WARN（主路径是剪映/PR 剪辑）。
  - 任一项 FAIL → 退出码 1；否则退出码 0（WARN 需人工确认）。
  - -Json 输出机器可读 JSON（不输出表格），退出码规则相同。
  - 只读检查，不创建目录、不修改任何文件。

.PARAMETER Json
  以 JSON 输出检查结果。

.PARAMETER ImageSmoke
  可选：调用 qwen-image-3.0 异步任务生成 1024*1024 一张图，验证 key/端点/模型可用
  （创建 → 轮询 tasks → 确认 content[] 里有 type=image 的 URL，不下载图片）。
  默认不跑；会产生很小的费用，仅在排障时使用。

.EXAMPLE
  scripts\hero\doctor.cmd
  scripts\hero\doctor.cmd -Json
  scripts\hero\doctor.cmd -ImageSmoke
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hero\doctor.ps1
  pwsh -File scripts/hero/doctor.ps1 -Json   # PowerShell 7
#>
[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$ImageSmoke
)

$ErrorActionPreference = 'Continue'

# 统一 UTF-8 输出，避免中文乱码
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {
    # 忽略控制台编码受限的情况
}

$ScriptRoot = $PSScriptRoot
$Root = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
$TimeoutMs = 3000
$HttpTimeoutSec = 8
$DefaultBaseUrl = 'https://dashscope.aliyuncs.com'

$checks = New-Object System.Collections.ArrayList

function Add-Check {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Detail,
        [string]$Hint = ''
    )
    [void]$checks.Add([pscustomobject][ordered]@{
            name   = $Name
            status = $Status
            detail = $Detail
            hint   = $Hint
        })
}

# ---------- 通用：带超时运行外部命令 ----------
function Invoke-External {
    param(
        [string]$FilePath,
        [string]$Arguments = '',
        [int]$Timeout = $TimeoutMs
    )
    $fileName = $FilePath
    $argLine = $Arguments
    # .cmd/.bat 需要经 cmd.exe 启动；.ps1 走 cmd 调同名命令，避免 ShellExecute
    if ($FilePath -match '\.(cmd|bat)$') {
        $fileName = $env:ComSpec
        if ([string]::IsNullOrWhiteSpace($fileName)) { $fileName = 'cmd.exe' }
        $argLine = '/c ""' + $FilePath + '" ' + $Arguments + '"'
    } elseif ($FilePath -match '\.ps1$') {
        $fileName = $env:ComSpec
        if ([string]::IsNullOrWhiteSpace($fileName)) { $fileName = 'cmd.exe' }
        $commandName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
        $argLine = '/c "' + $commandName + ' ' + $Arguments + '"'
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $fileName
    $psi.Arguments = $argLine
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    try {
        $proc = [System.Diagnostics.Process]::Start($psi)
    } catch {
        return [pscustomobject]@{ ok = $false; timedOut = $false; code = -1; output = ''; error = $_.Exception.Message }
    }

    if (-not $proc.WaitForExit($Timeout)) {
        try { $proc.Kill() } catch { }
        return [pscustomobject]@{ ok = $false; timedOut = $true; code = -1; output = ''; error = '超时' }
    }

    $out = ''
    $err = ''
    try { $out = $proc.StandardOutput.ReadToEnd() } catch { }
    try { $err = $proc.StandardError.ReadToEnd() } catch { }
    $ok = ($proc.ExitCode -eq 0)
    return [pscustomobject]@{
        ok       = $ok
        timedOut = $false
        code     = $proc.ExitCode
        output   = $out.Trim()
        error    = $err.Trim()
    }
}

# ---------- 通用：带超时的 HTTP GET（非 2xx 也返回状态码，用于判断「连通」） ----------
function Invoke-HttpProbe {
    param(
        [string]$Url,
        [int]$TimeoutSec = 8
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        return [pscustomobject]@{
            ok      = $true
            status  = [int]$resp.StatusCode
            content = [string]$resp.Content
            error   = ''
        }
    } catch {
        $status = $null
        $exceptionResponse = $_.Exception.Response
        if ($null -ne $exceptionResponse) {
            try { $status = [int]$exceptionResponse.StatusCode } catch { $status = $null }
        }
        return [pscustomobject]@{
            ok      = $false
            status  = $status
            content = ''
            error   = $_.Exception.Message
        }
    }
}

function Get-HumanSize {
    param([double]$Bytes)
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0:N0} B' -f $Bytes)
}

# ---------- 通用：读取 DashScope key（只判断存在，不返回值内容） ----------
function Get-DashScopeKeyInfo {
    $envKey = [string]$env:DASHSCOPE_API_KEY
    if (-not [string]::IsNullOrWhiteSpace($envKey)) {
        return [pscustomobject]@{
            present  = $true
            inEnv    = $true
            source   = '环境变量 DASHSCOPE_API_KEY'
            value    = $envKey.Trim()
        }
    }

    $projectLocal = Join-Path $Root '.claude\settings.local.json'
    $userSettings = Join-Path $env:USERPROFILE '.claude\settings.json'
    $candidates = @(
        [pscustomobject]@{ path = $projectLocal; label = '.claude/settings.local.json'; keys = @('DASHSCOPE_API_KEY', 'ANTHROPIC_AUTH_TOKEN') },
        [pscustomobject]@{ path = $userSettings; label = '~/.claude/settings.json'; keys = @('DASHSCOPE_API_KEY', 'ANTHROPIC_AUTH_TOKEN') }
    )

    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate.path)) { continue }
        $json = $null
        try { $json = Get-Content -LiteralPath $candidate.path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $json = $null }
        if ($null -eq $json -or $null -eq $json.env) { continue }
        foreach ($keyName in $candidate.keys) {
            $prop = $json.env.PSObject.Properties[$keyName]
            if ($null -ne $prop -and -not [string]::IsNullOrWhiteSpace([string]$prop.Value)) {
                return [pscustomobject]@{
                    present = $true
                    inEnv   = $false
                    source  = ($candidate.label + ' env.' + $keyName)
                    value   = ([string]$prop.Value).Trim()
                }
            }
        }
    }

    return [pscustomobject]@{ present = $false; inEnv = $false; source = ''; value = '' }
}

# ---------- 1. PowerShell ----------
$psEditionName = 'Desktop'
try { $psEditionName = [string]$PSVersionTable.PSEdition } catch { }
Add-Check -Name 'PowerShell' -Status 'PASS' -Detail ('v' + $PSVersionTable.PSVersion.ToString() + '（' + $psEditionName + '；脚本兼容 5.1+ / 7+）')

# ---------- 2. Node.js ----------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Add-Check -Name 'Node.js' -Status 'FAIL' -Detail '未找到 node 命令' `
        -Hint '安装 Node.js 24 LTS（https://nodejs.org/），重开终端后重试；qwen-image-batch / qwen-video-batch 需要 Node 20+'
} else {
    $nodeRun = Invoke-External -FilePath $nodeCmd.Source -Arguments '--version'
    if ($nodeRun.ok) {
        $major = 0
        if ($nodeRun.output -match 'v(\d+)') { $major = [int]$Matches[1] }
        if ($major -ge 20) {
            Add-Check -Name 'Node.js' -Status 'PASS' -Detail ($nodeRun.output + '（' + $nodeCmd.Source + '；推荐 24）')
        } else {
            Add-Check -Name 'Node.js' -Status 'WARN' -Detail ($nodeRun.output + '，版本偏低') `
                -Hint 'scripts/hero/qwen-*.mjs 需要 Node 20+（内置 fetch），推荐 Node 24 LTS'
        }
    } else {
        Add-Check -Name 'Node.js' -Status 'FAIL' -Detail ('node 存在但无法运行：' + $nodeRun.error)
    }
}

# ---------- 3. npm ----------
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($null -eq $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}
if ($null -eq $npmCmd) {
    Add-Check -Name 'npm' -Status 'WARN' -Detail '未找到 npm 命令' -Hint '通常随 Node.js 一起安装；重开终端或修复 PATH（S6 前端集成需要 npm run build）'
} else {
    $npmRun = Invoke-External -FilePath $npmCmd.Source -Arguments '--version'
    if ($npmRun.ok) {
        Add-Check -Name 'npm' -Status 'PASS' -Detail ($npmRun.output + '（' + $npmCmd.Source + '）')
    } else {
        Add-Check -Name 'npm' -Status 'WARN' -Detail ('npm 存在但 --version 失败/超时：' + $npmRun.error) `
            -Hint 'S6 前端集成需要 npm run build，先修复 npm'
    }
}

# ---------- 4. DASHSCOPE_API_KEY ----------
$keyInfo = Get-DashScopeKeyInfo
if (-not $keyInfo.present) {
    Add-Check -Name 'DASHSCOPE_API_KEY' -Status 'FAIL' -Detail '未找到（环境变量与 .claude/settings*.json 均无）' `
        -Hint '运行 scripts\hero\setup-claude.cmd 配置并实测；或当前终端设置 $env:DASHSCOPE_API_KEY（本脚本不打印密钥）'
} else {
    $formatOk = $keyInfo.value.StartsWith('sk-')
    $sourceText = $keyInfo.source
    if (-not $keyInfo.inEnv) {
        $sourceText += '（当前进程环境变量未设置；Claude Code 会话会注入，独立终端请先 setx/set）'
    }
    if ($formatOk) {
        Add-Check -Name 'DASHSCOPE_API_KEY' -Status 'PASS' -Detail ('已配置：' + $sourceText + '；值不打印')
    } else {
        Add-Check -Name 'DASHSCOPE_API_KEY' -Status 'WARN' -Detail ('已配置但格式不像 DashScope key：' + $sourceText) `
            -Hint 'DashScope key 通常以 sk- 开头；确认没有把别的 token 写进 DASHSCOPE_API_KEY（值不打印）'
    }
}

# ---------- 5. DashScope Base URL 连通性 ----------
$baseUrl = $DefaultBaseUrl
if (-not [string]::IsNullOrWhiteSpace([string]$env:DASHSCOPE_BASE_URL)) {
    $baseUrl = ([string]$env:DASHSCOPE_BASE_URL).Trim()
}
$baseUrl = $baseUrl.TrimEnd('/')
$baseUrlOk = $baseUrl -match '^https?://[^\s]+$'
if (-not $baseUrlOk) {
    Add-Check -Name 'DashScope 连通性' -Status 'FAIL' -Detail ('DASHSCOPE_BASE_URL 不是合法 URL：' + $baseUrl) `
        -Hint '默认 https://dashscope.aliyuncs.com；业务空间专属域名见 docs/hero-visual 的 API 说明'
} else {
    $probeUrl = $baseUrl + '/api/v1/tasks/not-a-task'
    $probe = Invoke-HttpProbe -Url $probeUrl -TimeoutSec $HttpTimeoutSec
    if ($probe.ok) {
        Add-Check -Name 'DashScope 连通性' -Status 'PASS' -Detail ('HTTP ' + $probe.status + '（GET ' + $probeUrl + '）')
    } elseif ($null -ne $probe.status) {
        Add-Check -Name 'DashScope 连通性' -Status 'PASS' -Detail ('HTTP ' + $probe.status + '（4xx/2xx 均视为连通；GET ' + $probeUrl + '）')
    } else {
        Add-Check -Name 'DashScope 连通性' -Status 'FAIL' -Detail ('无法连接：' + $baseUrl + '（' + $probe.error + '）') `
            -Hint '检查网络/代理/防火墙，确认地域与 key、模型一致（本方案按北京地域）；不能用时 qwen-*-batch --run 会失败'
    }
    if ($baseUrl -notmatch '^https://') {
        Add-Check -Name 'Base URL 协议' -Status 'WARN' -Detail ('当前为 ' + $baseUrl + '（非 https）') `
            -Hint '官方默认 https://dashscope.aliyuncs.com；仅本地 mock 测试时才应使用 http'
    }
}

# ---------- 6. Qwen 批量脚本 ----------
$qwenScripts = @(
    'scripts\hero\qwen-image-batch.mjs',
    'scripts\hero\qwen-video-batch.mjs'
)
$missingScripts = @()
foreach ($scriptRel in $qwenScripts) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $scriptRel))) { $missingScripts += ($scriptRel -replace '\\', '/') }
}
if ($missingScripts.Count -eq 0) {
    Add-Check -Name 'Qwen 批量脚本' -Status 'PASS' -Detail 'scripts/hero/qwen-image-batch.mjs + qwen-video-batch.mjs'
} else {
    Add-Check -Name 'Qwen 批量脚本' -Status 'FAIL' -Detail ('缺少：' + ($missingScripts -join '、')) `
        -Hint '从版本库恢复 scripts/hero/qwen-*.mjs；缺脚本时 S2–S5 无法批量生成'
}

# ---------- 7/8. design 参考素材 ----------
$refImage = Join-Path $Root 'design\UI_ref.jpg'
if (Test-Path -LiteralPath $refImage) {
    $refImageSize = (Get-Item -LiteralPath $refImage).Length
    if ($refImageSize -gt 0) {
        Add-Check -Name '参考图 UI_ref.jpg' -Status 'PASS' -Detail ('design/UI_ref.jpg（' + (Get-HumanSize $refImageSize) + '；MOONLITE 版式参考，只学版式/材质，无人）')
    } else {
        Add-Check -Name '参考图 UI_ref.jpg' -Status 'WARN' -Detail 'design/UI_ref.jpg 存在但为 0 字节' -Hint '重新从工作区 refs/ref-mockup.jpg 复制（同哈希）'
    }
} else {
    Add-Check -Name '参考图 UI_ref.jpg' -Status 'FAIL' -Detail '缺少 design/UI_ref.jpg' `
        -Hint '参考图是版式/材质依据（I2I 第 2 张参考）；从工作区 refs/ref-mockup.jpg 恢复到 design/UI_ref.jpg'
}

$refVideo = Join-Path $Root 'design\滑板少女.mp4'
if (Test-Path -LiteralPath $refVideo) {
    $refVideoSize = (Get-Item -LiteralPath $refVideo).Length
    if ($refVideoSize -gt 0) {
        Add-Check -Name '参考视频' -Status 'PASS' -Detail ('design/滑板少女.mp4（' + (Get-HumanSize $refVideoSize) + '；608×1092 / 16.9s，画面事实依据）')
    } else {
        Add-Check -Name '参考视频' -Status 'WARN' -Detail 'design/滑板少女.mp4 存在但为 0 字节' -Hint '重新复制原片；抽帧/比对依赖它'
    }
} else {
    Add-Check -Name '参考视频' -Status 'FAIL' -Detail '缺少 design/滑板少女.mp4' `
        -Hint '参考视频是角色/场景/水印事实依据；把原片放回 design/滑板少女.mp4（只读，不要改）'
}

# ---------- 9. 输出目录 ----------
$outDirs = @(
    'design\source\frames',
    'design\source\refs',
    'design\source\qwen',
    'design\source\wan'
)
$missingDirs = @()
foreach ($d in $outDirs) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $d))) { $missingDirs += ($d -replace '\\', '/') }
}
if ($missingDirs.Count -eq 0) {
    Add-Check -Name '输出目录' -Status 'PASS' -Detail 'design/source/{frames,refs,qwen,wan} 均已存在'
} else {
    Add-Check -Name '输出目录' -Status 'WARN' -Detail ('待创建：' + ($missingDirs -join '、')) `
        -Hint 'qwen-*-batch --run 会自动创建母版目录；doctor 不自动建目录，避免误判已完成'
}

# ---------- 10. ffmpeg（可选备选） ----------
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($null -eq $ffmpegCmd) {
    Add-Check -Name 'ffmpeg' -Status 'WARN' -Detail '未安装（PATH 中无 ffmpeg）' `
        -Hint '仅可选备选：转码/抽帧/规格验收；主路径是剪映/PR 手工剪辑导出。安装：winget install Gyan.FFmpeg（装后重开终端）'
} else {
    $ffRun = Invoke-External -FilePath $ffmpegCmd.Source -Arguments '-version'
    if ($ffRun.ok) {
        $firstLine = ($ffRun.output -split "`r?`n")[0]
        Add-Check -Name 'ffmpeg' -Status 'PASS' -Detail ($firstLine + '（可选工具；主路径仍是剪映/PR）')
    } else {
        Add-Check -Name 'ffmpeg' -Status 'WARN' -Detail ('存在但运行失败/超时：' + $ffRun.error) `
            -Hint 'ffmpeg 只是可选备选，不影响 Qwen API 生成；需要时卸载后重装 Gyan.FFmpeg'
    }
}

# ---------- 11. 提示词目录 ----------
$promptsImage = Join-Path $Root 'docs\hero-visual\prompts\image'
$promptsVideo = Join-Path $Root 'docs\hero-visual\prompts\video'
$imagePromptCount = 0
$videoPromptCount = 0
if (Test-Path -LiteralPath $promptsImage) { $imagePromptCount = @(Get-ChildItem -LiteralPath $promptsImage -File -Filter '*.txt' -ErrorAction SilentlyContinue).Count }
if (Test-Path -LiteralPath $promptsVideo) { $videoPromptCount = @(Get-ChildItem -LiteralPath $promptsVideo -File -Filter '*.txt' -ErrorAction SilentlyContinue).Count }
if ($imagePromptCount -eq 0 -and $videoPromptCount -eq 0) {
    Add-Check -Name '提示词目录' -Status 'WARN' -Detail 'docs/hero-visual/prompts/{image,video} 尚无 .txt' `
        -Hint '提示词由 plan-image / plan-video 产出；未生成前 qwen-*-batch 会明确报「prompt 文件不存在」'
} else {
    Add-Check -Name '提示词目录' -Status 'PASS' -Detail ('docs/hero-visual/prompts/image ' + $imagePromptCount.ToString() + ' 个 / video ' + $videoPromptCount.ToString() + ' 个 .txt')
}

# ---------- 12. assets.json ----------
$assetsJson = Join-Path $Root 'docs\hero-visual\assets.json'
if (-not (Test-Path -LiteralPath $assetsJson)) {
    Add-Check -Name '资产清单' -Status 'WARN' -Detail 'docs/hero-visual/assets.json 尚未生成' `
        -Hint '由 Lead 合并 docs/hero-visual/_fragments/image-assets.json + video-assets.json 后生成（v2，16 个 Qwen 资产）'
} else {
    $manifest = $null
    try {
        $manifest = Get-Content -LiteralPath $assetsJson -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        $manifest = $null
        Add-Check -Name '资产清单' -Status 'FAIL' -Detail ('assets.json 解析失败：' + $_.Exception.Message) `
            -Hint '运行 node scripts/hero/assets-check.mjs 查看结构错误；清单由 Lead 合并生成，不要手改'
    }
    if ($null -ne $manifest) {
        $assetList = @()
        if ($null -ne $manifest.assets) { $assetList = @($manifest.assets) }
        $imageCount = 0
        $videoCount = 0
        $qwenImageCount = 0
        $wanVideoCount = 0
        $otherCount = 0
        $missingPromptCount = 0
        $missingPromptSamples = @()
        $missingMasterCount = 0
        foreach ($asset in $assetList) {
            $kind = [string]$asset.kind
            if ($kind -eq 'image') { $imageCount += 1 }
            elseif ($kind -eq 'video') { $videoCount += 1 }
            $model = ''
            if ($null -ne $asset.model) { $model = [string]$asset.model }
            elseif ($null -ne $asset.params -and $null -ne $asset.params.model) { $model = [string]$asset.params.model }
            if ($model -match '^qwen-image') { $qwenImageCount += 1 }
            elseif ($model -match '^wan2\.7') { $wanVideoCount += 1 }
            else { $otherCount += 1 }

            foreach ($field in @('prompt', 'negative')) {
                $relPath = [string]$asset.$field
                if ([string]::IsNullOrWhiteSpace($relPath)) { continue }
                $promptExists = $false
                try {
                    $promptExists = Test-Path -LiteralPath (Join-Path $Root $relPath)
                } catch {
                    $promptExists = $false
                }
                if (-not $promptExists) {
                    $missingPromptCount += 1
                    if ($missingPromptSamples.Count -lt 3) { $missingPromptSamples += ($relPath -replace '\\', '/') }
                }
            }
            $masterRel = [string]$asset.master
            if (-not [string]::IsNullOrWhiteSpace($masterRel)) {
                $masterCheck = $masterRel -replace '<seed>', '20261101'
                try {
                    if (-not (Test-Path -LiteralPath (Join-Path $Root $masterCheck))) { $missingMasterCount += 1 }
                } catch {
                    $missingMasterCount += 1
                }
            }
        }
        $versionText = 'v?'
        if ($null -ne $manifest.version) { $versionText = 'v' + [string]$manifest.version }
        $detail = ($versionText + '（' + $assetList.Count.ToString() + ' 个资产：' + $imageCount.ToString() + ' image / ' + $videoCount.ToString() + ' video；qwen-image ' + $qwenImageCount.ToString() + ' / wan2.7 ' + $wanVideoCount.ToString() + '）')
        if ($otherCount -gt 0) {
            Add-Check -Name '资产清单' -Status 'WARN' -Detail ($detail + '；仍有 ' + $otherCount.ToString() + ' 个非 Qwen 资产（旧版），合并 v2 后应清理') `
                -Hint 'qwen-*-batch 会跳过非 Qwen 资产；用 node scripts/hero/assets-check.mjs 查看清单结构'
        } elseif ($qwenImageCount -eq 0 -and $wanVideoCount -eq 0) {
            Add-Check -Name '资产清单' -Status 'WARN' -Detail ($detail + '；尚无 Qwen 资产') `
                -Hint '若清单仍是旧版 v1，等 Lead 合并 v2（qwen-00…qwen-kf-sky、wan-shot-a/b/c、wan-loop）后再批量生成'
        } else {
            Add-Check -Name '资产清单' -Status 'PASS' -Detail $detail
        }
        if ($missingPromptCount -gt 0) {
            Add-Check -Name '清单引用的提示词' -Status 'WARN' -Detail ($missingPromptCount.ToString() + ' 个 prompt/negative 文件不存在（示例：' + ($missingPromptSamples -join '、') + '）') `
                -Hint '清单引用的 .txt 由 plan-image / plan-video 产出；补齐后 qwen-*-batch --dry-run 才能通过'
        }
        if ($missingMasterCount -gt 0) {
            Add-Check -Name '待生成母版' -Status 'PASS' -Detail ($missingMasterCount.ToString() + ' 个母版待生成（pending 不算错误）')
        }
    }
}

# ---------- 13. 可选：ImageSmoke ----------
if ($ImageSmoke) {
    if (-not $keyInfo.present) {
        Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail '跳过：缺少 DASHSCOPE_API_KEY' -Hint '先配置 key（scripts\hero\setup-claude.cmd），再跑 -ImageSmoke'
    } elseif (-not $baseUrlOk) {
        Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail '跳过：Base URL 非法' -Hint '修正 DASHSCOPE_BASE_URL 后重试'
    } else {
        # DashScope 原生异步图像任务：创建 → 轮询 → 确认 content[] 里有 type=image 的 URL（不下载）
        $smokeJson = '{"model":"qwen-image-3.0","input":{"messages":[{"role":"user","content":[{"text":"一只白色纸船停在平静的浅蓝色水面上，极简插画，无文字"}]}]},"parameters":{"size":"1024*1024","n":1,"prompt_extend":false,"watermark":false}}'
        $smokeHeaders = @{
            Authorization         = 'Bearer ' + $keyInfo.value
            'Content-Type'        = 'application/json'
            'X-DashScope-Async'   = 'enable'
        }
        $smokeCreateUrl = $baseUrl + '/api/v1/services/aigc/image-generation/generation'
        $smokeTaskId = ''
        try {
            $smokeCreate = Invoke-RestMethod -Uri $smokeCreateUrl -Method Post -Headers $smokeHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($smokeJson)) -TimeoutSec 120 -ErrorAction Stop
            $smokeTaskId = [string]$smokeCreate.output.task_id
        } catch {
            $smokeStatus = $null
            $smokeResponse = $_.Exception.Response
            if ($null -ne $smokeResponse) {
                try { $smokeStatus = [int]$smokeResponse.StatusCode } catch { $smokeStatus = $null }
            }
            $statusText = ''
            if ($null -ne $smokeStatus) { $statusText = 'HTTP ' + $smokeStatus.ToString() + '；' }
            Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail ($statusText + $_.Exception.Message) `
                -Hint '确认 key 有效、地域/Base URL 一致、qwen-image-3.0 已开通；图像接口是 /api/v1/services/aigc/image-generation/generation 异步任务'
            $smokeTaskId = ''
        }
        if (-not [string]::IsNullOrWhiteSpace($smokeTaskId)) {
            $smokeTaskUrl = $baseUrl + '/api/v1/tasks/' + $smokeTaskId
            $smokePollHeaders = @{ Authorization = 'Bearer ' + $keyInfo.value }
            $smokeDeadline = (Get-Date).AddSeconds(240)
            $smokeStatusText = ''
            $smokeCode = ''
            $smokeMessage = ''
            $smokeImageUrl = ''
            $smokeStartedAt = Get-Date
            while ((Get-Date) -lt $smokeDeadline) {
                Start-Sleep -Seconds 5
                $smokeTask = $null
                try {
                    $smokeTask = Invoke-RestMethod -Uri $smokeTaskUrl -Method Get -Headers $smokePollHeaders -TimeoutSec 30 -ErrorAction Stop
                } catch {
                    $smokeStatusText = 'POLL_ERROR'
                    continue
                }
                $smokeStatusText = [string]$smokeTask.output.task_status
                if ($smokeStatusText -eq 'SUCCEEDED') {
                    $smokeContents = @()
                    if ($null -ne $smokeTask.output.choices -and @($smokeTask.output.choices).Count -gt 0) {
                        $smokeMessageObj = $smokeTask.output.choices[0].message
                        if ($null -ne $smokeMessageObj -and $null -ne $smokeMessageObj.content) {
                            $smokeContents = @($smokeMessageObj.content)
                        }
                    }
                    foreach ($smokeItem in $smokeContents) {
                        if ($null -ne $smokeItem.type -and [string]$smokeItem.type -eq 'image' -and -not [string]::IsNullOrWhiteSpace([string]$smokeItem.image)) {
                            $smokeImageUrl = [string]$smokeItem.image
                            break
                        }
                    }
                    break
                }
                if ($smokeStatusText -eq 'FAILED' -or $smokeStatusText -eq 'CANCELED' -or $smokeStatusText -eq 'UNKNOWN') {
                    $smokeCode = [string]$smokeTask.output.code
                    $smokeMessage = [string]$smokeTask.output.message
                    break
                }
            }
            $smokeSeconds = [int]((Get-Date) - $smokeStartedAt).TotalSeconds
            if ($smokeStatusText -eq 'SUCCEEDED' -and -not [string]::IsNullOrWhiteSpace($smokeImageUrl)) {
                Add-Check -Name 'ImageSmoke' -Status 'PASS' -Detail ('qwen-image-3.0 1024*1024 异步任务 SUCCEEDED（' + [string]$smokeSeconds + 's，未下载；URL 24h 有效；花费很小）')
            } elseif ($smokeStatusText -eq 'SUCCEEDED') {
                Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail '任务 SUCCEEDED 但 output.choices[].message.content[] 中没有 type=image 的 URL' `
                    -Hint '查看完整响应；模型/接口版本可能变化，按百炼文档核对'
            } elseif ($smokeStatusText -eq 'FAILED' -or $smokeStatusText -eq 'CANCELED' -or $smokeStatusText -eq 'UNKNOWN') {
                Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail ('任务 ' + $smokeStatusText + '：code=' + $smokeCode + ' message=' + $smokeMessage) `
                    -Hint '常见原因：key/地域不一致、模型未开通、提示词触发内容安全；修好后重跑 -ImageSmoke'
            } else {
                Add-Check -Name 'ImageSmoke' -Status 'FAIL' -Detail ('轮询超时（240s，最后状态：' + $smokeStatusText + '，task_id=' + $smokeTaskId + '）') `
                    -Hint '任务可能仍在排队；到百炼控制台查看，或稍后再试；doctor 不会自动重试避免重复计费'
            }
        }
    }
}

# ---------- 汇总输出 ----------
$passCount = @($checks | Where-Object { $_.status -eq 'PASS' }).Count
$warnCount = @($checks | Where-Object { $_.status -eq 'WARN' }).Count
$failCount = @($checks | Where-Object { $_.status -eq 'FAIL' }).Count

if ($failCount -gt 0) {
    $conclusion = 'FAIL —— 存在 ' + $failCount + ' 项 FAIL，先按提示修复再进入 S1（S0 gate 未过）。'
    $exitCode = 1
} elseif ($warnCount -gt 0) {
    $conclusion = 'PASS（有 WARN）—— 无 FAIL，可以进入 S1；' + $warnCount + ' 项 WARN 需按提示确认后再用于对应阶段。'
    $exitCode = 0
} else {
    $conclusion = 'PASS —— 环境齐备，可以进入 S1。'
    $exitCode = 0
}

if ($Json) {
    $payload = [pscustomobject][ordered]@{
        root        = $Root
        generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        timeoutMs   = $TimeoutMs
        imageSmoke  = $ImageSmoke.IsPresent
        baseUrl     = $baseUrl
        summary     = [pscustomobject][ordered]@{ pass = $passCount; warn = $warnCount; fail = $failCount }
        ok          = ($failCount -eq 0)
        conclusion  = $conclusion
        checks      = @($checks)
    }
    $payload | ConvertTo-Json -Depth 8
    exit $exitCode
}

Write-Output 'Hero 视觉 · 环境自检（doctor · Qwen API 版）'
Write-Output ('项目根：' + $Root)
Write-Output ('时间：' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + '    探测超时：' + $TimeoutMs + ' ms/项（HTTP ' + $HttpTimeoutSec + ' s）')
Write-Output ''
Write-Output ('{0,-6} {1,-24} {2}' -f '状态', '检查项', '详情')
Write-Output ('{0,-6} {1,-24} {2}' -f '------', '------------------------', '------------------------------')
foreach ($c in $checks) {
    Write-Output ('{0,-6} {1,-24} {2}' -f $c.status, $c.name, $c.detail)
    if ($c.status -ne 'PASS' -and -not [string]::IsNullOrWhiteSpace($c.hint)) {
        Write-Output ('       └ 提示：' + $c.hint)
    }
}
Write-Output ''
Write-Output ('汇总：PASS ' + $passCount + ' / WARN ' + $warnCount + ' / FAIL ' + $failCount)
Write-Output ('结论：' + $conclusion)
if ($failCount -gt 0) {
    Write-Output '下一步：先修复 FAIL 项，然后重跑 scripts\hero\doctor.cmd，直到无 FAIL。'
} else {
    Write-Output '下一步：node scripts/hero/qwen-image-batch.mjs --dry-run（或 /hero-next）'
}
exit $exitCode
