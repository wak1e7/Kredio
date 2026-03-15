import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { CustomerStatus } from "@prisma/client";
import { z } from "zod";

const createCustomerSchema = z.object({
  businessId: z.string().uuid().optional(),
  fullName: z.string().min(2),
  phone: z.string().min(6),
  documentId: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
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
    const query = searchParams.get("q")?.trim();
    const debtMode = searchParams.get("debtMode"); // with | without | all
    const statusParam = searchParams.get("status");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const customerStatus =
      statusParam === "ACTIVE" || statusParam === "INACTIVE"
        ? (statusParam as CustomerStatus)
        : undefined;

    const customers = await prisma.customer.findMany({
      where: {
        businessId: businessResolution.businessId,
        status: customerStatus,
        OR: query
          ? [
              { fullName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
        campaignBalances:
          debtMode === "with"
            ? { some: { balance: { gt: 0 } } }
            : debtMode === "without"
              ? { none: { balance: { gt: 0 } } }
              : undefined,
      },
      include: {
        campaignBalances: {
          select: {
            balance: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = customers.map((customer) => {
      const totalDebt = customer.campaignBalances.reduce(
        (acc, balance) => acc + Number(balance.balance.toString()),
        0,
      );

      return {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        documentId: customer.documentId,
        address: customer.address,
        email: customer.email,
        notes: customer.notes,
        status: customer.status,
        totalDebt: Number(totalDebt.toFixed(2)),
        createdAt: customer.createdAt,
      };
    });

    return NextResponse.json({ data, businessId: businessResolution.businessId });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo listar clientes.",
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
    const payload = createCustomerSchema.parse(json);

    const businessResolution = await resolveBusinessId(user.id, payload.businessId);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const created = await prisma.customer.create({
      data: {
        businessId: businessResolution.businessId,
        fullName: payload.fullName,
        phone: payload.phone,
        documentId: payload.documentId,
        address: payload.address,
        email: payload.email,
        notes: payload.notes,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo crear el cliente.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

