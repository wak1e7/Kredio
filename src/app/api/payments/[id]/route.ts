import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { syncCustomerLedger } from "@/lib/services/customer-ledger";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updatePaymentSchema = z.object({
  customerId: z.string().uuid(),
  paymentDate: z.string().datetime().optional(),
  amount: z.number().positive(),
  method: z.union([z.string(), z.null()]).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
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
    const payload = updatePaymentSchema.parse(json);

    const [existingPayment, customer] = await Promise.all([
      prisma.payment.findFirst({
        where: {
          id,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          customerId: true,
          paymentDate: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: payload.customerId,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!existingPayment) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado para este negocio." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          customerId: payload.customerId,
          paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : existingPayment.paymentDate,
          amount: payload.amount,
          method: payload.method?.trim() || null,
          notes: payload.notes?.trim() || null,
        },
      });

      for (const customerId of new Set([existingPayment.customerId, payload.customerId])) {
        await syncCustomerLedger(tx, ownedBusiness.id, customerId);
      }

      return payment;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el pago.",
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
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id,
        businessId: ownedBusiness.id,
      },
      select: {
        id: true,
        customerId: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({
        where: {
          id: existingPayment.id,
        },
      });

      await syncCustomerLedger(tx, ownedBusiness.id, existingPayment.customerId);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar el pago.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
