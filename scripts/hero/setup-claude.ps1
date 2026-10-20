#requires -Version 5.1
<#
.SYNOPSIS
  配置本项目 Claude Code 的 DashScope 鉴权：读取全局 key，合并写入 .claude/settings.local.json，
  并实测 DashScope 的 Anthropic 兼容端点（模型 qwen3.8-max）。

.DESCRIPTION
  - key 来源优先级：$env:USERPROFILE\.claude\settings.json 的 env.ANTHROPIC_AUTH_TOKEN
    → 环境变量 ANTHROPIC_AUTH_TOKEN → 环境变量 DASHSCOPE_API_KEY。
  - 只写项目内 .claude/settings.local.json（保留已有键，幂等）；绝不修改全局 settings.json。
  - 脚本只打印 token 前 6 位 + 后 4 位，不打印完整 token。
  - 实测 POST https://dashscope.aliyuncs.com/apps/anthropic/v1/messages，
    headers: x-api-key + anthropic-version: 2023-06-01，body: model + max_tokens 32 + ping。
  - 超时 60 秒；成功打印 PASS，失败打印 FAIL + HTTP 状态 + 排查提示，退出码 1。

.EXAMPLE
  scripts\hero\setup-claude.cmd
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hero\setup-claude.ps1
  pwsh -File scripts/hero/setup-claude.ps1   # PowerShell 7

.NOTES
  编码说明：本文件为 UTF-8 with BOM，Windows PowerShell 5.1 才能正确读取中文；
  PowerShell 7 同样兼容。不要另存为无 BOM，否则 5.1 下中文会乱码。
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# 统一 UTF-8 输出，避免中文乱码
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {
    # 某些宿主不允许改控制台编码，忽略即可
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
    # PowerShell 7 默认已启用 TLS 1.2+，忽略
}

$ScriptRoot = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
$LocalSettingsPath = Join-Path $ProjectRoot '.claude\settings.local.json'
$ProjectSettingsPath = Join-Path $ProjectRoot '.claude\settings.json'
$GlobalSettingsPath = Join-Path $env:USERPROFILE '.claude\settings.json'
$ApiUri = 'https://dashscope.aliyuncs.com/apps/anthropic/v1/messages'

function Write-Line {
    param([string]$Text)
    Write-Output $Text
}

function Format-Token {
    param([string]$Token)
    if ([string]::IsNullOrEmpty($Token)) { return '(空)' }
    if ($Token.Length -le 12) { return '***（长度过短，不显示）' }
    return ($Token.Substring(0, 6) + '...' + $Token.Substring($Token.Length - 4))
}

function Exit-Fail {
    param([string]$Message)
    Write-Line ('FAIL：' + $Message)
    exit 1
}

Write-Line '== Hero 视觉 · Claude Code 鉴权配置（DashScope / qwen3.8-max）=='
Write-Line ('项目根：' + $ProjectRoot)

# ---------- 1. 读取 API Key ----------
$token = $null
$tokenSource = $null

if (Test-Path -LiteralPath $GlobalSettingsPath) {
    try {
        $globalSettings = Get-Content -LiteralPath $GlobalSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -ne $globalSettings.env -and -not [string]::IsNullOrWhiteSpace([string]$globalSettings.env.ANTHROPIC_AUTH_TOKEN)) {
            $token = [string]$globalSettings.env.ANTHROPIC_AUTH_TOKEN
            $tokenSource = '全局 settings.json → env.ANTHROPIC_AUTH_TOKEN'
        }
    } catch {
        Write-Line ('WARN：全局 settings.json 解析失败（' + $_.Exception.Message + '），继续尝试环境变量')
    }
} else {
    Write-Line ('WARN：未找到全局 settings.json（' + $GlobalSettingsPath + '），继续尝试环境变量')
}

if ([string]::IsNullOrWhiteSpace($token) -and -not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_AUTH_TOKEN)) {
    $token = $env:ANTHROPIC_AUTH_TOKEN
    $tokenSource = '环境变量 ANTHROPIC_AUTH_TOKEN'
}
if ([string]::IsNullOrWhiteSpace($token) -and -not [string]::IsNullOrWhiteSpace($env:DASHSCOPE_API_KEY)) {
    $token = $env:DASHSCOPE_API_KEY
    $tokenSource = '环境变量 DASHSCOPE_API_KEY'
}

if ([string]::IsNullOrWhiteSpace($token)) {
    Exit-Fail ('未找到 API Key。请任选一种方式提供：' +
        "①在 $GlobalSettingsPath 的 env.ANTHROPIC_AUTH_TOKEN 填入 DashScope key；" +
        '②设置环境变量 DASHSCOPE_API_KEY 后重开终端。' +
        '（脚本不会打印或上传完整 token）')
}

Write-Line ('[1/4] 读取 API Key：PASS（来源：' + $tokenSource + '，token=' + (Format-Token $token) + '）')

# ---------- 2. 读取项目模型 ----------
$model = 'qwen3.8-max'
$modelNote = '默认值（项目 .claude/settings.json 未提供）'
if (Test-Path -LiteralPath $ProjectSettingsPath) {
    try {
        $projectSettings = Get-Content -LiteralPath $ProjectSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -ne $projectSettings.env -and -not [string]::IsNullOrWhiteSpace([string]$projectSettings.env.ANTHROPIC_MODEL)) {
            $model = [string]$projectSettings.env.ANTHROPIC_MODEL
            $modelNote = '项目 .claude/settings.json → env.ANTHROPIC_MODEL'
        } elseif (-not [string]::IsNullOrWhiteSpace([string]$projectSettings.model)) {
            $model = [string]$projectSettings.model
            $modelNote = '项目 .claude/settings.json → model'
        }
    } catch {
        Write-Line ('WARN：项目 .claude/settings.json 解析失败（' + $_.Exception.Message + '），使用默认模型 qwen3.8-max')
    }
} else {
    Write-Line 'WARN：未找到项目 .claude/settings.json（由 Lead 维护），API 测试使用默认模型 qwen3.8-max'
}

# Claude Code 的模型别名可能带 [1M] 之类后缀，真实 API 只认基础模型名
$apiModel = $model
if ($apiModel -match '^(.+?)\[') {
    $apiModel = $Matches[1]
    $modelNote = $modelNote + '；已去掉别名后缀（' + $model + ' → ' + $apiModel + '）'
}
Write-Line ('[2/4] 读取模型：PASS（' + $apiModel + '；来源：' + $modelNote + '）')

# ---------- 3. 合并写入 .claude/settings.local.json ----------
$localSettingsDir = Split-Path -Parent $LocalSettingsPath
if (-not (Test-Path -LiteralPath $localSettingsDir)) {
    New-Item -ItemType Directory -Force -Path $localSettingsDir | Out-Null
}

$settings = $null
if (Test-Path -LiteralPath $LocalSettingsPath) {
    try {
        $raw = Get-Content -LiteralPath $LocalSettingsPath -Raw -Encoding UTF8
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $settings = $raw | ConvertFrom-Json
        }
    } catch {
        Exit-Fail ('现有 .claude/settings.local.json 不是合法 JSON，拒绝覆盖：' + $_.Exception.Message +
            '（请人工检查该文件；本脚本不会删除它）')
    }
}
if ($null -eq $settings) {
    $settings = New-Object psobject
}

if (-not ($settings.PSObject.Properties.Name -contains 'env') -or $null -eq $settings.env) {
    $settings | Add-Member -NotePropertyName env -NotePropertyValue (New-Object psobject) -Force
}
$existingToken = $null
if ($settings.env.PSObject.Properties.Name -contains 'ANTHROPIC_AUTH_TOKEN') {
    $existingToken = [string]$settings.env.ANTHROPIC_AUTH_TOKEN
}
$existingDashScopeKey = $null
if ($settings.env.PSObject.Properties.Name -contains 'DASHSCOPE_API_KEY') {
    $existingDashScopeKey = [string]$settings.env.DASHSCOPE_API_KEY
}

$changed = $false
if ($existingToken -ne $token) {
    if ($settings.env.PSObject.Properties.Name -contains 'ANTHROPIC_AUTH_TOKEN') {
        $settings.env.ANTHROPIC_AUTH_TOKEN = $token
    } else {
        $settings.env | Add-Member -NotePropertyName ANTHROPIC_AUTH_TOKEN -NotePropertyValue $token
    }
    $changed = $true
}
if ($existingDashScopeKey -ne $token) {
    if ($settings.env.PSObject.Properties.Name -contains 'DASHSCOPE_API_KEY') {
        $settings.env.DASHSCOPE_API_KEY = $token
    } else {
        $settings.env | Add-Member -NotePropertyName DASHSCOPE_API_KEY -NotePropertyValue $token
    }
    $changed = $true
}

if (-not $changed) {
    Write-Line '[3/4] 写入 .claude/settings.local.json：SKIP（ANTHROPIC_AUTH_TOKEN / DASHSCOPE_API_KEY 已一致，保持幂等）'
} else {
    $json = $settings | ConvertTo-Json -Depth 20
    if ([string]::IsNullOrWhiteSpace($json)) {
        Exit-Fail '序列化 settings.local.json 失败（结果为空），未写入任何内容'
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($LocalSettingsPath, ($json + [Environment]::NewLine), $utf8NoBom)
    Write-Line '[3/4] 写入 .claude/settings.local.json：PASS（已同步 ANTHROPIC_AUTH_TOKEN + DASHSCOPE_API_KEY，保留原有键）'
}
Write-Line '     注意：ANTHROPIC_BASE_URL / 模型别名由项目 .claude/settings.json 提供（Lead 维护），本脚本不覆盖。'
Write-Line '     说明：DASHSCOPE_API_KEY 供 scripts/hero/qwen-image-batch.mjs、qwen-video-batch.mjs 调用百炼图像/视频 API。'

# ---------- 4. 实测 DashScope Anthropic 兼容端点 ----------
$body = @{
    model      = $apiModel
    max_tokens = 32
    messages   = @(@{ role = 'user'; content = 'ping' })
} | ConvertTo-Json -Depth 6 -Compress

$headers = @{
    'x-api-key'         = $token
    'anthropic-version' = '2023-06-01'
}

Write-Line ('[4/4] 测试 ' + $ApiUri + '（模型 ' + $apiModel + '，max_tokens=32，超时 60s）…')

try {
    $response = Invoke-RestMethod -Uri $ApiUri -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 60
    $returnedModel = '(未返回)'
    if ($null -ne $response.model -and -not [string]::IsNullOrWhiteSpace([string]$response.model)) {
        $returnedModel = [string]$response.model
    }
    Write-Line ('      返回 model：' + $returnedModel)
    Write-Line '结论：PASS —— token 可用，DashScope Anthropic 兼容端点与 qwen3.8-max 正常。'
    Write-Line '下一步：scripts\hero\doctor.cmd  然后按 docs/hero-visual/00-INDEX.md 从 S0 开始。'
    exit 0
} catch {
    $status = $null
    $exceptionResponse = $_.Exception.Response
    if ($null -ne $exceptionResponse) {
        try { $status = [int]$exceptionResponse.StatusCode } catch {
            try { $status = [int]$exceptionResponse.StatusCode.value__ } catch { $status = $null }
        }
    }

    $statusText = '无 HTTP 状态（网络/代理/超时）'
    if ($null -ne $status) { $statusText = 'HTTP ' + $status }

    $detail = ''
    if ($null -ne $_.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
        $detail = [string]$_.ErrorDetails.Message
        if ($detail.Length -gt 300) { $detail = $detail.Substring(0, 300) + '…' }
    }

    Write-Line ('FAIL：API 测试未通过 —— ' + $statusText)
    if ($detail) { Write-Line ('      服务端返回：' + $detail) }
    Write-Line ('      异常：' + $_.Exception.Message)

    if ($null -eq $status) {
        Write-Line '排查：① 能否访问 dashscope.aliyuncs.com（代理/防火墙）；② 系统时间是否准确；③ 是否配置了需要代理的 HTTP(S)_PROXY。'
    } elseif ($status -eq 401) {
        Write-Line '排查：token 无效或已过期，检查全局 settings.json 的 ANTHROPIC_AUTH_TOKEN 是否与 DashScope 控制台一致。'
    } elseif ($status -eq 403) {
        Write-Line '排查：key 无该模型权限/未开通 qwen3.8-max，或账号被限制。'
    } elseif ($status -eq 404) {
        Write-Line '排查：端点或模型名不对（应为 /apps/anthropic/v1/messages，模型 qwen3.8-max）。'
    } elseif ($status -eq 429) {
        Write-Line '排查：触发限流，稍后重试。'
    } elseif ($status -ge 500) {
        Write-Line '排查：DashScope 服务端异常，稍后重试。'
    }

    Write-Line '说明：.claude/settings.local.json 已按第 3 步写入；修复 token/网络后可直接重跑本脚本（幂等）。'
    exit 1
}
