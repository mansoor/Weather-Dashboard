// Unique per build — used to detect when a new version has been deployed so the
// app can prompt the user to refresh. Evaluated once when `next build` runs.
const buildId = process.env.NEXT_PUBLIC_BUILD_ID || String(Date.now())

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  generateBuildId: () => buildId,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.FASTIFY_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/:path*`,
      },
    ]
  },
}

export default nextConfig
