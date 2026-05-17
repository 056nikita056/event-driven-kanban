/** @type {import('next').NextConfig} */
const nextConfig = {
  // Socket.io is attached in server.ts, so production must run `npm run start`.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
  },
}

module.exports = nextConfig
