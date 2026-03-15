"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

export function RegisterAdminForm() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [fullName, setFullName] = useState("Administrador Kredio");
  const [businessName, setBusinessName] = useState("Kredio Business");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
          business_name: businessName,
        },
      },
    });

    if (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({ fullName, businessName }) });
      setIsLoading(false);
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setIsLoading(false);
    setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso.");
  }

  return (
    <div className="kredio-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-[var(--surface)] p-6 shadow-[0_2px_12px_rgba(14,30,55,0.04)] md:p-7">
        <div className="mb-6 text-center">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-lg font-bold text-white">
            K
          </span>
          <h1 className="mt-3 text-2xl font-semibold">Crear cuenta administrador</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">Registra el usuario propietario de tu negocio.</p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Nombre del administrador"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Nombre del negocio"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            required
          />
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          {errorMessage ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creando..." : "Crear administrador"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="font-semibold text-[var(--accent)]">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
