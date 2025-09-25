import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// In development, prefer pooled connection for stability
// In production, prefer pooled DATABASE_URL (6543). Fallback to the other if missing.
const isDev = process.env.NODE_ENV !== "production";
const primaryUrl = isDev ? process.env.DATABASE_URL : process.env.DATABASE_URL;
const secondaryUrl = isDev ? process.env.DIRECT_URL : process.env.DIRECT_URL;
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
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
	
	// Ensure graceful disconnection in development
	process.on('beforeExit', async () => {
		await prisma.$disconnect();
	});
}

// Retry wrapper for database operations
export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000
): Promise<T> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error: any) {
			if (attempt === maxRetries) {
				throw error;
			}
			
			// Only retry on connection errors
			if (error.code === 'P1001' || error.code === 'P1017') {
				console.warn(`Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
				continue;
			}
			
			// Don't retry other errors
			throw error;
		}
	}
	
	throw new Error('Maximum retries exceeded');
}
