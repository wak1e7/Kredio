"use client";

import { Panel } from "@/components/ui/panel";

export type ReportSummary = {
  sold: number;
  collected: number;
  pending: number;
  cost: number;
  margin: number;
  campaignsCount?: number;
  customersCount?: number;
};

export type CategoryMarginRow = {
  category: string;
  sold: number;
  cost: number;
  margin: number;
  itemsCount: number;
};

export type TopBuyerRow = {
  customerId: string;
  customerName: string;
  totalPurchased: number;
  purchasesCount: number;
};

export type TopDebtorRow = {
  customerId: string;
  customerName: string;
  debt: number;
  pendingCampaigns: number;
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function ReportSummaryCards({
  summary,
  labelSold,
  labelExtra,
  extraValue,
}: {
  summary: ReportSummary;
  labelSold: string;
  labelExtra: string;
  extraValue: string | number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Panel className="rounded-2xl p-4" delay={180}>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">{labelSold}</p>
        <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.sold)}</p>
      </Panel>
      <Panel className="rounded-2xl p-4" delay={220}>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Costo total</p>
        <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.cost)}</p>
      </Panel>
      <Panel className="rounded-2xl p-4" delay={260}>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Ganancia total</p>
        <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.margin)}</p>
      </Panel>
      <Panel className="rounded-2xl p-4" delay={300}>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Cobrado</p>
        <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.collected)}</p>
      </Panel>
      <Panel className="rounded-2xl p-4" delay={340}>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">{labelExtra}</p>
        <p className="mt-2 text-3xl font-semibold">
          {typeof extraValue === "number" ? formatCurrency(extraValue) : extraValue}
        </p>
      </Panel>
    </section>
  );
}

export function CategoryMarginsPanel({
  isLoading,
  rows,
  emptyLabel,
}: {
  isLoading: boolean;
  rows: CategoryMarginRow[];
  emptyLabel: string;
}) {
  return (
    <Panel delay={430}>
      <h2 className="text-lg font-semibold">Categorias</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando categorias...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((category) => (
            <div key={category.category} className="rounded-2xl border bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{category.category}</p>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {category.itemsCount} items
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Venta</p>
                  <p className="mt-1 font-semibold">{formatCurrency(category.sold)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Costo</p>
                  <p className="mt-1 font-semibold">{formatCurrency(category.cost)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Ganancia</p>
                  <p className="mt-1 font-semibold">{formatCurrency(category.margin)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function TopBuyersPanel({
  isLoading,
  rows,
  emptyLabel,
}: {
  isLoading: boolean;
  rows: TopBuyerRow[];
  emptyLabel: string;
}) {
  return (
    <Panel delay={480}>
      <h2 className="text-lg font-semibold">Clientes que mas compran</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando ranking...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">{emptyLabel}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((buyer, index) => (
            <li key={buyer.customerId} className="flex items-center justify-between rounded-2xl border bg-[var(--surface)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{buyer.customerName}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{buyer.purchasesCount} compras registradas</p>
                </div>
              </div>
              <p className="text-base font-semibold">{formatCurrency(buyer.totalPurchased)}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function TopDebtorsPanel({
  isLoading,
  rows,
  emptyLabel,
}: {
  isLoading: boolean;
  rows: TopDebtorRow[];
  emptyLabel: string;
}) {
  return (
    <Panel delay={520}>
      <h2 className="text-lg font-semibold">Clientes que mas deben</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando deudores...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">{emptyLabel}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((debtor, index) => (
            <li key={debtor.customerId} className="flex items-center justify-between rounded-2xl border bg-[var(--surface)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{debtor.customerName}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{debtor.pendingCampaigns} campanas con deuda</p>
                </div>
              </div>
              <p className="text-base font-semibold">{formatCurrency(debtor.debt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
