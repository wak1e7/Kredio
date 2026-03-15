export const isProductionEnv = process.env.NODE_ENV === "production";

export function sanitizeInternalRedirectPath(candidate: string | null | undefined, fallback = "/dashboard") {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
