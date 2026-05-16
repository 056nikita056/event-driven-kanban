/** @type {import('next').NextConfig} */
const nextConfig = {
  // Custom server needed for Socket.io — see server.ts
  // Using default Next.js server with Socket.io attached via API route hack
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
  },
}

module.exports = nextConfig
