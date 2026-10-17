import type {WatchTitle} from '@/lib/data';
export function mediaSlug(title:string):string{
 return title.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s*\(\d{4} film\)$/,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
}
export function mediaHref(item:Pick<WatchTitle,'title'>):string{
 return '/filmes-series/'+mediaSlug(item.title);
}
export function mediaHasEditorial(item:WatchTitle):boolean{
 return Boolean(item.editorialBody&&item.editorialBody.length>=350&&item.sourceUrl);
}
export function mediaImage(item:WatchTitle):string|undefined{
 // Somente imagens vindas do catálogo TVmaze, não URLs arbitrárias de bancos.
 return item.posterUrl?.startsWith('https://static.tvmaze.com/')?item.posterUrl:undefined;
}
