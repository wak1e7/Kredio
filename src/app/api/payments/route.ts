import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { allocatePaymentToOldestDebts } from "@/lib/services/financial";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPaymentSchema = z.object({
  businessId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  paymentDate: z.string().datetime().optional(),
  amount: z.number().positive(),
  method: z.string().optional(),
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
    const customerId = searchParams.get("customerId");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const payments = await prisma.payment.findMany({
      where: {
        businessId: businessResolution.businessId,
        customerId: customerId || undefined,
      },
      include: {
        customer: {
          select: {
            fullName: true,
          },
        },
        applications: {
          include: {
            campaign: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    });

    const data = payments.map((payment) => ({
      id: payment.id,
      paymentDate: payment.paymentDate,
      customerId: payment.customerId,
      customerName: payment.customer.fullName,
      amount: Number(payment.amount.toString()),
      method: payment.method,
      notes: payment.notes,
      applications: payment.applications.map((app) => ({
        campaignId: app.campaignId,
        campaignName: app.campaign.name,
        appliedAmount: Number(app.appliedAmount.toString()),
      })),
    }));

    return NextResponse.json({ data, businessId: businessResolution.businessId });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo listar pagos.",
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
    const payload = createPaymentSchema.parse(json);

    const businessResolution = await resolveBusinessId(user.id, payload.businessId);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: payload.customerId,
        businessId: businessResolution.businessId,
      },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado para este negocio." }, { status: 404 });
    }

    const openBalances = await prisma.customerCampaignBalance.findMany({
      where: {
        customerId: payload.customerId,
        balance: { gt: 0 },
        campaign: {
          businessId: businessResolution.businessId,
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            month: true,
            year: true,
          },
        },
      },
    });

    if (openBalances.length === 0) {
      return NextResponse.json(
        { error: "El cliente no tiene deudas pendientes para aplicar el pago." },
        { status: 400 },
      );
    }

    const allocationInput = openBalances.map((item) => ({
      customerCampaignId: item.id,
      campaignId: item.campaign.id,
      year: item.campaign.year,
      month: item.campaign.month,
      balance: Number(item.balance.toString()),
    }));

    const { allocations, unappliedAmount } = allocatePaymentToOldestDebts(payload.amount, allocationInput);

    if (allocations.length === 0) {
      return NextResponse.json(
        { error: "No se pudo aplicar el pago porque no hay saldos abiertos." },
        { status: 400 },
      );
    }

    const paymentResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          businessId: businessResolution.businessId,
          customerId: payload.customerId,
          paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
          amount: payload.amount,
          method: payload.method,
          notes: payload.notes,
        },
      });

      for (const allocation of allocations) {
        const balanceRecord = openBalances.find((item) => item.id === allocation.customerCampaignId);

        if (!balanceRecord) continue;

        const currentPaid = Number(balanceRecord.totalPaid.toString());
        const nextPaid = Number((currentPaid + allocation.appliedAmount).toFixed(2));
        const nextBalance = allocation.remainingBalance;
        const nextStatus = nextBalance <= 0 ? "PAID" : "PARTIAL";

        await tx.customerCampaignBalance.update({
          where: { id: allocation.customerCampaignId },
          data: {
            totalPaid: nextPaid,
            balance: nextBalance,
            status: nextStatus,
          },
        });

        await tx.paymentApplication.create({
          data: {
            paymentId: payment.id,
            customerId: payload.customerId,
            campaignId: allocation.campaignId,
            customerCampaignId: allocation.customerCampaignId,
            appliedAmount: allocation.appliedAmount,
          },
        });
      }

      return payment;
    });

    return NextResponse.json(
      {
        data: paymentResult,
        allocationSummary: {
          allocations,
          unappliedAmount,
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
        error: "No se pudo registrar el pago.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
