# stage-state.md — 当前阶段状态（新会话只读这一页）

> **规则**：每个阶段切换时**整页重写**。任何会话接手前只读本文件 + `00-INDEX.md`，**不要通读 docs/hero-visual**。
> 最后更新：2026-10-21 00:15

## 当前阶段

- **S6 前端集成 / S7 总验收之间**（视频素材已于 2026-10-21 修复重编码）

## 产物状态（实测，非声称）

| 资产 | 路径 | 状态 | 证据 |
|---|---|---|---|
| 1080p 主源 | `public/hero/hero.mp4` | ✅ 可用 | H.264 / 1920×1080 / 30fps / 13.33s / 6.15MB / 无音轨 / faststart |
| 720p 兜底 | `public/hero/hero-720p.mp4` | ✅ 可用 | H.264 / 1280×720 / 2.63MB / MD5 与主源不同 |
| 9:16 移动档 | `public/hero/hero-9x16.mp4` | ⚠️ 未生成 | 由 `mobile-cover.jpg` 图片兜底（可接受，非阻塞） |
| poster | `public/hero/poster.jpg` | ✅ | 168 KB |
| 移动封面 | `public/hero/mobile-cover.jpg` | ✅ | 306 KB |
| 15 张图像母版 + 5 段视频 | `design/source/qwen`、`design/source/wan` | ✅ | 见 `assets.json` |

## 2026-10-21 变更（重要）

1. **发现并修复**：`hero-720p.mp4` 曾是 `hero.mp4` 的字节级复制品（MD5 相同），且主源实为 **HEVC + 含音轨**（桌面 Firefox 不可播）。
2. 已用 ffmpeg 重编码为 **H.264 / 无音轨 / faststart**，SSIM 0.9885。
3. 原始文件备份在 `design/source/wan/_web_backup_20261021/`（勿删）。
4. 新增回归测试 `scripts/hero/verify-web-assets.mjs`（见下）。

## 下一步（按序，一次只做一项）

1. `node scripts/hero/verify-web-assets.mjs` 必须 0 FAIL（当前已通过）。
2. `npm run build` + 375/768/1440 三档截图，确认视频真实播放（不是只显示 poster）。
3. `05-acceptance.md` 逐条打勾，把结果写回本文件的「产物状态」。
4. 清理（2026-10-21 已完成）：`public/` 根目录旧主题死图（`art-cat/person/sky.jpg`、`hero-poster.jpg`、根 `hero.mp4`）、`art/feature-parse-2.jpg`、Next 样板 SVG、`design/frames/` 旧抽帧、`.next` 缓存已删除；`design/source/**`、`design/qa/`、`_web_backup_20261021/` 保留。删除项均可用 `git restore <path>` 恢复。

## 禁改项

- `facts` 类文档、`.env.local`、`lib/`、`app/api/`、认证/支付/数据库逻辑
- `design/source/**` 母版与备份（只读）

## 必跑命令

```powershell
node scripts/hero/verify-web-assets.mjs     # 素材证据化验收（0 FAIL 才算完成）
node scripts/hero/doctor.cmd                # 环境自检
npm run build                               # S6 gate
```

## 成本纪律（每次 --run 前）

- 先 `--dry-run`，输出「预计调用数 × 单价 + 试水方案 + 停止条件」，用户确认再执行。
- 图 ≤10 次、视频 ≤4 段、同 seed 重跑 ≤2 次；超了停手改提示词，不准抽卡。
- 本地零成本操作（转码/裁剪/压缩/验收）一律脚本化，不消耗 API。
