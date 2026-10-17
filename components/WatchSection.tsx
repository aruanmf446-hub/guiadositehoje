'use client';

import { useState } from 'react';
import { FilterGroup } from './FilterGroup';
import { watchKinds, type WatchKind, type WatchTitle } from '@/lib/data';

const ALL_PLATFORMS = 'Todas';

export function WatchSection({ titles }: { titles: WatchTitle[] }) {
  const [kind, setKind] = useState<WatchKind>(
    () => watchKinds.find(k => titles.some(t => t.kind === k)) || 'Filmes',
  );
  const [platform, setPlatform] = useState<string>(ALL_PLATFORMS);
  const platforms = [...new Set(titles.map(t => t.platform))];
  const visible = titles.filter(t => t.kind === kind && (platform === ALL_PLATFORMS || t.platform === platform));
  return (
    <section id="assistir" aria-labelledby="t-assistir" className="section bordered watch">
      <div className="section-title-wrap">
        <h2 id="t-assistir" className="section-title">Onde assistir</h2>
        <span className="section-sub">Filmes, séries e programas: veja em qual plataforma está cada título.</span>
      </div>
      {titles.length === 0 ? (
        <p className="empty" style={{ marginTop: 24 }}>O guia de programação será atualizado após a confirmação dos catálogos.</p>
      ) : (
        <>
          <div className="filter-stack">
            <FilterGroup label="Tipo de conteúdo" options={watchKinds} value={kind}
              onChange={value => { setKind(value as WatchKind); setPlatform(ALL_PLATFORMS); }} />
            <FilterGroup label="Plataforma" options={[ALL_PLATFORMS, ...platforms]}
              value={platform} onChange={setPlatform} />
          </div>
          <div className="titles-grid">
            {visible.length === 0 ? <p className="empty">Sem títulos para este filtro.</p> : visible.map(item => (
              <article key={item.id} className="title-card">
                <div className="poster">
                  {item.posterUrl ? <img src={item.posterUrl} alt={`Cartaz: ${item.title}`} loading="lazy" /> : <span>{item.kind}</span>}
                </div>
                <div className="title-body">
                  <h3 className="title-name">{item.title}</h3>
                  <span className="platform-tag">{item.platform}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
