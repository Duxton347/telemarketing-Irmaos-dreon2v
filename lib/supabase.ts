
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Credenciais fornecidas pelo usuário
const supabaseUrl = 'https://oaudjakdzvfgymkiwfaa.supabase.co';
const supabaseAnonKey = 'sb_publishable_WS2wtYXmV6P_zenHdEtwTQ_LUVY6gU2';

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

export const normalizePhone = (phone: string) => {
  return phone.replace(/\D/g, '');
};

export const getInternalEmail = (username: string) => {
  if (username.includes('@')) return username;
  return `${slugify(username)}@telemarketing.local`;
};
