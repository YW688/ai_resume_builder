import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function requireUser(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
