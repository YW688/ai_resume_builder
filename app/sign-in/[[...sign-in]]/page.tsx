import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { readRedirect } from "@/lib/auth/redirect";
import { auth } from "@/lib/auth/server";

export const metadata = { robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

/** 读 session / searchParams 属于请求时数据，放进 Suspense 边界内流式渲染（Cache Components 约定）。 */
async function SignInContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const redirectTo = readRedirect(await searchParams);

  const { data: session } = await auth.getSession();
  if (session?.user) redirect(redirectTo);

  return <SignInForm redirectUrl={redirectTo} />;
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <AuthShell
      title="登录"
      subtitle="使用邮箱和密码，继续你的求职工作台。"
      footer={
        <p className="leading-relaxed">
          注册后简历、目标岗位与投递记录都会保存在账号下。继续即表示同意
          <Link href="/privacy" className="mx-0.5 text-[#1A6BD6] hover:underline">
            《隐私政策》
          </Link>
          。
        </p>
      }
    >
      <Suspense fallback={<SignInForm redirectUrl="/dashboard" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
