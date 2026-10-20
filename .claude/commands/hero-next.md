---
description: 推进 Hero 视觉产线：读取 assets.json v2，找出下一个未完成资产（或指定资产 $ARGUMENTS），给出可直接执行的 Qwen 命令、输入检查与验收标准。
---

# /hero-next

只读规划，不直接生成资产；把「下一步做什么、命令是什么、怎么算过」讲清楚。

## 执行步骤

1. 运行 `node scripts/hero/assets-check.mjs --next`：
   - 退出码 `0` 且打印「全部完成」→ 直接汇报进入 S7 验收（`/hero-verify`），结束。
   - 退出码 `2`（清单缺失）→ 说明 `docs/hero-visual/assets.json` 尚未由 Lead 生成，
     改为按 `docs/hero-visual/00-INDEX.md` 的路线给出下一个阶段入口，不要伪造资产 id。
   - 退出码 `1`（结构错误）→ 先列错误与修复建议，不要再规划生成。
2. 若 `$ARGUMENTS` 非空（资产 id，如 `qwen-04`、`wan-shot-b`）：
   - 先 `node scripts/hero/assets-check.mjs --json`，在 `assets` 数组中定位该 id；
   - 找不到 → 明确报「未知资产 id：$ARGUMENTS」，并列出可用 id，停止；
   - 找到 → 以该资产为目标（即使它已完成，也说明「已存在母版，如需重生成加 --force」）。
3. 读对应阶段文档的该资产小节，不要凭记忆：
   - `kind = image` → `docs/hero-visual/02-qwen-images.md`；
   - `kind = video` → `docs/hero-visual/03-qwen-video.md`；
   - 需要路径映射/色板/安全区 → `docs/hero-visual/01-visual-bible.md`。
4. 检查输入是否就绪（不预生成）：
   - 引用提示词文件存在且 >50 字节（`docs/hero-visual/prompts/{image,video}/*.txt`，
     以 assets.json 的 prompt/negative 字段为准）；
   - 图片：`refs` 列出的参考图（角色卡、`design/source/frames/` 抽帧）存在，3.0 系 ≤3 张；
   - 视频：`firstFrame`（i2v 必需）、`lastFrame`（首尾帧/loop）存在，且首帧精确 16:9；
   - 依赖 `dependsOn` 中的资产母版已完成；
   - 环境：`DASHSCOPE_API_KEY` 是否已配置（`scripts/hero/doctor.cmd -Json` 的
     `DASHSCOPE_API_KEY` 项）；未配置时只能 dry-run，必须先 `scripts/hero/setup-claude.cmd`。
5. 输出模板（必须可直接复制执行）：

```text
下一个资产：qwen-03（S3 / image）
标题：功能图 · 模板/版式（3 块玻璃面板）
依赖：qwen-00-character（已完成）
输入：docs/hero-visual/prompts/image/03-feature-templates.pos.txt（存在）
      docs/hero-visual/prompts/image/03-feature-templates.neg.txt（存在）
      参考图 design/source/refs/character_front.png（存在）、design/source/frames/ref_1_t2.jpg（待 S1 抽帧）
输出：design/source/qwen/004-feature-templates_s20261103.png + 同名 .txt
执行：
  node scripts/hero/qwen-image-batch.mjs --only qwen-03 --dry-run   # 核对创建请求
  node scripts/hero/qwen-image-batch.mjs --only qwen-03 --run       # 真正生成（异步任务+轮询，计费）
验收（10 秒验收，详见 02 文档）：
  1) ……  2) ……
失败处理：脚本退出码 1/2/3 对应 结构/环境/API；最多重试 2 次，每次只改一个变量。
```

6. 若输入缺失或环境未就绪：不要给出生成命令作为「下一步」，先输出「前置未满足」+ 补齐命令
   （如先完成角色卡确认、先抽帧、先配置 key、先完成依赖资产），并说明 dry-run 可先行核对字段。

## 边界

- 不执行 `--run` 生成，不复制素材到 `public/`，不修改清单和提示词。
- 素材路径一律项目相对路径；不要输出外部盘符路径。
- 不写具体价格；只提示「按像素档/按秒计费，先 dry-run + 单张试水」。
