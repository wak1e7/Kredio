import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { getReportOverviewData } from "@/lib/reports/overview";
import { NextRequest, NextResponse } from "next/server";

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

    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");
    const yearParam = searchParams.get("year");
    const campaignIdParam = searchParams.get("campaignId");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const requestedYear = yearParam ? Number(yearParam) : undefined;
    const data = await getReportOverviewData({
      businessId: businessResolution.businessId,
      requestedYear,
      requestedCampaignId: campaignIdParam,
    });

    return NextResponse.json({
      data,
      businessId: businessResolution.businessId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron generar los reportes.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}