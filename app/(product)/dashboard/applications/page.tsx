import type { Metadata } from "next";
import { ApplicationsScreen } from "@/components/applications/ApplicationsScreen";

export const metadata: Metadata = {
  title: "投递追踪 — 简历编辑器",
  description: "记录每一次投递、阶段与下一步时间，自动统计漏斗和近期面试。",
};

export default function ApplicationsPage() {
  return <ApplicationsScreen />;
}
