import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { syncCustomerLedger } from "@/lib/services/customer-ledger";
import { calculatePurchaseTotals } from "@/lib/services/financial";
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

const updatePurchaseSchema = z.object({
  customerId: z.string().uuid(),
  campaignId: z.string().uuid(),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
        { error: "No se encontro un negocio para este usuario. Ejecuta /api/setup/dev-seed." },
        { status: 404 },
      );
    }

    const { id } = await context.params;
    const json = await request.json();
    const payload = updatePurchaseSchema.parse(json);

    const [existingPurchase, customer, campaign] = await Promise.all([
      prisma.purchase.findFirst({
        where: {
          id,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          customerId: true,
          campaignId: true,
          purchaseDate: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: payload.customerId,
          businessId: ownedBusiness.id,
        },
        select: { id: true },
      }),
      prisma.campaign.findFirst({
        where: {
          id: payload.campaignId,
          businessId: ownedBusiness.id,
        },
        select: { id: true },
      }),
    ]);

    if (!existingPurchase) {
      return NextResponse.json({ error: "Compra no encontrada." }, { status: 404 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado para este negocio." }, { status: 404 });
    }

    if (!campaign) {
      return NextResponse.json({ error: "Campana no encontrada para este negocio." }, { status: 404 });
    }

    const totals = calculatePurchaseTotals(payload.items);

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: {
          id: existingPurchase.id,
        },
        data: {
          customerId: payload.customerId,
          campaignId: payload.campaignId,
          purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : existingPurchase.purchaseDate,
          notes: payload.notes?.trim() || null,
          totalAmount: totals.totalAmount,
          items: {
            deleteMany: {},
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
        include: {
          items: true,
        },
      });

      await Promise.all(
        totals.items.map((item) =>
          tx.product.upsert({
            where: {
              businessId_code: {
                businessId: ownedBusiness.id,
                code: item.code,
              },
            },
            create: {
              businessId: ownedBusiness.id,
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

      for (const customerId of new Set([existingPurchase.customerId, payload.customerId])) {
        await syncCustomerLedger(tx, ownedBusiness.id, customerId);
      }

      return purchase;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar la compra.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
