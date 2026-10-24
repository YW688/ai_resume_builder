import type { Metadata } from "next";

import {
  LegalDocument,
  type LegalDocumentData,
} from "@/components/legal/LegalDocument";
import privacyData from "@/data/legal/privacy.json";

export const metadata: Metadata = {
  title: "隐私政策 — AI 简历编辑器",
  description:
    "我们收集哪些信息、如何使用与共享、存储地点与跨境传输、保存期限、安全措施，以及你如何行使个人信息权利。",
};

const doc = privacyData as unknown as LegalDocumentData;

export default function PrivacyPage() {
  return <LegalDocument doc={doc} />;
}
