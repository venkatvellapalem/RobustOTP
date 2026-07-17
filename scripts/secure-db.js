const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log("Connecting to database and setting up demo_user restrictions...");
  const prisma = new PrismaClient();
  try {
    // 1. Revoke destructive privileges on tables
    await prisma.$executeRawUnsafe(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM demo_user;`);
    
    // 2. Grant only select, insert, update
    await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO demo_user;`);
    
    console.log("Successfully locked down demo_user permissions!");
  } catch (err) {
    console.error("Error setting up database permissions:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
