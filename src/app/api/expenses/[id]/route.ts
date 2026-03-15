import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateExpenseSchema = z.object({
  campaignId: z.string().uuid(),
  concept: z.string().min(1),
  amount: z.number().positive(),
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

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
        { error: "No se encontro un negocio para este usuario. Ejecuta /api/setup/dev-seed." },
        { status: 404 },
      );
    }

    const { id } = await context.params;
    const json = await request.json();
    const payload = updateExpenseSchema.parse(json);

    const [existingExpense, campaign] = await Promise.all([
      prisma.expense.findFirst({
        where: {
          id,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
        },
      }),
      prisma.campaign.findFirst({
        where: {
          id: payload.campaignId,
          businessId: ownedBusiness.id,
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!existingExpense) {
      return NextResponse.json({ error: "Gasto no encontrado." }, { status: 404 });
    }

    if (!campaign) {
      return NextResponse.json({ error: "Campana no encontrada para este negocio." }, { status: 404 });
    }

    const expense = await prisma.expense.update({
      where: {
        id: existingExpense.id,
      },
      data: {
        campaignId: payload.campaignId,
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

    return NextResponse.json({
      data: {
        id: expense.id,
        expenseDate: expense.expenseDate,
        campaignId: expense.campaignId,
        campaignName: expense.campaign?.name ?? "Sin campana",
        concept: expense.concept,
        amount: Number(expense.amount.toString()),
        notes: expense.notes,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el gasto.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
