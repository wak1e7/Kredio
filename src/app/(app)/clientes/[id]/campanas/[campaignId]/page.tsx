import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
}

type PurchaseItemRow = {
  key: string;
  product: string;
  qty: number;
  price: number;
  subtotal: number;
};

export default async function ClienteCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = await params;
  const authUser = await getAuthenticatedUser();

  if (!authUser) {
    redirect("/login");
  }

  const customerCampaign = await prisma.customerCampaignBalance.findFirst({
    where: {
      customerId: id,
      campaignId,
      customer: {
        business: {
          ownerId: authUser.id,
        },
      },
      campaign: {
        business: {
          ownerId: authUser.id,
        },
      },
    },
    include: {
      customer: {
        select: {
          fullName: true,
        },
      },
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!customerCampaign) {
    notFound();
  }

  const purchases = await prisma.purchase.findMany({
    where: {
      customerId: id,
      campaignId,
      business: {
        ownerId: authUser.id,
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      purchaseDate: "desc",
    },
  });

  const itemRows: PurchaseItemRow[] = purchases.flatMap((purchase) =>
    purchase.items.map((item) => ({
      key: item.id,
      product: item.productName,
      qty: item.quantity,
      price: Number(item.salePrice.toString()),
      subtotal: Number(item.subtotal.toString()),
    })),
  );

  const totalPurchases = Number(customerCampaign.totalPurchased.toString());
  const totalPaid = Number(customerCampaign.totalPaid.toString());
  const pendingBalance = Number(customerCampaign.balance.toString());

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Detalle de campaña"
        title={`${customerCampaign.customer.fullName} - ${customerCampaign.campaign.name}`}
        description="Productos comprados y resumen financiero de la campaña seleccionada."
      />

      <Panel delay={180}>
        <h2 className="text-lg font-semibold">Productos comprados</h2>
        {itemRows.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Aún no hay productos registrados en esta campaña.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 font-semibold">Cantidad</th>
                  <th className="pb-2 font-semibold">Precio unitario</th>
                  <th className="pb-2 font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((item) => (
                  <tr key={item.key} className="border-t border-[var(--border)]/80">
                    <td className="py-3 font-medium">{item.product}</td>
                    <td className="py-3">{item.qty}</td>
                    <td className="py-3">{formatCurrency(item.price)}</td>
                    <td className="py-3">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <section className="grid gap-3 md:grid-cols-3">
        <Panel className="rounded-2xl p-4" delay={240}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Total compras</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalPurchases)}</p>
        </Panel>
        <Panel className="rounded-2xl p-4" delay={280}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Pagos aplicados</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalPaid)}</p>
        </Panel>
        <Panel className="rounded-2xl p-4" delay={320}>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Saldo pendiente</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(pendingBalance)}</p>
        </Panel>
      </section>
    </div>
  );
}
