import { redirect } from "next/navigation";

export const metadata = { robots: { index: false, follow: false } };

/** 旧的 /settings 已并入产品工作台。 */
export default function LegacySettingsPage() {
  redirect("/dashboard/settings");
}
