import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const monthLabels = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

type TrendPoint = {
  label: string;
  sold: number;
  collected: number;
  debt: number;
};

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

async function resolveBusinessId(userId: string, requestedBusinessId: string | null | undefined) {
  if (requestedBusinessId) {
    const hasAccess = await canAccessBusiness(userId, requestedBusinessId);
    if (!hasAccess) {
      return { error: "No autorizado para este negocio.", status: 403 as const };
    }
    return { businessId: requestedBusinessId };
  }

  const ownedBusiness = await getOwnedBusiness(userId);
  if (!ownedBusiness) {
    return { error: "No se encontro un negocio para este usuario. Ejecuta /api/setup/dev-seed.", status: 404 as const };
  }

  return { businessId: ownedBusiness.id };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");
    const campaignIdParam = searchParams.get("campaignId");
    const yearParam = Number(searchParams.get("year"));

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const businessId = businessResolution.businessId;

    const campaignYears = await prisma.campaign.findMany({
      where: { businessId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });

    const availableYears = campaignYears.map((campaign) => campaign.year);
    const fallbackYear = availableYears[0] ?? new Date().getFullYear();
    const selectedYear =
      Number.isFinite(yearParam) && availableYears.includes(yearParam) ? yearParam : fallbackYear;

    const campaignOptions = await prisma.campaign.findMany({
      where: {
        businessId,
        year: selectedYear,
      },
      select: {
        id: true,
        name: true,
        month: true,
        year: true,
        status: true,
      },
      orderBy: [{ month: "asc" }, { name: "asc" }],
    });

    const selectedCampaign =
      campaignIdParam && campaignIdParam !== "ALL"
        ? campaignOptions.find((campaign) => campaign.id === campaignIdParam)
        : null;

    if (campaignIdParam && campaignIdParam !== "ALL" && !selectedCampaign) {
      return NextResponse.json({ error: "Campana no encontrada para este ano." }, { status: 404 });
    }

    const campaignScopeIds = selectedCampaign ? [selectedCampaign.id] : campaignOptions.map((campaign) => campaign.id);

    if (campaignScopeIds.length === 0) {
      return NextResponse.json({
        data: {
          selectedYear,
          availableYears: availableYears.length > 0 ? availableYears : [selectedYear],
          selectedCampaignId: null,
          campaignOptions,
          indicators: {
            totalDebt: 0,
            collectedYear: 0,
            soldYear: 0,
            customersWithDebt: 0,
            totalCustomers: 0,
            activeCampaigns: 0,
            campaignsCount: 0,
          },
          campaignFlow: [],
          collectionsByMonth: monthLabels.map((label) => ({ month: label, total: 0 })),
          latestPayments: [],
          topDebtors: [],
        },
        businessId,
      });
    }

    const [campaigns, balances, purchases, paymentApplications, latestApplicationsRaw] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          id: { in: campaignScopeIds },
          businessId,
        },
        include: {
          customerBalances: {
            select: {
              customerId: true,
              totalPurchased: true,
              totalPaid: true,
              balance: true,
            },
          },
        },
        orderBy: [{ month: "asc" }, { name: "asc" }],
      }),
      prisma.customerCampaignBalance.findMany({
        where: {
          campaignId: { in: campaignScopeIds },
          campaign: {
            businessId,
            year: selectedYear,
          },
        },
        select: {
          customerId: true,
          balance: true,
          campaignId: true,
          customer: {
            select: {
              fullName: true,
            },
          },
        },
      }),
      prisma.purchase.findMany({
        where: {
          businessId,
          campaignId: { in: campaignScopeIds },
          campaign: {
            year: selectedYear,
          },
        },
        select: {
          campaignId: true,
          purchaseDate: true,
          totalAmount: true,
        },
      }),
      prisma.paymentApplication.findMany({
        where: {
          campaignId: { in: campaignScopeIds },
          campaign: {
            businessId,
            year: selectedYear,
          },
        },
        select: {
          campaignId: true,
          appliedAmount: true,
          payment: {
            select: {
              paymentDate: true,
              method: true,
            },
          },
          customer: {
            select: {
              fullName: true,
            },
          },
          paymentId: true,
        },
      }),
      prisma.paymentApplication.findMany({
        where: {
          campaignId: { in: campaignScopeIds },
          campaign: {
            businessId,
            year: selectedYear,
          },
        },
        orderBy: [{ payment: { paymentDate: "desc" } }, { appliedAt: "desc" }],
        take: 5,
        select: {
          paymentId: true,
          appliedAmount: true,
          payment: {
            select: {
              paymentDate: true,
              method: true,
            },
          },
          customer: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    ]);

    let trendMode: "campaigns" | "days" = "campaigns";
    let trendSeries: TrendPoint[] = [];

    const totalDebt = balances.reduce((acc, item) => acc + Number(item.balance.toString()), 0);
    const soldYear = purchases.reduce((acc, item) => acc + Number(item.totalAmount.toString()), 0);
    const collectedYear = paymentApplications.reduce(
      (acc, item) => acc + Number(item.appliedAmount.toString()),
      0,
    );

    const debtorMap = new Map<
      string,
      { customerId: string; customerName: string; debt: number; pendingCampaigns: Set<string> }
    >();

    for (const balance of balances) {
      const debt = Number(balance.balance.toString());
      if (debt <= 0) continue;

      const current = debtorMap.get(balance.customerId);
      if (current) {
        current.debt = roundCurrency(current.debt + debt);
        current.pendingCampaigns.add(balance.campaignId);
        continue;
      }

      debtorMap.set(balance.customerId, {
        customerId: balance.customerId,
        customerName: balance.customer.fullName,
        debt,
        pendingCampaigns: new Set([balance.campaignId]),
      });
    }

    const campaignFlow = campaigns.map((campaign) => {
      const sold = campaign.customerBalances.reduce(
        (acc, item) => acc + Number(item.totalPurchased.toString()),
        0,
      );
      const collected = campaign.customerBalances.reduce(
        (acc, item) => acc + Number(item.totalPaid.toString()),
        0,
      );
      const debt = campaign.customerBalances.reduce((acc, item) => acc + Number(item.balance.toString()), 0);

      return {
        campaignId: campaign.id,
        campaign: campaign.name,
        sold: roundCurrency(sold),
        collected: roundCurrency(collected),
        debt: roundCurrency(debt),
      };
    });

    if (selectedCampaign) {
      trendMode = "days";

      const soldByDay = new Map<number, number>();
      const paymentDays = new Set<number>();

      for (const purchase of purchases) {
        const campaignMatch = purchase.campaignId === selectedCampaign.id;
        if (!campaignMatch) continue;

        const day = purchase.purchaseDate.getDate();
        soldByDay.set(
          day,
          roundCurrency((soldByDay.get(day) ?? 0) + Number(purchase.totalAmount.toString())),
        );
      }

      for (const application of paymentApplications) {
        if (application.campaignId !== selectedCampaign.id) continue;

        paymentDays.add(application.payment.paymentDate.getDate());
      }

      trendSeries = Array.from(paymentDays)
        .sort((a, b) => a - b)
        .map((day) => ({
          label: String(day).padStart(2, "0"),
          sold: soldByDay.get(day) ?? 0,
          collected: 0,
          debt: 0,
        }));
    } else {
      trendMode = "campaigns";
      trendSeries = campaignFlow.map((campaign) => ({
        label: campaign.campaign,
        sold: campaign.sold,
        collected: 0,
        debt: 0,
      }));
    }

    const monthTotals = new Array<number>(12).fill(0);
    for (const application of paymentApplications) {
      const monthIndex = application.payment.paymentDate.getMonth();
      monthTotals[monthIndex] = roundCurrency(
        monthTotals[monthIndex] + Number(application.appliedAmount.toString()),
      );
    }

    const collectionsByMonth = monthLabels.map((label, index) => ({
      month: label,
      total: monthTotals[index],
    }));

    const latestPayments = latestApplicationsRaw.map((application) => ({
      paymentId: application.paymentId,
      date: application.payment.paymentDate,
      customerName: application.customer.fullName,
      amount: Number(application.appliedAmount.toString()),
      method: application.payment.method,
    }));

    const totalCustomersSet = new Set(balances.map((item) => item.customerId));

    const topDebtors = Array.from(debtorMap.values())
      .map((item) => ({
        customerId: item.customerId,
        customerName: item.customerName,
        debt: roundCurrency(item.debt),
        pendingCampaigns: item.pendingCampaigns.size,
        riskLevel: item.debt >= 1000 ? "ALTO" : item.debt >= 500 ? "MEDIO" : "BAJO",
      }))
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        selectedYear,
        availableYears: availableYears.length > 0 ? availableYears : [selectedYear],
        selectedCampaignId: selectedCampaign?.id ?? null,
        campaignOptions,
        indicators: {
          totalDebt: roundCurrency(totalDebt),
          collectedYear: roundCurrency(collectedYear),
          soldYear: roundCurrency(soldYear),
          customersWithDebt: debtorMap.size,
          totalCustomers: totalCustomersSet.size,
          activeCampaigns: campaigns.filter((campaign) => campaign.status === "OPEN").length,
          campaignsCount: campaigns.length,
        },
        campaignFlow,
        trendMode,
        trendSeries,
        collectionsByMonth,
        latestPayments,
        topDebtors,
      },
      businessId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el dashboard.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
