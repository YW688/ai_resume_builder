---
description: 按资产 id（$ARGUMENTS）或当前阶段验收 Hero 资产：检查文件/尺寸/时长/编码/参数 txt/prompt 引用一致性，输出 PASS/FAIL 证据表。
---

# /hero-verify

验收以证据为准：文件不存在 = FAIL（不是「待生成」）；无法探测的项标 WARN 并写原因。
默认只读，不修改任何文件。

## 执行步骤

1. **确定验收对象**：
   - 若 `$ARGUMENTS` 非空：当作资产 id（可逗号分隔多个，如 `qwen-01,qwen-02`、`wan-shot-a`），
     运行 `node scripts/hero/assets-check.mjs --json` 并在 `assets` 中定位；未知 id 直接报错停止。
   - 若为空：先 `node scripts/hero/assets-check.mjs --next` 找到当前阶段，再汇报该阶段全部资产
     （已完成资产逐项复验，pending 资产列为 FAIL 并注明「未生成」）。
   - 清单缺失（退出码 2）→ 说明无法按资产验收，改为按 `docs/hero-visual/05-acceptance.md`
     的「顶层 10 秒验收 + 分阶段检查」人工执行。
2. **读验收标准**：读 `docs/hero-visual/05-acceptance.md` 对应分组（A 图 / B 视频 / C 前端集成 /
   D 合规与交付）以及 `.claude/skills/hero-visual/SKILL.md` 的阶段 gate；不要自创标准。
3. **文件级检查**（对每个资产）：
   - `master` 与 `webOutputs[].path` 是否存在、大小是否 >0；多 seed 资产按 `<seed>` 展开逐个查；
   - 母版同名 `.txt` 参数记录是否存在，且含 prompt/negative/refs/model/size 或 resolution/duration/
     seed/parameters/task_id/usage（由 `qwen-image-batch.mjs` / `qwen-video-batch.mjs` 生成）；
   - `prompt`/`negative` 文件是否被清单引用且 >50 字节（引用一致即视为原样，可用
     `Get-FileHash -Algorithm SHA256` 留证）；
   - 生成时间是否合理（24h 内下载落盘；`task_id` 与 sidecar 一致）。
4. **媒体规格检查**：
   - 图片：用 PowerShell `Add-Type -AssemblyName System.Drawing` 后
     `[System.Drawing.Image]::FromFile(<路径>)` 读取 `Width/Height`；
     对照 `docs/hero-visual/02-qwen-images.md` 的尺寸表（1920×1080 / 1280×720 / 1024×1024 /
     1152×1536 / 1080×1920）。
   - 视频：优先 `ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name
     -show_entries format=duration -of json <路径>`，核对 1920×1080、30 fps、5/6/5/5s、无音轨；
     `ffprobe` 不存在 → 标 WARN（本机无 ffmpeg，可改用剪映/播放器人工核对），不要假装通过。
   - 浏览器级验收（S6）：按 `04-frontend-integration.md` 跑 `npm run build`，三档截图
     （1440×900 / 768×1024 / 375×812）由 `visual-qa` 或人工留证。
5. **Qwen 专有检查**：
   - 图片/视频画面**无文字、水印、logo、二维码、UI 边框**（肉眼项，标「待人工确认」）；
   - 同角色：与 `design/source/refs/character_front.png` 对照脸/发型/服装锚点；
   - 视频首帧必须是关键帧且精确 16:9；loop 首尾同图、亮度差 ≤3%；
   - 结果链接是否已落盘（`master` 存在即视为已归档，不依赖 24h URL）；
   - 无密钥泄露：汇报/文档里不得出现 `sk-` 开头的 token。
6. **输出证据表**（缺证据就是 FAIL/WARN，不能写「看起来没问题」）：

```text
验收对象：qwen-03（S3 / image）
| 检查项 | 方法 | 结果 | 证据 |
| 母版存在 | Test-Path | PASS | design/source/qwen/004-feature-templates_s20261103.png |
| 尺寸 1920×1080 | System.Drawing | PASS | Width=1920 Height=1080 |
| 参数 txt | 读文件 | FAIL | 缺 004-feature-templates_s20261103.txt |
| 安全区无文字 | 肉眼 | 待人工 | 由客户确认 |
结论：FAIL（1 项失败，1 项待人工）
修复建议：按 02 文档「导出与参数记录」补写同名 txt 后重跑 /hero-verify qwen-03
```

7. 收尾写清：本次验证的 gate 是哪一个（S3/S4/S5/S6）、是否可进入下一阶段、剩余人工确认项。

## 边界

- 只读：不生成/不覆盖资产、不改清单、不修改前端代码。
- 不凭印象通过肉眼项；把「需要人工确认」的项显式标出，交客户/Lead 签字。
- 不运行 `--run` 或任何计费接口；不写文件（除非 Lead 明确要求落盘到指定报告路径）。
