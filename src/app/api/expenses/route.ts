import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createExpenseSchema = z.object({
  businessId: z.string().uuid().optional(),
  campaignId: z.string().uuid(),
  concept: z.string().min(1),
  amount: z.number().positive(),
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

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const [expenses, campaignOptions] = await Promise.all([
      prisma.expense.findMany({
        where: {
          businessId: businessResolution.businessId,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              year: true,
            },
          },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.campaign.findMany({
        where: {
          businessId: businessResolution.businessId,
        },
        select: {
          id: true,
          name: true,
          month: true,
          year: true,
          status: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { name: "desc" }],
      }),
    ]);

    const totalAmount = expenses.reduce((acc, expense) => acc + Number(expense.amount.toString()), 0);

    return NextResponse.json({
      data: expenses.map((expense) => ({
        id: expense.id,
        expenseDate: expense.expenseDate,
        campaignId: expense.campaignId,
        campaignName: expense.campaign?.name ?? "Sin campaña",
        concept: expense.concept,
        amount: Number(expense.amount.toString()),
        notes: expense.notes,
      })),
      campaignOptions,
      totalAmount: Number(totalAmount.toFixed(2)),
      businessId: businessResolution.businessId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar gastos.",
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
    const payload = createExpenseSchema.parse(json);

    const businessResolution = await resolveBusinessId(user.id, payload.businessId);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: payload.campaignId,
        businessId: businessResolution.businessId,
      },
      select: {
        id: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada para este negocio." }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        businessId: businessResolution.businessId,
        campaignId: payload.campaignId,
        expenseDate: new Date(),
        concept: payload.concept.trim(),
        amount: payload.amount,
        notes: payload.notes?.trim() || null,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: expense.id,
          expenseDate: expense.expenseDate,
          campaignId: expense.campaignId,
          campaignName: expense.campaign?.name ?? "Sin campaña",
          concept: expense.concept,
          amount: Number(expense.amount.toString()),
          notes: expense.notes,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo registrar el gasto.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}


