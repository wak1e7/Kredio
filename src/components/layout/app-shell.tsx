"use client";

import { cn } from "@/lib/cn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Archive,
  Bell,
  ChevronDown,
  FileText,
  ReceiptText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Target,
  UserCircle2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  beta?: boolean;
  children?: Array<{
    label: string;
    href: string;
  }>;
};

type NotificationItem = {
  id: string;
  type: "overdue_customer";
  customerId: string;
  customerName: string;
  pendingCampaigns: number;
  totalDebt: number;
  title: string;
  message: string;
};

const SESSION_MARKER_KEY = "kredio.active-browser-session";
const SESSION_LAST_ACTIVITY_KEY = "kredio.last-activity-at";

const mainItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Campañas", href: "/campanas", icon: Target },
  { label: "Compras", href: "/compras", icon: Package },
  { label: "Pagos", href: "/pagos", icon: HandCoins },
  { label: "Gastos", href: "/gastos", icon: ReceiptText },
  { label: "Almacén", href: "/almacen", icon: Archive },
];

const toolItems: NavItem[] = [
  { label: "Reportes", href: "/reportes", icon: FileText },
];

const supportItems: NavItem[] = [
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <section className="space-y-2">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const hasChildren = (item.children?.length ?? 0) > 0;
          const childActive = item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false;
          const isExpanded = hasChildren && (childActive || pathname.startsWith("/reportes"));

          return (
            <li key={`${title}-${item.href}`}>
              <div className="space-y-1">
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    active || childActive
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.beta ? (
                    <span className="ml-auto rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      BETA
                    </span>
                  ) : null}
                  {hasChildren ? <ChevronDown className={cn("ml-auto h-4 w-4 transition", isExpanded ? "rotate-180" : "")} /> : null}
                </Link>

                {hasChildren && isExpanded ? (
                  <ul className="space-y-1 pl-8">
                    {item.children?.map((child) => {
                      const childIsActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex items-center rounded-lg px-3 py-2 text-sm transition",
                              childIsActive
                                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accountName, setAccountName] = useState("Mi cuenta");
  const [accountEmail, setAccountEmail] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }

      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const json = (await response.json()) as {
        data?: {
          fullName: string;
          email: string;
        };
      };

      if (cancelled || !response.ok) {
        return;
      }

      setAccountName(json.data?.fullName?.trim() || "Mi cuenta");
      setAccountEmail(json.data?.email ?? "");
    }

    loadProfile().catch(() => {});

    function handleProfileUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ fullName?: string; email?: string }>;
      setAccountName(customEvent.detail?.fullName?.trim() || "Mi cuenta");
      setAccountEmail(customEvent.detail?.email ?? "");
    }

    window.addEventListener("kredio:profile-updated", handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("kredio:profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const json = (await response.json()) as {
        data?: {
          notifications: NotificationItem[];
        };
      };

      if (cancelled || !response.ok) {
        return;
      }

      setNotifications(json.data?.notifications ?? []);
    }

    loadNotifications().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function onLogout() {
    setIsNotificationsOpen(false);
    setIsAccountMenuOpen(false);
    window.sessionStorage.removeItem(SESSION_MARKER_KEY);
    window.sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace("/login");
    router.refresh();
  }

  const accountInitials = accountName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MK";
  const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[240px_1fr]">
        <aside
          className="animate-fade-up border-b border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 xl:border-r xl:border-b-0"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-white">
              K
            </span>
            <div>
              <p className="font-semibold leading-5">Kredio</p>
              <p className="text-xs text-[var(--foreground-muted)]">Control de crédito</p>
            </div>
          </div>

          <div className="space-y-6">
            <NavSection title="General" items={mainItems} pathname={pathname} />
            <NavSection title="Herramientas" items={toolItems} pathname={pathname} />
            <NavSection title="Soporte" items={supportItems} pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0">
          <header
            className="animate-fade-up relative z-40 flex flex-wrap items-center justify-end gap-3 overflow-visible border-b border-[var(--border)] bg-[var(--surface)] p-3 md:p-4"
            style={{ animationDelay: "110ms" }}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div ref={notificationsRef} className="relative z-50">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen((value) => !value)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--surface)] text-[var(--foreground-muted)]"
                  aria-haspopup="menu"
                  aria-expanded={isNotificationsOpen}
                >
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 ? (
                    <span className="absolute right-2 top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {notifications.length}
                    </span>
                  ) : null}
                </button>
                {isNotificationsOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[320px] rounded-xl border bg-[var(--surface)] p-2 shadow-lg">
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Notificaciones</p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        Recordatorios de clientes con 3 o más campañas pendientes.
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto py-2">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[var(--foreground-muted)]">
                          No hay recordatorios pendientes.
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href={`/clientes/${notification.customerId}`}
                            onClick={() => setIsNotificationsOpen(false)}
                            className="block rounded-lg px-3 py-3 hover:bg-[var(--surface-muted)]"
                          >
                            <p className="text-sm font-semibold text-[var(--foreground)]">{notification.title}</p>
                            <p className="mt-1 text-sm text-[var(--foreground-muted)]">{notification.message}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                              <span>{notification.pendingCampaigns} campañas sin pagar</span>
                              <span>{currencyFormatter.format(notification.totalDebt)}</span>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={accountMenuRef} className="relative z-50">
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((value) => !value)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--surface)] px-3 text-sm"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                    {accountInitials}
                  </span>
                  <span className="max-w-[140px] truncate text-sm font-semibold">{accountName}</span>
                  <ChevronDown
                    className={[
                      "h-4 w-4 text-[var(--foreground-muted)] transition",
                      isAccountMenuOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>
                {isAccountMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-52 rounded-xl border bg-[var(--surface)] p-2 shadow-lg">
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{accountName}</p>
                      <p className="truncate text-xs text-[var(--foreground-muted)]">{accountEmail}</p>
                    </div>
                    <Link
                      href="/perfil"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="mt-2 flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    >
                      <UserCircle2 className="h-4 w-4" />
                      Perfil
                    </Link>
                    <button
                      type="button"
                      onClick={onLogout}
                      disabled={isSigningOut}
                      className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {isSigningOut ? "Saliendo..." : "Cerrar sesión"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="relative z-0 space-y-4 p-3 md:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
