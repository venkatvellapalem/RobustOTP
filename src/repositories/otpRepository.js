const prisma = require('../config/prisma');

async function create(userId, otpHash, purpose, expiresAt, clientFingerprint = null) {
  return prisma.otpCode.create({
    data: { userId, otpHash, purpose, expiresAt, clientFingerprint },
  });
}

async function findLatest(userId) {
  return prisma.otpCode.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
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
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { verified: true, createdAt: { lt: fiveMinutesAgo } }
      ]
    },
  });
}

module.exports = {
  create, findLatest, findLatestUnverified, incrementAttempts,
  markVerified, invalidatePrevious, countRecentByUser, deleteExpired,
};
