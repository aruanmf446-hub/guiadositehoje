const fallbackOrigin = 'https://guiadehoje.site';

export const siteUrl = (() => {
  try {
    const candidate = new URL(process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin);
    return candidate.origin;
  } catch {
    return fallbackOrigin;
  }
})();

export const siteName = 'Guia de Hoje';
export const siteDescription =
  'Jogos do dia, notícias do Brasil e do mundo e um guia de onde assistir filmes, séries e programas.';
