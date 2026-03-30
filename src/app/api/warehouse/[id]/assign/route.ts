import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { syncCustomerLedger } from "@/lib/services/customer-ledger";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const assignWarehouseItemSchema = z.object({
  customerId: z.string().uuid(),
  quantity: z.number().int().min(1),
  assignmentDate: z.string().datetime().optional(),
});

export async function POST(
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
    const json = await request.json();
    const payload = assignWarehouseItemSchema.parse(json);

    const [warehouseItem, customer] = await Promise.all([
      prisma.warehouseItem.findFirst({
        where: {
          id,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          businessId: true,
          campaignId: true,
          code: true,
          name: true,
          category: true,
          size: true,
          color: true,
          availableQuantity: true,
          costPrice: true,
          salePrice: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: payload.customerId,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          fullName: true,
        },
      }),
    ]);

    if (!warehouseItem) {
      return NextResponse.json({ error: "Producto de almacén no encontrado." }, { status: 404 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado para este negocio." }, { status: 404 });
    }

    if (payload.quantity > warehouseItem.availableQuantity) {
      return NextResponse.json({ error: "La cantidad solicitada supera el stock disponible." }, { status: 400 });
    }

    const totalAmount = Number((payload.quantity * Number(warehouseItem.salePrice.toString())).toFixed(2));

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          businessId: ownedBusiness.id,
          customerId: payload.customerId,
          campaignId: warehouseItem.campaignId,
          source: "WAREHOUSE_TRANSFER",
          purchaseDate: payload.assignmentDate ? new Date(payload.assignmentDate) : new Date(),
          totalAmount,
          items: {
            create: {
              warehouseItemId: warehouseItem.id,
              productCode: warehouseItem.code,
              productName: warehouseItem.name,
              category: warehouseItem.category,
              size: warehouseItem.size,
              color: warehouseItem.color,
              quantity: payload.quantity,
              costPrice: warehouseItem.costPrice,
              salePrice: warehouseItem.salePrice,
              unitPrice: warehouseItem.salePrice,
              subtotal: totalAmount,
            },
          },
        },
        select: {
          id: true,
          purchaseDate: true,
        },
      });

      await tx.warehouseItem.update({
        where: { id: warehouseItem.id },
        data: {
          availableQuantity: {
            decrement: payload.quantity,
          },
        },
      });

      await syncCustomerLedger(tx, ownedBusiness.id, payload.customerId);

      return purchase;
    });

    return NextResponse.json({
      data: {
        purchaseId: result.id,
        purchaseDate: result.purchaseDate,
        customerName: customer.fullName,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo asignar el producto al cliente.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}