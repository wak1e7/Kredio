import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function canAccessBusiness(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      ownerId: userId,
    },
    select: { id: true },
  });

  return Boolean(business);
}

export async function getOwnedBusiness(userId: string) {
  return prisma.business.findFirst({
    where: { ownerId: userId },
    select: { id: true, name: true },
  });
}
