# 中文求职技能参考库（lib/skills）

供 AI 提示词引用的**岗位族技能知识库**。不直接展示给用户，只作为「规范写法 / 关键词 / 量化口径」的参考，避免 AI 自由发挥、堆砌关键词或编造技能。

## 目录结构

```
lib/skills/
├── index.ts          # 加载器：合并内置 JSON + 扫描 data/ 目录
├── README.md
└── data/
    ├── general.json             # 通用 / 跨岗位（兜底）
    ├── product.json             # 产品经理
    ├── operations-growth.json   # 运营 / 用户增长
    ├── frontend.json            # 前端
    ├── backend.json             # 后端
    ├── data-analysis.json       # 数据分析
    ├── algorithm-ai.json        # 算法 / AI
    ├── design.json              # 设计
    ├── marketing-brand.json     # 市场 / 品牌
    ├── sales.json               # 销售 / 商务
    ├── hr.json                  # 人力资源
    └── finance.json             # 财务
```

## JSON 字段

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定 id（建议与文件名一致） |
| `name` | 中文岗位族名 |
| `aliases` | 岗位别名，用于匹配目标岗位 / JD |
| `coreSkills` | 核心技能（规范写法） |
| `tools` | 常用工具 |
| `jdKeywords` | 常见 JD 关键词 |
| `actionVerbs` | 简历句首可复用的动作动词 |
| `quantTemplates` | 量化口径模板，**占位数字必须来自用户真实信息** |
| `canonical` | 口语化写法 → 规范写法（如「sql」→「SQL（窗口函数、复杂查询）」） |

## 扩展方式

1. **推荐**：新建 `data/<id>.json`，并在 `index.ts` 的 `BUNDLED_DATA` 里补一行 import。
   这样构建期就打包进服务端，部署后一定可用。
2. 只丢 JSON 文件到 `data/`：服务端首次加载时会自动扫描目录（本地 dev / 常规 `next start` 有效；
   没有源码目录的 Serverless 产物会静默跳过）。生产部署请用方式 1。

## 使用约定（写在提示词里的硬约束）

- 技能参考**只能用来规范写法 / 对齐 JD 关键词**，不能当作事实直接写进简历。
- 用户没做过的技能不添加；用户没提供的数字不编造。
- 量化模板里的 `{N}` 只有在用户原文提供了真实数据时才可替换。
