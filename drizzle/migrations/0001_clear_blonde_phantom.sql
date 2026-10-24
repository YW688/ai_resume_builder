CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"resume_id" uuid NOT NULL,
	"stage" text DEFAULT 'applied' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_step" text,
	"next_at" timestamp with time zone,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"salary" text,
	"source" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"jd_text" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"kind" text DEFAULT 'plan' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_fen" integer DEFAULT 0 NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"target_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"cities" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary" text,
	"job_type" text,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"auto_keyword_check" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "target_job_id" uuid;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "template_id" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "accent" text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "target_role" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "joined_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_price_fen" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_id_applied_at_idx" ON "applications" USING btree ("user_id","applied_at");--> statement-breakpoint
CREATE INDEX "applications_resume_id_idx" ON "applications" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "jobs_user_id_saved_at_idx" ON "jobs" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_at_idx" ON "notifications" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "orders_user_id_at_idx" ON "orders" USING btree ("user_id","at");--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_target_job_id_jobs_id_fk" FOREIGN KEY ("target_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resumes_user_id_updated_at_idx" ON "resumes" USING btree ("user_id","updated_at");