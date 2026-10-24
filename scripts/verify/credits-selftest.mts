/**
 * 点数核心自测（真实 Neon 数据库）。不属于产品代码，跑完自动清库。
 * 用法：npx tsx scripts/verify/credits-selftest.ts
 *
 * 需要 node_modules/server-only 的空壳（Next 内部 alias 在纯 Node 下不存在），
 * 若缺失请先 `node -e "..."` 创建；具体由 Lead 在本地跑，不建议提交。
 */
import fs from "node:fs";
import path from "node:path";

// 1) 手动加载 .env.local（tsx 不自动读 Next 的 env 文件）
const envPath = path.resolve(process.cwd(), ".env.local");
for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  if (process.env[key] !== undefined) continue;
  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const { eq } = await import("drizzle-orm");
const { db } = await import("@/lib/db");
const { users, orders, creditLedger } = await import("@/drizzle/schema");
const {
  getCreditsState,
  consumeCredits,
  grantCredits,
  refundCredits,
  getCreditLedger,
  shanghaiDateKey,
} = await import("@/lib/credits/server");
const { purchaseCreditPackage, createPendingOrder, settlePaidOrder } = await import(
  "@/lib/pay"
);

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
  }
}

const userId = crypto.randomUUID();
await db.insert(users).values({ id: userId, email: `selftest.${Date.now()}@example.com`, name: "自测" });

try {
  // 1. 初始状态
  let state = await getCreditsState(userId);
  check("初始余额 0", state.balance === 0, state);
  check("每日免费 5 点", state.dailyFree === 5 && state.dailyRemaining === 5, state);
  check("初始 plan=free", state.plan === "free", state);

  // 2. 免费额度优先扣减
  let res = await consumeCredits(userId, "jd_rewrite");
  check("扣 1 点成功", res.ok === true, res);
  if (res.ok) {
    check("本次全部来自每日免费", res.fromDaily === 1 && res.fromBalance === 0, res);
    check("免费余额剩 4", res.state.dailyRemaining === 4, res.state);
  }

  // 3. 每日免费耗尽后，余额不足应拒绝
  for (let i = 0; i < 4; i += 1) await consumeCredits(userId, "jd_rewrite");
  res = await consumeCredits(userId, "resume_generate");
  check("免费耗尽且无余额 → 拒绝", res.ok === false, res);
  if (!res.ok) check("错误码 insufficient_credits", res.code === "insufficient_credits", res);

  // 4. 发放点数（模拟购买）
  await grantCredits(userId, {
    amount: 12,
    kind: "purchase",
    validityDays: 90,
    note: "自测购买体验包",
  });
  state = await getCreditsState(userId);
  check("购买后余额 12", state.balance === 12, state);
  check("有效期已设置", typeof state.expiresAt === "string", state);

  // 5. 整份生成扣 2 点（从余额扣，因为今日免费已用完）
  res = await consumeCredits(userId, "resume_generate");
  check("整份生成扣 2 点成功", res.ok === true, res);
  if (res.ok) {
    check("整份生成从余额扣 2", res.fromBalance === 2 && res.fromDaily === 0, res);
    check("余额剩 10", res.state.balance === 10, res.state);
  }

  // 5b) 退款按原路退回：先扣 1 点余额，再退回，余额应恢复且不产生每日额度
  res = await consumeCredits(userId, "experience_polish");
  check("余额扣 1 点成功", res.ok === true && res.fromBalance === 1, res);
  if (res.ok) {
    await refundCredits(userId, 1, {
      feature: "experience_polish",
      fromDaily: res.fromDaily,
      fromBalance: res.fromBalance,
    });
    state = await getCreditsState(userId);
    check("失败退款回到余额（10）", state.balance === 10, state);
    check("退款不改变每日免费额度", state.dailyRemaining === 0, state);
  }

  // 6. 跨天重置：把 daily_credits_date 改成昨天，再读应恢复 5 点
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  await db
    .update(users)
    .set({ dailyCreditsDate: shanghaiDateKey(yesterday), dailyCreditsUsed: 5 })
    .where(eq(users.id, userId));
  state = await getCreditsState(userId);
  check("跨天免费额度重置为 5", state.dailyRemaining === 5, state);

  // 6b) 免费额度扣了再退：应还回「今日已用」，而不是变成永久余额
  res = await consumeCredits(userId, "jd_rewrite");
  check("跨天后从免费额度扣 1", res.ok === true && res.fromDaily === 1, res);
  if (res.ok) {
    await refundCredits(userId, 1, {
      feature: "jd_rewrite",
      fromDaily: res.fromDaily,
      fromBalance: res.fromBalance,
    });
    state = await getCreditsState(userId);
    check("免费额度退款后恢复 5", state.dailyRemaining === 5, state);
    check("免费退款不增加余额", state.balance === 10, state);
  }

  // 7. 点数流水
  const ledger = await getCreditLedger(userId, 50);
  check("流水包含 spend 与 purchase", ledger.some((x) => x.kind === "spend") && ledger.some((x) => x.kind === "purchase"), ledger.slice(0, 3));

  // 8. manual 购买套餐（真实调用 purchaseCreditPackage）
  const purchase = await purchaseCreditPackage(userId, "starter");
  check("套餐购买成功（manual 沙箱）", purchase.ok === true, purchase);
  if (purchase.ok) {
    check("到期后余额 = 10 + 12", purchase.credits.balance === 22, purchase.credits);
    check("订单为 paid 且 12 点", purchase.order.status === "paid" && purchase.order.credits === 12, purchase.order);
  }

  // 9. 外部回调幂等：pending 订单只入账一次
  const pkg = { id: "jobhunt", name: "求职包", priceFen: 2990, points: 45, validityDays: 180, tagline: "", perks: [] } as never;
  const pending = await createPendingOrder(userId, pkg, "mbd");
  const first = await settlePaidOrder({ orderId: pending.id, provider: "mbd", amountFen: 2990 });
  const second = await settlePaidOrder({ orderId: pending.id, provider: "mbd", amountFen: 2990 });
  state = await getCreditsState(userId);
  check("回调首次入账", first.ok && first.message === "credited", first);
  check("重复回调幂等", second.ok && second.message === "already_paid", second);
  check("45 点只到账一次（余额 22+45=67）", state.balance === 67, state);

  const orderRows = await db.select().from(orders).where(eq(orders.userId, userId));
  const ledgerRows = await db.select().from(creditLedger).where(eq(creditLedger.userId, userId));
  check("订单数量 2（starter + jobhunt）", orderRows.length === 2, orderRows.length);
  check("流水有记录", ledgerRows.length > 0, ledgerRows.length);
} finally {
  // 清理测试用户（cascade 会删 orders / ledger）
  await db.delete(users).where(eq(users.id, userId));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
