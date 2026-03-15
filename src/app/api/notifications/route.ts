import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
        { error: "No se encontró un negocio para este usuario." },
        { status: 404 },
      );
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId: ownedBusiness.id,
        campaignBalances: {
          some: {
            balance: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        campaignBalances: {
          where: {
            balance: { gt: 0 },
          },
          select: {
            balance: true,
            campaign: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const notifications = customers
      .map((customer) => {
        const pendingCampaigns = customer.campaignBalances.length;
        const totalDebt = customer.campaignBalances.reduce(
          (acc, item) => acc + Number(item.balance.toString()),
          0,
        );

        return {
          id: `customer-overdue-${customer.id}`,
          type: "overdue_customer" as const,
          customerId: customer.id,
          customerName: customer.fullName,
          pendingCampaigns,
          totalDebt: Number(totalDebt.toFixed(2)),
          title: "Recordatorio de cobranza",
          message: `${customer.fullName} acumula ${pendingCampaigns} campañas pendientes.`,
        };
      })
      .filter((item) => item.pendingCampaigns > 2)
      .sort((a, b) => {
        if (b.pendingCampaigns !== a.pendingCampaigns) {
          return b.pendingCampaigns - a.pendingCampaigns;
        }
        return b.totalDebt - a.totalDebt;
      });

    return NextResponse.json({
      data: {
        unreadCount: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar las notificaciones.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}


