/**
 * AI 点数（额度点）的「唯一事实源」。
 *
 * 这个文件是用户可见的计费规则：客户端组件、服务端 action、文档与
 * 定价脚本都从这里读取点数价格 / 消耗 / 套餐，避免出现两套数字。
 *
 * 计费模型（2026-10 重构，取代旧的「30 天通行证」）：
 * - 所有 AI 能力按「点」计费，PDF 导出免费。
 * - 每个自然日（Asia/Shanghai）有固定的免费点数，先扣每日免费，再扣购买余额。
 * - 套餐为一次性购买，不自动续费；余额在有效期内不过期（到期日见套餐）。
 */

/** 一次 AI 操作的计费定义。 */
export const CREDIT_FEATURES = {
  /** 整份简历 AI 生成 / 整份润色（用户明确要求：一份简历 = 2 点）。 */
  resume_generate: {
    label: "整份简历生成",
    shortLabel: "整份生成",
    cost: 2,
    description: "按目标岗位 JD 生成或重写整份简历（摘要 + 经历 + 技能）。",
  },
  /** 项目/工作经历单段润色。 */
  experience_polish: {
    label: "项目经历润色",
    shortLabel: "经历润色",
    cost: 1,
    description: "把一段项目或工作经历改写成量化、可投递的表达。",
  },
  /** 技能栏润色 / 关键词补充。 */
  skills_polish: {
    label: "技能栏优化",
    shortLabel: "技能优化",
    cost: 1,
    description: "按岗位族与 JD 关键词整理、补充技能栏。",
  },
  /** 自我评价润色。 */
  summary_polish: {
    label: "自我评价润色",
    shortLabel: "评价润色",
    cost: 1,
    description: "生成一段对齐 JD 的个人优势/自我评价。",
  },
  /** 对照 JD 改写单段（旧版「AI 改写」的等价能力）。 */
  jd_rewrite: {
    label: "对照 JD 改写",
    shortLabel: "JD 改写",
    cost: 1,
    description: "对照目标岗位 JD，改写选中的一段经历。",
  },
  /** PDF 导出免费，不扣点。保留定义是为了在 UI 中展示规则。 */
  export_pdf: {
    label: "PDF 导出",
    shortLabel: "导出",
    cost: 0,
    description: "导出 A4 PDF，不限次数，不消耗点数。",
  },
} as const;

export type CreditFeature = keyof typeof CREDIT_FEATURES;

/** 每个自然日（Asia/Shanghai 00:00 重置）赠送的免费点数。 */
export const DAILY_FREE_CREDITS = 5;

/** 点数套餐：一次性购买，不自动续费。 */
export type CreditPackage = {
  id: string;
  name: string;
  /** 实付金额（分），与支付渠道一致。 */
  priceFen: number;
  /** 到账点数。 */
  points: number;
  /** 点数有效期（天）。 */
  validityDays: number;
  /** 一句话卖点。 */
  tagline: string;
  /** 权益列表（用于购买卡片）。 */
  perks: string[];
  /** 是否作为「最划算」推荐档。 */
  recommended?: boolean;
  /** 角标，例如「校招推荐」。 */
  badge?: string;
};

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: "starter",
    name: "体验包",
    priceFen: 990,
    points: 12,
    validityDays: 90,
    tagline: "先试 6 份完整简历，够跑完一轮投递",
    perks: ["12 点点数", "约 6 份整份简历生成", "90 天有效", "不自动续费"],
    badge: "新用户首选",
  },
  {
    id: "jobhunt",
    name: "求职包",
    priceFen: 2990,
    points: 45,
    validityDays: 180,
    tagline: "一次求职季够用，单点成本最低",
    perks: ["45 点点数", "约 22 份整份简历生成", "180 天有效", "不自动续费"],
    recommended: true,
    badge: "最划算",
  },
  {
    id: "sprint",
    name: "冲刺包",
    priceFen: 6900,
    points: 120,
    validityDays: 365,
    tagline: "多版本、多岗位并行投递的长期方案",
    perks: ["120 点点数", "约 60 份整份简历生成", "365 天有效", "不自动续费"],
  },
] as const;

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]["id"];

/** 供 UI 展示的消耗规则（顺序即展示顺序）。 */
export const CREDIT_COST_ROWS: {
  feature: CreditFeature;
  label: string;
  cost: number;
  description: string;
}[] = (
  [
    "resume_generate",
    "experience_polish",
    "skills_polish",
    "summary_polish",
    "jd_rewrite",
    "export_pdf",
  ] as CreditFeature[]
).map((feature) => ({
  feature,
  label: CREDIT_FEATURES[feature].label,
  cost: CREDIT_FEATURES[feature].cost,
  description: CREDIT_FEATURES[feature].description,
}));

/** 客户端可安全使用的点数状态（由服务端 loadWorkspace / action 返回）。 */
export type CreditsState = {
  /** 购买的可用点数（不含每日免费）。 */
  balance: number;
  /** 每日免费额度上限。 */
  dailyFree: number;
  /** 今天已经用掉的每日免费点数。 */
  dailyUsed: number;
  /** 今天还剩的每日免费点数。 */
  dailyRemaining: number;
  /** 下一次每日额度重置时间（ISO，Asia/Shanghai 次日 00:00）。 */
  resetAt: string;
  /** free = 从未购买过；member = 仍在点数有效期内。 */
  plan: "free" | "member";
  /** 购买点数的到期时间（ISO）；无余额时为 null。 */
  expiresAt: string | null;
  /** 服务端状态时间（ISO）。 */
  updatedAt: string;
};

/** 流水记录（设置页「点数明细」用）。 */
export type CreditLedgerEntry = {
  id: string;
  at: string;
  /** 正数为获得，负数为消耗。 */
  delta: number;
  balanceAfter: number;
  kind: "purchase" | "grant" | "spend" | "refund" | "expire";
  feature: CreditFeature | null;
  note: string;
};

/** 一次性换算：这份套餐每点多少钱（分）。 */
export function pointsUnitPriceFen(pkg: CreditPackage): number {
  return pkg.priceFen / pkg.points;
}

/** 折扣百分比（相对体验包单点价），用于 UI 展示「省 X%」。 */
export function packageDiscountPercent(pkg: CreditPackage): number {
  const base = pointsUnitPriceFen(CREDIT_PACKAGES[0]);
  if (pkg.id === CREDIT_PACKAGES[0].id) return 0;
  return Math.round((1 - pointsUnitPriceFen(pkg) / base) * 100);
}

/** 任意 cost 能兑换多少份该能力（向下取整）。 */
export function actionsPerPackage(pkg: CreditPackage, feature: CreditFeature): number {
  const cost = CREDIT_FEATURES[feature].cost;
  return cost > 0 ? Math.floor(pkg.points / cost) : Infinity;
}

/** ¥9.90 / 45 点 之类的展示文本。 */
export function formatPoints(value: number): string {
  return `${value} 点`;
}

export function formatYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : 2)}`;
}

export function getCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === id);
}

export function isCreditPackageId(id: string): id is CreditPackageId {
  return CREDIT_PACKAGES.some((pkg) => pkg.id === id);
}

/** 一句话说明「每日免费额度」规则，UI 与文档共用。 */
export const DAILY_FREE_RULE_TEXT = `每天 ${DAILY_FREE_CREDITS} 点免费额度，北京时间 0 点重置，不累积、不可转赠`;
