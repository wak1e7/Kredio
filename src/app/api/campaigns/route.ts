import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createCampaignSchema = z.object({
  businessId: z.string().uuid().optional(),
  name: z.string().min(2),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
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
    return { error: "No se encontro un negocio para este usuario. Ejecuta /api/setup/dev-seed.", status: 404 as const };
  }

  return { businessId: ownedBusiness.id };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");
    const statusParam = searchParams.get("status");
    const campaignStatus =
      statusParam === "OPEN" || statusParam === "CLOSED" ? (statusParam as CampaignStatus) : undefined;

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        businessId: businessResolution.businessId,
        status: campaignStatus,
      },
      include: {
        customerBalances: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const data = campaigns.map((campaign) => {
      const totalSold = campaign.customerBalances.reduce(
        (acc, item) => acc + Number(item.totalPurchased.toString()),
        0,
      );
      const totalCollected = campaign.customerBalances.reduce(
        (acc, item) => acc + Number(item.totalPaid.toString()),
        0,
      );
      const pending = Number((totalSold - totalCollected).toFixed(2));
      const debtorsCount = campaign.customerBalances.filter((item) => Number(item.balance.toString()) > 0).length;

      return {
        id: campaign.id,
        name: campaign.name,
        month: campaign.month,
        year: campaign.year,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        totalSold: Number(totalSold.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        pending,
        debtorsCount,
      };
    });

    return NextResponse.json({ data, businessId: businessResolution.businessId });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo listar campanas.",
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
    const payload = createCampaignSchema.parse(json);

    const businessResolution = await resolveBusinessId(user.id, payload.businessId);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const created = await prisma.campaign.create({
      data: {
        businessId: businessResolution.businessId,
        name: payload.name,
        month: payload.month,
        year: payload.year,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo crear la campana.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
