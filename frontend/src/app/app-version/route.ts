import { NextResponse } from 'next/server'

// Reports the deployed build id (baked in at build time). The client compares it
// to its own loaded build id to detect when a new version has been deployed.
// Not under /api (that path is proxied to the backend).
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
