import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { creditLedger, users } from "@/drizzle/schema";
import {
  CREDIT_FEATURES,
  DAILY_FREE_CREDITS,
  type CreditFeature,
  type CreditLedgerEntry,
  type CreditsState,
} from "./catalog";

/**
 * AI 点数服务端核心。
 *
 * 设计约束：
 * - 数据库驱动是 @neondatabase/serverless（HTTP），drizzle 的 `db.transaction`
 *   不可用，所以扣减用**单条原子 SQL** 完成（每日重置 + 先扣免费再扣余额 + 余额过期）。
 * - 每日额度按 Asia/Shanghai 自然日惰性重置：读取/扣减时发现日期变了就先归零。
 * - 点数优先扣「当日免费额度」，不足部分再扣购买余额；余额到期后归零。
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 当前北京时间日期键（YYYY-MM-DD）。 */
export function shanghaiDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 下一次每日额度重置时间（北京时间次日 00:00 的 ISO 字符串）。 */
export function nextShanghaiResetIso(date: Date = new Date()): string {
  const shanghaiMs = date.getTime() + SHANGHAI_OFFSET_MS;
  const shanghai = new Date(shanghaiMs);
  const nextMidnightUtcMs =
    Date.UTC(
      shanghai.getUTCFullYear(),
      shanghai.getUTCMonth(),
      shanghai.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ) - SHANGHAI_OFFSET_MS;
  return new Date(nextMidnightUtcMs).toISOString();
}

type CreditUserRow = {
  creditsBalance: number;
  creditsExpireAt: Date | null;
  dailyCreditsUsed: number;
  dailyCreditsDate: string | null;
  plan: string;
  planExpiresAt: Date | null;
};

async function readCreditUser(userId: string): Promise<CreditUserRow | null> {
  const rows = await db
    .select({
      creditsBalance: users.creditsBalance,
      creditsExpireAt: users.creditsExpireAt,
      dailyCreditsUsed: users.dailyCreditsUsed,
      dailyCreditsDate: users.dailyCreditsDate,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function appendLedger(entry: {
  userId: string;
  delta: number;
  balanceAfter: number;
  kind: CreditLedgerEntry["kind"];
  feature?: CreditFeature | null;
  ref?: string | null;
  note?: string;
}): Promise<void> {
  try {
    await db.insert(creditLedger).values({
      userId: entry.userId,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      kind: entry.kind,
      feature: entry.feature ?? null,
      ref: entry.ref ?? null,
      note: entry.note ?? "",
    });
  } catch (error) {
    // 流水失败不应阻断主流程，但要留下日志方便对账。
    console.error("[credits] appendLedger failed", error);
  }
}

/**
 * 读取点数状态，并顺手完成两件惰性维护：
 * 1) 跨天时把 daily_credits_used 归零；
 * 2) 已过期余额归零并写流水。
 */
export async function getCreditsState(userId: string): Promise<CreditsState> {
  let row = await readCreditUser(userId);
  if (!row) throw new Error("USER_NOT_FOUND");

  const now = new Date();
  const today = shanghaiDateKey(now);

  // 1) 购买余额过期
  if (row.creditsBalance > 0 && row.creditsExpireAt && row.creditsExpireAt <= now) {
    const expired = row.creditsBalance;
    await db
      .update(users)
      .set({ creditsBalance: 0, creditsExpireAt: null })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.creditsExpireAt} is not null and ${users.creditsExpireAt} <= now()`,
        ),
      );
    await appendLedger({
      userId,
      delta: -expired,
      balanceAfter: 0,
      kind: "expire",
      note: `点数到期，清零 ${expired} 点`,
    });
    row = await readCreditUser(userId);
    if (!row) throw new Error("USER_NOT_FOUND");
  }

  // 2) 每日额度跨天重置
  if (row.dailyCreditsDate !== today) {
    await db
      .update(users)
      .set({ dailyCreditsUsed: 0, dailyCreditsDate: today })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.dailyCreditsDate} is distinct from ${today}`,
        ),
      );
    row = await readCreditUser(userId);
    if (!row) throw new Error("USER_NOT_FOUND");
  }

  const used = row.dailyCreditsUsed;
  const member = Boolean(row.plan === "paid" && row.planExpiresAt && row.planExpiresAt > now);

  return {
    balance: row.creditsBalance,
    dailyFree: DAILY_FREE_CREDITS,
    dailyUsed: Math.min(used, DAILY_FREE_CREDITS),
    dailyRemaining: Math.max(0, DAILY_FREE_CREDITS - used),
    resetAt: nextShanghaiResetIso(now),
    plan: member ? "member" : "free",
    expiresAt: toIsoOrNull(row.creditsExpireAt),
    updatedAt: now.toISOString(),
  };
}

export type ConsumeCreditsResult =
  | {
      ok: true;
      state: CreditsState;
      cost: number;
      fromDaily: number;
      fromBalance: number;
    }
  | {
      ok: false;
      code: "insufficient_credits" | "user_not_found";
      message: string;
      state?: CreditsState;
      cost: number;
    };

/**
 * 原子扣点。先用当日免费额度，再用购买余额；不够则整笔失败（不会部分扣减）。
 */
export async function consumeCredits(
  userId: string,
  feature: CreditFeature,
  meta?: { ref?: string; note?: string },
): Promise<ConsumeCreditsResult> {
  const cost = CREDIT_FEATURES[feature].cost;

  if (cost <= 0) {
    return {
      ok: true,
      state: await getCreditsState(userId),
      cost: 0,
      fromDaily: 0,
      fromBalance: 0,
    };
  }

  const today = shanghaiDateKey();
  const label = CREDIT_FEATURES[feature].label;

  // 单条 SQL：
  // - snapshot 计算今天的已用额度 / 可用余额（过期余额视为 0）
  // - calc 计算免费额度能抵扣多少
  // - update 只有在余额足够时才执行（不够则不更新任何行）
  const result = await db.execute(sql`
    WITH snapshot AS (
      SELECT
        id,
        CASE WHEN daily_credits_date = ${today} THEN daily_credits_used ELSE 0 END AS used_today,
        CASE
          WHEN credits_expire_at IS NULL OR credits_expire_at > now() THEN credits_balance
          ELSE 0
        END AS balance_now,
        CASE
          WHEN credits_expire_at IS NULL OR credits_expire_at > now() THEN credits_expire_at
          ELSE NULL
        END AS expire_at_now
      FROM users
      WHERE id = ${userId}
    ), calc AS (
      SELECT
        id,
        used_today,
        balance_now,
        expire_at_now,
        LEAST(${cost}::int, GREATEST(0, ${DAILY_FREE_CREDITS}::int - used_today))::int AS from_daily
      FROM snapshot
    ), calc2 AS (
      SELECT *, (${cost}::int - from_daily)::int AS need_balance
      FROM calc
    )
    UPDATE users u
    SET
      daily_credits_date = ${today},
      daily_credits_used = calc2.used_today + calc2.from_daily,
      credits_balance = calc2.balance_now - calc2.need_balance,
      -- 余额扣到 0 时保留到期时间：退款/后续发放可以沿用原有效期，避免退款立刻过期。
      credits_expire_at = calc2.expire_at_now
    FROM calc2
    WHERE u.id = calc2.id
      AND calc2.need_balance <= calc2.balance_now
    RETURNING
      u.credits_balance AS balance,
      u.daily_credits_used AS daily_used,
      u.credits_expire_at AS expire_at,
      calc2.from_daily AS from_daily,
      calc2.need_balance AS from_balance
  `);

  const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  const updated = rows[0];

  if (!updated) {
    const state = await getCreditsState(userId).catch(() => undefined);
    if (!state) {
      return { ok: false, code: "user_not_found", message: "用户不存在", cost };
    }
    const available = state.dailyRemaining + state.balance;
    return {
      ok: false,
      code: "insufficient_credits",
      message: `点数不足：本次需要 ${cost} 点，当前可用 ${available} 点（免费 ${state.dailyRemaining} + 余额 ${state.balance}）`,
      state,
      cost,
    };
  }

  const fromDaily = Number(updated.from_daily ?? 0);
  const fromBalance = Number(updated.from_balance ?? 0);
  const balanceAfter = Number(updated.balance ?? 0);

  await appendLedger({
    userId,
    delta: -cost,
    balanceAfter,
    kind: "spend",
    feature,
    ref: meta?.ref ?? null,
    note: meta?.note ?? `${label}（免费 ${fromDaily} / 余额 ${fromBalance}）`,
  });

  const todayUsed = Number(updated.daily_used ?? 0);
  const expireRaw = updated.expire_at;
  const expiresAt =
    expireRaw instanceof Date
      ? expireRaw.toISOString()
      : typeof expireRaw === "string"
        ? new Date(expireRaw).toISOString()
        : null;

  const state =
    (await getCreditsState(userId).catch(() => undefined)) ?? {
      balance: balanceAfter,
      dailyFree: DAILY_FREE_CREDITS,
      dailyUsed: Math.min(todayUsed, DAILY_FREE_CREDITS),
      dailyRemaining: Math.max(0, DAILY_FREE_CREDITS - todayUsed),
      resetAt: nextShanghaiResetIso(),
      plan: "free" as const,
      expiresAt,
      updatedAt: new Date().toISOString(),
    };

  return {
    ok: true,
    cost,
    fromDaily,
    fromBalance,
    state,
  };
}

export type GrantCreditsInput = {
  amount: number;
  kind: Extract<CreditLedgerEntry["kind"], "purchase" | "grant" | "refund">;
  feature?: CreditFeature | null;
  ref?: string | null;
  note?: string;
  /** 传入则把余额有效期延长到 max(now, 当前到期) + validityDays；不传则不改有效期。 */
  validityDays?: number;
};

/**
 * 发放/退回点数。返回发放后的余额；调用方通常再调用 getCreditsState 取完整状态。
 */
export async function grantCredits(
  userId: string,
  input: GrantCreditsInput,
): Promise<{ balance: number; expiresAt: Date | null }> {
  const amount = Math.max(0, Math.trunc(input.amount));
  const validityDays = input.validityDays ?? null;

  const result = await db.execute(sql`
    UPDATE users
    SET
      credits_balance = (
        CASE
          WHEN credits_expire_at IS NOT NULL AND credits_expire_at <= now() THEN 0
          ELSE credits_balance
        END
      ) + ${amount}::int,
      credits_expire_at = CASE
        WHEN ${validityDays}::int IS NULL THEN (
          CASE
            WHEN credits_expire_at IS NOT NULL AND credits_expire_at <= now() THEN NULL
            ELSE credits_expire_at
          END
        )
        ELSE GREATEST(
          COALESCE(
            CASE
              WHEN credits_expire_at IS NOT NULL AND credits_expire_at <= now() THEN NULL
              ELSE credits_expire_at
            END,
            now()
          ),
          now()
        ) + make_interval(days => ${validityDays}::int)
      END
    WHERE id = ${userId}
    RETURNING credits_balance AS balance, credits_expire_at AS expire_at
  `);

  const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  const row = rows[0];
  const balance = Number(row?.balance ?? 0);
  const expireRaw = row?.expire_at;
  const expiresAt =
    expireRaw instanceof Date
      ? expireRaw
      : typeof expireRaw === "string"
        ? new Date(expireRaw)
        : null;

  await appendLedger({
    userId,
    delta: amount,
    balanceAfter: balance,
    kind: input.kind,
    feature: input.feature ?? null,
    ref: input.ref ?? null,
    note: input.note ?? "",
  });

  return { balance, expiresAt };
}

/**
 * 回滚一笔扣点（AI 调用失败时）。
 *
 * 传入扣点时的拆分（fromDaily / fromBalance）时按原路退回：
 * - 当天扣的每日免费额度还回「今日已用」；
 * - 购买余额还回余额。
 * 跨天后退款：免费额度部分已随新一天重置，不能重复还，按余额退回（等价补偿）。
 * 不传拆分时（旧调用）退到余额。
 */
export async function refundCredits(
  userId: string,
  amount: number,
  meta?: {
    feature?: CreditFeature;
    ref?: string | null;
    note?: string;
    fromDaily?: number;
    fromBalance?: number;
  },
): Promise<void> {
  if (amount <= 0) return;

  const hasBreakdown =
    typeof meta?.fromDaily === "number" && typeof meta?.fromBalance === "number";

  if (!hasBreakdown) {
    await grantCredits(userId, {
      amount,
      kind: "refund",
      feature: meta?.feature ?? null,
      ref: meta?.ref ?? null,
      note: meta?.note ?? "AI 调用失败，自动退回点数",
    });
    return;
  }

  const today = shanghaiDateKey();
  const fromDaily = Math.max(0, Math.trunc(meta?.fromDaily ?? 0));
  const fromBalance = Math.max(0, Math.trunc(meta?.fromBalance ?? 0));

  const result = await db.execute(sql`
    UPDATE users
    SET
      daily_credits_used = CASE
        WHEN daily_credits_date = ${today}
          THEN GREATEST(0, daily_credits_used - ${fromDaily}::int)
        ELSE daily_credits_used
      END,
      credits_balance = credits_balance + ${fromBalance}::int + (
        CASE WHEN daily_credits_date = ${today} THEN 0 ELSE ${fromDaily}::int END
      ),
      credits_expire_at = CASE
        WHEN credits_balance + ${fromBalance}::int + (
          CASE WHEN daily_credits_date = ${today} THEN 0 ELSE ${fromDaily}::int END
        ) > 0 THEN COALESCE(credits_expire_at, now() + interval '365 days')
        ELSE credits_expire_at
      END
    WHERE id = ${userId}
    RETURNING credits_balance AS balance
  `);

  const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  const balanceAfter = Number(rows[0]?.balance ?? 0);

  await appendLedger({
    userId,
    delta: amount,
    balanceAfter,
    kind: "refund",
    feature: meta?.feature ?? null,
    ref: meta?.ref ?? null,
    note:
      meta?.note ??
      `AI 调用失败，自动退回（免费 ${fromDaily} / 余额 ${fromBalance}）`,
  });
}

/** 点数流水（倒序），设置页展示最近记录。 */
export async function getCreditLedger(
  userId: string,
  limit = 20,
): Promise<CreditLedgerEntry[]> {
  const rows = await db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));

  return rows.map((row) => ({
    id: row.id,
    at: row.createdAt.toISOString(),
    delta: row.delta,
    balanceAfter: row.balanceAfter,
    kind: row.kind as CreditLedgerEntry["kind"],
    feature: (row.feature as CreditFeature | null) ?? null,
    note: row.note,
  }));
}
