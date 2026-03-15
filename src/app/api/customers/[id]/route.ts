import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

const updateCustomerSchema = z
  .object({
    fullName: z.string().min(2).optional(),
    phone: z.string().min(6).optional(),
    documentId: z.union([z.string(), z.null()]).optional(),
    address: z.union([z.string(), z.null()]).optional(),
    email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
    notes: z.union([z.string(), z.null()]).optional(),
    status: z.enum(CUSTOMER_STATUSES).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
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

    const { id } = await context.params;
    const json = await request.json();
    const payload = updateCustomerSchema.parse(json);

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
      { error: "No se encontró un negocio para este usuario." },
        { status: 404 },
      );
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        businessId: ownedBusiness.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        fullName: payload.fullName?.trim(),
        phone: payload.phone?.trim(),
        documentId:
          payload.documentId === undefined
            ? undefined
            : payload.documentId?.trim()
              ? payload.documentId.trim()
              : null,
        address:
          payload.address === undefined
            ? undefined
            : payload.address?.trim()
              ? payload.address.trim()
              : null,
        email:
          payload.email === undefined
            ? undefined
            : payload.email?.trim()
              ? payload.email.trim()
              : null,
        notes:
          payload.notes === undefined
            ? undefined
            : payload.notes?.trim()
              ? payload.notes.trim()
              : null,
        status: payload.status,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        documentId: true,
        address: true,
        email: true,
        notes: true,
        status: true,
      },
    });

    return NextResponse.json({ data: updatedCustomer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el cliente.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
