"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

export default function RecuperarAccesoPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setIsLoading(false);

    if (resetError) {
      setError("No se pudo enviar el correo de recuperacion.");
      return;
    }

    setMessage("Te enviamos un enlace para restablecer tu contrasena.");
  }

  return (
    <div className="kredio-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-[var(--surface)] p-6 shadow-[0_2px_12px_rgba(14,30,55,0.04)] md:p-7">
        <h1 className="text-2xl font-semibold">Recuperar acceso</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Ingresa tu correo para enviarte instrucciones de restablecimiento.
        </p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Correo</span>
            <input
              className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="correo@negocio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
            />
          </label>

          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="font-semibold text-[var(--accent)]">
            Volver al inicio de sesion
          </Link>
        </div>
      </div>
    </div>
  );
}
