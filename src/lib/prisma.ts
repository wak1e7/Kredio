import { getServerEnv } from "@/lib/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function hasRequiredDelegates(client: PrismaClient | undefined) {
  if (!client) {
    return false;
  }

  const prismaWithDelegates = client as PrismaClient & {
    business?: unknown;
    expense?: unknown;
    _runtimeDataModel?: {
      models?: Record<string, { fields?: Array<{ name: string }> }>;
    };
  };
  const expenseFields = prismaWithDelegates._runtimeDataModel?.models?.Expense?.fields ?? [];
  const hasExpenseCampaignRelation = expenseFields.some((field) => field.name === "campaign");

  return (
    Boolean(prismaWithDelegates.business) &&
    Boolean(prismaWithDelegates.expense) &&
    hasExpenseCampaignRelation
  );
}

function createPrismaClient() {
  const { DATABASE_URL, PG_SSL_REJECT_UNAUTHORIZED } = getServerEnv();
  const rejectUnauthorized =
    PG_SSL_REJECT_UNAUTHORIZED === "true"
      ? true
      : PG_SSL_REJECT_UNAUTHORIZED === "false"
        ? false
        : process.env.NODE_ENV === "production";

  // pg can prioritize sslmode from the connection string over ssl options.
  // We remove sslmode and control TLS behavior explicitly via rejectUnauthorized.
  const normalizedConnectionString = (() => {
    try {
      const url = new URL(DATABASE_URL);
      url.searchParams.delete("sslmode");
      return url.toString();
    } catch {
      return DATABASE_URL;
    }
  })();

  const pool = new Pool({
    connectionString: normalizedConnectionString,
    ssl: {
      rejectUnauthorized,
    },
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const cachedPrisma = hasRequiredDelegates(globalThis.prismaGlobal) ? globalThis.prismaGlobal : undefined;

export const prisma = cachedPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
