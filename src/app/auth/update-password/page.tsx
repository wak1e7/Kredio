"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (updateError) {
      setError("No se pudo actualizar la contraseña.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="kredio-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-[var(--surface)] p-6 shadow-[0_2px_12px_rgba(14,30,55,0.04)] md:p-7">
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">Define tu nueva contraseña para recuperar el acceso.</p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Nueva contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Confirmar contraseña"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
