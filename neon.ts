import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: true,
  },
  auth: true,
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    // 从 JD 文本提取关键词/技能（确定性算法，无外部 API）。
    // slug 一旦部署不可更改；部署后环境变量：NEON_FUNCTION_KEYWORDS_BASE_URL
    keywords: { name: "Extract JD keywords", source: "./functions/extract-keywords.ts" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
