import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// users
// Auth 用户 id 来自 Neon Auth（neon_auth.users.id），因此以 text 存储。
// plan / aiUsed / exportUsed 由配额与支付逻辑维护；planName/planStartedAt/
// planExpiresAt/planPriceFen/autoRenew 描述当前通行证的到期信息。
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().default(""),
  name: text("name").notNull().default(""),
  phone: text("phone"),
  city: text("city"),
  targetRole: text("target_role"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  // "free" | "paid"
  plan: text("plan").notNull().default("free"),
  planName: text("plan_name"),
  planStartedAt: timestamp("plan_started_at", { withTimezone: true }),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  planPriceFen: integer("plan_price_fen"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  aiUsed: integer("ai_used").notNull().default(0),
  exportUsed: integer("export_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// jobs —— 用户收藏/粘贴的职位（对应 Job）
// ---------------------------------------------------------------------------
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    salary: text("salary"),
    source: text("source"),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    jdText: text("jd_text").notNull().default(""),
    // 列表展示顺序（种子数据按 demo 数组顺序写入）
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("jobs_user_id_saved_at_idx").on(table.userId, table.savedAt)],
);

// ---------------------------------------------------------------------------
// resumes —— 保留原有列，补充模板/状态/目标岗位
// skills 仍是换行分隔的 text（与 lib/actions.ts 的读写契约一致）
// ---------------------------------------------------------------------------
export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetJobId: uuid("target_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("我的简历"),
    fullName: text("full_name").notNull().default(""),
    phone: text("phone"),
    email: text("email"),
    city: text("city"),
    summary: text("summary"),
    // 换行分隔的技能列表
    skills: text("skills"),
    // Neon Storage 对象 key
    photoKey: text("photo_key"),
    // "classic" | "split" | "compact"
    templateId: text("template_id").notNull().default("classic"),
    // "blue" | "ink" | "green"
    accent: text("accent").notNull().default("blue"),
    // "draft" | "ready" | "applied" | "archived"
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("resumes_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  company: text("company").notNull().default(""),
  title: text("title").notNull().default(""),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const educations = pgTable("educations", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  school: text("school").notNull().default(""),
  degree: text("degree"),
  major: text("major"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// applications —— 投递追踪（对应 Application）
// ---------------------------------------------------------------------------
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    // "applied" | "read" | "interview" | "offer" | "rejected"
    stage: text("stage").notNull().default("applied"),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    nextStep: text("next_step"),
    nextAt: timestamp("next_at", { withTimezone: true }),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("applications_user_id_applied_at_idx").on(
      table.userId,
      table.appliedAt,
    ),
    index("applications_resume_id_idx").on(table.resumeId),
  ],
);

// ---------------------------------------------------------------------------
// notifications —— 站内通知（对应 Notification）
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    read: boolean("read").notNull().default(false),
    // "plan" | "application" | "resume"
    kind: text("kind").notNull().default("plan"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notifications_user_id_at_idx").on(table.userId, table.at)],
);

// ---------------------------------------------------------------------------
// preferences —— 求职偏好（每个用户一行，对应 Preferences）
// ---------------------------------------------------------------------------
export const preferences = pgTable("preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRoles: text("target_roles")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  cities: text("cities")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  salary: text("salary"),
  jobType: text("job_type"),
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  autoKeywordCheck: boolean("auto_keyword_check").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// orders —— 通行证购买记录（对应 Order）
// ---------------------------------------------------------------------------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    amountFen: integer("amount_fen").notNull().default(0),
    label: text("label").notNull().default(""),
    // "paid" | ...
    status: text("status").notNull().default("paid"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("orders_user_id_at_idx").on(table.userId, table.at)],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lsSubscriptionId: text("ls_subscription_id").notNull().unique(),
  lsCustomerId: text("ls_customer_id"),
  // active | cancelled | expired | ...
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const aiRewrites = pgTable("ai_rewrites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, {
    onDelete: "cascade",
  }),
  experienceId: uuid("experience_id").references(() => experiences.id, {
    onDelete: "cascade",
  }),
  jdSnapshot: text("jd_snapshot"),
  prompt: text("prompt"),
  output: text("output"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type Experience = typeof experiences.$inferSelect;
export type Education = typeof educations.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type Order = typeof orders.$inferSelect;
