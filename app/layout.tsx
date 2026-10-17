import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { siteDescription, siteName, siteUrl } from '@/lib/seo';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'], weight: ['500', '700', '800'],
  variable: '--font-display', display: 'swap',
});
const body = Instrument_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'],
  variable: '--font-body', display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Guia de Hoje | Jogos, Notícias e Onde Assistir', template: '%s | Guia de Hoje' },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: 'website', locale: 'pt_BR', siteName, title: siteName,
    description: siteDescription, url: siteUrl,
  },
  twitter: { card: 'summary_large_image', title: siteName, description: siteDescription },
  robots: { index: true, follow: true },
  category: 'news',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
