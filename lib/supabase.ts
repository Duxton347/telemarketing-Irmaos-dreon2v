
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Função auxiliar para buscar variáveis de ambiente de forma segura
// em diferentes ambientes (Vite, Node, ou Browser puro)
const getEnv = (name: string): string => {
  try {
    // Tenta import.meta.env (padrão Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      // @ts-ignore
      return import.meta.env[name];
    }
    // Tenta process.env (padrão Node/CJS)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      // @ts-ignore
      return process.env[name];
    }
  } catch (e) {
    // Ignora erros de referência
  }
  return '';
};

// Se as variáveis estiverem vazias, usamos placeholders válidos (formato de URL) 
// para que o createClient não lance uma exceção fatal no boot da aplicação.
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const slugify = (text: string) => {
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

export const getInternalEmail = (username: string) => {
  if (username.includes('@')) return username;
  return `${slugify(username)}@telemarketing.local`;
};

export const normalizePhone = (phone: string) => {
  return phone.replace(/\D/g, '');
};

// Exporta as variáveis para uso em outros componentes (ex: Admin.tsx)
export const ENV = {
  SIGNUP_CODE: getEnv('VITE_SIGNUP_CODE') || 'DREON2024'
};
