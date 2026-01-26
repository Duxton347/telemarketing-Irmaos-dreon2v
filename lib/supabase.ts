
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

/**
 * Utilitário seguro para obter variáveis de ambiente.
 */
const getEnv = (key: string): string => {
  // @ts-ignore
  let envValue = (typeof process !== 'undefined' && process.env?.[key]) || 
                 // @ts-ignore
                 (typeof import.meta !== 'undefined' && import.meta.env?.[key]);
  
  if (envValue && typeof envValue === 'string') {
    return envValue.trim();
  }

  const fallbacks: Record<string, string> = {
    VITE_SUPABASE_URL: 'https://oaudjakdzvfgymkiwfaa.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_WS2wtYXmV6P_zenHdEtwTQ_LUVY6gU2'
  };

  return (fallbacks[key] || '').trim();
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Cliente padrão com persistência de sessão (localStorage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cria um cliente Supabase temporário que NÃO persiste sessão.
 * Usado para criar usuários (signUp) sem deslogar o administrador atual.
 */
export const createAuthClient = () => createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

/**
 * Normaliza strings para slugs
 */
export const slugify = (text: string) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const normalizePhone = (phone: string) => {
  return phone.replace(/\D/g, '');
};

export const getInternalEmail = (username: string) => {
  if (!username) return '';
  const trimmed = username.trim().toLowerCase();
  if (trimmed.includes('@') && trimmed.split('@')[1].includes('.')) {
    return trimmed;
  }
  const slug = slugify(username);
  return `${slug}@telemarketing-dreon.com.br`;
};
