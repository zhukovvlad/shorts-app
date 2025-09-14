import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// In development, prefer direct connection (5432) to avoid pgBouncer quirks on 6543.
// In production, prefer pooled DATABASE_URL (6543). Fallback to the other if missing.
const isDev = process.env.NODE_ENV !== "production";
const primaryUrl = isDev ? process.env.DIRECT_URL : process.env.DATABASE_URL;
const secondaryUrl = isDev ? process.env.DATABASE_URL : process.env.DIRECT_URL;
const resolvedDbUrl = primaryUrl || secondaryUrl;

if (!resolvedDbUrl) {
	// Fail fast with a clearer message if both env vars are missing
	throw new Error(
		"Database connection URL is not set. Please define DATABASE_URL or DIRECT_URL in your .env",
	);
}

export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		datasources: {
			db: {
				url: resolvedDbUrl,
			},
		},
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
