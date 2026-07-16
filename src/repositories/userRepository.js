const prisma = require('../config/prisma');

async function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function findOrCreate(email) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

module.exports = { findByEmail, findOrCreate };
