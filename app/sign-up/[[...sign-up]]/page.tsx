import { redirect } from "next/navigation";

export const metadata = { robots: { index: false, follow: false } };

/** 演示版本不实现身份认证：所有入口直接进入工作台。 */
export default function SignUpPage() {
  redirect("/dashboard");
}
