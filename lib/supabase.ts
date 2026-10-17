import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Retorna null enquanto as variáveis não estiverem configuradas,
// para o site continuar funcionando com os dados locais de lib/data.ts.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey);
}
