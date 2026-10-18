export type CapaTipo='noticia'|'filme'|'serie'|'futebol';
export function editorialCover(tipo:CapaTipo,titulo:string):string {
 return '/api/capa?'+new URLSearchParams({tipo,titulo}).toString();
}
export const editorialCoverCredit='Arte editorial ilustrativa: Guia de Hoje';
