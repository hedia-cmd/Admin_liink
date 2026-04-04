// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const anonKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

if (!url || !anonKey) {
  throw new Error('Missing Supabase env: REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY');
}

// Log masqué pour vérifier qu'on lit bien les variables (.env.local)
// (désactive en prod si tu veux)
console.log('SB URL:', url);
console.log('SB KEY:', anonKey.slice(0, 6) + '…' + anonKey.slice(-6));

// ⚡️ Création du client avec gestion de session
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,        // garde la session en localStorage
    autoRefreshToken: true,      // refresh auto des tokens
    detectSessionInUrl: true,    // utile si tu utilises magic links
  },
});

export default supabase;
