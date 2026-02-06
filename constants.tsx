
import { CallType } from './types';

export const COLORS = {
  primary: '#2563eb', // Blue 600
  secondary: '#facc15', // Yellow 400
  success: '#10b981', // Emerald 500
  danger: '#ef4444', // Red 500
  warning: '#f59e0b', // Amber 500
  info: '#6366f1', // Indigo 500
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    400: '#94a3b8',
    600: '#475569',
    900: '#0f172a',
  }
};

export const SKIP_REASONS = [
  'NÃO ATENDE',
  'CAIXA POSTAL',
  'NÚMERO ERRADO / INEXISTENTE',
  'CLIENTE OCUPADO / RETORNAR DEPOIS',
  'FORA DE ÁREA',
  'RECUSOU ATENDIMENTO'
];

export const PROTOCOL_SLA: Record<string, number> = {
  'Alta': 24,
  'Média': 48,
  'Baixa': 72
};

// Fix: Added missing SATISFACTION_EMOJIS used in Clients.tsx
export const SATISFACTION_EMOJIS: Record<string, string> = {
  'low': '😞',
  'medium': '😐',
  'high': '😊'
};

// Fix: Added missing SCORE_MAP used in dataService.ts for performance calculations
export const SCORE_MAP: Record<string, number> = {
  'Ótimo': 2,
  'Ok': 1,
  'Precisa melhorar': 0,
  'Sim': 2,
  'Parcial': 1,
  'Não': 0,
  'No prazo': 2,
  'Atrasado': 0,
  'Alto': 2,
  'Médio': 1,
  'Baixo': 0,
  'Boa': 2,
  'Regular': 1,
  'Ruim': 0,
  'Atendeu': 2
};

// Fix: Added missing STAGE_CONFIG used in dataService.ts for grouping stats by stage
export const STAGE_CONFIG = {
  atendimento: { label: 'Atendimento', color: COLORS.primary },
  tecnico: { label: 'Técnico', color: COLORS.success },
  financeiro: { label: 'Financeiro', color: COLORS.secondary },
  logistica: { label: 'Logística', color: COLORS.warning }
};

export const DEFAULT_QUESTIONS = [
  // POS-VENDA
  { id: 'pv1', text: 'Atendimento durante a compra', options: ['Ótimo', 'Ok', 'Precisa melhorar'], type: CallType.POS_VENDA, order: 1, stageId: 'atendimento' },
  { id: 'pv2', text: 'Segurança no dimensionamento/indicação', options: ['Sim', 'Parcial', 'Não'], type: CallType.POS_VENDA, order: 2, stageId: 'tecnico' },
  // ... rest of the logic remains in DB, this is for UI defaults
];
