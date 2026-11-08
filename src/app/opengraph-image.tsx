import { ImageResponse } from 'next/og';

export const alt = 'Wont Stop Moving — Moving made simple';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: 80, background: '#10243a', color: '#fff' }}>
      <div style={{ display: 'flex', fontSize: 30, color: '#ff6929', marginBottom: 45 }}>WONT STOP MOVING</div>
      <div style={{ display: 'flex', fontSize: 86, fontWeight: 700 }}>Moving made simple.</div>
      <div style={{ display: 'flex', fontSize: 30, marginTop: 35 }}>US · Puerto Rico · Canada</div>
      <div style={{ display: 'flex', fontSize: 26, marginTop: 40, color: '#ff6929' }}>Get your moving quote at wontstopmoving.com</div>
    </div>,
    size,
  );
}
