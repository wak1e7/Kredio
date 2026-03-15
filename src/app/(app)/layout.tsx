import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
