"use client";

import { ListFilters } from "@/components/ui/list-filters";
import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
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

function toPaymentDateIso(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export default function PagosPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [latestAllocation, setLatestAllocation] = useState<AllocationSummary | null>(null);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");

  const syncCustomerSelection = useCallback(
    (value: string) => {
      setCustomerSearch(value);
      const normalizedValue = normalizeText(value);
      const matchedCustomer = customers.find((customer) => normalizeText(customer.fullName) === normalizedValue);
      setCustomerId(matchedCustomer?.id ?? "");
    },
    [customers],
  );

  function resetForm() {
    setEditingPaymentId(null);
    setCustomerId("");
    setCustomerSearch("");
    setPaymentDate(toDateInputValue(new Date()));
    setAmount("");
    setMethod("Efectivo");
  }

  const loadData = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const [customersRes, campaignsRes, paymentsRes] = await Promise.all([
      fetch("/api/customers?status=ACTIVE&debtMode=with", { cache: "no-store" }),
      fetch("/api/campaigns", { cache: "no-store" }),
      fetch("/api/payments", { cache: "no-store" }),
    ]);

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
      setError(customersJson.error ?? campaignsJson.error ?? paymentsJson.error ?? "No se pudieron cargar los pagos.");
      setIsLoading(false);
      return;
    }

    const customerData = [...(customersJson.data ?? [])].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" }),
    );
    setCustomers(customerData);
    setCampaignOptions(campaignsJson.data ?? []);
    setPayments(paymentsJson.data ?? []);
    setCurrentPage(1);
    setIsLoading(false);
  }, []);

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

    if (!customerId || !paymentDate || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Completa cliente, fecha y monto correctamente.");
      return;
    }

    setIsSaving(true);
    const isEditing = Boolean(editingPaymentId);

    const response = await fetch(isEditing ? `/api/payments/${editingPaymentId}` : "/api/payments", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        paymentDate: toPaymentDateIso(paymentDate),
        amount: parsedAmount,
        method,
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
    await loadData();
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

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) => customer.fullName.toLowerCase().includes(normalizedSearch));
  }, [customerSearch, customers]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAYMENTS_PER_PAGE));
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * PAYMENTS_PER_PAGE,
    currentPage * PAYMENTS_PER_PAGE,
  );

  function onEditPayment(payment: PaymentRow) {
    setEditingPaymentId(payment.id);
    setCustomerId(payment.customerId);
    setCustomerSearch(payment.customerName);
    setPaymentDate(toDateInputValue(new Date(payment.paymentDate)));
    setAmount(String(payment.amount));
    setMethod(payment.method ?? "Efectivo");
    setError(null);
    setSuccessMessage(null);
    setShowCreateForm(true);
  }

  async function onDeletePayment(payment: PaymentRow) {
    const confirmed = window.confirm(`¿Seguro que quieres eliminar el pago de ${payment.customerName}?`);
    if (!confirmed) {
      return;
    }

    setDeletingPaymentId(payment.id);
    setError(null);
    setSuccessMessage(null);
    setLatestAllocation(null);

    const response = await fetch(`/api/payments/${payment.id}`, {
      method: "DELETE",
    });

    const json = (await response.json()) as { error?: string };
    setDeletingPaymentId(null);

    if (!response.ok) {
      setError(json.error ?? "No se pudo eliminar el pago.");
      return;
    }

    if (editingPaymentId === payment.id) {
      resetForm();
      setShowCreateForm(false);
    }

    setSuccessMessage("Pago eliminado correctamente.");
    await loadData();
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
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 1</p>
                <p className="mt-1 font-semibold">Seleccionar cliente</p>
                <input
                  list="payment-customers"
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  placeholder="Buscar y seleccionar cliente..."
                  value={customerSearch}
                  onChange={(event) => syncCustomerSelection(event.target.value)}
                  required
                />
                <datalist id="payment-customers">
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.fullName} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                <p className="mt-1 font-semibold">Seleccionar fecha de pago</p>
                <input
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  required
                />
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 3</p>
                <p className="mt-1 font-semibold">Registrar monto y método</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
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
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
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
                  className="h-10 w-full rounded-xl border text-sm font-semibold"
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
        <ListFilters
          search={{
            label: "Buscar pago",
            placeholder: "Buscar por cliente o método...",
            value: query,
            onChange: (value) => {
              setQuery(value);
              setCurrentPage(1);
            },
          }}
        >
          <select
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
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
        </ListFilters>
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
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(payment.paymentDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3 font-medium">{payment.customerName}</td>
                    <td className="py-3">{currencyFormatter.format(payment.amount)}</td>
                    <td className="py-3">{payment.method ?? "-"}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {payment.applications.length > 0 ? payment.applications.map((app) => app.campaignName).join(", ") : "-"}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditPayment(payment)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePayment(payment)}
                          disabled={deletingPaymentId === payment.id}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingPaymentId === payment.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
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
