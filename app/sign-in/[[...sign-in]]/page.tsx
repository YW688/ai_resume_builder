import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { readRedirect } from "@/lib/auth/redirect";
import { auth } from "@/lib/auth/server";

export const metadata = { robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

/** 读 session / searchParams 属于请求时数据，放进 Suspense 边界内流式渲染（Cache Components 约定）。 */
async function SignInContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const redirectTo = readRedirect(await searchParams);

  const { data: session } = await auth.getSession();
  if (session?.user) redirect(redirectTo);

  return <SignInPanel redirectUrl={redirectTo} />;
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <AuthShell
      title="登录"
      subtitle="用邮箱验证码登录；未注册的邮箱会自动创建账号，也可以改用密码登录。"
      footer={
        <p className="leading-relaxed">
          登录后简历、目标岗位与投递记录都会保存在账号下。验证码与账号由 Neon Auth
          托管发送和保存，本应用不存储你的邮箱密码。继续即表示你同意
           <Link
            href="/terms"
            className="mx-0.5 whitespace-nowrap text-[#1A6BD6] hover:underline"
          >
            《用户服务条款》
          </Link>
          与
          <Link
            href="/privacy"
            className="mx-0.5 whitespace-nowrap text-[#1A6BD6] hover:underline"
          >
            《隐私政策》
          </Link>
          。
        </p>
      }
    >
      <Suspense fallback={<SignInPanel redirectUrl="/dashboard" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
