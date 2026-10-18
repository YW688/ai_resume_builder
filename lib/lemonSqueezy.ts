import "server-only";
import crypto from "node:crypto";

const API = "https://api.lemonsqueezy.com/v1";

/**
 * 创建订阅 checkout，返回支付链接。
 * 字段结构以 Lemon Squeezy API 官方文档为准（实施/联调时核对）。
 */
export async function createCheckoutUrl(opts: {
  userId: string;
  email: string;
}): Promise<string | null> {
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
  const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID;
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!storeId || !variantId || !apiKey) return null;

  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: opts.email,
            custom: { user_id: opts.userId },
          },
          product_options: {
            redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=1`,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { attributes?: { url?: string } };
  };
  return json?.data?.attributes?.url ?? null;
}

/** 校验 Lemon Squeezy webhook 签名（HMAC-SHA256）。 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
