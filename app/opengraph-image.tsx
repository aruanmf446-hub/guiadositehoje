import { ImageResponse } from 'next/og';

export const alt = 'Guia de Hoje — Jogos, Notícias e Onde Assistir';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 78, background: '#0f1720', color: '#fff',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', fontSize: 36, color: '#72d6c1', fontWeight: 700 }}>
        GUIA DE HOJE
      </div>
      <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.12, maxWidth: 950, marginTop: 36 }}>
        Tudo o que importa hoje, num só lugar.
      </div>
      <div style={{ fontSize: 30, marginTop: 36, color: '#d0dbe2' }}>
        Jogos • Notícias • Onde assistir
      </div>
    </div>, size,
  );
}
