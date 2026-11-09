import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 开发服务器默认只放行 localhost 及其启动 hostname；E2E/调试脚本常用 127.0.0.1，
  // 未放行时 dev-only 资源（chunk/HMR）会被 403 拦截，页面无法水合、表单提交失效。
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    agentFeedback: true,
    serverActions: {
      // 照片上传 ≤5MB，留出 multipart 开销
      bodySizeLimit: "6mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  // 基础安全响应头（不引入严格 CSP，避免破坏现有的内联样式/脚本）。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
