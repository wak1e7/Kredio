import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { syncCustomerLedger } from "@/lib/services/customer-ledger";
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

    const originError = validateTrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
      { error: "No se encontró un negocio para este usuario." },
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
          source: true,
          items: {
            select: {
              id: true,
              warehouseItemId: true,
              quantity: true,
            },
          },
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
      return NextResponse.json({ error: "Campaña no encontrada para este negocio." }, { status: 404 });
    }

    if (existingPurchase.source === "WAREHOUSE_TRANSFER") {
      const transferItem = existingPurchase.items[0];

      if (!transferItem?.warehouseItemId || existingPurchase.items.length !== 1) {
        return NextResponse.json(
          { error: "La compra asignada desde almacén no tiene una estructura editable compatible." },
          { status: 400 },
        );
      }

      const desiredItem = payload.items[0];
      if (!desiredItem) {
        return NextResponse.json({ error: "Debes mantener un producto en la compra." }, { status: 400 });
      }

      const warehouseItem = await prisma.warehouseItem.findFirst({
        where: {
          id: transferItem.warehouseItemId,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          size: true,
          color: true,
          availableQuantity: true,
          costPrice: true,
          salePrice: true,
        },
      });

      if (!warehouseItem) {
        return NextResponse.json({ error: "El producto original de almacén ya no existe." }, { status: 404 });
      }

      const nextQuantity = desiredItem.quantity;
      const stockDelta = nextQuantity - transferItem.quantity;

      if (stockDelta > warehouseItem.availableQuantity) {
        return NextResponse.json(
          { error: "La cantidad solicitada supera el stock disponible en almacén." },
          { status: 400 },
        );
      }

      const nextTotalAmount = Number(
        (nextQuantity * desiredItem.salePrice).toFixed(2),
      );

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
            totalAmount: nextTotalAmount,
            items: {
              update: {
                where: {
                  id: transferItem.id,
                },
                data: {
                  productCode: desiredItem.code,
                  productName: desiredItem.name,
                  category: desiredItem.category,
                  size: desiredItem.size,
                  color: desiredItem.color,
                  quantity: nextQuantity,
                  costPrice: desiredItem.costPrice,
                  salePrice: desiredItem.salePrice,
                  unitPrice: desiredItem.salePrice,
                  subtotal: nextTotalAmount,
                },
              },
            },
          },
          include: {
            items: true,
          },
        });

        if (stockDelta !== 0) {
          await tx.warehouseItem.update({
            where: {
              id: warehouseItem.id,
            },
            data: {
              availableQuantity:
                stockDelta > 0
                  ? { decrement: stockDelta }
                  : { increment: Math.abs(stockDelta) },
            },
          });
        }

        await tx.product.upsert({
          where: {
            businessId_code: {
              businessId: ownedBusiness.id,
              code: desiredItem.code,
            },
          },
          create: {
            businessId: ownedBusiness.id,
            code: desiredItem.code,
            name: desiredItem.name,
            category: desiredItem.category,
            size: desiredItem.size,
            color: desiredItem.color,
          },
          update: {
            name: desiredItem.name,
            category: desiredItem.category,
            size: desiredItem.size,
            color: desiredItem.color,
            isActive: true,
          },
        });

        for (const customerId of new Set([existingPurchase.customerId, payload.customerId])) {
          await syncCustomerLedger(tx, ownedBusiness.id, customerId);
        }

        return purchase;
      });

      return NextResponse.json({ data: result });
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const originError = validateTrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "No se encontró un negocio para este usuario." }, { status: 404 });
    }

    const { id } = await context.params;
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        id,
        businessId: ownedBusiness.id,
      },
      select: {
        id: true,
        customerId: true,
        source: true,
        items: {
          select: {
            warehouseItemId: true,
            quantity: true,
          },
        },
      },
    });

    if (!existingPurchase) {
      return NextResponse.json({ error: "Compra no encontrada." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of existingPurchase.items) {
        if (!item.warehouseItemId) {
          continue;
        }

        await tx.warehouseItem.update({
          where: {
            id: item.warehouseItemId,
          },
          data: {
            availableQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.purchase.delete({
        where: {
          id: existingPurchase.id,
        },
      });

      await syncCustomerLedger(tx, ownedBusiness.id, existingPurchase.customerId);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar la compra.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

