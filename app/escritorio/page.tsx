import type {Metadata} from 'next';
import {getOfficeSnapshot} from '@/lib/office';
import OfficeExperience from './OfficeExperience';
import './escritorio.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={
 title:'Escritório dos Agentes | Guia de Hoje',
 description:'Painel para acompanhar as automações editoriais do Guia de Hoje.',
 robots:{index:false,follow:false,nocache:true},
};
export default async function EscritorioPage(){
 const snapshot=await getOfficeSnapshot();
 return <OfficeExperience initial={snapshot}/>;
}
