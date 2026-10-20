---
description: 查看 Hero 视觉产线当前状态：环境/API 自检（doctor）、assets.json v2 结构校验、各阶段完成度、阻塞项与下一步。
---

# /hero-status

只读盘点，不生成资产、不改文件。用中文汇报。

## 执行步骤

1. **定位项目根**：当前目录应含 `package.json` 与 `scripts/hero/`；若不在项目根，先切到项目根
   再执行（脚本自身可定位，但保持命令可复制）。
2. **环境与 API 自检**：
   - 运行 `scripts/hero/doctor.cmd`（PowerShell 7 也可 `pwsh -File scripts/hero/doctor.ps1`）。
   - 记录 PASS/WARN/FAIL；重点看 `DASHSCOPE_API_KEY`、`DashScope 连通性`、`design/UI_ref.jpg`、
     `design/滑板少女.mp4`、`assets.json`。FAIL 时状态结论为「S0 未过」，直接跳到第 6 步输出。
   - 默认不要跑 `-ImageSmoke`（会真实生成 1 张图、产生很小费用）；只有 Lead 明确要求排障时才跑。
3. **资产清单校验**：
   - 运行 `node scripts/hero/assets-check.mjs --json`，保存 stdout 作为结构化结果，并记录退出码：
     `0` 正常（pending 不算错）、`1` 结构错误、`2` 清单缺失。
   - 退出码 `2` 时不要编造阶段进度：明确写「`docs/hero-visual/assets.json` 尚未生成（由 Lead 合并
     `_fragments/image-assets.json` 与 `video-assets.json`）」，改为读 `docs/hero-visual/00-INDEX.md`
     盘点人工进度。
   - v2 清单应有 16 个资产（12 图 + 4 视频）与 8 个阶段（S0–S7）；数量不符时如实报差异。
4. **读索引**：读 `docs/hero-visual/00-INDEX.md`，确认当前阶段与 gate 定义（S0–S7 与
   `.claude/skills/hero-visual/SKILL.md` 一致）。若 `$ARGUMENTS` 非空，把它当作筛选条件：
   - 是资产 id（如 `qwen-03`、`wan-shot-b`）→ 只汇报该资产；
   - 是阶段 id（如 `S4`）→ 只汇报该阶段及其 gate。
5. **计算结论**：按阶段表列出「已完成 / 总数」与卡点；完成判定以 `master` 与 `webOutputs`
   文件是否真实存在为准，不以「跑过命令」为准。
6. **输出模板**（缺失项写「无 / 待生成」，不要留占位不填）：

```text
环境（S0）：PASS 11 / WARN 2 / FAIL 0；doctor 结论：……
清单结构：PASS（16 资产 / 8 阶段 / 0 错误 / N 警告）或 未生成
阶段完成度：
  S2 角色卡      0/1  卡点：等待客户确认 character_front.png
  S3 图 + 关键帧 2/11 下一张：qwen-03
  S4 视频        0/4  下一段：wan-shot-a
  ……
阻塞项：……（没有写「无」）
下一步：/hero-next 或具体命令（如 node scripts/hero/qwen-image-batch.mjs --only qwen-03 --dry-run）
```

## 边界

- 只运行只读检查命令；不要启动生成（不要 `--run`）、不要改动 `docs/hero-visual/assets.json`。
- 不要用「大概」「应该」描述状态；一切结论要有命令退出码或文件路径证据。
- 不在汇报里输出密钥或完整 token；只写「已配置 / 缺失」。
