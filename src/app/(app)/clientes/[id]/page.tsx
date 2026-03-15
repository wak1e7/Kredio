import { getAuthenticatedUser } from "@/lib/auth/guards";
import { getCustomerStatementData } from "@/lib/customer-statement";
import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import { CustomerCampaignStatus } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
}

function campaignStatusLabel(status: CustomerCampaignStatus) {
  if (status === "PAID") return "Pagada";
  if (status === "PARTIAL") return "Parcial";
  return "Abierta";
}

function campaignStatusClass(status: CustomerCampaignStatus) {
  if (status === "PAID") return "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600";
  if (status === "PARTIAL") return "rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-600";
  return "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600";
}

export default async function ClienteProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authUser = await getAuthenticatedUser();

  if (!authUser) {
    redirect("/login");
  }

  const statement = await getCustomerStatementData(authUser.id, id);

  if (!statement) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Perfil del cliente"
        title={statement.customer.fullName}
        description="Estado de cuenta, campañas, productos comprados y pagos realizados."
        actions={
          <a
            href={`/api/customers/${id}/statement`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Exportar PDF
          </a>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Panel className="rounded-xl p-4" delay={180}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Deuda total</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(statement.totals.totalDebt)}</p>
        </Panel>
        <Panel className="rounded-xl p-4" delay={220}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Total comprado</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(statement.totals.totalPurchased)}</p>
        </Panel>
        <Panel className="rounded-xl p-4" delay={260}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Total pagado</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(statement.totals.totalPaid)}</p>
        </Panel>
        <Panel className="rounded-xl p-4" delay={300}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Campañas</p>
          <p className="mt-2 text-3xl font-semibold">{statement.totals.campaignsCount}</p>
        </Panel>
        <Panel className="rounded-xl p-4" delay={340}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Campañas con deuda</p>
          <p className="mt-2 text-3xl font-semibold">{statement.totals.campaignsWithDebtCount}</p>
        </Panel>
      </section>

      <Panel delay={400}>
        <h2 className="text-lg font-semibold">Campañas del cliente</h2>
        {statement.campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Aún no hay campañas registradas para este cliente.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Total comprado</th>
                  <th className="pb-2 font-semibold">Total pagado</th>
                  <th className="pb-2 font-semibold">Saldo</th>
                  <th className="pb-2 font-semibold">Estado</th>
                  <th className="pb-2 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {statement.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 font-medium">{campaign.campaignName}</td>
                    <td className="py-3">{formatCurrency(campaign.totalPurchased)}</td>
                    <td className="py-3">{formatCurrency(campaign.totalPaid)}</td>
                    <td className="py-3">{formatCurrency(campaign.balance)}</td>
                    <td className="py-3">
                      <span className={campaignStatusClass(campaign.status)}>{campaignStatusLabel(campaign.status)}</span>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/clientes/${id}/campanas/${campaign.campaignId}`}
                        className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                      >
                        Ver campaña
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel delay={450}>
        <h2 className="text-lg font-semibold">Productos comprados</h2>
        {statement.products.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Aún no hay productos comprados por este cliente.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 font-semibold">Cantidad total</th>
                  <th className="pb-2 font-semibold">Total comprado</th>
                  <th className="pb-2 font-semibold">Última campaña</th>
                </tr>
              </thead>
              <tbody>
                {statement.products.map((item) => (
                  <tr key={item.productKey} className="border-t border-[var(--border)]/80">
                    <td className="py-3 font-medium">{item.productName}</td>
                    <td className="py-3">{item.totalQty}</td>
                    <td className="py-3">{formatCurrency(item.totalAmount)}</td>
                    <td className="py-3 text-[var(--foreground-muted)]">{item.lastCampaign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel delay={500}>
        <h2 className="text-lg font-semibold">Pagos del cliente</h2>
        {statement.payments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Aún no hay pagos registrados para este cliente.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {statement.payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {new Date(payment.paymentDate).toLocaleDateString("es-PE")}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                  Método: {payment.method ?? "No especificado"} | {payment.notes ?? "Sin observación"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
