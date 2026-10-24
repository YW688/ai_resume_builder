// Read-only Postgres inspector: lists public tables, columns and row counts.
// Usage: node scripts/db/inspect.mjs
// Uses the direct (unpooled) connection; never prints the connection string.
import { neon } from "@neondatabase/serverless";
import { loadEnv, directDatabaseUrl } from "./env.mjs";

loadEnv();
const sql = neon(directDatabaseUrl());

const tables = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`;

if (tables.length === 0) {
  console.log("public schema has no tables");
} else {
  console.log("public tables:", tables.map((t) => t.table_name).join(", "));
  console.log("");
  for (const { table_name: name } of tables) {
    const columns = await sql`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = ${name}
      order by ordinal_position
    `;
    const [count] = await sql`
      select count(*)::int as n from ${sql.unsafe(`"public"."${name}"`)}
    `;
    console.log(`## ${name} (rows=${count.n})`);
    console.log(
      columns
        .map(
          (c) =>
            `  - ${c.column_name} ${c.data_type}${c.is_nullable === "NO" ? " not null" : ""}${c.column_default ? ` default ${c.column_default}` : ""}`,
        )
        .join("\n"),
    );
    console.log("");
  }
}

const migrations = await sql`
  select table_schema, table_name
  from information_schema.tables
  where table_name = '__drizzle_migrations'
`;
if (migrations.length > 0) {
  const applied = await sql`
    select id, hash, created_at
    from drizzle.__drizzle_migrations
    order by id
  `;
  console.log("drizzle.__drizzle_migrations:", applied.length, "applied");
  for (const m of applied) {
    console.log(`  - id=${m.id} created_at=${m.created_at}`);
  }
} else {
  console.log("drizzle.__drizzle_migrations: not present");
}
