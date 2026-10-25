import type { Metadata } from "next";

import {
  LegalDocument,
  type LegalDocumentData,
} from "@/components/legal/LegalDocument";
import termsData from "@/data/legal/terms.json";

export const metadata: Metadata = {
  title: "用户服务条款 — AI 简历编辑器",
  description:
    "使用 AI 简历编辑器的规则：服务范围、账号、用户内容、AI 输出、点数与付费、使用规范、责任与争议解决。",
};

const doc = termsData as unknown as LegalDocumentData;

export default function TermsPage() {
  return <LegalDocument doc={doc} />;
}
