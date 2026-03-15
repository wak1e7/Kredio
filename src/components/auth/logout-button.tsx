"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isLoading, setIsLoading] = useState(false);

  async function onLogout() {
    setIsLoading(true);
    await supabase.auth.signOut();
    setIsLoading(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={isLoading}
      className="inline-flex h-10 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      {isLoading ? "Saliendo..." : "Salir"}
    </button>
  );
}
