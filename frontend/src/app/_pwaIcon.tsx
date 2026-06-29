/* Shared PWA/app icon artwork, rendered with next/og (Satori). Uses only plain
 * divs (no emoji/web fonts) so it renders without any network dependency.
 * The folder/file is prefixed so the app router does not treat it as a route. */
import { ImageResponse } from 'next/og'

// Brand: cyan gradient with a sun + cloud mark.
export function pwaIcon(size: number, maskable = false): ImageResponse {
  // Maskable icons need their content inside the ~80% "safe zone" circle.
  const scale = maskable ? 0.6 : 0.78
  const glyph = size * scale
  const sun = glyph * 0.62
  const cloudW = glyph * 0.78
  const cloudH = glyph * 0.34

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 55%, #0e7490 100%)',
        }}
      >
        <div style={{ position: 'relative', width: glyph, height: glyph, display: 'flex' }}>
          {/* Sun */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: glyph - sun,
              width: sun,
              height: sun,
              borderRadius: sun,
              backgroundImage: 'linear-gradient(135deg, #fef9c3 0%, #fcd34d 100%)',
            }}
          />
          {/* Cloud */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: cloudW,
              height: cloudH,
              borderRadius: cloudH,
              background: '#ffffff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: cloudH * 0.55,
              left: cloudW * 0.28,
              width: cloudH * 1.15,
              height: cloudH * 1.15,
              borderRadius: cloudH,
              background: '#ffffff',
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
