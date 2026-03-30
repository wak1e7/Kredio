import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CATEGORY_OPTIONS = ["Sokso", "Footloose", "Leonisa"] as const;

const createWarehouseItemSchema = z.object({
  businessId: z.string().uuid().optional(),
  campaignId: z.string().uuid(),
  entryDate: z.string().datetime().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(CATEGORY_OPTIONS),
  size: z.string().optional(),
  color: z.string().optional(),
  quantity: z.number().int().min(1),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive(),
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
    const campaignId = searchParams.get("campaignId");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const [items, campaigns] = await Promise.all([
      prisma.warehouseItem.findMany({
        where: {
          businessId: businessResolution.businessId,
          campaignId: campaignId && campaignId !== "all" ? campaignId : undefined,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              month: true,
              year: true,
              status: true,
            },
          },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.campaign.findMany({
        where: { businessId: businessResolution.businessId },
        select: {
          id: true,
          name: true,
          month: true,
          year: true,
          status: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      data: items.map((item) => ({
        id: item.id,
        campaignId: item.campaignId,
        campaignName: item.campaign.name,
        campaignStatus: item.campaign.status,
        entryDate: item.entryDate,
        code: item.code,
        name: item.name,
        category: item.category,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        availableQuantity: item.availableQuantity,
        assignedQuantity: item.quantity - item.availableQuantity,
        costPrice: Number(item.costPrice.toString()),
        salePrice: Number(item.salePrice.toString()),
        notes: item.notes,
      })),
      campaignOptions: campaigns,
      businessId: businessResolution.businessId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el almacén.",
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

    const originError = validateTrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const json = await request.json();
    const payload = createWarehouseItemSchema.parse(json);

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
        name: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada para este negocio." }, { status: 404 });
    }

    const warehouseItem = await prisma.$transaction(async (tx) => {
      const created = await tx.warehouseItem.create({
        data: {
          businessId: businessResolution.businessId,
          campaignId: payload.campaignId,
          entryDate: payload.entryDate ? new Date(payload.entryDate) : new Date(),
          code: payload.code.trim(),
          name: payload.name.trim(),
          category: payload.category,
          size: payload.size?.trim() || null,
          color: payload.color?.trim() || null,
          quantity: payload.quantity,
          availableQuantity: payload.quantity,
          costPrice: payload.costPrice,
          salePrice: payload.salePrice,
          notes: payload.notes?.trim() || null,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      await tx.product.upsert({
        where: {
          businessId_code: {
            businessId: businessResolution.businessId,
            code: payload.code.trim(),
          },
        },
        create: {
          businessId: businessResolution.businessId,
          code: payload.code.trim(),
          name: payload.name.trim(),
          category: payload.category,
          size: payload.size?.trim() || null,
          color: payload.color?.trim() || null,
        },
        update: {
          name: payload.name.trim(),
          category: payload.category,
          size: payload.size?.trim() || null,
          color: payload.color?.trim() || null,
          isActive: true,
        },
      });

      return created;
    });

    return NextResponse.json({
      data: {
        id: warehouseItem.id,
        campaignId: warehouseItem.campaignId,
        campaignName: warehouseItem.campaign.name,
        campaignStatus: warehouseItem.campaign.status,
        entryDate: warehouseItem.entryDate,
        code: warehouseItem.code,
        name: warehouseItem.name,
        category: warehouseItem.category,
        size: warehouseItem.size,
        color: warehouseItem.color,
        quantity: warehouseItem.quantity,
        availableQuantity: warehouseItem.availableQuantity,
        assignedQuantity: warehouseItem.quantity - warehouseItem.availableQuantity,
        costPrice: Number(warehouseItem.costPrice.toString()),
        salePrice: Number(warehouseItem.salePrice.toString()),
        notes: warehouseItem.notes,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo registrar el producto en almacén.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}