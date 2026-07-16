const prisma = require('../config/prisma');

async function create(userId, otpHash, purpose, expiresAt) {
  return prisma.otpCode.create({
    data: { userId, otpHash, purpose, expiresAt },
  });
}

async function findLatestUnverified(userId) {
  return prisma.otpCode.findFirst({
    where: { userId, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

async function incrementAttempts(id) {
  return prisma.otpCode.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}

async function markVerified(id) {
  return prisma.otpCode.update({
    where: { id },
    data: { verified: true },
  });
}

async function invalidatePrevious(userId, excludeId) {
  return prisma.otpCode.updateMany({
    where: { userId, verified: false, id: { not: excludeId } },
    data: { verified: true },
  });
}

async function countRecentByUser(userId, since) {
  return prisma.otpCode.count({
    where: { userId, createdAt: { gt: since } },
  });
}

async function deleteExpired() {
  return prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

module.exports = {
  create, findLatestUnverified, incrementAttempts,
  markVerified, invalidatePrevious, countRecentByUser, deleteExpired,
};
