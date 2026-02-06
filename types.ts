
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR_TELEMARKETING = 'OPERATOR_TELEMARKETING',
  ANALISTA_MARKETING = 'ANALISTA_MARKETING',
  VENDEDOR = 'VENDEDOR'
}

export enum CampaignStatus {
  RASCUNHO = 'Rascunho',
  ATIVA = 'Ativa',
  FINALIZADA = 'Finalizada',
  PAUSADA = 'Pausada'
}

export interface Campaign {
  id: string;
  name: string;
  type: 'WhatsApp' | 'E-mail' | 'Visita';
  status: CampaignStatus;
  targetCount: number;
  openCount: number;
  clickCount: number;
  convertedCount: number;
  conversionValue: number;
  createdAt: string;
  startDate?: string;
}

export interface EcommerceOrder {
  id: string;
  orderNumber: string;
  clientId?: string;
  prospectId?: string;
  campaignId?: string;
  operatorId?: string;
  value: number;
  status: 'Pendente' | 'Pago' | 'Cancelado';
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export enum CallType {
  POS_VENDA = 'PÓS-VENDA',
  PROSPECCAO = 'PROSPECÇÃO',
  VENDA = 'VENDA',
  CONFIRMACAO_PROTOCOLO = 'CONFIRMAÇÃO PROTOCOLO',
  ASSISTENCIA = 'ASSISTÊNCIA'
}

export enum ProtocolStatus {
  ABERTO = 'Aberto',
  EM_ANDAMENTO = 'Em andamento',
  AGUARDANDO_SETOR = 'Aguardando Setor',
  AGUARDANDO_CLIENTE = 'Aguardando Cliente',
  RESOLVIDO_PENDENTE = 'Resolvido (Pendente Confirmação)',
  FECHADO = 'Fechado',
  REABERTO = 'Reaberto'
}

export enum OperatorEventType {
  INICIAR_PROXIMO_ATENDIMENTO = 'INICIAR_PROXIMO_ATENDIMENTO',
  PULAR_ATENDIMENTO = 'PULAR_ATENDIMENTO',
  FINALIZAR_ATENDIMENTO = 'FINALIZAR_ATENDIMENTO'
}

export interface ProtocolEvent {
  id: string;
  protocolId: string;
  actorId: string;
  eventType: 'status_change' | 'note' | 'creation' | 'update';
  note: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  acceptance: 'low' | 'medium' | 'high';
  satisfaction: 'low' | 'medium' | 'high';
  marketingAuthorized: boolean;
  items: string[];
  lastInteraction?: string;
  latitude?: number;
  longitude?: number;
}

export enum ProspectStatus {
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  DESCARTADO = 'descartado',
  CONVERTIDO = 'convertido'
}

export interface Prospect {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  marketingAuthorized: boolean;
  categoryId?: string;
  categoryName?: string;
  latitude?: number;
  longitude?: number;
  status: ProspectStatus;
  score: number;
  createdAt: string;
}

export interface Task {
  id: string;
  clientId?: string;
  prospectId?: string;
  type: CallType;
  deadline: string;
  assignedTo: string;
  status: 'pending' | 'completed' | 'skipped';
  skipReason?: string;
}

export interface CallRecord {
  id: string;
  taskId?: string;
  operatorId: string;
  clientId?: string;
  prospectId?: string;
  startTime: string;
  endTime: string;
  duration: number;
  reportTime: number;
  responses: Record<string, any>;
  type: CallType;
  protocolId?: string;
}

export interface Protocol {
  id: string;
  protocolNumber?: string;
  clientId?: string;
  prospectId?: string;
  openedByOperatorId: string;
  ownerOperatorId: string;
  departmentId: string;
  title: string;
  description: string;
  priority: 'Baixa' | 'Média' | 'Alta';
  status: ProtocolStatus;
  openedAt: string;
  updatedAt: string;
  resolutionSummary?: string;
  slaDueAt: string;
  originCallType?: CallType;
  closedAt?: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  type: CallType | 'ALL';
  inputType: 'select' | 'multiselect' | 'text';
  order: number;
  stageId?: string;
}

// Novos tipos para QA e Testes
export interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'pending';
  error?: string;
  duration?: number;
}

export interface ChecklistTask {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}
