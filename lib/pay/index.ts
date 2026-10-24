import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders, users } from "@/drizzle/schema";
import {
  getCreditPackage,
  type CreditPackage,
  type CreditsState,
} from "@/lib/credits/catalog";
import { getCreditsState, grantCredits } from "@/lib/credits/server";

/**
 * 点数购买 / 支付渠道适配层（中国大陆）。
 *
 * v1 默认 `manual`：本机沙箱模式，点击购买直接到账、不产生真实扣款，
 * 用于联调点数扣减与 UI 流程。生产接入路径（按 plan.md 的决策表）：
 * - 面包多Pay（默认）：站内收银台，支付宝/微信，约 2% + ¥0.1/笔；
 * - 爱发电（兜底）：站外支付 + 回站内订单号核销，约 6%；
 * - 个体户/企业资质后：支付宝/微信官方直连，约 0.6%。
 *
 * 外部渠道回调统一走 `POST /api/webhooks/payment`（HMAC-SHA256 验签，
 * 幂等入账），本文件只负责「建单 + 到账发点」，不碰资金流。
 */

export type PayProvider = "manual" | "mbd" | "afdian" | "alipay" | "wechat";

export const PAY_PROVIDER_LABELS: Record<PayProvider, string> = {
  manual: "本机沙箱（不扣款）",
  mbd: "面包多Pay",
  afdian: "爱发电",
  alipay: "支付宝",
  wechat: "微信支付",
};

function coerceProvider(value: string | undefined): PayProvider {
  const allowed: PayProvider[] = ["manual", "mbd", "afdian", "alipay", "wechat"];
  return allowed.includes(value as PayProvider) ? (value as PayProvider) : "manual";
}

/** 当前支付渠道：PAY_PROVIDER，缺省在本机/开发环境用 manual，生产缺省 mbd。 */
export function getPayProvider(): PayProvider {
  const configured = process.env.PAY_PROVIDER;
  if (configured) return coerceProvider(configured);
  return process.env.NODE_ENV === "production" ? "mbd" : "manual";
}

/** manual 模式只能在本机/显式允许时启用（生产误用会变成免费发点）。 */
export function isManualPayEnabled(): boolean {
  if (getPayProvider() !== "manual") return false;
  return (
    process.env.NODE_ENV !== "production" || process.env.PAY_ALLOW_MANUAL === "1"
  );
}

export type PurchaseOrder = {
  id: string;
  at: string;
  amountFen: number;
  label: string;
  credits: number;
  packageId: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  provider: PayProvider;
  providerOrderId: string | null;
  paidAt: string | null;
};

export type PurchaseResult =
  | {
      ok: true;
      provider: PayProvider;
      /** 是否真实走了外部支付（false = 本机沙箱直接到账）。 */
      simulated: boolean;
      credits: CreditsState;
      order: PurchaseOrder;
    }
  | {
      ok: false;
      error: "invalid_package" | "payment_not_configured" | "unavailable";
      message: string;
    };

function toOrder(row: typeof orders.$inferSelect): PurchaseOrder {
  return {
    id: row.id,
    at: row.at.toISOString(),
    amountFen: row.amountFen,
    label: row.label,
    credits: row.credits,
    packageId: row.packageId ?? "",
    status: (row.status as PurchaseOrder["status"]) ?? "pending",
    provider: coerceProvider(row.provider ?? undefined),
    providerOrderId: row.providerOrderId ?? null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
  };
}

/** 创建待支付订单（外部渠道接入时使用；manual 模式不会走到这里）。 */
export async function createPendingOrder(
  userId: string,
  pkg: CreditPackage,
  provider: PayProvider,
): Promise<PurchaseOrder> {
  const [row] = await db
    .insert(orders)
    .values({
      userId,
      amountFen: pkg.priceFen,
      label: `${pkg.name} · ${pkg.points} 点`,
      status: "pending",
      packageId: pkg.id,
      credits: pkg.points,
      provider,
    })
    .returning();
  return toOrder(row);
}

async function markUserPlanActive(
  userId: string,
  pkg: CreditPackage,
  expiresAt: Date | null,
): Promise<void> {
  await db
    .update(users)
    .set({
      plan: "paid",
      planName: "点数会员",
      planPriceFen: pkg.priceFen,
      planExpiresAt: expiresAt,
    })
    .where(eq(users.id, userId));
}

/**
 * 购买点数套餐。manual 模式下同步到账；真实渠道未配置时给出明确错误，
 * 不会“假装支付成功”。
 */
export async function purchaseCreditPackage(
  userId: string,
  packageId: string,
): Promise<PurchaseResult> {
  const pkg = getCreditPackage(packageId);
  if (!pkg) {
    return { ok: false, error: "invalid_package", message: "套餐不存在，请刷新页面重试" };
  }

  const provider = getPayProvider();
  if (provider !== "manual") {
    return {
      ok: false,
      error: "payment_not_configured",
      message: `支付渠道（${PAY_PROVIDER_LABELS[provider]}）尚未接入：请在 .env.local 配置渠道参数，或暂时把 PAY_PROVIDER 设为 manual 在本机联调。`,
    };
  }
  if (!isManualPayEnabled()) {
    return {
      ok: false,
      error: "unavailable",
      message: "生产环境已禁用沙箱支付（如有需要请显式设置 PAY_ALLOW_MANUAL=1）。",
    };
  }

  const now = new Date();
  const [orderRow] = await db
    .insert(orders)
    .values({
      userId,
      at: now,
      amountFen: pkg.priceFen,
      label: `${pkg.name} · ${pkg.points} 点`,
      status: "paid",
      packageId: pkg.id,
      credits: pkg.points,
      provider: "manual",
      providerOrderId: `manual_${crypto.randomUUID()}`,
      paidAt: now,
    })
    .returning();

  const granted = await grantCredits(userId, {
    amount: pkg.points,
    kind: "purchase",
    validityDays: pkg.validityDays,
    ref: orderRow.id,
    note: `${pkg.name} · ${pkg.points} 点（沙箱）`,
  });

  await markUserPlanActive(userId, pkg, granted.expiresAt);

  return {
    ok: true,
    provider,
    simulated: true,
    credits: await getCreditsState(userId),
    order: toOrder(orderRow),
  };
}

/** 外部渠道回调入账（幂等）。返回是否本次真正入账。 */
export async function settlePaidOrder(input: {
  orderId: string;
  provider: PayProvider;
  providerOrderId?: string | null;
  amountFen?: number | null;
}): Promise<{ ok: boolean; message: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!order) return { ok: false, message: "order_not_found" };
  if (order.status === "paid") return { ok: true, message: "already_paid" };

  const pkg = order.packageId ? getCreditPackage(order.packageId) : undefined;
  if (!pkg) return { ok: false, message: "package_not_found" };

  // 金额校验：渠道回调金额与建单金额不一致时拒绝入账（防篡改/错单）。
  if (typeof input.amountFen === "number" && input.amountFen !== order.amountFen) {
    console.error("[pay] amount mismatch", { order: order.amountFen, callback: input.amountFen });
    return { ok: false, message: "amount_mismatch" };
  }

  // 幂等：只有 pending -> paid 的那次条件更新才发点（并发回调也只会有一个 winner）。
  const now = new Date();
  const updated = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: now,
      provider: input.provider,
      providerOrderId: input.providerOrderId ?? order.providerOrderId,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
    .returning({ id: orders.id });

  if (updated.length === 0) {
    return { ok: true, message: "already_paid" };
  }
  const granted = await grantCredits(order.userId, {
    amount: pkg.points,
    kind: "purchase",
    validityDays: pkg.validityDays,
    ref: order.id,
    note: `${pkg.name} · ${pkg.points} 点（${PAY_PROVIDER_LABELS[input.provider]}）`,
  });
  await markUserPlanActive(order.userId, pkg, granted.expiresAt);

  return { ok: true, message: "credited" };
}
