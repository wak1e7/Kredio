"use client";

import { ListFilters } from "@/components/ui/list-filters";
import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  campaignId?: string | null;
  campaignName: string;
  concept: string;
  amount: number;
  notes?: string | null;
};

type CampaignOption = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
};

type ExpensesResponse = {
  data?: ExpenseRow[];
  campaignOptions?: CampaignOption[];
  totalAmount?: number;
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});
const EXPENSES_PER_PAGE = 10;

export default function GastosPage() {
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setEditingExpenseId(null);
    setConcept("");
    setAmount("");
    setNotes("");
  }

  const loadExpenses = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/expenses", { cache: "no-store" });
    const json = (await response.json()) as ExpensesResponse;

    if (!response.ok) {
      setError(json.error ?? "No se pudieron cargar los gastos.");
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    const nextCampaignOptions = json.campaignOptions ?? [];
    setExpenses(json.data ?? []);
    setCurrentPage(1);
    setCampaignOptions(nextCampaignOptions);
    setCampaignId((current) => current || nextCampaignOptions[0]?.id || "");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadExpenses();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadExpenses]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsedAmount = Number(amount);
    if (!campaignId || !concept.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Completa la campaña, el concepto y el monto correctamente.");
      return;
    }

    setIsSaving(true);
    const isEditing = Boolean(editingExpenseId);
    const response = await fetch(isEditing ? `/api/expenses/${editingExpenseId}` : "/api/expenses", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        concept: concept.trim(),
        amount: parsedAmount,
        notes: notes || undefined,
      }),
    });

    const json = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? `No se pudo ${isEditing ? "actualizar" : "registrar"} el gasto.`);
      return;
    }

    resetForm();
    setSuccessMessage(isEditing ? "Gasto actualizado correctamente." : "Gasto registrado correctamente.");
    setShowCreateForm(false);
    await loadExpenses();
  }

  const filteredExpenses = useMemo(() => {
    if (campaignFilter === "all") {
      return expenses;
    }

    return expenses.filter((expense) => expense.campaignId === campaignFilter);
  }, [campaignFilter, expenses]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / EXPENSES_PER_PAGE));
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * EXPENSES_PER_PAGE,
    currentPage * EXPENSES_PER_PAGE,
  );

  function onEditExpense(expense: ExpenseRow) {
    setEditingExpenseId(expense.id);
    setCampaignId(expense.campaignId ?? "");
    setConcept(expense.concept);
    setAmount(String(expense.amount));
    setNotes(expense.notes ?? "");
    setError(null);
    setSuccessMessage(null);
    setShowCreateForm(true);
  }

  async function onDeleteExpense(expense: ExpenseRow) {
    const confirmed = window.confirm(`¿Seguro que quieres eliminar el gasto "${expense.concept}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingExpenseId(expense.id);
    setError(null);
    setSuccessMessage(null);

    const response = await fetch(`/api/expenses/${expense.id}`, {
      method: "DELETE",
    });

    const json = (await response.json()) as { error?: string };
    setDeletingExpenseId(null);

    if (!response.ok) {
      setError(json.error ?? "No se pudo eliminar el gasto.");
      return;
    }

    if (editingExpenseId === expense.id) {
      resetForm();
      setShowCreateForm(false);
    }

    setSuccessMessage("Gasto eliminado correctamente.");
    await loadExpenses();
  }

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Registro general"
        title="Gastos adicionales"
        description="Registra gastos adicionales y asígnalos a la campaña correspondiente."
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
            {showCreateForm ? "Cerrar formulario" : "Nuevo gasto"}
          </button>
        }
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      {showCreateForm ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <Panel delay={180}>
            <h2 className="text-lg font-semibold">{editingExpenseId ? "Editar gasto" : "Nuevo gasto"}</h2>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 1</p>
                <p className="mt-1 font-semibold">Seleccionar campaña</p>
                <select
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                >
                  <option value="">Seleccionar campaña</option>
                  {campaignOptions.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                <p className="mt-1 font-semibold">Registrar concepto y monto</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                    placeholder="Concepto del gasto"
                    value={concept}
                    onChange={(event) => setConcept(event.target.value)}
                    required
                  />
                  <input
                    className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                    placeholder="Monto"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 3</p>
                <p className="mt-1 font-semibold">Agregar observación</p>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm"
                  placeholder="Observación (opcional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : editingExpenseId ? "Actualizar gasto" : "Registrar gasto"}
              </button>
              {editingExpenseId ? (
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
            <h2 className="text-lg font-semibold">Resultado esperado</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
              <li className="rounded-xl border bg-[var(--surface)] p-3">El gasto queda vinculado a la campaña seleccionada.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se actualiza el historial de gastos del negocio.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">El costo se reflejará en los reportes correspondientes.</li>
            </ul>
            {successMessage ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}
          </Panel>
        </section>
      ) : null}

      <Panel delay={260}>
        <ListFilters>
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
        <h2 className="text-lg font-semibold">Historial de gastos</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando gastos...</p>
        ) : filteredExpenses.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay gastos para mostrar con el filtro actual.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Concepto</th>
                  <th className="pb-2 font-semibold">Monto</th>
                  <th className="pb-2 font-semibold">Observación</th>
                  <th className="pb-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {new Date(expense.expenseDate).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-3">{expense.campaignName}</td>
                    <td className="py-3 font-medium">{expense.concept}</td>
                    <td className="py-3">{currencyFormatter.format(expense.amount)}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">{expense.notes ?? "-"}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditExpense(expense)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(expense)}
                          disabled={deletingExpenseId === expense.id}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingExpenseId === expense.id ? "Eliminando..." : "Eliminar"}
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
