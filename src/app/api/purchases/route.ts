import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { calculatePurchaseTotals } from "@/lib/services/financial";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const purchaseItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["Sokso", "Footloose", "Leonisa"]),
  size: z.string().optional(),
  color: z.string().optional(),
  quantity: z.number().int().min(1),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive(),
});

const createPurchaseSchema = z.object({
  businessId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  campaignId: z.string().uuid(),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
});

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
    return { error: "No se encontró un negocio para este usuario.", status: 404 as const };
  }

  return { businessId: ownedBusiness.id };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const originError = validateTrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");
    const customerId = searchParams.get("customerId");
    const campaignId = searchParams.get("campaignId");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const purchases = await prisma.purchase.findMany({
      where: {
        businessId: businessResolution.businessId,
        customerId: customerId || undefined,
        campaignId: campaignId || undefined,
      },
      include: {
        customer: { select: { fullName: true } },
        campaign: { select: { name: true } },
        items: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            category: true,
            size: true,
            color: true,
            quantity: true,
            costPrice: true,
            salePrice: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    const data = purchases.map((purchase) => ({
      id: purchase.id,
      purchaseDate: purchase.purchaseDate,
      customerId: purchase.customerId,
      customerName: purchase.customer.fullName,
      campaignId: purchase.campaignId,
      campaignName: purchase.campaign.name,
      itemsCount: purchase.items.length,
      totalAmount: Number(purchase.totalAmount.toString()),
      items: purchase.items.map((item) => ({
        id: item.id,
        code: item.productCode,
        name: item.productName,
        category: item.category,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        costPrice: Number(item.costPrice.toString()),
        salePrice: Number(item.salePrice.toString()),
      })),
    }));

    return NextResponse.json({ data, businessId: businessResolution.businessId });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo listar compras.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const json = await request.json();
    const payload = createPurchaseSchema.parse(json);

    const businessResolution = await resolveBusinessId(user.id, payload.businessId);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const [campaign, customer] = await Promise.all([
      prisma.campaign.findFirst({
        where: {
          id: payload.campaignId,
          businessId: businessResolution.businessId,
        },
        select: {
          id: true,
          status: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: payload.customerId,
          businessId: businessResolution.businessId,
        },
        select: { id: true },
      }),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada para este negocio." }, { status: 404 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado para este negocio." }, { status: 404 });
    }

    if (campaign.status === "CLOSED") {
      return NextResponse.json(
        { error: "No se pueden registrar compras en una campaña cerrada." },
        { status: 400 },
      );
    }

    const totals = calculatePurchaseTotals(payload.items);

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          businessId: businessResolution.businessId,
          customerId: payload.customerId,
          campaignId: payload.campaignId,
          purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : new Date(),
          notes: payload.notes,
          totalAmount: totals.totalAmount,
          items: {
            create: totals.items.map((item) => ({
              productCode: item.code,
              productName: item.name,
              category: item.category,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
              costPrice: item.costPrice,
              salePrice: item.salePrice,
              unitPrice: item.salePrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      await Promise.all(
        totals.items.map((item) =>
          tx.product.upsert({
            where: {
              businessId_code: {
                businessId: businessResolution.businessId,
                code: item.code,
              },
            },
            create: {
              businessId: businessResolution.businessId,
              code: item.code,
              name: item.name,
              category: item.category,
              size: item.size,
              color: item.color,
            },
            update: {
              name: item.name,
              category: item.category,
              size: item.size,
              color: item.color,
              isActive: true,
            },
          }),
        ),
      );

      const existing = await tx.customerCampaignBalance.findUnique({
        where: {
          customerId_campaignId: {
            customerId: payload.customerId,
            campaignId: payload.campaignId,
          },
        },
      });

      if (!existing) {
        await tx.customerCampaignBalance.create({
          data: {
            customerId: payload.customerId,
            campaignId: payload.campaignId,
            totalPurchased: totals.totalAmount,
            totalPaid: 0,
            balance: totals.totalAmount,
            status: "OPEN",
          },
        });
      } else {
        const currentPurchased = Number(existing.totalPurchased.toString());
        const currentPaid = Number(existing.totalPaid.toString());
        const nextPurchased = Number((currentPurchased + totals.totalAmount).toFixed(2));
        const nextBalance = Number((nextPurchased - currentPaid).toFixed(2));

        await tx.customerCampaignBalance.update({
          where: { id: existing.id },
          data: {
            totalPurchased: nextPurchased,
            balance: nextBalance,
            status: currentPaid > 0 ? "PARTIAL" : "OPEN",
          },
        });
      }

      return purchase;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo registrar la compra.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}


