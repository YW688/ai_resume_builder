import { Suspense } from "react";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumes } from "@/drizzle/schema";
import { getUserId } from "@/lib/dal";
import { getUsage } from "@/lib/quota";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata = { robots: { index: false, follow: false } };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-zinc-500">加载中…</div>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const list = await db.query.resumes.findMany({
    where: eq(resumes.userId, userId),
    orderBy: [desc(resumes.updatedAt)],
  });
  const usage = await getUsage(userId);

  return (
    <DashboardView
      resumes={list.map((r) => ({
        id: r.id,
        title: r.title,
        updatedAt: r.updatedAt.toISOString(),
      }))}
      usage={usage}
    />
  );
}
