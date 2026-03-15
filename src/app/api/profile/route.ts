import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { validateTrustedOrigin } from "@/lib/security/http";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(2),
});

async function ensureAppUser() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return { error: "No autenticado." as const, status: 401 as const };
  }

  const email = authUser.email ?? `${authUser.id}@no-email.local`;
  const authFullName =
    (authUser.user_metadata?.full_name as string | undefined) ?? email.split("@")[0] ?? "Usuario Kredio";
  const phone = (authUser.user_metadata?.phone as string | undefined) ?? "";

  const appUser = await prisma.appUser.upsert({
    where: { id: authUser.id },
    update: {
      email,
      fullName: authFullName,
      isActive: true,
    },
    create: {
      id: authUser.id,
      email,
      fullName: authFullName,
      isActive: true,
    },
  });

  return {
    authUser,
    profile: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.fullName ?? authFullName,
      phone,
    },
  };
}

export async function GET() {
  try {
    const result = await ensureAppUser();
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ data: result.profile });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el perfil.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const originError = validateTrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const json = await request.json();
    const payload = updateProfileSchema.parse(json);
    const email = authUser.email ?? `${authUser.id}@no-email.local`;
    const phone = (authUser.user_metadata?.phone as string | undefined) ?? "";

    const updated = await prisma.appUser.upsert({
      where: { id: authUser.id },
      update: {
        email,
        fullName: payload.fullName,
        isActive: true,
      },
      create: {
        id: authUser.id,
        email,
        fullName: payload.fullName,
        isActive: true,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName ?? payload.fullName,
        phone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload invalido.", detail: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el perfil.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
