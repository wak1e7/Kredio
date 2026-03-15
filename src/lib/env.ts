import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PG_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .optional()
    .transform((value) => (value ?? "").toLowerCase())
    .refine((value) => value === "" || value === "true" || value === "false", {
      message: "PG_SSL_REJECT_UNAUTHORIZED debe ser 'true' o 'false'.",
    }),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    PG_SSL_REJECT_UNAUTHORIZED: process.env.PG_SSL_REJECT_UNAUTHORIZED,
  });
}
