import {NextResponse} from 'next/server';
import {getOfficeSnapshot} from '@/lib/office';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const data=await getOfficeSnapshot();
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow'}});
 }catch{
  return NextResponse.json({error:'Falha ao consultar o escritório'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
