/**
 * @deprecated 2026-10 计费重构后已停用。
 *
 * 旧的 Lemon Squeezy 订阅回调（境外 MoR 支付）不再被前端调用，也不会给用户
 * 开通任何权益。新支付回调统一走 `POST /api/webhooks/payment`
 * （见 `lib/pay/index.ts` 与 `docs/credits/README.md`）。
 * 保留本文件只为不删除历史路由/表结构，后续可安全移除。
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, subscriptions } from "@/drizzle/schema";
import { verifyWebhookSignature } from "@/lib/lemonSqueezy";

type LsWebhook = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> };
  data?: { id?: string; attributes?: Record<string, unknown> };
};

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: LsWebhook;
  try {
    payload = JSON.parse(raw) as LsWebhook;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  if (!eventName?.startsWith("subscription_")) {
    return new Response("ignored", { status: 200 });
  }

  const attrs = payload.data?.attributes ?? {};
  const custom = (attrs.custom ?? {}) as Record<string, unknown>;
  const metaCustom = (payload.meta?.custom_data ?? {}) as Record<string, unknown>;
  // userId 通过 checkout_data.custom.user_id 传入；字段路径联调时核对 LS 文档
  const userId = (custom.user_id ?? metaCustom.user_id) as string | undefined;
  if (!userId) return new Response("no user", { status: 200 });

  const lsSubscriptionId = String(payload.data?.id ?? "");
  const status = String(attrs.status ?? "unknown");
  const customerId =
    attrs.customer_id != null ? String(attrs.customer_id) : null;
  const renewsAt = attrs.renews_at != null ? new Date(String(attrs.renews_at)) : null;

  await db
    .insert(subscriptions)
    .values({
      userId,
      lsSubscriptionId,
      lsCustomerId: customerId,
      status,
      currentPeriodEnd: renewsAt,
    })
    .onConflictDoUpdate({
      target: subscriptions.lsSubscriptionId,
      set: { status, lsCustomerId: customerId, currentPeriodEnd: renewsAt },
    });

  // v1 简化：active 视为付费，其余视为免费（取消立即生效，不做周期末尾宽限）
  const paid = status === "active";
  await db.update(users).set({ plan: paid ? "paid" : "free" }).where(eq(users.id, userId));

  return new Response("ok", { status: 200 });
}
