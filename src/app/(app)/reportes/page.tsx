"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import {
  CategoryMarginRow,
  CategoryMarginsPanel,
  ReportSummary,
  ReportSummaryCards,
  TopBuyerRow,
  TopBuyersPanel,
  TopDebtorRow,
  TopDebtorsPanel,
  formatCurrency,
} from "@/components/reports/shared";
import { useCallback, useEffect, useState } from "react";

type CampaignOption = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
};

type CampaignBreakdownRow = {
  campaignId: string;
  campaignName: string;
  month: number;
  year: number;
  sold: number;
  cost: number;
  collected: number;
  pending: number;
  margin: number;
  customersCount: number;
};

type ExpenseHistoryRow = {
  id: string;
  expenseDate: string;
  campaignName: string;
  concept: string;
  amount: number;
  notes?: string | null;
};

type ReportResponse = {
  data?: {
    selectedYear: number;
    availableYears: number[];
    selectedCampaignId: string | null;
    campaignOptions: CampaignOption[];
    annualSummary: ReportSummary;
    expensesTotal: number;
    expensesHistory: ExpenseHistoryRow[];
    campaignBreakdown: CampaignBreakdownRow[];
    categoryMargins: CategoryMarginRow[];
    topBuyers: TopBuyerRow[];
    topDebtors: TopDebtorRow[];
  };
  error?: string;
};

const emptySummary: ReportSummary = {
  sold: 0,
  collected: 0,
  pending: 0,
  cost: 0,
  margin: 0,
  campaignsCount: 0,
};

export default function ReportesPage() {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("ALL");
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(emptySummary);
  const [expensesHistory, setExpensesHistory] = useState<ExpenseHistoryRow[]>([]);
  const [campaignBreakdown, setCampaignBreakdown] = useState<CampaignBreakdownRow[]>([]);
  const [categoryMargins, setCategoryMargins] = useState<CategoryMarginRow[]>([]);
  const [topBuyers, setTopBuyers] = useState<TopBuyerRow[]>([]);
  const [topDebtors, setTopDebtors] = useState<TopDebtorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(
    async (year = selectedYear, campaignId = selectedCampaignId) => {
      setError(null);
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("year", String(year));
      if (campaignId && campaignId !== "ALL") {
        params.set("campaignId", campaignId);
      }

      const response = await fetch(`/api/reports/overview?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as ReportResponse;

      if (!response.ok) {
        setError(json.error ?? "No se pudo cargar reportes.");
        setSummary(emptySummary);
        setExpensesHistory([]);
        setCampaignBreakdown([]);
        setCategoryMargins([]);
        setTopBuyers([]);
        setTopDebtors([]);
        setIsLoading(false);
        return;
      }

      setAvailableYears(json.data?.availableYears ?? []);
      setSelectedYear(json.data?.selectedYear ?? year);
      setCampaignOptions(json.data?.campaignOptions ?? []);
      setSelectedCampaignId(json.data?.selectedCampaignId ?? "ALL");
      setSummary(json.data?.annualSummary ?? emptySummary);
      setExpensesHistory(json.data?.expensesHistory ?? []);
      setCampaignBreakdown(json.data?.campaignBreakdown ?? []);
      setCategoryMargins(json.data?.categoryMargins ?? []);
      setTopBuyers(json.data?.topBuyers ?? []);
      setTopDebtors(json.data?.topDebtors ?? []);
      setIsLoading(false);
    },
    [selectedCampaignId, selectedYear],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadReports(selectedYear, selectedCampaignId);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadReports, selectedCampaignId, selectedYear]);

  const selectedCampaignName =
    selectedCampaignId !== "ALL"
      ? campaignOptions.find((campaign) => campaign.id === selectedCampaignId)?.name ?? "Campaña seleccionada"
      : null;

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Módulo de reportes"
        title="Reportes de ventas y rentabilidad"
        description="Vista anual por defecto, con filtros para revisar una campaña específica dentro del año."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setSelectedCampaignId("ALL");
              }}
            >
              {(availableYears.length > 0 ? availableYears : [selectedYear]).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className="h-10 min-w-48 rounded-xl border bg-[var(--surface)] px-3 text-sm"
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
            >
              <option value="ALL">Todas las campañas</option>
              {campaignOptions.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      ) : null}

      <ReportSummaryCards
        summary={summary}
        labelSold={selectedCampaignName ? `Vendido en ${selectedCampaignName}` : `Vendido en ${selectedYear}`}
        labelExtra="Deuda pendiente"
        extraValue={summary.pending}
      />

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel delay={380}>
          <div>
            <h2 className="text-lg font-semibold">
              {selectedCampaignName ? "Campaña" : "Campañas"}
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              {selectedCampaignName
                ? `${selectedCampaignName} en ${selectedYear}`
                : `${summary.campaignsCount ?? 0} campañas registradas en ${selectedYear}.`}
            </p>
          </div>

          {isLoading ? (
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando campañas...</p>
          ) : campaignBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay campañas registradas para este filtro.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                  <tr>
                    <th className="pb-2 font-semibold">Campaña</th>
                    <th className="pb-2 font-semibold">Vendido</th>
                    <th className="pb-2 font-semibold">Costo</th>
                    <th className="pb-2 font-semibold">Ganancia</th>
                    <th className="pb-2 font-semibold">Cobrado</th>
                    <th className="pb-2 font-semibold">Pendiente</th>
                    <th className="pb-2 font-semibold">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignBreakdown.map((campaign) => (
                    <tr key={campaign.campaignId} className="border-t border-[var(--border)]/80">
                      <td className="py-3 font-medium">{campaign.campaignName}</td>
                      <td className="py-3">{formatCurrency(campaign.sold)}</td>
                      <td className="py-3">{formatCurrency(campaign.cost)}</td>
                      <td className="py-3">{formatCurrency(campaign.margin)}</td>
                      <td className="py-3">{formatCurrency(campaign.collected)}</td>
                      <td className="py-3">{formatCurrency(campaign.pending)}</td>
                      <td className="py-3">{campaign.customersCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <CategoryMarginsPanel
          isLoading={isLoading}
          rows={categoryMargins}
          emptyLabel="No hay productos vendidos para este filtro."
        />
      </section>

      <Panel delay={460}>
        <div>
          <h2 className="text-lg font-semibold">Gastos</h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {selectedCampaignName
              ? `Gastos registrados en ${selectedCampaignName}.`
              : `Gastos registrados en las campañas del ${selectedYear}.`}
          </p>
        </div>

        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando gastos...</p>
        ) : expensesHistory.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay gastos registrados para este filtro.</p>
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
                </tr>
              </thead>
              <tbody>
                {expensesHistory.map((expense) => (
                  <tr key={expense.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(expense.expenseDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3">{expense.campaignName}</td>
                    <td className="py-3 font-medium">{expense.concept}</td>
                    <td className="py-3">{formatCurrency(expense.amount)}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">{expense.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <TopBuyersPanel isLoading={isLoading} rows={topBuyers} emptyLabel="No hay compras registradas para este filtro." />
        <TopDebtorsPanel isLoading={isLoading} rows={topDebtors} emptyLabel="No hay deuda registrada para este filtro." />
      </section>
    </div>
  );
}

