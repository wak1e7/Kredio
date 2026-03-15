import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const seedSchema = z.object({
  fullName: z.string().min(2).optional(),
  businessName: z.string().min(2).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const payload = seedSchema.parse(json);

    const email = authUser.email ?? `${authUser.id}@no-email.local`;
    const fullName =
      payload.fullName ??
      ((authUser.user_metadata?.full_name as string | undefined) ?? email.split("@")[0] ?? "Usuario Kredio");
    const businessName =
      payload.businessName ??
      ((authUser.user_metadata?.business_name as string | undefined) ?? `${fullName} - Negocio`);

    const user = await prisma.appUser.upsert({
      where: { id: authUser.id },
      update: {
        email,
        fullName,
        isActive: true,
      },
      create: {
        id: authUser.id,
        email,
        fullName,
        isActive: true,
      },
    });

    const business =
      (await prisma.business.findUnique({
        where: { ownerId: user.id },
      })) ??
      (await prisma.business.create({
        data: {
          ownerId: user.id,
          name: businessName,
        },
      }));

    return NextResponse.json({
      data: {
        userId: user.id,
        businessId: business.id,
        email: user.email,
        businessName: business.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo crear el seed de desarrollo.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
