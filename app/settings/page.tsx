import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/dal";
import { getUsage } from "@/lib/quota";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata = { robots: { index: false, follow: false } };

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-zinc-500">加载中…</div>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  const usage = await getUsage(userId);
  return <SettingsView usage={usage} />;
}
