"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CustomerRow = {
  id: string;
  fullName: string;
  phone: string;
  documentId?: string | null;
  address?: string | null;
  email?: string | null;
  notes?: string | null;
  status: "ACTIVE" | "INACTIVE";
  totalDebt: number;
  createdAt: string;
};

type FilterMode = "all" | "withDebt" | "withoutDebt" | "inactive";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});
const CUSTOMERS_PER_PAGE = 20;

export default function ClientesPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setEditingCustomerId(null);
    setFullName("");
    setPhone("");
    setDocumentId("");
    setAddress("");
    setEmail("");
    setNotes("");
  }

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (filterMode === "withDebt") {
      params.set("debtMode", "with");
    }

    if (filterMode === "withoutDebt") {
      params.set("debtMode", "without");
    }

    if (filterMode === "inactive") {
      params.set("status", "INACTIVE");
    }

    return params;
  }, [filterMode, query]);

  const loadCustomers = useCallback(async (params: URLSearchParams, retrySeed = true) => {
    setError(null);
    setIsLoading(true);

    let hasRetriedSeed = false;

    while (true) {
      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as { data?: CustomerRow[]; error?: string };

      if (!response.ok) {
        if (response.status === 404 && retrySeed && !hasRetriedSeed) {
          hasRetriedSeed = true;
          await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
          continue;
        }

        setError(json.error ?? "No se pudo cargar clientes.");
        setIsLoading(false);
        return;
      }

      setCustomers(json.data ?? []);
      setCurrentPage(1);
      setIsLoading(false);
      return;
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCustomers(queryParams);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadCustomers, queryParams]);

  async function onSubmitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const isEditing = Boolean(editingCustomerId);
    const response = await fetch(isEditing ? `/api/customers/${editingCustomerId}` : "/api/customers", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        documentId: documentId || undefined,
        address: address || undefined,
        email: email || undefined,
        notes: notes || undefined,
      }),
    });

    const json = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? `No se pudo ${isEditing ? "actualizar" : "crear"} el cliente.`);
      return;
    }

    resetForm();
    setShowCreateForm(false);
    await loadCustomers(queryParams);
  }

  function onEditCustomer(customer: CustomerRow) {
    setEditingCustomerId(customer.id);
    setFullName(customer.fullName);
    setPhone(customer.phone);
    setDocumentId(customer.documentId ?? "");
    setAddress(customer.address ?? "");
    setEmail(customer.email ?? "");
    setNotes(customer.notes ?? "");
    setShowCreateForm(true);
    setError(null);
  }

  async function onToggleCustomerStatus(customer: CustomerRow) {
    setError(null);
    setUpdatingCustomerId(customer.id);

    const nextStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const response = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const json = (await response.json()) as { error?: string };
    setUpdatingCustomerId(null);

    if (!response.ok) {
      setError(json.error ?? "No se pudo actualizar el estado del cliente.");
      return;
    }

    await loadCustomers(queryParams, false);
  }

  const totalPages = Math.max(1, Math.ceil(customers.length / CUSTOMERS_PER_PAGE));
  const paginatedCustomers = customers.slice(
    (currentPage - 1) * CUSTOMERS_PER_PAGE,
    currentPage * CUSTOMERS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Módulo de clientes"
        title="Clientes"
        description="Registro, búsqueda y seguimiento de deuda por cliente."
        actions={
          <button
            type="button"
            onClick={() => {
              if (showCreateForm) {
                setShowCreateForm(false);
                resetForm();
                return;
              }

              resetForm();
              setShowCreateForm(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cerrar formulario" : "Nuevo cliente"}
          </button>
        }
      />

      {showCreateForm ? (
        <Panel delay={150}>
          <h2 className="text-lg font-semibold">{editingCustomerId ? "Editar cliente" : "Crear cliente"}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onSubmitCustomer}>
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="Nombre completo *"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                placeholder="Teléfono *"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="Documento (opcional)"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            />
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              placeholder="Correo (opcional)"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm md:col-span-2"
                placeholder="Dirección (opcional)"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <textarea
              className="min-h-24 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm md:col-span-2"
              placeholder="Observaciones (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
            >
              {isSaving ? "Guardando..." : editingCustomerId ? "Actualizar cliente" : "Guardar cliente"}
            </button>
            {editingCustomerId ? (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                className="h-10 rounded-xl border px-4 text-sm font-semibold md:col-span-2 md:w-fit"
              >
                Cancelar edición
              </button>
            ) : null}
          </form>
        </Panel>
      ) : null}

      <Panel delay={180}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className="sr-only">Buscar cliente</span>
            <span className="flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--foreground-muted)]" />
              <input
                placeholder="Buscar por nombre o teléfono..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--foreground-muted)]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>
          <select
            className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value as FilterMode)}
          >
            <option value="all">Todos</option>
            <option value="withDebt">Con deuda</option>
            <option value="withoutDebt">Sin deuda</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </Panel>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      ) : null}

      <Panel delay={240}>
        {isLoading ? (
          <p className="text-sm text-[var(--foreground-muted)]">Cargando clientes...</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">No hay clientes para mostrar con el filtro actual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Nombre</th>
                  <th className="pb-2 font-semibold">Teléfono</th>
                  <th className="pb-2 font-semibold">Deuda total</th>
                  <th className="pb-2 font-semibold">Registro</th>
                  <th className="pb-2 font-semibold">Estado</th>
                  <th className="pb-2 font-semibold">Acciones</th>
                  <th className="pb-2 font-semibold">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 font-medium">{customer.fullName}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">{customer.phone}</td>
                    <td className="py-3">{currencyFormatter.format(customer.totalDebt)}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {new Date(customer.createdAt).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-3">
                      <span
                        className={
                          customer.status === "ACTIVE"
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600"
                            : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500"
                        }
                      >
                        {customer.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditCustomer(customer)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCustomerStatus(customer)}
                          disabled={updatingCustomerId === customer.id}
                          className={
                            customer.status === "ACTIVE"
                              ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          }
                        >
                          {updatingCustomerId === customer.id
                            ? "Actualizando..."
                            : customer.status === "ACTIVE"
                              ? "Desactivar"
                              : "Activar"}
                        </button>
                      </div>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
              onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
