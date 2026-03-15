import { getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateCampaignSchema = z
  .object({
    name: z.string().min(2).optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2024).max(2100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    status: z.nativeEnum(CampaignStatus).optional(),
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

    const { id } = await context.params;
    const json = await request.json();
    const payload = updateCampaignSchema.parse(json);

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json(
        { error: "No se encontro un negocio para este usuario. Ejecuta /api/setup/dev-seed." },
        { status: 404 },
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        businessId: ownedBusiness.id,
      },
      select: {
        id: true,
        status: true,
        endDate: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }

    if (payload.status && campaign.status === payload.status) {
      return NextResponse.json(
        {
          error:
            payload.status === CampaignStatus.CLOSED
              ? "La campaña ya está cerrada."
              : "La campaña ya está activa.",
        },
        { status: 400 },
      );
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: payload.name?.trim(),
        month: payload.month,
        year: payload.year,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        status: payload.status,
        endDate:
          payload.status === CampaignStatus.CLOSED
            ? payload.endDate && payload.endDate !== ""
              ? new Date(payload.endDate)
              : campaign.endDate ?? new Date()
            : payload.status === CampaignStatus.OPEN
              ? null
              : payload.endDate === undefined
                ? undefined
                : payload.endDate && payload.endDate !== ""
                  ? new Date(payload.endDate)
                  : null,
      },
      select: {
        id: true,
        name: true,
        month: true,
        year: true,
        startDate: true,
        status: true,
        endDate: true,
      },
    });

    return NextResponse.json({ data: updatedCampaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar la campaña.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

