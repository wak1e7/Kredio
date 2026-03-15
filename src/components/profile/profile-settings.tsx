"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";

type ProfileResponse = {
  data?: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
  };
  error?: string;
};

export function ProfileSettings() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/profile", { cache: "no-store" });
      const json = (await response.json()) as ProfileResponse;

      if (cancelled) return;

      if (!response.ok) {
        setError(json.error ?? "No se pudo cargar el perfil.");
        setIsLoading(false);
        return;
      }

      setFullName(json.data?.fullName ?? "");
      setEmail(json.data?.email ?? "");
      setPhone(json.data?.phone ?? "");
      setIsLoading(false);
    }

    loadProfile().catch(() => {
      if (!cancelled) {
        setError("No se pudo cargar el perfil.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProfileMessage(null);
    setPasswordMessage(null);

    if (fullName.trim().length < 2) {
      setError("Ingresa un nombre valido.");
      return;
    }

    setIsSavingProfile(true);

    const authResult = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone: phone.trim(),
      },
    });

    if (authResult.error) {
      setIsSavingProfile(false);
      setError(authResult.error.message);
      return;
    }

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.trim() }),
    });
    const json = (await response.json()) as ProfileResponse;

    setIsSavingProfile(false);

    if (!response.ok) {
      setError(json.error ?? "No se pudo actualizar el perfil.");
      return;
    }

    setFullName(json.data?.fullName ?? fullName.trim());
    setEmail(json.data?.email ?? email);
    setPhone(phone.trim());
    setProfileMessage("Perfil actualizado correctamente.");
    window.dispatchEvent(
      new CustomEvent("kredio:profile-updated", {
        detail: {
          fullName: json.data?.fullName ?? fullName.trim(),
          email: json.data?.email ?? email,
        },
      }),
    );
  }

  async function onSavePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProfileMessage(null);
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setError("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La confirmacion de contrasena no coincide.");
      return;
    }

    setIsSavingPassword(true);
    const result = await supabase.auth.updateUser({ password: newPassword });
    setIsSavingPassword(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Contrasena actualizada correctamente.");
  }

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Cuenta de usuario"
        title="Perfil"
        description="Aqui puedes ver y actualizar tu nombre, numero y contrasena."
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel delay={180}>
          <h2 className="text-lg font-semibold">Datos de la cuenta</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando perfil...</p>
          ) : (
            <form className="mt-3 grid gap-3" onSubmit={onSaveProfile}>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Nombre</span>
                <input
                  className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Correo</span>
                <input
                  className="h-10 w-full rounded-xl border bg-[var(--surface-muted)] px-3 text-sm text-[var(--foreground-muted)]"
                  value={email}
                  readOnly
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Numero</span>
                <input
                  className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+51 999 888 777"
                />
              </label>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Guardando..." : "Guardar cambios"}
              </button>

              {profileMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {profileMessage}
                </p>
              ) : null}
            </form>
          )}
        </Panel>

        <Panel delay={240}>
          <h2 className="text-lg font-semibold">Seguridad</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">Preparando seguridad...</p>
          ) : (
            <form className="mt-3 grid gap-3" onSubmit={onSavePassword}>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Nueva contrasena</span>
                <input
                  className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimo 6 caracteres"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Confirmar contrasena</span>
                <input
                  className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repite la nueva contrasena"
                />
              </label>

              <button
                type="submit"
                disabled={isSavingPassword}
                className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPassword ? "Actualizando..." : "Cambiar contrasena"}
              </button>

              {passwordMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {passwordMessage}
                </p>
              ) : null}
            </form>
          )}
        </Panel>
      </section>
    </div>
  );
}
