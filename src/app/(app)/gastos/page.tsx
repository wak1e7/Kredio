"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

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
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  const loadExpenses = useCallback(async (retrySeed = true) => {
    setError(null);
    setIsLoading(true);

    let hasRetriedSeed = false;

    while (true) {
      const response = await fetch("/api/expenses", { cache: "no-store" });
      const json = (await response.json()) as ExpensesResponse;

      if (!response.ok) {
        if (response.status === 404 && retrySeed && !hasRetriedSeed) {
          hasRetriedSeed = true;
          await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
          continue;
        }

        setError(json.error ?? "No se pudo cargar gastos.");
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
      return;
    }
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
      setError("Completa campana, concepto y monto correctamente.");
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
    await loadExpenses(false);
  }

  const totalPages = Math.max(1, Math.ceil(expenses.length / EXPENSES_PER_PAGE));
  const paginatedExpenses = expenses.slice(
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

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Registro general"
        title="Gastos adicionales"
        description="Registra gastos adicionales y asignalos a la campana correspondiente."
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
            {showCreateForm ? "Cerrar" : "Nuevo gasto"}
          </button>
        }
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      {showCreateForm ? (
        <Panel delay={180}>
          <h2 className="text-lg font-semibold">{editingExpenseId ? "Editar gasto" : "Nuevo gasto"}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
            <select
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">Seleccionar campana</option>
              {campaignOptions.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
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
            <textarea
              className="min-h-24 rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm md:col-span-2"
              placeholder="Observacion (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"
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
                className="h-10 rounded-xl border text-sm font-semibold md:col-span-2"
              >
                Cancelar edicion
              </button>
            ) : null}
          </form>
          {successMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Panel delay={300}>
        <h2 className="text-lg font-semibold">Historial de gastos</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando gastos...</p>
        ) : expenses.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay gastos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Campana</th>
                  <th className="pb-2 font-semibold">Concepto</th>
                  <th className="pb-2 font-semibold">Monto</th>
                  <th className="pb-2 font-semibold">Observacion</th>
                  <th className="pb-2 font-semibold">Accion</th>
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
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Pagina {currentPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
