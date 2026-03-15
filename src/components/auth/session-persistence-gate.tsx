"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

const SESSION_MARKER_KEY = "kredio.active-browser-session";
const SESSION_LAST_ACTIVITY_KEY = "kredio.last-activity-at";
const SESSION_EXEMPT_ROUTES = new Set(["/auth/update-password"]);
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function SessionPersistenceGate() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let cancelled = false;
    let idleTimer: number | null = null;

    function clearSessionMarkers() {
      window.sessionStorage.removeItem(SESSION_MARKER_KEY);
      window.sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    }

    async function expireSession() {
      await supabase.auth.signOut();

      if (!cancelled) {
        clearSessionMarkers();
        router.replace("/login");
        router.refresh();
      }
    }

    function getLastActivityAt() {
      const rawValue = window.sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
      const parsedValue = Number(rawValue ?? "0");
      return Number.isFinite(parsedValue) ? parsedValue : 0;
    }

    function recordActivity() {
      window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
      const nextActivityAt = Date.now();
      window.sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(nextActivityAt));
      scheduleIdleTimeout(nextActivityAt);
    }

    function scheduleIdleTimeout(lastActivityAt: number) {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }

      const remainingMs = SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);

      if (remainingMs <= 0) {
        expireSession().catch(() => {});
        return;
      }

      idleTimer = window.setTimeout(() => {
        expireSession().catch(() => {});
      }, remainingMs);
    }

    async function syncSessionLifetime() {
      if (SESSION_EXEMPT_ROUTES.has(pathname)) {
        return;
      }

      const hasActiveBrowserMarker = window.sessionStorage.getItem(SESSION_MARKER_KEY) === "1";
      const lastActivityAt = getLastActivityAt();
      const isSessionStillActive = lastActivityAt > 0 && Date.now() - lastActivityAt <= SESSION_IDLE_TIMEOUT_MS;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (session && (!hasActiveBrowserMarker || !isSessionStillActive)) {
        await expireSession();
        return;
      }

      if (session && isSessionStillActive) {
        scheduleIdleTimeout(lastActivityAt);
      }
    }

    syncSessionLifetime().catch(() => {});

    function handleUserActivity() {
      if (SESSION_EXEMPT_ROUTES.has(pathname)) {
        return;
      }

      recordActivity();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncSessionLifetime().catch(() => {});
      }
    }

    window.addEventListener("pointerdown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (SESSION_EXEMPT_ROUTES.has(pathname)) {
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        clearSessionMarkers();
        return;
      }

      if (event === "SIGNED_IN") {
        recordActivity();
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        const lastActivityAt = getLastActivityAt();
        if (lastActivityAt > 0) {
          scheduleIdleTimeout(lastActivityAt);
        }
      }
    });

    return () => {
      cancelled = true;
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  return null;
}
