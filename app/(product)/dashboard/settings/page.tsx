import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export const metadata: Metadata = {
  title: "设置 — 简历编辑器",
  description: "管理个人资料、求职偏好、点数余额与订单，以及本地演示数据。",
};

export default function SettingsPage() {
  return <SettingsScreen />;
}
