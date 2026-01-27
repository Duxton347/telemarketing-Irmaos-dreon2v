
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR'
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
  CONFIRMACAO_PROTOCOLO = 'CONFIRMAÇÃO PROTOCOLO'
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
  FINALIZAR_ATENDIMENTO = 'FINALIZAR_ATENDIMENTO',
  PULAR_ATENDIMENTO = 'PULAR_ATENDIMENTO'
}

export interface OperatorEvent {
  id: string;
  operatorId: string;
  taskId?: string;
  eventType: OperatorEventType;
  timestamp: string;
  note?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  acceptance: 'low' | 'medium' | 'high';
  satisfaction: 'low' | 'medium' | 'high';
  items: string[];
  lastInteraction?: string;
  invalid?: boolean;
}

export interface Task {
  id: string;
  clientId: string;
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
  clientId: string;
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
  clientId: string;
  openedByOperatorId: string;
  ownerOperatorId: string;
  origin: string; 
  departmentId: string;
  categoryId: string;
  title: string;
  description: string;
  priority: 'Baixa' | 'Média' | 'Alta';
  status: ProtocolStatus;
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  firstResponseAt?: string;
  lastActionAt: string;
  slaDueAt: string;
  resolutionSummary?: string;
  rootCause?: string;
}

export interface ProtocolEvent {
  id: string;
  protocolId: string;
  eventType: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
  actorId: string; 
  createdAt: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  type: CallType | 'ALL';
  order: number;
  stageId?: string;
}
