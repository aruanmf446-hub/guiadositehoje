'use client';

import { useState } from 'react';
import { FilterGroup } from './FilterGroup';
import { platforms, watchKinds, watchTitles, type WatchKind } from '@/lib/data';

const ALL_PLATFORMS = 'Todas';

export function WatchSection() {
  const [kind, setKind] = useState<WatchKind>('Filmes');
  const [platform, setPlatform] = useState<string>(ALL_PLATFORMS);

  const visible = watchTitles.filter(
    (t) => t.kind === kind && (platform === ALL_PLATFORMS || t.platform === platform),
  );

  return (
    <section id="assistir" aria-labelledby="t-assistir" className="section bordered watch">
      <div className="section-title-wrap">
        <h2 id="t-assistir" className="section-title">
          Onde assistir
        </h2>
        <span className="section-sub">
          Filmes, séries e programas: veja em qual plataforma está cada título.
        </span>
      </div>

      <div className="filter-stack">
        <FilterGroup
          label="Tipo de conteúdo"
          options={watchKinds}
          value={kind}
          onChange={(value) => setKind(value as WatchKind)}
        />
        <FilterGroup
          label="Plataforma"
          options={[ALL_PLATFORMS, ...platforms]}
          value={platform}
          onChange={setPlatform}
        />
      </div>

      <div className="titles-grid">
        {visible.map((item) => (
          <article key={item.id} className="title-card">
            <div className="poster">[PÔSTER]</div>
            <div className="title-body">
              <h3 className="title-name">{item.title}</h3>
              <span className="platform-tag">{item.platform}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
