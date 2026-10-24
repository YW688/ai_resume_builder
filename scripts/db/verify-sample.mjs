// Seed verification: reads the demo workspace back through the **pooled**
// application connection and prints representative rows.
// Usage: node scripts/db/verify-sample.mjs [--user-id seed-user-e2e]
import { neon } from "@neondatabase/serverless";
import { loadEnv, pooledDatabaseUrl, directDatabaseUrl } from "./env.mjs";

loadEnv();

const argv = process.argv.slice(2);
const index = argv.indexOf("--user-id");
const uid = index >= 0 ? argv[index + 1] : argv[0] || "seed-user-e2e";

const pooled = pooledDatabaseUrl();
const direct = directDatabaseUrl();
console.log("connection: pooled url has -pooler:", /-pooler\./.test(pooled));
console.log("connection: direct url has -pooler:", /-pooler\./.test(direct));

const sql = neon(pooled); // 应用流量走 pooled
const [user] = await sql`
  select id, name, email, phone, city, target_role, plan, plan_name,
         plan_started_at, plan_expires_at, plan_price_fen, auto_renew,
         ai_used, export_used, joined_at
  from users where id = ${uid}
`;
console.log("\nuser:", JSON.stringify(user, null, 2));

const jobs = await sql`
  select company, title, location, salary, source, saved_at,
         array_length(keywords, 1) as keyword_count, length(jd_text) as jd_len
  from jobs where user_id = ${uid} order by saved_at desc
`;
console.log("\njobs:", jobs.length);
for (const job of jobs) console.log(" ", JSON.stringify(job));

const resumes = await sql`
  select r.title, r.template_id, r.accent, r.status, r.skills,
         j.company as target_company, j.title as target_title
  from resumes r left join jobs j on j.id = r.target_job_id
  where r.user_id = ${uid} order by r.created_at
`;
console.log("\nresumes:", resumes.length);
for (const resume of resumes) {
  console.log(
    " ",
    JSON.stringify({
      title: resume.title,
      template_id: resume.template_id,
      accent: resume.accent,
      status: resume.status,
      skills: resume.skills.split("\n"),
      target: resume.target_company
        ? `${resume.target_company} / ${resume.target_title}`
        : null,
    }),
  );
}

const apps = await sql`
  select a.company, a.role, a.stage, a.applied_at, a.next_step, a.next_at,
         a.note, r.title as resume_title
  from applications a join resumes r on r.id = a.resume_id
  where a.user_id = ${uid} order by a.applied_at desc
`;
console.log("\napplications:", apps.length, "(first 3)");
for (const app of apps.slice(0, 3)) console.log(" ", JSON.stringify(app));

const [prefs] = await sql`
  select target_roles, cities, salary, job_type, weekly_digest, auto_keyword_check
  from preferences where user_id = ${uid}
`;
console.log("\npreferences:", JSON.stringify(prefs));

const notifs = await sql`
  select title, read, kind, at from notifications
  where user_id = ${uid} order by at desc
`;
console.log("\nnotifications:", notifs.length);
for (const notification of notifs) console.log(" ", JSON.stringify(notification));

const orders = await sql`
  select at, amount_fen, label, status from orders
  where user_id = ${uid} order by at desc
`;
console.log("\norders:", orders.length);
for (const order of orders) console.log(" ", JSON.stringify(order));
