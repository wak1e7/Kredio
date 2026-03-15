"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

const SESSION_MARKER_KEY = "kredio.active-browser-session";
const SESSION_LAST_ACTIVITY_KEY = "kredio.last-activity-at";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage("Credenciales incorrectas. Verifica tu correo y contraseña.");
      return;
    }

    window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
    window.sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
    await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="kredio-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-[var(--surface)] p-6 shadow-[0_2px_12px_rgba(14,30,55,0.04)] md:p-7">
        <div className="mb-6 text-center">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-lg font-bold text-white">
            K
          </span>
          <h1 className="mt-3 text-2xl font-semibold">Ingresar a Kredio</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Gestiona tus ventas a crédito de forma simple y segura.
          </p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
              Correo electrónico
            </span>
            <input
              className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="correo@negocio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
              Contraseña
            </span>
            <input
              className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="********"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/recuperar-acceso" className="font-semibold text-[var(--accent)]">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  );
}
