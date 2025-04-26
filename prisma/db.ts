import { PrismaClient } from '@prisma/client';

// Declare a global variable to store the Prisma client instance
declare global {
  var prisma: PrismaClient | undefined;
}

// Initialize Prisma client with connection pool configuration
const prisma = global.prisma || new PrismaClient({
  // Configure Prisma client options
  log: ['query', 'info', 'warn', 'error'], // Enable logging for debugging
  datasources: {
    db: {
      url: process.env.DATABASE_URL 
    },
  },
  // Optional: Customize connection pool settings (adjust based on your needs)
  // These can also be set via DATABASE_URL query parameters
  // Example: postgresql://user:pass@localhost:5432/db?connection_limit=20&pool_timeout=15
});

// Cache the Prisma client in development to avoid multiple instances during hot reload
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Handle process termination to close Prisma connections gracefully
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Export the Prisma client instance
export { prisma };