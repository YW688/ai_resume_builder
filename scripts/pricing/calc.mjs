#!/usr/bin/env node
/**
 * 中国简历工具 · AI 点数计费 —— 本地单位经济学计算脚本
 * =============================================================================
 * 纯本地：无第三方依赖、无网络请求、不读环境变量、不写数据库。
 * 运行：  node scripts/pricing/calc.mjs
 * 可选：  node scripts/pricing/calc.mjs --csv    # 追加写出 docs/pricing/unit-economics.csv
 *         node scripts/pricing/calc.mjs --json   # 追加写出 docs/pricing/assumptions.json
 *         node scripts/pricing/calc.mjs --quiet  # 只写文件，不打印
 *
 * 时间基准：2026-10-24（Asia/Shanghai）
 * 币种：人民币（CNY）。美元计价项按 CONFIG.usdCny 折算并标注为假设。
 *
 * 所有外部价格/费率来源见 CONFIG.sources，以及 docs/pricing/README.md 的「核实清单」。
 * 标 [已验证] 的数据来自官方页面；标 [假设] 的为运营假设，需真实数据逐步替换。
 * =============================================================================
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/* ============================================================================
 * CONFIG —— 所有参数集中在这里；改这里即可重算，文档数字应与本脚本输出一致。
 * ==========================================================================*/
const CONFIG = {
  meta: {
    asOf: '2026-10-24',            // 时间基准（Asia/Shanghai）
    currency: 'CNY',
    usdCny: 7.15,                  // [假设] 美元兑人民币汇率，2026-10-24 未联网核实
    note: '本脚本为纯本地测算；外部价格以官网/签约页为准。',
  },

  // —— DeepSeek 官方 API 价格（元 / 百万 tokens）[已验证 2026-10-24] ——
  // 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
  // 高峰时段 = 北京时间周一至周五（不含法定节假日）9:00-12:00、14:00-18:00，其余为空闲时段；
  // 空闲价为高峰价的一半。以下为「元/百万 tokens」。
  deepseek: {
    model: 'deepseek-flash',       // 生产默认模型（最便宜一档）
    peakShare: 0.30,               // [假设] 30% 调用落在高峰时段（求职者晚间/周末使用为主）
    cacheHitShare: 0.40,           // [假设] 40% 输入 token 命中上下文缓存（系统提示词可缓存）
    retryFactor: 1.15,             // [假设] 失败重试/截断重生成冗余 15%
    priceFlash: {
      cacheHit:  { idle: 0.02, peak: 0.04 },
      cacheMiss: { idle: 1.00, peak: 2.00 },
      output:    { idle: 4.00, peak: 8.00 },
    },
    pricePro: {                    // 质量档备选，用于敏感度（约 3~5 倍成本）
      cacheHit:  { idle: 0.15, peak: 0.30 },
      cacheMiss: { idle: 4.50, peak: 9.00 },
      output:    { idle: 13.50, peak: 27.00 },
    },
  },

  // —— 单次 AI 调用的 token 用量 [假设，来自产品事实：1.5k–3k 输入、0.5k–3k 输出] ——
  tokenUsage: {
    fullResume: { input: 3000, output: 3000, points: 2 }, // 整份生成 / 整份润色 = 2 点
    section:    { input: 1500, output: 500,  points: 1 }, // 单段润色 / 技能 / 自我评价 / 对照 JD = 1 点
  },

  // —— 每 100 点消耗的调用构成 [假设] ——
  // 20 次整份（40 点）+ 60 次单段（60 点）= 100 点
  usageMixPer100Points: { fullResumeCalls: 20, sectionCalls: 60 },

  // —— 点数套餐（产品事实，不可改）——
  packages: [
    { id: 'trial',  name: '体验包', price: 9.9,  points: 12,  validityDays: 90,  mix: 0.55, tag: '' },
    { id: 'job',    name: '求职包', price: 29.9, points: 45,  validityDays: 180, mix: 0.35, tag: '最划算' },
    { id: 'sprint', name: '冲刺包', price: 69,   points: 120, validityDays: 365, mix: 0.10, tag: '' },
  ],

  // —— 每日免费额度与消耗模型 [假设] ——
  // 每日 5 点（Asia/Shanghai 00:00 重置，不累积、不可转移）= 产品事实
  freeQuota: {
    pointsPerDay: 5,
    activeAiUserShare: 0.35,        // 当月真正调用过 AI 的 MAU 占比
    callsPerActiveUserPerMonth: 5,  // 活跃者月均调用次数
    pointsPerCall: 1.6,             // 平均每次调用消耗点数（2 点与 1 点的加权）
    freeCoverageShare: 0.75,        // 75% 的调用被每日免费额度覆盖（其余由购买点数支付）
  },

  // —— 支付渠道 [已验证 2026-10-24] ——
  // 面包多Pay: https://doc.mbd.pub/untitled  2% + ¥0.1/笔（<¥0.5 免服务费）
  // 爱发电:    https://guide.afdian.com/faq/faq-for-creators  6%（1% 通道 + 5% 平台）
  // 微信支付:  https://kf.qq.com/touch/sappfaq/220420FbQjaQ220420Eruu2y.html  个体户/企业 0.6%，T+1
  payment: {
    channels: [
      { id: 'mbd',    name: '面包多Pay',       pct: 0.02,  fixed: 0.10, note: '2% + ¥0.1/笔' },
      { id: 'afdian', name: '爱发电',          pct: 0.06,  fixed: 0.00, note: '6% 全包' },
      { id: 'direct', name: '微信/支付宝直连', pct: 0.006, fixed: 0.00, note: '0.6%（以签约页为准）' },
    ],
    defaultChannel: 'mbd',
  },

  // —— 退款与复购 [假设] ——
  refundRate: 0.03,                 // 退款率（按订单金额）
  repeat: {
    ordersPerPayerPerMonth: 1.15,   // 当月付费用户人均订单数（含升级/复购）
    lifetimeOrdersPerPayer: 1.6,    // 生命周期内人均订单数（求职周期 1–3 个月）
    newPayerShare: 0.65,            // 当月付费用户中首次付费占比（决定 CAC 计提）
  },

  // —— 获客成本 [假设] ——
  acquisition: { cacPerNewPayer: 10 },

  // —— 税费 [政策已核实，适用性为假设] ——
  // 增值税：月销售额 10 万元以下免征，执行至 2027-12-31
  //   https://www.gov.cn/zhengce/zhengceku/202308/content_6896287.htm（财政部 税务总局公告2023年第19号）
  // 所得税：小型微利企业实际税负按 5% 估算（应纳税所得额 ≤300 万，[假设] 未单独核实文件）
  tax: { vatRate: 0, incomeTaxRate: 0.05 },

  // —— 固定成本（元/月）[假设，2026-10 价格] ——
  // Neon: https://neon.com/pricing  Free $0（100 CU-hrs/项目、1GB）/ Launch 典型 $15/月
  // Vercel Pro $20/月 ≈ ¥143，取整 ¥150（Hobby 不允许商用）
  fixedCost: {
    domain: 7,                      // .com 约 ¥75/年
    vercelPro: 150,                 // [假设] $20/月 × 7.15
    storageBase: 10,                // 对象存储基础
    storagePerMau: 0.002,           // 存储随 MAU 增长
    neonTiers: [                    // [假设] 按 MAU 档位取 Neon 套餐
      { maxMau: 500,     cost: 0 },   // Free
      { maxMau: 5000,    cost: 110 }, // Launch $15/月
      { maxMau: Infinity, cost: 400 },// 更高用量
    ],
    sms: { costPerNewUser: 0.03, newUserShare: 0.2 }, // 短信验证码 ¥0.03/条（[假设]）
    accounting: 200,                // 代理记账/合规
    supportTiers: [
      { maxMau: 1000,    cost: 0 },
      { maxMau: 5000,    cost: 300 },
      { maxMau: Infinity, cost: 1500 },
    ],
    contentFixed: 100,              // 内容/SEO 固定投入
    contentPerMau: 0.05,            // 内容投入随规模增长
    misc: 60,                       // 监控/工具/字体授权等
  },

  // —— 规模测算档位（产品/任务要求）——
  scale: { mau: [100, 1000, 10000], conversion: [0.015, 0.03, 0.05] },

  // —— 敏感度分析基准点 ——
  sensitivityBase: { mau: 3000, conversion: 0.03 },

  // —— 免费额度被薅羊毛的极限情形：每人每天用满 5 点 ——
  abuseWorstCasePointsPerMau: 5 * 30,

  // —— 来源清单（全部为本次实际访问过的页面，核实日期 2026-10-24）——
  sources: {
    deepseekPricing: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    mbdPayFee: 'https://doc.mbd.pub/untitled',
    afdianFee: 'https://guide.afdian.com/faq/faq-for-creators',
    wechatPayFee: 'https://kf.qq.com/touch/sappfaq/220420FbQjaQ220420Eruu2y.html',
    neonPricing: 'https://neon.com/pricing',
    vatExemption: 'https://www.gov.cn/zhengce/zhengceku/202308/content_6896287.htm',
    prepaidCardRule: 'https://www.gov.cn/zhengce/2012-09/21/content_5712346.htm',
    icpRule: 'http://xzfg.moj.gov.cn/front/law/detail?LawID=1756',
    pipl: 'http://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html',
  },
};

/* ============================================================================
 * 工具函数
 * ==========================================================================*/
const yuan = (n, d = 2) =>
  Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;
const num = (n, d = 2) => Number(n).toFixed(d);

const dispWidth = (s) =>
  [...String(s)].reduce(
    (a, c) => a + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(c) ? 2 : 1),
    0,
  );
const pad = (s, n, align = 'left') => {
  const fill = ' '.repeat(Math.max(0, n - dispWidth(s)));
  return align === 'right' ? fill + s : s + fill;
};

function table(title, headers, rows, aligns = []) {
  const widths = headers.map((h, i) =>
    Math.max(dispWidth(h), ...rows.map((r) => dispWidth(r[i] ?? ''))),
  );
  const line = (cells) =>
    cells.map((c, i) => pad(String(c ?? ''), widths[i], aligns[i] || 'left')).join('  ');
  const out = [];
  out.push('');
  out.push(`### ${title}`);
  out.push(line(headers));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) out.push(line(r));
  return out.join('\n');
}

/* ============================================================================
 * 1. DeepSeek 单价与单次调用成本
 * ==========================================================================*/
function blendedUnitPrice(price) {
  const { peakShare: p, cacheHitShare: h } = CONFIG.deepseek;
  const avg = (o) => o.idle * (1 - p) + o.peak * p;
  const hit = avg(price.cacheHit);
  const miss = avg(price.cacheMiss);
  const out = avg(price.output);
  return {
    hit, miss, out,
    input: h * hit + (1 - h) * miss, // 综合输入单价（元/百万 tokens）
  };
}

function callCost(usage, price) {
  const u = blendedUnitPrice(price);
  const inputCost = (usage.input * u.input) / 1e6;
  const outputCost = (usage.output * u.out) / 1e6;
  const raw = inputCost + outputCost;
  return {
    inputCost,
    outputCost,
    raw,
    withRetry: raw * CONFIG.deepseek.retryFactor,
    perPoint: (raw * CONFIG.deepseek.retryFactor) / usage.points,
  };
}

const P = {
  flash: blendedUnitPrice(CONFIG.deepseek.priceFlash),
  pro: blendedUnitPrice(CONFIG.deepseek.pricePro),
};
const fullFlash = callCost(CONFIG.tokenUsage.fullResume, CONFIG.deepseek.priceFlash);
const secFlash = callCost(CONFIG.tokenUsage.section, CONFIG.deepseek.priceFlash);
const fullPro = callCost(CONFIG.tokenUsage.fullResume, CONFIG.deepseek.pricePro);
const secPro = callCost(CONFIG.tokenUsage.section, CONFIG.deepseek.pricePro);

/** 每 100 点消耗的 token 成本（含重试冗余），返回总额与每点成本 */
function pointsCost(pointsCalls) {
  const m = CONFIG.usageMixPer100Points;
  const total = m.fullResumeCalls * pointsCalls.full.withRetry + m.sectionCalls * pointsCalls.section.withRetry;
  const points = m.fullResumeCalls * CONFIG.tokenUsage.fullResume.points + m.sectionCalls * CONFIG.tokenUsage.section.points;
  return { total, points, perPoint: total / points };
}
const ptsFlash = pointsCost({ full: fullFlash, section: secFlash });
const ptsPro = pointsCost({ full: fullPro, section: secPro });
const modelMultiplier = ptsPro.perPoint / ptsFlash.perPoint;

/* ============================================================================
 * 2. 套餐单位经济学
 * ==========================================================================*/
function channelById(id) {
  return CONFIG.payment.channels.find((c) => c.id === id) || CONFIG.payment.channels[0];
}
function payFee(amount, ch) {
  if (amount < 0.5) return 0; // 面包多Pay：<¥0.5 免服务费
  return amount * ch.pct + ch.fixed;
}
function packageEcon(pkg, channelId = CONFIG.payment.defaultChannel) {
  const ch = channelById(channelId);
  const tokenCost = pkg.points * ptsFlash.perPoint;
  const fee = payFee(pkg.price, ch);
  const variableCost = tokenCost + fee;
  const gross = pkg.price - variableCost;
  return {
    ...pkg,
    channel: ch.name,
    pricePerPoint: pkg.price / pkg.points,
    tokenCost,
    fee,
    effectiveFeeRate: fee / pkg.price,
    variableCost,
    gross,
    grossMargin: gross / pkg.price,
    grossPerPoint: gross / pkg.points,
  };
}
const pkgEcon = CONFIG.packages.map((p) => packageEcon(p));
const ARPP = CONFIG.packages.reduce((a, p) => a + p.price * p.mix, 0);         // 客单价（人民币）
const avgPointsPerOrder = CONFIG.packages.reduce((a, p) => a + p.points * p.mix, 0);
const avgTokenCostPerOrder = avgPointsPerOrder * ptsFlash.perPoint;
const avgFeePerOrder = payFee(ARPP, channelById(CONFIG.payment.defaultChannel));
const contributionPerOrder = ARPP - avgTokenCostPerOrder - avgFeePerOrder;
const grossMarginAvg = contributionPerOrder / ARPP;

/* ============================================================================
 * 3. 免费额度成本
 * ==========================================================================*/
const fq = CONFIG.freeQuota;
const freePointsPerMauMonth =
  fq.activeAiUserShare * fq.callsPerActiveUserPerMonth * fq.pointsPerCall * fq.freeCoverageShare;
const freeCostPerMauMonth = freePointsPerMauMonth * ptsFlash.perPoint;

/* ============================================================================
 * 4. 固定成本
 * ==========================================================================*/
function pickTier(tiers, mau) {
  return tiers.find((t) => mau <= t.maxMau).cost;
}
function fixedCostMonthly(mau) {
  const f = CONFIG.fixedCost;
  const neon = pickTier(f.neonTiers, mau);
  const support = pickTier(f.supportTiers, mau);
  const sms = f.sms.costPerNewUser * mau * f.sms.newUserShare;
  const storage = f.storageBase + f.storagePerMau * mau;
  const content = f.contentFixed + f.contentPerMau * mau;
  const items = [
    { name: '域名', cost: f.domain },
    { name: '托管（Vercel Pro）', cost: f.vercelPro },
    { name: 'Neon Postgres/Auth', cost: neon },
    { name: '对象存储', cost: storage },
    { name: '短信验证码', cost: sms },
    { name: '代理记账/合规', cost: f.accounting },
    { name: '客服/运营支持', cost: support },
    { name: '内容与 SEO', cost: content },
    { name: '杂项工具', cost: f.misc },
  ];
  return { items, total: items.reduce((a, i) => a + i.cost, 0) };
}

/* ============================================================================
 * 5. 月度损益（核心模型）
 * ==========================================================================*/
function monthPnl(opts = {}) {
  const o = {
    mau: CONFIG.sensitivityBase.mau,
    conversion: CONFIG.sensitivityBase.conversion,
    channelId: CONFIG.payment.defaultChannel,
    refundRate: CONFIG.refundRate,
    tokenCostPerPoint: ptsFlash.perPoint,
    freePointsPerMauMonth,
    cacPerNewPayer: CONFIG.acquisition.cacPerNewPayer,
    fixedMultiplier: 1,
    ordersPerPayer: CONFIG.repeat.ordersPerPayerPerMonth,
    arpp: ARPP,
    newPayerShare: CONFIG.repeat.newPayerShare,
    ...opts,
  };
  const payers = o.mau * o.conversion;
  const orders = payers * o.ordersPerPayer;
  const grossRevenue = orders * o.arpp;
  const revenue = grossRevenue * (1 - o.refundRate);
  const ch = channelById(o.channelId);

  const aiPaidCost = orders * avgPointsPerOrder * o.tokenCostPerPoint;
  const aiFreeCost = o.mau * o.freePointsPerMauMonth * o.tokenCostPerPoint;
  const paymentFees = orders * payFee(o.arpp, ch); // 退款不退还手续费，按全额计提
  const cac = payers * o.newPayerShare * o.cacPerNewPayer;
  const variableCost = aiPaidCost + aiFreeCost + paymentFees + cac;

  const fixed = fixedCostMonthly(o.mau).total * o.fixedMultiplier;
  const pretax = revenue - variableCost - fixed;
  const incomeTax = Math.max(0, pretax) * CONFIG.tax.incomeTaxRate;
  const net = pretax - incomeTax;

  return {
    ...o,
    payers, orders, grossRevenue, revenue,
    aiPaidCost, aiFreeCost, paymentFees, cac,
    variableCost, fixed, pretax, incomeTax, net,
    netMargin: revenue > 0 ? net / revenue : 0,
  };
}

/* ============================================================================
 * 6. LTV / CAC / 回本
 * ==========================================================================*/
const ltv = ARPP * CONFIG.repeat.lifetimeOrdersPerPayer * grossMarginAvg;
const cac = CONFIG.acquisition.cacPerNewPayer;
const firstOrderGross = ARPP * grossMarginAvg;
const paybackOrders = cac / firstOrderGross;

/* ============================================================================
 * 7. 盈亏平衡（含随 MAU 变化的固定成本与 CAC，二分求解）
 * ==========================================================================*/
function breakevenMau(conversion) {
  const f = (mau) => monthPnl({ mau, conversion }).pretax;
  let lo = 10, hi = 200000;
  if (f(hi) < 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  const mau = hi;
  return { mau, payers: mau * conversion, revenue: monthPnl({ mau, conversion }).revenue };
}

/* ============================================================================
 * 输出
 * ==========================================================================*/
const OUT = [];
const push = (s = '') => OUT.push(s);

push('中国简历工具 · AI 点数计费｜单位经济学测算');
push(`时间基准 ${CONFIG.meta.asOf}（Asia/Shanghai）｜币种 ${CONFIG.meta.currency}｜模型 ${CONFIG.deepseek.model}`);
push(CONFIG.meta.note);

/* —— 1. DeepSeek 单价 —— */
push(table(
  '1. DeepSeek 单价（元/百万 tokens，官方 2026-10-24 抓取）',
  ['项目', '空闲时段', '高峰时段', '加权均价', '说明'],
  [
    ['缓存命中输入', num(CONFIG.deepseek.priceFlash.cacheHit.idle, 2), num(CONFIG.deepseek.priceFlash.cacheHit.peak, 2), num(P.flash.hit, 4), `命中率假设 ${pct(CONFIG.deepseek.cacheHitShare, 0)}`],
    ['缓存未命中输入', num(CONFIG.deepseek.priceFlash.cacheMiss.idle, 2), num(CONFIG.deepseek.priceFlash.cacheMiss.peak, 2), num(P.flash.miss, 4), ''],
    ['输出', num(CONFIG.deepseek.priceFlash.output.idle, 2), num(CONFIG.deepseek.priceFlash.output.peak, 2), num(P.flash.out, 4), ''],
    ['综合输入（含缓存）', '—', '—', num(P.flash.input, 4), `高峰占比假设 ${pct(CONFIG.deepseek.peakShare, 0)}`],
  ],
  ['left', 'right', 'right', 'right', 'left'],
));

push(table(
  '2. 单次 AI 调用 token 成本（deepseek-flash，含 15% 重试冗余）',
  ['场景', '点数', '输入tokens', '输出tokens', '纯成本(元)', '含重试(元)', '每点成本(元)'],
  [
    ['整份生成/整份润色', '2', String(CONFIG.tokenUsage.fullResume.input), String(CONFIG.tokenUsage.fullResume.output), num(fullFlash.raw, 5), num(fullFlash.withRetry, 5), num(fullFlash.perPoint, 5)],
    ['单段润色/技能/JD改写', '1', String(CONFIG.tokenUsage.section.input), String(CONFIG.tokenUsage.section.output), num(secFlash.raw, 5), num(secFlash.withRetry, 5), num(secFlash.perPoint, 5)],
    ['加权（每100点构成）', '100', '—', '—', num(ptsFlash.total / CONFIG.deepseek.retryFactor, 4), num(ptsFlash.total, 4), num(ptsFlash.perPoint, 5)],
    ['同口径 deepseek-v4-pro', '100', '—', '—', '—', num(ptsPro.total, 4), num(ptsPro.perPoint, 5)],
  ],
  ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
));
push(`  → 生产用 deepseek-flash 的每点 token 成本 ≈ ¥${num(ptsFlash.perPoint, 4)}；换 v4-pro 约为 ${num(modelMultiplier, 2)} 倍（¥${num(ptsPro.perPoint, 4)}/点）。`);

/* —— 2. 套餐单位经济 —— */
push(table(
  '3. 三档套餐单位经济学（支付渠道：面包多Pay 2% + ¥0.1/笔）',
  ['套餐', '价格(元)', '点数', '元/点', '点数成本(元)', '支付费(元)', '变动成本(元)', '毛利(元)', '毛利率', '每点毛利(元)'],
  pkgEcon.map((p) => [
    p.name + (p.tag ? `（${p.tag}）` : ''),
    num(p.price, 1), String(p.points), num(p.pricePerPoint, 3),
    num(p.tokenCost, 4), num(p.fee, 3), num(p.variableCost, 4), num(p.gross, 2), pct(p.grossMargin), num(p.grossPerPoint, 3),
  ]),
  ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
));

push(table(
  '4. 支付渠道对套餐毛利的影响（毛利率）',
  ['套餐', '面包多Pay(2%+0.1)', '爱发电(6%)', '官方直连(0.6%)', '直连 vs 面包多 毛利差(元/单)'],
  pkgEcon.map((p) => {
    const a = packageEcon(p, 'mbd'), b = packageEcon(p, 'afdian'), c = packageEcon(p, 'direct');
    return [p.name, pct(a.grossMargin), pct(b.grossMargin), pct(c.grossMargin), num(c.gross - a.gross, 2)];
  }),
  ['left', 'right', 'right', 'right', 'right'],
));

push('');
push(`  加权客单价 ARPP = ¥${num(ARPP, 2)}｜平均每单点数 = ${num(avgPointsPerOrder, 2)} 点｜每单 token 成本 = ¥${num(avgTokenCostPerOrder, 4)}｜每单支付费 = ¥${num(avgFeePerOrder, 3)}`);
push(`  每单贡献毛利 = ¥${num(contributionPerOrder, 2)}｜加权毛利率 = ${pct(grossMarginAvg, 1)}`);

/* —— 3. 成本结构 —— */
const fixed100 = fixedCostMonthly(100);
const fixed1k = fixedCostMonthly(1000);
const fixed10k = fixedCostMonthly(10000);
push(table(
  '5. 月度固定成本结构（元/月，按 MAU 档位）',
  ['项目', 'MAU 100', 'MAU 1,000', 'MAU 10,000', '说明'],
  [
    ...fixed100.items.map((it, i) => [
      it.name,
      num(it.cost, 2),
      num(fixed1k.items[i].cost, 2),
      num(fixed10k.items[i].cost, 2),
      i === 0 ? '域名摊销' : i === 2 ? 'Neon Free/Launch/更高' : i === 6 ? '客服按档位' : '',
    ]),
    ['合计', num(fixed100.total, 2), num(fixed1k.total, 2), num(fixed10k.total, 2), ''],
  ],
  ['left', 'right', 'right', 'right', 'left'],
));
push(`  免费额度成本：人均每月消耗 ${num(freePointsPerMauMonth, 2)} 点 → ¥${num(freeCostPerMauMonth, 4)}/MAU/月；` +
  `10,000 MAU 时 ≈ ¥${num(freeCostPerMauMonth * 10000, 2)}/月。`);

/* —— 4. 三档规模测算 —— */
{
  const rows = [];
  for (const mau of CONFIG.scale.mau) {
    for (const conv of CONFIG.scale.conversion) {
      const p = monthPnl({ mau, conversion: conv });
      rows.push([
        String(mau), pct(conv, 1), num(p.payers, 1), num(p.orders, 1),
        num(p.grossRevenue, 0), num(p.variableCost, 0), num(p.fixed, 0),
        num(p.pretax, 0), pct(p.netMargin, 1),
      ]);
    }
  }
  push(table(
    '6. 三档规模 × 转化率 月度损益（元/月；含 3% 退款率、CAC ¥10、面包多Pay）',
    ['MAU', '付费转化率', '月付费用户', '月订单', '毛收入', '变动成本', '固定成本', '税前利润', '净利率'],
    rows,
    ['right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  ));
  const base1k3 = monthPnl({ mau: 1000, conversion: 0.03 });
  push(`  变动成本拆分（1,000 MAU / 3%）：点数成本 ¥${num(base1k3.aiPaidCost + base1k3.aiFreeCost, 2)}（其中免费额度 ¥${num(base1k3.aiFreeCost, 2)}）` +
    `、支付手续费 ¥${num(base1k3.paymentFees, 2)}、获客 ¥${num(base1k3.cac, 2)}。`);
}

/* —— 5. LTV / CAC / 回本 —— */
push(table(
  '7. LTV / CAC / 回本周期',
  ['指标', '数值', '说明'],
  [
    ['客单价 ARPP', `¥${num(ARPP, 2)}`, '按 55/35/10 套餐结构加权'],
    ['加权毛利率', pct(grossMarginAvg, 1), '含 token + 支付手续费'],
    ['生命周期订单数', num(CONFIG.repeat.lifetimeOrdersPerPayer, 2), '[假设] 求职周期内 1.6 单'],
    ['LTV（毛利口径）', `¥${num(ltv, 2)}`, 'ARPP × 终身订单数 × 毛利率'],
    ['CAC', `¥${num(cac, 2)}`, '[假设] 小红书/知乎/校招社群获客'],
    ['LTV / CAC', num(ltv / cac, 2), '健康线 ≥3'],
    ['首单毛利', `¥${num(firstOrderGross, 2)}`, ''],
    ['回本（订单数）', num(paybackOrders, 2), 'CAC ÷ 首单毛利；<1 表示首单即回本'],
  ],
  ['left', 'left', 'left'],
));

/* —— 6. 敏感度 —— */
{
  const base = monthPnl({ ...CONFIG.sensitivityBase });
  const rows = [];
  const add = (label, p) => {
    rows.push([
      label, num(p.revenue, 0), num(p.variableCost, 0), num(p.fixed, 0),
      num(p.pretax, 0), pct(p.netMargin, 1), num(p.pretax - base.pretax, 0),
    ]);
  };
  add(`基准（${CONFIG.sensitivityBase.mau} MAU / ${pct(CONFIG.sensitivityBase.conversion, 0)} / 面包多 2%+0.1 / 退款 3%）`, base);

  // 支付渠道
  for (const ch of CONFIG.payment.channels) add(`支付渠道：${ch.name}（${ch.note}）`, monthPnl({ channelId: ch.id }));
  // 退款率
  for (const r of [0, 0.03, 0.08, 0.15]) add(`退款率 ${pct(r, 0)}`, monthPnl({ refundRate: r }));
  // 转化率
  for (const c of [0.01, 0.015, 0.03, 0.05, 0.08]) add(`付费转化率 ${pct(c, 1)}`, monthPnl({ conversion: c }));
  // token 用量 / 模型
  for (const m of [0.5, 1, 1.5, 2]) add(`token 用量 ×${m}（flash）`, monthPnl({ tokenCostPerPoint: ptsFlash.perPoint * m }));
  add(`模型换成 v4-pro（×${num(modelMultiplier, 2)}）`, monthPnl({ tokenCostPerPoint: ptsPro.perPoint }));
  // 免费额度消耗
  for (const m of [0.5, 1, 2, 5]) add(`免费额度消耗 ×${m}（${num(freePointsPerMauMonth * m, 1)} 点/MAU/月）`, monthPnl({ freePointsPerMauMonth: freePointsPerMauMonth * m }));
  add(`免费额度极限（${CONFIG.abuseWorstCasePointsPerMau} 点/MAU/月，人人用满）`, monthPnl({ freePointsPerMauMonth: CONFIG.abuseWorstCasePointsPerMau }));
  // CAC
  for (const c of [0, 5, 10, 20, 30]) add(`CAC ¥${c}`, monthPnl({ cacPerNewPayer: c }));
  // 固定成本
  for (const f of [0.7, 1, 1.3]) add(`固定成本 ×${f}`, monthPnl({ fixedMultiplier: f }));

  push(table(
    `8. 敏感度分析（基准 ${CONFIG.sensitivityBase.mau} MAU / ${pct(CONFIG.sensitivityBase.conversion, 0)}）`,
    ['情景', '毛收入', '变动成本', '固定成本', '税前利润', '净利率', '利润变化'],
    rows,
    ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
  ));
}

/* —— 7. 盈亏平衡 —— */
{
  const rows = [];
  for (const c of CONFIG.scale.conversion) {
    const be = breakevenMau(c);
    if (!be) { rows.push([pct(c, 1), '不可达（超额亏损）', '—', '—']); continue; }
    rows.push([pct(c, 1), num(be.mau, 0), num(be.payers, 0), num(be.revenue, 0)]);
  }
  push(table(
    '9. 盈亏平衡（按 MAU 档位固定成本 + CAC 动态求解）',
    ['付费转化率', '保本 MAU', '保本月付费用户', '保本月收入(元)'],
    rows,
    ['right', 'right', 'right', 'right'],
  ));
  const be3 = breakevenMau(0.03);
  if (be3) {
    const contribPerPayer = ARPP * CONFIG.repeat.ordersPerPayerPerMonth * grossMarginAvg
      - CONFIG.repeat.newPayerShare * cac;
    push(`  → 3% 转化下保本约 ${num(be3.mau, 0)} MAU / ${num(be3.payers, 0)} 付费用户 / ¥${num(be3.revenue, 0)} 月收入；` +
      `单付费用户月贡献毛利约 ¥${num(contribPerPayer, 2)}（已扣 CAC）。`);
    push('  注：固定成本随 MAU 档位跳变（Neon/客服档位），保本点呈台阶状，上方取保守值。');
  }
}

/* —— 8. 免费额度滥用上限 —— */
{
  const maxCost = CONFIG.abuseWorstCasePointsPerMau * ptsFlash.perPoint;
  const base = monthPnl({ ...CONFIG.sensitivityBase });
  const big = monthPnl({ mau: 10000, conversion: 0.05 });
  push('');
  push('### 10. 免费额度上限成本（最坏情形：MAU 人人每天用满 5 点）');
  push(`  单 MAU 月成本 = ${CONFIG.abuseWorstCasePointsPerMau} 点 × ¥${num(ptsFlash.perPoint, 4)} = ¥${num(maxCost, 2)}`);
  push(`  ${CONFIG.sensitivityBase.mau} MAU → ¥${num(maxCost * CONFIG.sensitivityBase.mau, 0)}/月，是基准毛收入（¥${num(base.revenue, 0)}）的 ${num(maxCost * CONFIG.sensitivityBase.mau / base.revenue, 2)} 倍；`);
  push(`  10,000 MAU → ¥${num(maxCost * 10000, 0)}/月，可吞掉 10,000 MAU / 5% 转化情景的全部利润（¥${num(big.net, 0)}）。`);
}

/* —— 9. 定价空间：毛利率下限反推最低售价 —— */
{
  const ch = channelById(CONFIG.payment.defaultChannel);
  const targetGM = 0.90;
  const floorPrice = (pkg) => (pkg.points * ptsFlash.perPoint + ch.fixed) / (1 - targetGM - ch.pct);
  push('');
  push(table(
    `11. 定价空间表（目标毛利率 ${pct(targetGM, 0)} 下限；渠道：${ch.name}）`,
    ['套餐', '现价(元)', '每点售价(元)', '每点 token 成本(元)', '售价/成本 倍数', `达 ${pct(targetGM, 0)} 毛利最低价(元)`, '现价安全垫'],
    pkgEcon.map((p) => {
      const floor = floorPrice(p);
      return [
        p.name, num(p.price, 1), num(p.pricePerPoint, 3), num(ptsFlash.perPoint, 4),
        num(p.pricePerPoint / ptsFlash.perPoint, 1) + 'x', num(floor, 2), `${num((p.price / floor - 1) * 100, 0)}%`,
      ];
    }),
    ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
  ));
  push('  → 成本极低，价格对成本几乎不敏感：定价应锚定「一份简历对求职者的价值」，而不是 token 成本；');
  push('    降价空间大，但无必要——低价换不来等比例的转化，反而压缩 LTV。');
}

/* —— 10. 结论摘要 —— */
{
  const rec = {
    grossMargin: grossMarginAvg,
    perOrder: contributionPerOrder,
    be3: breakevenMau(0.03),
  };
  push('');
  push('### 12. 结论摘要');
  push(`  · 生产毛利：三档套餐毛利率 ${pct(Math.min(...pkgEcon.map((p) => p.grossMargin)), 1)}–${pct(Math.max(...pkgEcon.map((p) => p.grossMargin)), 1)}，加权 ${pct(rec.grossMargin, 1)}；每单贡献 ¥${num(rec.perOrder, 2)}。`);
  push(`  · 成本主项不是 token，而是 支付手续费 + 获客 + 固定成本；token 成本仅占客单价 ${pct(avgTokenCostPerOrder / ARPP, 2)}，一份简历的 AI 成本约 ¥${num(fullFlash.withRetry, 4)}。`);
  push(`  · 3% 转化下保本约 ${rec.be3 ? num(rec.be3.mau, 0) : '—'} MAU / ${rec.be3 ? num(rec.be3.payers, 0) : '—'} 付费用户。`);
  push(`  · 建议目标毛利率 ≥ ${pct(0.9, 0)}，关键动作：支付直连降费、控制 CAC、收紧免费额度滥用。`);
}

/* ============================================================================
 * 文件输出
 * ==========================================================================*/
const args = new Set(process.argv.slice(2));
const csvLines = [];
const CSV = (a, b, c = '', d = '') => csvLines.push([a, b, c, d].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));

CSV('section', 'item', 'value', 'unit');
CSV('meta', 'asOf', CONFIG.meta.asOf, 'date');
CSV('meta', 'usdCny', CONFIG.meta.usdCny, 'CNY/USD');
CSV('deepseek', 'input_price_blended', num(P.flash.input, 4), 'CNY/M tokens');
CSV('deepseek', 'output_price_blended', num(P.flash.out, 4), 'CNY/M tokens');
CSV('deepseek', 'cost_per_full_resume_call', num(fullFlash.withRetry, 5), 'CNY');
CSV('deepseek', 'cost_per_section_call', num(secFlash.withRetry, 5), 'CNY');
CSV('point', 'token_cost_per_point_flash', num(ptsFlash.perPoint, 5), 'CNY/point');
CSV('point', 'token_cost_per_point_pro', num(ptsPro.perPoint, 5), 'CNY/point');
CSV('point', 'free_points_per_mau_month', num(freePointsPerMauMonth, 2), 'points');
CSV('point', 'free_cost_per_mau_month', num(freeCostPerMauMonth, 4), 'CNY');
CSV('package', 'arpp', num(ARPP, 2), 'CNY/order');
CSV('package', 'avg_points_per_order', num(avgPointsPerOrder, 2), 'points');
CSV('package', 'gross_margin_weighted', num(grossMarginAvg, 4), 'ratio');
CSV('package', 'contribution_per_order', num(contributionPerOrder, 2), 'CNY');
for (const p of pkgEcon) {
  CSV('package', `${p.name}_price`, num(p.price, 1), 'CNY');
  CSV('package', `${p.name}_points`, p.points, 'points');
  CSV('package', `${p.name}_price_per_point`, num(p.pricePerPoint, 3), 'CNY/point');
  CSV('package', `${p.name}_gross`, num(p.gross, 2), 'CNY');
  CSV('package', `${p.name}_gross_margin`, num(p.grossMargin, 4), 'ratio');
}
CSV('ltv', 'ltv_gross_margin_basis', num(ltv, 2), 'CNY');
CSV('ltv', 'cac', num(cac, 2), 'CNY');
CSV('ltv', 'ltv_cac_ratio', num(ltv / cac, 2), 'ratio');
CSV('ltv', 'payback_orders', num(paybackOrders, 2), 'orders');
CSV('fixed', 'cost_mau_100', num(fixed100.total, 2), 'CNY/month');
CSV('fixed', 'cost_mau_1000', num(fixed1k.total, 2), 'CNY/month');
CSV('fixed', 'cost_mau_10000', num(fixed10k.total, 2), 'CNY/month');
for (const mau of CONFIG.scale.mau) {
  for (const conv of CONFIG.scale.conversion) {
    const p = monthPnl({ mau, conversion: conv });
    const tag = `mau_${mau}_conv_${(conv * 100).toFixed(1)}`;
    CSV('scale', `${tag}_revenue`, num(p.revenue, 0), 'CNY/month');
    CSV('scale', `${tag}_variable_cost`, num(p.variableCost, 0), 'CNY/month');
    CSV('scale', `${tag}_fixed_cost`, num(p.fixed, 0), 'CNY/month');
    CSV('scale', `${tag}_pretax_profit`, num(p.pretax, 0), 'CNY/month');
    CSV('scale', `${tag}_net_margin`, num(p.netMargin, 4), 'ratio');
  }
}
for (const c of CONFIG.scale.conversion) {
  const be = breakevenMau(c);
  CSV('breakeven', `mau_at_conv_${(c * 100).toFixed(1)}`, be ? num(be.mau, 0) : 'n/a', 'MAU');
}
CSV('abuse', 'worst_case_cost_per_mau_month', num(CONFIG.abuseWorstCasePointsPerMau * ptsFlash.perPoint, 2), 'CNY');

if (args.has('--csv')) {
  const p = resolve(ROOT, 'docs/pricing/unit-economics.csv');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, csvLines.join('\n') + '\n', 'utf8');
  if (!args.has('--quiet')) console.log(`\n[写出] ${p}`);
}
if (args.has('--json')) {
  const p = resolve(ROOT, 'docs/pricing/assumptions.json');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(CONFIG, null, 2) + '\n', 'utf8');
  if (!args.has('--quiet')) console.log(`[写出] ${p}`);
}

if (!args.has('--quiet')) console.log(OUT.join('\n'));

export { CONFIG };
