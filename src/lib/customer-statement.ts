import { prisma } from "@/lib/prisma";
import { CustomerCampaignStatus } from "@prisma/client";

export type CustomerStatementProduct = {
  productKey: string;
  productName: string;
  totalQty: number;
  totalAmount: number;
  lastCampaign: string;
  lastDate: Date;
};

export type CustomerStatementMovement = {
  id: string;
  date: Date;
  concept: string;
  reference: string;
  charge: number;
  credit: number;
};

export type CustomerStatementData = {
  customer: {
    id: string;
    fullName: string;
    documentId: string | null;
    phone: string;
    address: string | null;
    email: string | null;
    status: string;
    createdAt: Date;
  };
  totals: {
    totalDebt: number;
    totalPurchased: number;
    totalPaid: number;
    campaignsCount: number;
    campaignsWithDebtCount: number;
  };
  campaigns: Array<{
    id: string;
    campaignId: string;
    campaignName: string;
    month: number;
    year: number;
    totalPurchased: number;
    totalPaid: number;
    balance: number;
    status: CustomerCampaignStatus;
  }>;
  products: CustomerStatementProduct[];
  payments: Array<{
    id: string;
    paymentDate: Date;
    amount: number;
      method: string | null;
      notes: string | null;
    }>;
  movements: CustomerStatementMovement[];
};

export async function getCustomerStatementData(userId: string, customerId: string): Promise<CustomerStatementData | null> {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      business: {
        ownerId: userId,
      },
    },
    include: {
      campaignBalances: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              month: true,
              year: true,
            },
          },
        },
      },
      payments: {
        orderBy: {
          paymentDate: "asc",
        },
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          method: true,
          notes: true,
        },
      },
      purchases: {
        orderBy: {
          purchaseDate: "asc",
        },
        include: {
          campaign: {
            select: {
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              productCode: true,
              productName: true,
              size: true,
              color: true,
              quantity: true,
              subtotal: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  const totalDebt = Number(
    customer.campaignBalances.reduce((acc, item) => acc + Number(item.balance.toString()), 0).toFixed(2),
  );
  const totalPurchased = Number(
    customer.campaignBalances.reduce((acc, item) => acc + Number(item.totalPurchased.toString()), 0).toFixed(2),
  );
  const totalPaid = Number(
    customer.campaignBalances.reduce((acc, item) => acc + Number(item.totalPaid.toString()), 0).toFixed(2),
  );
  const campaignsWithDebtCount = customer.campaignBalances.filter(
    (item) => Number(item.balance.toString()) > 0,
  ).length;

  const campaigns = [...customer.campaignBalances]
    .sort((a, b) => {
      if (a.campaign.year !== b.campaign.year) return a.campaign.year - b.campaign.year;
      return a.campaign.month - b.campaign.month;
    })
    .map((campaign) => ({
      id: campaign.id,
      campaignId: campaign.campaign.id,
      campaignName: campaign.campaign.name,
      month: campaign.campaign.month,
      year: campaign.campaign.year,
      totalPurchased: Number(campaign.totalPurchased.toString()),
      totalPaid: Number(campaign.totalPaid.toString()),
      balance: Number(campaign.balance.toString()),
      status: campaign.status,
    }));

  const productMap = new Map<string, CustomerStatementProduct>();

  for (const purchase of customer.purchases) {
    for (const item of purchase.items) {
      const key = `${item.productCode}|${item.productName}`;
      const existing = productMap.get(key);
      const subtotal = Number(item.subtotal.toString());

      if (!existing) {
        productMap.set(key, {
          productKey: key,
          productName: item.productName,
          totalQty: item.quantity,
          totalAmount: subtotal,
          lastCampaign: purchase.campaign.name,
          lastDate: purchase.purchaseDate,
        });
        continue;
      }

      existing.totalQty += item.quantity;
      existing.totalAmount = Number((existing.totalAmount + subtotal).toFixed(2));
      if (purchase.purchaseDate > existing.lastDate) {
        existing.lastDate = purchase.purchaseDate;
        existing.lastCampaign = purchase.campaign.name;
      }
    }
  }

  const products = [...productMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  const payments = customer.payments.map((payment) => ({
    id: payment.id,
    paymentDate: payment.paymentDate,
    amount: Number(payment.amount.toString()),
    method: payment.method,
    notes: payment.notes,
  }));
  const movements: CustomerStatementMovement[] = [];

  for (const purchase of customer.purchases) {
    for (const item of purchase.items) {
      const detailParts = [`Cant. ${item.quantity}`];

      if (item.size) {
        detailParts.push(`Talla ${item.size}`);
      }

      if (item.color) {
        detailParts.push(`Color ${item.color}`);
      }

      movements.push({
        id: item.id,
        date: purchase.purchaseDate,
        concept: `${item.productName} (${detailParts.join(" | ")})`,
        reference: item.productCode,
        charge: Number(item.subtotal.toString()),
        credit: 0,
      });
    }
  }

  for (const payment of customer.payments) {
    movements.push({
      id: payment.id,
      date: payment.paymentDate,
      concept: "Pago registrado",
      reference: payment.id.slice(0, 8).toUpperCase(),
      charge: 0,
      credit: Number(payment.amount.toString()),
    });
  }

  movements.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    if (a.charge !== b.charge) return b.charge - a.charge;
    return a.reference.localeCompare(b.reference);
  });

  return {
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      documentId: customer.documentId,
      phone: customer.phone,
      address: customer.address,
      email: customer.email,
      status: customer.status,
      createdAt: customer.createdAt,
    },
    totals: {
      totalDebt,
      totalPurchased,
      totalPaid,
      campaignsCount: campaigns.length,
      campaignsWithDebtCount,
    },
    campaigns,
    products,
    payments,
    movements,
  };
}
