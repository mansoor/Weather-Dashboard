import { pwaIcon } from '../_pwaIcon'

export const dynamic = 'force-static'

export function GET() {
  return pwaIcon(512, true)
}
