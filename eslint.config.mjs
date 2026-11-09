import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent tooling and design-research assets are not part of the app bundle.
    ".agents/**",
    ".taste-skill/**",
    "docs/**",
  ]),
  // Next 16 新增的 React Compiler 规则：本项目的 localStorage 水合模式（挂载后从
  // localStorage 同步 state）会触发这两条规则。行为是刻意为之，先降级为 warning，
  // 避免 CI 因既有代码模式失败；后续可迁移到 useSyncExternalStore 再收紧。
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
