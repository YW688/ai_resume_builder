import crypto from "node:crypto";

import { settlePaidOrder, type PayProvider } from "@/lib/pay";

/**
 * 支付渠道异步回调（中国大陆渠道接入点）。
 *
 * 统一契约（各渠道适配器在服务端转成这个格式）：
 *   POST /api/webhooks/payment
 *   Header: x-pay-signature = HMAC-SHA256(rawBody, PAY_WEBHOOK_SECRET) 的 hex
 *   Body: {
 *     "orderId": "本系统 orders.id",
 *     "status": "paid" | "refunded",
 *     "provider": "mbd" | "afdian" | "alipay" | "wechat",
 *     "providerOrderId": "渠道订单号（可选）",
 *     "amountFen": 2990
 *   }
 *
 * 只做「验签 → 幂等入账 → 发点」，不做资金清结算（符合 plan.md 的合规边界）。
 */

const VALID_PROVIDERS: PayProvider[] = ["mbd", "afdian", "alipay", "wechat"];

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.PAY_WEBHOOK_SECRET;
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type PaymentWebhook = {
  orderId?: string;
  status?: string;
  provider?: string;
  providerOrderId?: string;
  amountFen?: number;
};

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-pay-signature");
  if (!verifySignature(raw, signature)) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let payload: PaymentWebhook;
  try {
    payload = JSON.parse(raw) as PaymentWebhook;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const provider = payload.provider as PayProvider | undefined;
  if (!payload.orderId || !provider || !VALID_PROVIDERS.includes(provider)) {
    return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // 退款回调：v1 只记录，不做自动扣回（人工客服按流水处理），避免误伤已使用点数。
  if (payload.status === "refunded") {
    return Response.json({ ok: true, handled: "refund_manual_review" });
  }
  if (payload.status !== "paid") {
    return Response.json({ ok: true, handled: "ignored" });
  }

  const result = await settlePaidOrder({
    orderId: payload.orderId,
    provider,
    providerOrderId: payload.providerOrderId ?? null,
    amountFen: typeof payload.amountFen === "number" ? payload.amountFen : null,
  });

  if (!result.ok) {
    console.error("[payment webhook] settle failed", result.message, payload.orderId);
    return Response.json({ ok: false, error: result.message }, { status: 400 });
  }

  return Response.json({ ok: true, result: result.message });
}
