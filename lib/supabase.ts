import { createClient } from '@supabase/supabase-js';

// Somente chave PUBLICÁVEL. Nunca colocar service_role/secret key neste arquivo.
// A configuração padrão já aponta ao projeto indicado para o Guia de Hoje.
// Variáveis do ambiente prevalecem, permitindo trocar de projeto sem alterar o código.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kffzngznzjgioabtqxju.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_zaB1advTOtLng9sdijSBgA_jH71T5I7';

export function getSupabase() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
