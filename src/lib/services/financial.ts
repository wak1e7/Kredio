export type PurchaseItemInput = {
  code: string;
  name: string;
  category: string;
  size?: string;
  color?: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
};

export type OpenBalanceInput = {
  customerCampaignId: string;
  campaignId: string;
  year: number;
  month: number;
  balance: number;
};

export type AllocationResult = {
  customerCampaignId: string;
  campaignId: string;
  appliedAmount: number;
  remainingBalance: number;
};

export function calculatePurchaseTotals(items: PurchaseItemInput[]) {
  const mappedItems = items.map((item) => {
    const subtotal = Number((item.quantity * item.salePrice).toFixed(2));
    return {
      ...item,
      subtotal,
    };
  });

  const totalAmount = Number(mappedItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2));

  return {
    totalAmount,
    items: mappedItems,
  };
}

export function allocatePaymentToOldestDebts(amount: number, balances: OpenBalanceInput[]) {
  let remaining = amount;

  const sorted = [...balances].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const allocations: AllocationResult[] = [];

  for (const entry of sorted) {
    if (remaining <= 0) break;
    if (entry.balance <= 0) continue;

    const appliedAmount = Number(Math.min(remaining, entry.balance).toFixed(2));
    const remainingBalance = Number((entry.balance - appliedAmount).toFixed(2));
    remaining = Number((remaining - appliedAmount).toFixed(2));

    allocations.push({
      customerCampaignId: entry.customerCampaignId,
      campaignId: entry.campaignId,
      appliedAmount,
      remainingBalance,
    });
  }

  return {
    allocations,
    unappliedAmount: remaining,
  };
}
