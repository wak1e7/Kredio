import { Prisma } from "@prisma/client";

import { allocatePaymentToOldestDebts } from "./financial";

type TransactionClient = Prisma.TransactionClient;
type CustomerCampaignStatus = "OPEN" | "PARTIAL" | "PAID";

type CampaignLedgerEntry = {
  campaignId: string;
  month: number;
  year: number;
  totalPurchased: number;
  totalPaid: number;
  balance: number;
};

type PaymentAllocationDraft = {
  paymentId: string;
  campaignId: string;
  appliedAmount: number;
};

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function sortByCampaignPeriod(entries: CampaignLedgerEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.campaignId.localeCompare(b.campaignId);
  });
}

function resolveBalanceStatus(totalPaid: number, balance: number): CustomerCampaignStatus {
  if (balance <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "OPEN";
}

export async function syncCustomerLedger(
  tx: TransactionClient,
  businessId: string,
  customerId: string,
) {
  const [purchases, payments] = await Promise.all([
    tx.purchase.findMany({
      where: {
        businessId,
        customerId,
      },
      select: {
        campaignId: true,
        totalAmount: true,
        campaign: {
          select: {
            id: true,
            month: true,
            year: true,
          },
        },
      },
    }),
    tx.payment.findMany({
      where: {
        businessId,
        customerId,
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        createdAt: true,
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  await tx.paymentApplication.deleteMany({
    where: {
      customerId,
    },
  });

  const ledgerMap = new Map<string, CampaignLedgerEntry>();

  for (const purchase of purchases) {
    const current = ledgerMap.get(purchase.campaignId);
    const purchasedAmount = Number(purchase.totalAmount.toString());

    if (current) {
      current.totalPurchased = roundCurrency(current.totalPurchased + purchasedAmount);
      current.balance = roundCurrency(current.totalPurchased - current.totalPaid);
      continue;
    }

    ledgerMap.set(purchase.campaignId, {
      campaignId: purchase.campaign.id,
      month: purchase.campaign.month,
      year: purchase.campaign.year,
      totalPurchased: purchasedAmount,
      totalPaid: 0,
      balance: purchasedAmount,
    });
  }

  const allocationDrafts: PaymentAllocationDraft[] = [];

  for (const payment of payments) {
    const openBalances = sortByCampaignPeriod(Array.from(ledgerMap.values()))
      .filter((entry) => entry.balance > 0)
      .map((entry) => ({
        customerCampaignId: entry.campaignId,
        campaignId: entry.campaignId,
        year: entry.year,
        month: entry.month,
        balance: entry.balance,
      }));

    if (openBalances.length === 0) {
      continue;
    }

    const { allocations } = allocatePaymentToOldestDebts(Number(payment.amount.toString()), openBalances);

    for (const allocation of allocations) {
      const target = ledgerMap.get(allocation.campaignId);

      if (!target) continue;

      target.totalPaid = roundCurrency(target.totalPaid + allocation.appliedAmount);
      target.balance = allocation.remainingBalance;

      allocationDrafts.push({
        paymentId: payment.id,
        campaignId: allocation.campaignId,
        appliedAmount: allocation.appliedAmount,
      });
    }
  }

  await tx.customerCampaignBalance.deleteMany({
    where: {
      customerId,
    },
  });

  const balanceIdByCampaign = new Map<string, string>();

  for (const entry of sortByCampaignPeriod(Array.from(ledgerMap.values()))) {
    if (entry.totalPurchased <= 0 && entry.totalPaid <= 0) {
      continue;
    }

    const balance = roundCurrency(entry.totalPurchased - entry.totalPaid);
    const record = await tx.customerCampaignBalance.create({
      data: {
        customerId,
        campaignId: entry.campaignId,
        totalPurchased: entry.totalPurchased,
        totalPaid: entry.totalPaid,
        balance,
        status: resolveBalanceStatus(entry.totalPaid, balance),
      },
      select: {
        id: true,
        campaignId: true,
      },
    });

    balanceIdByCampaign.set(record.campaignId, record.id);
  }

  if (allocationDrafts.length > 0) {
    await tx.paymentApplication.createMany({
      data: allocationDrafts
        .map((draft) => {
          const customerCampaignId = balanceIdByCampaign.get(draft.campaignId);
          if (!customerCampaignId) return null;

          return {
            paymentId: draft.paymentId,
            customerId,
            campaignId: draft.campaignId,
            customerCampaignId,
            appliedAmount: draft.appliedAmount,
          };
        })
        .filter((draft): draft is NonNullable<typeof draft> => Boolean(draft)),
    });
  }
}
