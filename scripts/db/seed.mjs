// Idempotent demo-data seeder.
//
// Usage:
//   node scripts/db/seed.mjs --user-id <id> [--email <email>] [--name <name>]
//   node scripts/db/seed.mjs <id>
//
// Copies lib/mock/data.ts#initialWorkspace into Postgres for one user:
// remaps demo string ids (r1/j1/e1/...) to deterministic UUIDs so the seed can
// be re-run safely, clears that user's workspace rows (users ON DELETE cascade),
// then writes everything back in one transaction.
//
// Uses the direct (unpooled) connection; never prints the connection string.
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { ROOT, loadEnv, directDatabaseUrl } from "./env.mjs";

loadEnv();

const { initialWorkspace } = await import(
  pathToFileURL(path.join(ROOT, "lib", "mock", "data.ts")).href
);

// ---- args -----------------------------------------------------------------
function parseArgs(argv) {
  const out = { userId: null, email: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--user-id" || arg === "--userId") {
      out.userId = argv[++i] ?? null;
    } else if (arg === "--email") {
      out.email = argv[++i] ?? null;
    } else if (arg === "--name") {
      out.name = argv[++i] ?? null;
    } else if (!arg.startsWith("-") && !out.userId) {
      out.userId = arg;
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        "usage: node scripts/db/seed.mjs --user-id <id> [--email <email>] [--name <name>]",
      );
      process.exit(0);
    }
  }
  return out;
}

const { userId, email, name } = parseArgs(process.argv.slice(2));
if (!userId || !userId.trim()) {
  console.error(
    "missing --user-id\nusage: node scripts/db/seed.mjs --user-id <id> [--email <email>] [--name <name>]",
  );
  process.exit(1);
}

// ---- deterministic uuid v5 (no extra dependency) --------------------------
const NAMESPACE = "6f1a4f5e-8c2b-4d3e-9a70-2b5c8d1e4f60";

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes) {
  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function uuidv5(value) {
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([uuidToBytes(NAMESPACE), Buffer.from(value, "utf8")]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash.subarray(0, 16));
}

const workspace = initialWorkspace;
const uid = userId.trim();
const demoUser = workspace.user;
const demoPlan = workspace.plan;

const userEmail = email ?? demoUser.email;
const userName = name ?? demoUser.name;

const ids = {
  job: (mockId) => uuidv5(`${uid}|job|${mockId}`),
  resume: (mockId) => uuidv5(`${uid}|resume|${mockId}`),
  experience: (resumeMockId, mockId) =>
    uuidv5(`${uid}|resume|${resumeMockId}|experience|${mockId}`),
  education: (resumeMockId, mockId) =>
    uuidv5(`${uid}|resume|${resumeMockId}|education|${mockId}`),
  application: (mockId) => uuidv5(`${uid}|application|${mockId}`),
  notification: (mockId) => uuidv5(`${uid}|notification|${mockId}`),
  order: (mockId) => uuidv5(`${uid}|order|${mockId}`),
};

const ts = (value) => (value ? new Date(value) : null);

// ---- build one transaction ------------------------------------------------
const sql = neon(directDatabaseUrl());
const queries = [];

// 1. Clear this user's workspace (all child tables cascade from users).
queries.push(sql`delete from users where id = ${uid}`);

// 2. User row: plan + usage + profile.
queries.push(sql`
  insert into users (
    id, email, name, phone, city, target_role, joined_at,
    plan, plan_name, plan_started_at, plan_expires_at, plan_price_fen, auto_renew,
    ai_used, export_used, created_at
  ) values (
    ${uid}, ${userEmail}, ${userName}, ${demoUser.phone}, ${demoUser.city},
    ${demoUser.targetRole}, ${ts(demoUser.joinedAt)},
    'paid', ${demoPlan.name}, ${ts(demoPlan.startedAt)}, ${ts(demoPlan.expiresAt)},
    ${demoPlan.priceFen}, ${demoPlan.autoRenew},
    ${demoPlan.usage.aiRewrites}, ${demoPlan.usage.exports}, ${ts(demoUser.joinedAt)}
  )
`);

// 3. Preferences (one row per user).
queries.push(sql`
  insert into preferences (
    user_id, target_roles, cities, salary, job_type, weekly_digest, auto_keyword_check
  ) values (
    ${uid}, ${workspace.preferences.targetRoles}, ${workspace.preferences.cities},
    ${workspace.preferences.salary}, ${workspace.preferences.jobType},
    ${workspace.preferences.weeklyDigest}, ${workspace.preferences.autoKeywordCheck}
  )
`);

// 4. Jobs (saved postings).
workspace.jobs.forEach((job, index) => {
  queries.push(sql`
    insert into jobs (
      id, user_id, company, title, location, salary, source, saved_at,
      keywords, jd_text, sort_order
    ) values (
      ${ids.job(job.id)}, ${uid}, ${job.company}, ${job.title}, ${job.location},
      ${job.salary}, ${job.source}, ${ts(job.savedAt)},
      ${job.keywords}, ${job.jdText}, ${index}
    )
  `);
});

// 5. Resumes + experiences + educations.
workspace.resumes.forEach((resume, index) => {
  const resumeId = ids.resume(resume.id);
  queries.push(sql`
    insert into resumes (
      id, user_id, target_job_id, title, full_name, phone, email, city, summary,
      skills, photo_key, template_id, accent, status, created_at, updated_at
    ) values (
      ${resumeId}, ${uid},
      ${resume.targetJobId ? ids.job(resume.targetJobId) : null},
      ${resume.title}, ${resume.fullName}, ${resume.phone}, ${resume.email},
      ${resume.city}, ${resume.summary},
      ${resume.skills.join("\n")}, null,
      ${resume.templateId}, ${resume.accent}, ${resume.status},
      ${ts(resume.createdAt)}, ${ts(resume.updatedAt)}
    )
  `);

  resume.experiences.forEach((experience, expIndex) => {
    queries.push(sql`
      insert into experiences (
        id, resume_id, company, title, start_date, end_date, description, sort_order
      ) values (
        ${ids.experience(resume.id, experience.id)}, ${resumeId},
        ${experience.company}, ${experience.title}, ${experience.startDate},
        ${experience.endDate}, ${experience.description}, ${expIndex}
      )
    `);
  });

  resume.educations.forEach((education, eduIndex) => {
    queries.push(sql`
      insert into educations (
        id, resume_id, school, degree, major, start_date, end_date, sort_order
      ) values (
        ${ids.education(resume.id, education.id)}, ${resumeId},
        ${education.school}, ${education.degree}, ${education.major},
        ${education.startDate}, ${education.endDate}, ${eduIndex}
      )
    `);
  });

  // demo array order is already newest-first; keep an index for traceability
  void index;
});

// 6. Applications (reference the remapped resume id).
workspace.applications.forEach((application, index) => {
  const appliedAt = ts(application.appliedAt);
  queries.push(sql`
    insert into applications (
      id, user_id, company, role, resume_id, stage, applied_at,
      next_step, next_at, note, sort_order, updated_at, created_at
    ) values (
      ${ids.application(application.id)}, ${uid}, ${application.company},
      ${application.role}, ${ids.resume(application.resumeId)}, ${application.stage},
      ${appliedAt}, ${application.nextStep ?? null}, ${ts(application.nextAt) ?? null},
      ${application.note ?? null}, ${index}, ${appliedAt}, ${appliedAt}
    )
  `);
});

// 7. Notifications.
workspace.notifications.forEach((notification, index) => {
  queries.push(sql`
    insert into notifications (
      id, user_id, title, body, at, read, kind, sort_order, created_at
    ) values (
      ${ids.notification(notification.id)}, ${uid}, ${notification.title},
      ${notification.body}, ${ts(notification.at)}, ${notification.read},
      ${notification.kind}, ${index}, ${ts(notification.at)}
    )
  `);
});

// 8. Orders (plan purchase history).
demoPlan.orders.forEach((order, index) => {
  queries.push(sql`
    insert into orders (
      id, user_id, at, amount_fen, label, status, sort_order, created_at
    ) values (
      ${ids.order(order.id)}, ${uid}, ${ts(order.at)}, ${order.amountFen},
      ${order.label}, ${order.status}, ${index}, ${ts(order.at)}
    )
  `);
});

// ---- execute --------------------------------------------------------------
const startedAt = Date.now();
await sql.transaction(queries);
const elapsed = Date.now() - startedAt;

// ---- verify ---------------------------------------------------------------
const counts = {};
// experiences/educations have no user_id column; count them via their resume.
const countQueries = {
  users: sql`select count(*)::int as n from users where id = ${uid}`,
  preferences: sql`select count(*)::int as n from preferences where user_id = ${uid}`,
  jobs: sql`select count(*)::int as n from jobs where user_id = ${uid}`,
  resumes: sql`select count(*)::int as n from resumes where user_id = ${uid}`,
  experiences: sql`
    select count(*)::int as n from experiences e
    join resumes r on r.id = e.resume_id where r.user_id = ${uid}
  `,
  educations: sql`
    select count(*)::int as n from educations e
    join resumes r on r.id = e.resume_id where r.user_id = ${uid}
  `,
  applications: sql`select count(*)::int as n from applications where user_id = ${uid}`,
  notifications: sql`select count(*)::int as n from notifications where user_id = ${uid}`,
  orders: sql`select count(*)::int as n from orders where user_id = ${uid}`,
};
for (const [table, query] of Object.entries(countQueries)) {
  const [row] = await query;
  counts[table] = row.n;
}

const [orphans] = await sql`
  select count(*)::int as n
  from applications a
  left join resumes r on r.id = a.resume_id
  where a.user_id = ${uid} and r.id is null
`;
const [badTargets] = await sql`
  select count(*)::int as n
  from resumes r
  left join jobs j on j.id = r.target_job_id
  where r.user_id = ${uid} and r.target_job_id is not null and j.id is null
`;

const [dbCheck] = await sql`
  select current_database() as db, current_user as role,
         (select count(*)::int from drizzle.__drizzle_migrations) as migrations
`;

console.log(`seed ok for user ${uid} in ${elapsed}ms`);
console.log(`database=${dbCheck.db} role=${dbCheck.role} migrations=${dbCheck.migrations}`);
console.log("row counts:");
for (const [table, n] of Object.entries(counts)) {
  console.log(`  ${table}: ${n}`);
}
console.log(`applications with dangling resume_id: ${orphans.n}`);
console.log(`resumes with dangling target_job_id: ${badTargets.n}`);

if (
  counts.users !== 1 ||
  counts.preferences !== 1 ||
  counts.jobs < 1 ||
  counts.resumes < 1 ||
  counts.applications < 1 ||
  counts.notifications < 1 ||
  orphans.n !== 0 ||
  badTargets.n !== 0
) {
  console.error("seed verification failed");
  process.exit(1);
}
