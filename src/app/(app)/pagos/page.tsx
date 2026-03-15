"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CustomerOption = { id: string; fullName: string };
type CampaignOption = { id: string; name: string };

type PaymentApplication = {
  campaignId: string;
  campaignName: string;
  appliedAmount: number;
};

type PaymentRow = {
  id: string;
  paymentDate: string;
  customerId: string;
  customerName: string;
  amount: number;
  method?: string | null;
  notes?: string | null;
  applications: PaymentApplication[];
};

type AllocationSummary = {
  allocations: Array<{ campaignId: string; appliedAmount: number }>;
  unappliedAmount: number;
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});
const PAYMENTS_PER_PAGE = 10;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function PagosPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [latestAllocation, setLatestAllocation] = useState<AllocationSummary | null>(null);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const [customerId, setCustomerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setEditingPaymentId(null);
    setPaymentDate(toDateInputValue(new Date()));
    setAmount("");
    setMethod("Efectivo");
    setNotes("");
  }

  const loadData = useCallback(async (retrySeed = true) => {
    setError(null);
    setIsLoading(true);

    let hasRetriedSeed = false;

    while (true) {
      const [customersRes, campaignsRes, paymentsRes] = await Promise.all([
        fetch("/api/customers?status=ACTIVE&debtMode=with", { cache: "no-store" }),
        fetch("/api/campaigns", { cache: "no-store" }),
        fetch("/api/payments", { cache: "no-store" }),
      ]);

      if ((customersRes.status === 404 || campaignsRes.status === 404 || paymentsRes.status === 404) && retrySeed && !hasRetriedSeed) {
        hasRetriedSeed = true;
        await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
        continue;
      }

      const customersJson = (await customersRes.json()) as {
        data?: Array<{ id: string; fullName: string }>;
        error?: string;
      };
      const campaignsJson = (await campaignsRes.json()) as {
        data?: CampaignOption[];
        error?: string;
      };
      const paymentsJson = (await paymentsRes.json()) as { data?: PaymentRow[]; error?: string };

      if (!customersRes.ok || !campaignsRes.ok || !paymentsRes.ok) {
        setError(customersJson.error ?? campaignsJson.error ?? paymentsJson.error ?? "No se pudo cargar pagos.");
        setIsLoading(false);
        return;
      }

      const customerData = customersJson.data ?? [];
      setCustomers(customerData);
      setCampaignOptions(campaignsJson.data ?? []);
      setPayments(paymentsJson.data ?? []);
      setCurrentPage(1);

      if (!customerId && customerData[0]) {
        setCustomerId(customerData[0].id);
      }

      setIsLoading(false);
      return;
    }
  }, [customerId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadData]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLatestAllocation(null);

    const parsedAmount = Number(amount);

    if (!customerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Completa cliente y monto correctamente.");
      return;
    }

    setIsSaving(true);
    const isEditing = Boolean(editingPaymentId);

    const response = await fetch(isEditing ? `/api/payments/${editingPaymentId}` : "/api/payments", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        paymentDate: new Date(`${paymentDate}T00:00:00.000Z`).toISOString(),
        amount: parsedAmount,
        method,
        notes: notes || undefined,
      }),
    });

    const json = (await response.json()) as {
      error?: string;
      allocationSummary?: AllocationSummary;
    };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? `No se pudo ${isEditing ? "actualizar" : "registrar"} el pago.`);
      return;
    }

    resetForm();
    setSuccessMessage(isEditing ? "Pago actualizado correctamente." : "Pago registrado correctamente.");
    setLatestAllocation(json.allocationSummary ?? null);
    setShowCreateForm(false);
    await loadData(false);
  }

  const filteredPayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        payment.customerName.toLowerCase().includes(normalizedQuery) ||
        (payment.method ?? "").toLowerCase().includes(normalizedQuery);

      const matchesCampaign =
        campaignFilter === "all" ||
        payment.applications.some((application) => application.campaignId === campaignFilter);

      return matchesQuery && matchesCampaign;
    });
  }, [campaignFilter, payments, query]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAYMENTS_PER_PAGE));
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * PAYMENTS_PER_PAGE,
    currentPage * PAYMENTS_PER_PAGE,
  );

  function onEditPayment(payment: PaymentRow) {
    setEditingPaymentId(payment.id);
    setCustomerId(payment.customerId);
    setPaymentDate(toDateInputValue(new Date(payment.paymentDate)));
    setAmount(String(payment.amount));
    setMethod(payment.method ?? "Efectivo");
    setNotes(payment.notes ?? "");
    setError(null);
    setSuccessMessage(null);
    setShowCreateForm(true);
  }

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Registro de pagos"
        title="Pagos de clientes"
        description="Registra pagos y aplícalos automáticamente a las deudas más antiguas."
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
            {showCreateForm ? "Cerrar formulario" : "Nuevo pago"}
          </button>
        }
      />

      {showCreateForm ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <Panel delay={180}>
            <h2 className="text-lg font-semibold">{editingPaymentId ? "Editar pago" : "Nuevo pago"}</h2>
            <form className="mt-3 grid gap-3" onSubmit={onSubmit}>
              <select
                className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Seleccionar cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>

              <input
                className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />

              <input
                className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                placeholder="Monto"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />

              <select
                className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Yape</option>
                <option>Plin</option>
                <option>Tarjeta</option>
                <option>Otro</option>
              </select>

              <textarea
                className="min-h-24 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm"
                placeholder="Observación (opcional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />

              <button
                type="submit"
                disabled={isSaving}
                className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : editingPaymentId ? "Actualizar pago" : "Registrar pago"}
              </button>
              {editingPaymentId ? (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setSuccessMessage(null);
                    setShowCreateForm(false);
                  }}
                  className="h-10 rounded-xl border text-sm font-semibold"
                >
                  Cancelar edición
                </button>
              ) : null}
            </form>
          </Panel>

          <Panel delay={240}>
            <h2 className="text-lg font-semibold">Aplicación automática</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="font-semibold">Cómo funciona</p>
                <p className="mt-1 text-[var(--foreground-muted)]">
                  El pago se aplica primero a las campañas más antiguas con saldo pendiente.
                </p>
              </div>
              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="font-semibold">Resultado del último pago</p>
                {latestAllocation ? (
                  <p className="mt-1 text-[var(--foreground-muted)]">
                    Aplicaciones: {latestAllocation.allocations.length} · Sin aplicar:{" "}
                    {currencyFormatter.format(latestAllocation.unappliedAmount)}
                  </p>
                ) : (
                  <p className="mt-1 text-[var(--foreground-muted)]">Aún no registras pagos en esta sesión.</p>
                )}
              </div>
            </div>
            {successMessage ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}
          </Panel>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      <Panel delay={280}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className="sr-only">Buscar pago</span>
            <span className="flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--foreground-muted)]" />
              <input
                placeholder="Buscar por cliente o método..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--foreground-muted)]"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </span>
          </label>
          <select
            className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
            value={campaignFilter}
            onChange={(event) => {
              setCampaignFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Todas las campañas</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel delay={300}>
        <h2 className="text-lg font-semibold">Historial de pagos</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando pagos...</p>
        ) : filteredPayments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay pagos para mostrar con el filtro actual.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Cliente</th>
                  <th className="pb-2 font-semibold">Monto</th>
                  <th className="pb-2 font-semibold">Método</th>
                  <th className="pb-2 font-semibold">Campañas afectadas</th>
                  <th className="pb-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((payment) => (
                  <tr key={payment.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {new Date(payment.paymentDate).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-3 font-medium">{payment.customerName}</td>
                    <td className="py-3">{currencyFormatter.format(payment.amount)}</td>
                    <td className="py-3">{payment.method ?? "-"}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {payment.applications.length > 0
                        ? payment.applications.map((app) => app.campaignName).join(", ")
                        : "-"}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => onEditPayment(payment)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Editar
                      </button>
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

