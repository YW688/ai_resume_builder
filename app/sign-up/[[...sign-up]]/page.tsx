import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { readRedirect } from "@/lib/auth/redirect";
import { auth } from "@/lib/auth/server";

export const metadata = { robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

/** 读 session / searchParams 属于请求时数据，放进 Suspense 边界内流式渲染（Cache Components 约定）。 */
async function SignUpContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const redirectTo = readRedirect(await searchParams);

  const { data: session } = await auth.getSession();
  if (session?.user) redirect(redirectTo);

  return <SignUpForm redirectUrl={redirectTo} />;
}

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <AuthShell
      title="创建账号"
      subtitle="用邮箱注册，免费开始制作你的第一份简历。"
      footer={
        <p className="leading-relaxed">
          注册即表示同意
          <Link href="/privacy" className="mx-0.5 text-[#1A6BD6] hover:underline">
            《隐私政策》
          </Link>
          。密码由 Neon Auth 托管，本应用不存储明文密码。
        </p>
      }
    >
      <Suspense fallback={<SignUpForm redirectUrl="/dashboard" />}>
        <SignUpContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
