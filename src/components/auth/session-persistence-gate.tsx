"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

const SESSION_MARKER_KEY = "kredio.active-browser-session";
const SESSION_EXEMPT_ROUTES = new Set(["/auth/update-password"]);

export function SessionPersistenceGate() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function syncSessionLifetime() {
      if (SESSION_EXEMPT_ROUTES.has(pathname)) {
        return;
      }

      const hasActiveBrowserMarker = window.sessionStorage.getItem(SESSION_MARKER_KEY) === "1";
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (session && !hasActiveBrowserMarker) {
        await supabase.auth.signOut();

        if (!cancelled) {
          router.replace("/login");
          router.refresh();
        }
      }
    }

    syncSessionLifetime().catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (SESSION_EXEMPT_ROUTES.has(pathname)) {
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        window.sessionStorage.removeItem(SESSION_MARKER_KEY);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  return null;
}
