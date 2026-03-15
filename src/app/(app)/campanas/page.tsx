"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CampaignRow = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
  startDate: string;
  endDate: string | null;
  totalSold: number;
  totalCollected: number;
  pending: number;
  debtorsCount: number;
};

type CampaignFilter = "all" | "OPEN" | "CLOSED";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const CAMPAIGNS_PER_PAGE = 20;

function monthLabel(month: number) {
  return monthNames[month - 1] ?? `Mes ${month}`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [filter, setFilter] = useState<CampaignFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingCampaignId, setUpdatingCampaignId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaignName, setCampaignName] = useState("Campaña actual");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState<string>("");

  function resetForm() {
    setEditingCampaignId(null);
    setCampaignName("Campaña actual");
    setMonth(new Date().getMonth() + 1);
    setYear(new Date().getFullYear());
    setStartDate(toDateInputValue(new Date()));
    setEndDate("");
  }

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    return params;
  }, [filter]);

  const loadCampaigns = useCallback(async (params: URLSearchParams, retrySeed = true) => {
    setError(null);
    setIsLoading(true);

    let hasRetriedSeed = false;

    while (true) {
      const response = await fetch(`/api/campaigns?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as { data?: CampaignRow[]; error?: string };

      if (!response.ok) {
        if (response.status === 404 && retrySeed && !hasRetriedSeed) {
          hasRetriedSeed = true;
          await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
          continue;
        }

        setError(json.error ?? "No se pudieron cargar las campañas.");
        setIsLoading(false);
        return;
      }

      setCampaigns(json.data ?? []);
      setCurrentPage(1);
      setIsLoading(false);
      return;
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCampaigns(queryParams);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadCampaigns, queryParams]);

  async function onSubmitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const isEditing = Boolean(editingCampaignId);
    const response = await fetch(isEditing ? `/api/campaigns/${editingCampaignId}` : "/api/campaigns", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName,
        month,
        year,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : undefined,
      }),
    });

    const json = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? `No se pudo ${isEditing ? "actualizar" : "crear"} la campaña.`);
      return;
    }

    setShowCreateForm(false);
    resetForm();
    await loadCampaigns(queryParams);
  }

  function onEditCampaign(campaign: CampaignRow) {
    setEditingCampaignId(campaign.id);
    setCampaignName(campaign.name);
    setMonth(campaign.month);
    setYear(campaign.year);
    setStartDate(toDateInputValue(new Date(campaign.startDate)));
    setEndDate(campaign.endDate ? toDateInputValue(new Date(campaign.endDate)) : "");
    setShowCreateForm(true);
    setError(null);
  }

  async function onUpdateCampaignStatus(campaign: CampaignRow) {
    setError(null);
    setUpdatingCampaignId(campaign.id);

    const nextStatus = campaign.status === "OPEN" ? "CLOSED" : "OPEN";

    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const json = (await response.json()) as { error?: string };
    setUpdatingCampaignId(null);

    if (!response.ok) {
      setError(json.error ?? "No se pudo actualizar la campaña.");
      return;
    }

    await loadCampaigns(queryParams, false);
  }

  const totalPages = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE));
  const paginatedCampaigns = campaigns.slice(
    (currentPage - 1) * CAMPAIGNS_PER_PAGE,
    currentPage * CAMPAIGNS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Gestión de campañas"
        title="Campañas mensuales"
        description="Control de ventas, cobros y deuda por periodo comercial."
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
            {showCreateForm ? "Cerrar formulario" : "Nueva campaña"}
          </button>
        }
      />

      {showCreateForm ? (
        <Panel delay={150}>
          <h2 className="text-lg font-semibold">{editingCampaignId ? "Editar campaña" : "Crear campaña"}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onSubmitCampaign}>
            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm md:col-span-2"
              placeholder="Nombre de la campaña *"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              required
            />

            <select
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>

            <input
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              type="number"
              min={2024}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              required
            />

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Fecha inicio</span>
              <input
                className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Fecha cierre (opcional)</span>
              <input
                className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
            >
              {isSaving ? "Guardando..." : editingCampaignId ? "Actualizar campaña" : "Guardar campaña"}
            </button>
            {editingCampaignId ? (
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
        <div className="flex justify-end">
          <select
            className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
            value={filter}
            onChange={(event) => setFilter(event.target.value as CampaignFilter)}
          >
            <option value="all">Todas</option>
            <option value="OPEN">Abiertas</option>
            <option value="CLOSED">Cerradas</option>
          </select>
        </div>
      </Panel>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      ) : null}

      <Panel delay={220}>
        {isLoading ? (
          <p className="text-sm text-[var(--foreground-muted)]">Cargando campañas...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">No hay campañas para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Periodo</th>
                  <th className="pb-2 font-semibold">Inicio</th>
                  <th className="pb-2 font-semibold">Cierre</th>
                  <th className="pb-2 font-semibold">Vendido</th>
                  <th className="pb-2 font-semibold">Cobrado</th>
                  <th className="pb-2 font-semibold">Saldo</th>
                  <th className="pb-2 font-semibold">Clientes con deuda</th>
                  <th className="pb-2 font-semibold">Estado</th>
                  <th className="pb-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 font-medium">{campaign.name}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {monthLabel(campaign.month)} {campaign.year}
                    </td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {new Date(campaign.startDate).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-3 text-[var(--foreground-muted)]">
                      {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("es-PE") : "-"}
                    </td>
                    <td className="py-3">{currencyFormatter.format(campaign.totalSold)}</td>
                    <td className="py-3">{currencyFormatter.format(campaign.totalCollected)}</td>
                    <td className="py-3">{currencyFormatter.format(campaign.pending)}</td>
                    <td className="py-3">{campaign.debtorsCount}</td>
                    <td className="py-3">
                      <span
                        className={
                          campaign.status === "OPEN"
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600"
                            : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500"
                        }
                      >
                        {campaign.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditCampaign(campaign)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateCampaignStatus(campaign)}
                          disabled={updatingCampaignId === campaign.id}
                          className={
                            campaign.status === "OPEN"
                              ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                              : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          }
                        >
                          {updatingCampaignId === campaign.id
                            ? "Actualizando..."
                            : campaign.status === "OPEN"
                              ? "Cerrar campaña"
                              : "Reabrir campaña"}
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
