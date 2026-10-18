import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  // Clerk userId
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  // "free" | "paid"，由 Lemon Squeezy webhook 维护
  plan: text("plan").notNull().default("free"),
  aiUsed: integer("ai_used").notNull().default(0),
  exportUsed: integer("export_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
export type Resume = typeof resumes.$inferSelect;
export type Experience = typeof experiences.$inferSelect;
export type Education = typeof educations.$inferSelect;
