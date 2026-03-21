import { prisma } from "@/lib/prisma";

const CATEGORY_ORDER = ["Sokso", "Footloose", "Leonisa"] as const;

export type ReportCampaignOption = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
};

export type ReportSummaryData = {
  sold: number;
  collected: number;
  pending: number;
  cost: number;
  margin: number;
  campaignsCount: number;
};

export type ReportCampaignBreakdownRow = {
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

export type ReportCategoryMarginRow = {
  category: string;
  sold: number;
  cost: number;
  margin: number;
  itemsCount: number;
};

export type ReportExpenseHistoryRow = {
  id: string;
  expenseDate: Date;
  campaignName: string;
  concept: string;
  amount: number;
  notes?: string | null;
};

export type ReportTopBuyerRow = {
  customerId: string;
  customerName: string;
  totalPurchased: number;
  purchasesCount: number;
};

export type ReportTopDebtorRow = {
  customerId: string;
  customerName: string;
  debt: number;
  pendingCampaigns: number;
};

export type ReportOverviewData = {
  selectedYear: number;
  availableYears: number[];
  selectedCampaignId: string | null;
  campaignOptions: ReportCampaignOption[];
  annualSummary: ReportSummaryData;
  expensesTotal: number;
  expensesHistory: ReportExpenseHistoryRow[];
  campaignBreakdown: ReportCampaignBreakdownRow[];
  categoryMargins: ReportCategoryMarginRow[];
  topBuyers: ReportTopBuyerRow[];
  topDebtors: ReportTopDebtorRow[];
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getReportOverviewData({
  businessId,
  requestedYear,
  requestedCampaignId,
}: {
  businessId: string;
  requestedYear?: number;
  requestedCampaignId?: string | null;
}): Promise<ReportOverviewData> {
  const availableCampaignYears = await prisma.campaign.findMany({
    where: { businessId },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });

  const availableYears = availableCampaignYears.map((entry) => entry.year);
  const fallbackYear = availableYears[0] ?? new Date().getFullYear();
  const selectedYear =
    requestedYear && availableYears.includes(requestedYear) ? requestedYear : fallbackYear;

  const yearCampaignOptions = await prisma.campaign.findMany({
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

  const selectedCampaignId =
    requestedCampaignId && yearCampaignOptions.some((campaign) => campaign.id === requestedCampaignId)
      ? requestedCampaignId
      : null;

  const [scopedCampaigns, scopedPurchases, scopedExpenses] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        businessId,
        year: selectedYear,
        id: selectedCampaignId ?? undefined,
      },
      include: {
        customerBalances: {
          select: {
            customerId: true,
            totalPurchased: true,
            totalPaid: true,
            balance: true,
            customer: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: [{ month: "asc" }, { name: "asc" }],
    }),
    prisma.purchase.findMany({
      where: {
        businessId,
        campaignId: selectedCampaignId ?? undefined,
        campaign: {
          year: selectedYear,
        },
      },
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            month: true,
            year: true,
          },
        },
        items: {
          select: {
            id: true,
            category: true,
            quantity: true,
            subtotal: true,
            costPrice: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        businessId,
        campaignId: selectedCampaignId ?? undefined,
        campaign: {
          year: selectedYear,
        },
      },
      select: {
        id: true,
        expenseDate: true,
        concept: true,
        amount: true,
        notes: true,
        campaignId: true,
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const categoryMap = new Map<string, { category: string; sold: number; cost: number; margin: number; itemsCount: number }>();
  const buyerMap = new Map<string, { customerId: string; customerName: string; totalPurchased: number; purchasesCount: number }>();
  const debtorMap = new Map<string, { customerId: string; customerName: string; debt: number; pendingCampaigns: number }>();
  const campaignMarginMap = new Map<string, number>();

  for (const category of CATEGORY_ORDER) {
    categoryMap.set(category, {
      category,
      sold: 0,
      cost: 0,
      margin: 0,
      itemsCount: 0,
    });
  }

  for (const purchase of scopedPurchases) {
    const buyerEntry = buyerMap.get(purchase.customerId) ?? {
      customerId: purchase.customerId,
      customerName: purchase.customer.fullName,
      totalPurchased: 0,
      purchasesCount: 0,
    };

    buyerEntry.totalPurchased += Number(purchase.totalAmount.toString());
    buyerEntry.purchasesCount += 1;
    buyerMap.set(purchase.customerId, buyerEntry);

    let campaignCost = 0;

    for (const item of purchase.items) {
      const sold = Number(item.subtotal.toString());
      const cost = Number((item.quantity * Number(item.costPrice.toString())).toFixed(2));
      const margin = sold - cost;
      const category =
        item.category && CATEGORY_ORDER.includes(item.category as (typeof CATEGORY_ORDER)[number])
          ? item.category
          : "Sin categoría";

      const categoryEntry = categoryMap.get(category) ?? {
        category,
        sold: 0,
        cost: 0,
        margin: 0,
        itemsCount: 0,
      };

      categoryEntry.sold += sold;
      categoryEntry.cost += cost;
      categoryEntry.margin += margin;
      categoryEntry.itemsCount += item.quantity;
      categoryMap.set(category, categoryEntry);

      campaignCost += cost;
    }

    const currentCampaignMargin = campaignMarginMap.get(purchase.campaign.id) ?? 0;
    const nextMargin = currentCampaignMargin + Number(purchase.totalAmount.toString()) - campaignCost;
    campaignMarginMap.set(purchase.campaign.id, nextMargin);
  }

  const campaignCostMap = new Map<string, number>();

  for (const purchase of scopedPurchases) {
    let purchaseCost = 0;
    for (const item of purchase.items) {
      purchaseCost += item.quantity * Number(item.costPrice.toString());
    }

    const currentCost = campaignCostMap.get(purchase.campaign.id) ?? 0;
    campaignCostMap.set(purchase.campaign.id, currentCost + purchaseCost);
  }

  const campaignBreakdown = scopedCampaigns.map((campaign) => {
    const sold = campaign.customerBalances.reduce((acc, item) => acc + Number(item.totalPurchased.toString()), 0);
    const collected = campaign.customerBalances.reduce((acc, item) => acc + Number(item.totalPaid.toString()), 0);
    const pending = campaign.customerBalances.reduce((acc, item) => acc + Number(item.balance.toString()), 0);
    const cost = campaignCostMap.get(campaign.id) ?? 0;

    for (const balance of campaign.customerBalances) {
      const currentDebt = Number(balance.balance.toString());
      if (currentDebt <= 0) {
        continue;
      }

      const debtorEntry = debtorMap.get(balance.customerId) ?? {
        customerId: balance.customerId,
        customerName: balance.customer.fullName,
        debt: 0,
        pendingCampaigns: 0,
      };

      debtorEntry.debt += currentDebt;
      debtorEntry.pendingCampaigns += 1;
      debtorMap.set(balance.customerId, debtorEntry);
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      month: campaign.month,
      year: campaign.year,
      sold: roundMoney(sold),
      cost: roundMoney(cost),
      collected: roundMoney(collected),
      pending: roundMoney(pending),
      margin: roundMoney(campaignMarginMap.get(campaign.id) ?? 0),
      customersCount: campaign.customerBalances.length,
    };
  });

  const annualSold = campaignBreakdown.reduce((acc, item) => acc + item.sold, 0);
  const annualCollected = campaignBreakdown.reduce((acc, item) => acc + item.collected, 0);
  const annualPending = campaignBreakdown.reduce((acc, item) => acc + item.pending, 0);
  const purchaseCost = [...categoryMap.values()].reduce((acc, item) => acc + item.cost, 0);
  const expensesTotal = scopedExpenses.reduce((acc, expense) => acc + Number(expense.amount.toString()), 0);
  const annualCost = purchaseCost + expensesTotal;
  const annualMargin = annualSold - annualCost;

  const expenseCostMap = new Map<string, number>();
  for (const expense of scopedExpenses) {
    if (!expense.campaignId) {
      continue;
    }

    const current = expenseCostMap.get(expense.campaignId) ?? 0;
    expenseCostMap.set(expense.campaignId, current + Number(expense.amount.toString()));
  }

  const normalizedCampaignBreakdown = campaignBreakdown.map((campaign) => {
    const expenseCost = expenseCostMap.get(campaign.campaignId) ?? 0;
    const totalCost = campaign.cost + expenseCost;
    return {
      ...campaign,
      cost: roundMoney(totalCost),
      margin: roundMoney(campaign.sold - totalCost),
    };
  });

  const categoryMargins = [...categoryMap.values()]
    .map((entry) => ({
      category: entry.category,
      sold: roundMoney(entry.sold),
      cost: roundMoney(entry.cost),
      margin: roundMoney(entry.margin),
      itemsCount: entry.itemsCount,
    }))
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]);
      const orderB = CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]);

      if (orderA === -1 && orderB === -1) return a.category.localeCompare(b.category);
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });

  const topBuyers = [...buyerMap.values()]
    .map((entry) => ({
      ...entry,
      totalPurchased: roundMoney(entry.totalPurchased),
    }))
    .sort((a, b) => b.totalPurchased - a.totalPurchased)
    .slice(0, 5);

  const topDebtors = [...debtorMap.values()]
    .map((entry) => ({
      ...entry,
      debt: roundMoney(entry.debt),
    }))
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 5);

  return {
    selectedYear,
    availableYears,
    selectedCampaignId,
    campaignOptions: yearCampaignOptions,
    annualSummary: {
      sold: roundMoney(annualSold),
      collected: roundMoney(annualCollected),
      pending: roundMoney(annualPending),
      cost: roundMoney(purchaseCost + expensesTotal),
      margin: roundMoney(annualMargin),
      campaignsCount: campaignBreakdown.length,
    },
    expensesTotal: roundMoney(expensesTotal),
    expensesHistory: scopedExpenses.map((expense) => ({
      id: expense.id,
      expenseDate: expense.expenseDate,
      campaignName: expense.campaign?.name ?? "Sin campaña",
      concept: expense.concept,
      amount: Number(expense.amount.toString()),
      notes: expense.notes,
    })),
    campaignBreakdown: normalizedCampaignBreakdown,
    categoryMargins,
    topBuyers,
    topDebtors,
  };
}