"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import { CircleDollarSign, ListOrdered } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardIndicators = {
  totalDebt: number;
  collectedYear: number;
  soldYear: number;
  customersWithDebt: number;
  totalCustomers: number;
};

type TrendPoint = {
  label: string;
  sold: number;
};

type LatestPayment = {
  paymentId: string;
  date: string;
  customerName: string;
  amount: number;
  method?: string | null;
};

type TopDebtor = {
  customerId: string;
  customerName: string;
  debt: number;
  pendingCampaigns: number;
  riskLevel: "ALTO" | "MEDIO" | "BAJO";
};

type CampaignOption = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
};

type DashboardResponse = {
  data?: {
    selectedYear: number;
    availableYears: number[];
    selectedCampaignId: string | null;
    campaignOptions: CampaignOption[];
    indicators: DashboardIndicators;
    trendMode: "campaigns" | "days";
    trendSeries: TrendPoint[];
    latestPayments: LatestPayment[];
    topDebtors: TopDebtor[];
  };
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

const emptyIndicators: DashboardIndicators = {
  totalDebt: 0,
  collectedYear: 0,
  soldYear: 0,
  customersWithDebt: 0,
  totalCustomers: 0,
};

function riskBadgeClass(riskLevel: TopDebtor["riskLevel"]) {
  if (riskLevel === "ALTO") {
    return "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-500";
  }
  if (riskLevel === "MEDIO") {
    return "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600";
  }
  return "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600";
}

function formatTrendLabel(label: string, trendMode: "campaigns" | "days") {
  if (trendMode === "days") {
    return label;
  }

  const cleaned = label
    .replace(/^campa[nñ]a\s+/i, "")
    .trim();

  return cleaned.toLowerCase();
}

function TrendChart({
  trendSeries,
  trendMode,
}: {
  trendSeries: TrendPoint[];
  trendMode: "campaigns" | "days";
}) {
  const maxValue = Math.max(1, ...trendSeries.map((item) => item.sold));

  const chart = useMemo(() => {
    if (trendSeries.length === 0) {
      return {
        points: [] as Array<TrendPoint & { x: number; soldY: number }>,
        soldPath: "",
        gridValues: [] as number[],
        width: 860,
        height: 320,
        axisBottomY: 260,
      };
    }

    const width = Math.max(860, trendMode === "days" ? trendSeries.length * 42 : trendSeries.length * 180);
    const height = 320;
    const paddingX = 56;
    const paddingTop = 18;
    const paddingBottom = 58;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;
    const stepX = trendSeries.length === 1 ? 0 : chartWidth / (trendSeries.length - 1);
    const gridValues = Array.from({ length: 6 }, (_, index) =>
      Number(((maxValue / 5) * (5 - index)).toFixed(0)),
    );

    const points = trendSeries.map((item, index) => {
      const x = paddingX + stepX * index;
      const soldY = paddingTop + chartHeight - (item.sold / maxValue) * chartHeight;

      return {
        ...item,
        x,
        soldY,
      };
    });

    const soldPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.soldY}`).join(" ");

    return {
      points,
      soldPath,
      gridValues,
      width,
      height,
      axisBottomY: height - paddingBottom,
    };
  }, [maxValue, trendMode, trendSeries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Vendido
        </span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${chart.width}px` }}>
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[320px] w-full">
            {chart.gridValues.map((value, index) => {
              const y = 18 + (((chart.axisBottomY - 18) / 5) * index);

              return (
                <g key={value}>
                  <line
                    x1="56"
                    y1={y}
                    x2={chart.width - 42}
                    y2={y}
                    stroke="rgba(148,163,184,0.28)"
                    strokeWidth="1"
                  />
                  <text x="10" y={y + 4} fontSize="11" fill="rgba(100,116,139,1)">
                    {currencyFormatter.format(value)}
                  </text>
                </g>
              );
            })}

            <line
              x1="56"
              y1={chart.axisBottomY}
              x2={chart.width - 42}
              y2={chart.axisBottomY}
              stroke="rgba(148,163,184,0.4)"
              strokeWidth="1"
            />
            <line x1="56" y1="18" x2="56" y2={chart.axisBottomY} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />

            <path
              d={chart.soldPath}
              fill="none"
              stroke="rgba(25,113,194,1)"
              strokeWidth="3.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {chart.points.map((point) => (
              <g key={point.label}>
                <rect
                  x={point.x - 3.5}
                  y={point.soldY - 3.5}
                  width="7"
                  height="7"
                  fill="rgba(25,113,194,1)"
                />
                <text
                  x={point.x}
                  y={chart.axisBottomY + 26}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(100,116,139,1)"
                >
                  {formatTrendLabel(point.label, trendMode)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("ALL");
  const [indicators, setIndicators] = useState<DashboardIndicators>(emptyIndicators);
  const [trendMode, setTrendMode] = useState<"campaigns" | "days">("campaigns");
  const [trendSeries, setTrendSeries] = useState<TrendPoint[]>([]);
  const [latestPayments, setLatestPayments] = useState<LatestPayment[]>([]);
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (year = selectedYear, campaignId = selectedCampaignId) => {
      setError(null);
      setIsLoading(true);

      const query = new URLSearchParams();
      query.set("year", String(year));
      if (campaignId !== "ALL") {
        query.set("campaignId", campaignId);
      }

      const response = await fetch(`/api/dashboard/overview?${query.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        setError(json.error ?? "No se pudo cargar el dashboard.");
        setIndicators(emptyIndicators);
        setTrendMode("campaigns");
        setTrendSeries([]);
        setLatestPayments([]);
        setTopDebtors([]);
        setCampaignOptions([]);
        setIsLoading(false);
        return;
      }

      setAvailableYears(json.data?.availableYears ?? [year]);
      setSelectedYear(json.data?.selectedYear ?? year);
      setCampaignOptions(json.data?.campaignOptions ?? []);
      setSelectedCampaignId(json.data?.selectedCampaignId ?? "ALL");
      setIndicators(json.data?.indicators ?? emptyIndicators);
      setTrendMode(json.data?.trendMode ?? "campaigns");
      setTrendSeries(json.data?.trendSeries ?? []);
      setLatestPayments(json.data?.latestPayments ?? []);
      setTopDebtors(json.data?.topDebtors ?? []);
      setIsLoading(false);
    },
    [selectedCampaignId, selectedYear],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadDashboard(selectedYear, selectedCampaignId);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadDashboard, selectedCampaignId, selectedYear]);

  const selectedCampaignName =
    selectedCampaignId !== "ALL"
      ? campaignOptions.find((campaign) => campaign.id === selectedCampaignId)?.name ?? "Campaña seleccionada"
      : null;

  const metricCards = useMemo(
    () => [
      {
        title: selectedCampaignName ? `Vendido en ${selectedCampaignName}` : `Vendido en ${selectedYear}`,
        value: currencyFormatter.format(indicators.soldYear),
        tone: "neutral",
      },
      {
        title: selectedCampaignName ? "Cobrado en campaña" : `Cobrado en ${selectedYear}`,
        value: currencyFormatter.format(indicators.collectedYear),
        tone: "positive",
      },
      {
        title: selectedCampaignName ? "Deuda de la campaña" : "Deuda total",
        value: currencyFormatter.format(indicators.totalDebt),
        tone: "danger",
      },
      {
        title: selectedCampaignName ? "Clientes en campaña" : "Clientes del año",
        value: `${indicators.totalCustomers}`,
        tone: "neutral",
      },
      {
        title: "Clientes con deuda",
        value: `${indicators.customersWithDebt}`,
        tone: "warning",
      },
    ],
    [indicators, selectedCampaignName, selectedYear],
  );

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Panel principal"
        title="Dashboard"
        description="Vista anual por defecto, con filtro opcional por campaña dentro del año seleccionado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
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
              className="h-10 min-w-48 rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card, index) => (
          <Panel key={card.title} className="rounded-2xl p-4" delay={150 + index * 40}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">{card.title}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <h3 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{card.value}</h3>
              <span
                className={
                  card.tone === "danger"
                    ? "rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-500"
                    : card.tone === "positive"
                      ? "rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600"
                      : card.tone === "warning"
                        ? "rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600"
                        : "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500"
                }
              >
                {isLoading ? "Cargando..." : "Actualizado"}
              </span>
            </div>
          </Panel>
        ))}
      </section>

      <section>
        <Panel delay={320}>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Ventas</p>
            <h2 className="text-xl font-semibold">
              {selectedCampaignName
                ? `Tendencia diaria: ${selectedCampaignName}`
                : `Tendencia por campaña en ${selectedYear}`}
            </h2>
          </div>

          {trendSeries.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              No hay datos suficientes para mostrar la tendencia de este filtro.
            </p>
          ) : (
            <TrendChart trendSeries={trendSeries} trendMode={trendMode} />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        <Panel delay={430}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Últimos cobros</p>
              <h2 className="text-xl font-semibold">Movimientos recientes</h2>
            </div>
            <ListOrdered className="h-5 w-5 text-[var(--foreground-muted)]" />
          </div>

          {latestPayments.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">Todavía no hay cobros registrados.</p>
          ) : (
            <ul className="space-y-2">
              {latestPayments.slice(0, 5).map((payment) => (
                <li key={payment.paymentId} className="rounded-xl border border-[var(--border)]/80 bg-[var(--surface)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{payment.customerName}</span>
                    <span className="font-semibold">{currencyFormatter.format(payment.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                    <span>{new Date(payment.date).toLocaleDateString("es-PE")}</span>
                    <span>{payment.method ?? "Sin método"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel delay={470}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Alertas de cobranza</p>
              <h2 className="text-xl font-semibold">Clientes con mayor deuda</h2>
            </div>
            <CircleDollarSign className="h-5 w-5 text-[var(--foreground-muted)]" />
          </div>

          {topDebtors.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No hay deudores para este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                  <tr>
                    <th className="pb-2 font-semibold">Cliente</th>
                    <th className="pb-2 font-semibold">Deuda</th>
                    <th className="pb-2 font-semibold">Campañas</th>
                    <th className="pb-2 font-semibold">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {topDebtors.slice(0, 5).map((debtor) => (
                    <tr key={debtor.customerId} className="border-t border-[var(--border)]/80">
                      <td className="py-3 font-medium">{debtor.customerName}</td>
                      <td className="py-3 text-[var(--foreground-muted)]">{currencyFormatter.format(debtor.debt)}</td>
                      <td className="py-3 text-[var(--foreground-muted)]">{debtor.pendingCampaigns}</td>
                      <td className="py-3">
                        <span className={riskBadgeClass(debtor.riskLevel)}>
                          {debtor.riskLevel === "ALTO" ? "Alto" : debtor.riskLevel === "MEDIO" ? "Medio" : "Bajo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
