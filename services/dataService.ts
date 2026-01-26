
import { supabase, createAuthClient, normalizePhone, getInternalEmail, slugify } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, ProtocolEvent 
} from '../types';
import { DEFAULT_QUESTIONS, SCORE_MAP, STAGE_CONFIG, PROTOCOL_SLA } from '../constants';

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const dataService = {
  // --- USUÁRIOS ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) return [];
    return data.map(p => ({
      id: p.id,
      name: p.username_display,
      username: p.username_slug,
      role: p.role as UserRole,
      active: p.active
    }));
  },

  createUser: async (user: Partial<User>): Promise<void> => {
    const email = getInternalEmail(user.username || '');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: user.password!,
    });
    
    if (authError) throw authError;
    if (!authData.user) throw new Error('Falha ao registrar credenciais.');

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username_display: user.name,
      username_slug: slugify(user.username || ''),
      role: user.role,
      active: true
    });
    
    if (profileError) throw profileError;
  },

  signIn: async (username: string, password: string): Promise<User> => {
    const email = getInternalEmail(username);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Falha no login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
    if (!profile) throw new Error('Perfil não encontrado');

    return {
      id: profile.id,
      name: profile.username_display,
      username: profile.username_slug,
      role: profile.role as UserRole,
      active: profile.active
    };
  },

  // --- BUSCAS DETALHADAS DASHBOARD ---
  getDetailedCallsToday: async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        profiles:operator_id(username_display),
        clients:client_id(name, phone)
      `)
      .gte('start_time', `${today}T00:00:00`)
      .order('duration', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  getDetailedPendingTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles:assigned_to(username_display),
        clients:client_id(name, phone)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // --- TAREFAS ---
  getTasks: async (): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (error) return [];
    return data.map(t => ({
      id: t.id,
      clientId: t.client_id,
      type: t.type as CallType,
      deadline: t.created_at,
      assignedTo: t.assigned_to,
      status: t.status as any
    }));
  },

  createTask: async (task: Partial<Task>): Promise<boolean> => {
    const { error } = await supabase.from('tasks').insert({
      client_id: task.clientId,
      type: task.type,
      assigned_to: task.assignedTo,
      status: 'pending'
    });
    return !error;
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<boolean> => {
    const { error } = await supabase.from('tasks').update({
      status: updates.status
    }).eq('id', taskId);
    return !error;
  },

  // --- CLIENTES ---
  getClients: async (): Promise<Client[]> => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      items: c.items || [],
      acceptance: 'medium',
      satisfaction: 'medium'
    }));
  },

  upsertClient: async (client: Partial<Client>): Promise<Client> => {
    const phone = normalizePhone(client.phone || '');
    const { data, error } = await supabase.from('clients').upsert({
      name: client.name,
      phone,
      address: client.address,
      items: client.items,
      last_interaction: new Date().toISOString()
    }, { onConflict: 'phone' }).select().single();
    if (error) throw error;
    return data;
  },

  // --- LOGS DE CHAMADA ---
  saveCall: async (call: CallRecord): Promise<void> => {
    const { error } = await supabase.from('call_logs').insert({
      task_id: call.taskId,
      operator_id: call.operatorId,
      client_id: call.clientId,
      call_type: call.type,
      responses: call.responses,
      duration: call.duration,
      start_time: call.startTime,
      protocol_id: call.protocolId
    });
    if (error) throw error;
  },

  getCalls: async () => {
    const { data } = await supabase.from('call_logs').select('*');
    return data || [];
  },

  // --- PROTOCOLOS ---
  getProtocols: async (): Promise<Protocol[]> => {
    const { data } = await supabase.from('protocols').select('*').order('opened_at', { ascending: false });
    return (data || []).map(p => ({
      id: p.id,
      protocolNumber: p.protocol_number,
      clientId: p.client_id,
      openedByOperatorId: p.opened_by_id,
      ownerOperatorId: p.owner_id,
      origin: p.origin || 'Atendimento',
      departmentId: p.department_id,
      categoryId: '',
      title: p.title,
      description: p.description,
      priority: p.priority as any,
      status: p.status as ProtocolStatus,
      openedAt: p.opened_at,
      updatedAt: p.updated_at,
      closedAt: p.closed_at,
      lastActionAt: p.updated_at,
      slaDueAt: p.opened_at,
      resolutionSummary: p.resolution_summary
    }));
  },

  saveProtocol: async (protocol: Protocol, userId: string): Promise<string> => {
    const { data, error } = await supabase.from('protocols').insert({
      client_id: protocol.clientId,
      opened_by_id: protocol.openedByOperatorId,
      owner_id: protocol.ownerOperatorId,
      title: protocol.title,
      description: protocol.description,
      status: protocol.status,
      priority: protocol.priority,
      department_id: protocol.departmentId,
      origin: protocol.origin
    }).select().single();
    if (error) throw error;
    return data.protocol_number || data.id;
  },

  updateProtocol: async (pId: string, updates: Partial<Protocol>, userId: string, note?: string): Promise<boolean> => {
    let query = supabase.from('protocols').select('id, status, owner_id');
    if (isUUID(pId)) query = query.or(`id.eq.${pId},protocol_number.eq.${pId}`);
    else query = query.eq('protocol_number', pId);
    
    const { data: existing } = await query.single();
    if (!existing) return false;

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (updates.status) updatePayload.status = updates.status;
    if (updates.resolutionSummary) updatePayload.resolution_summary = updates.resolutionSummary;
    if (updates.ownerOperatorId) updatePayload.owner_id = updates.ownerOperatorId;
    if (updates.closedAt) updatePayload.closed_at = updates.closedAt;

    const { error } = await supabase.from('protocols').update(updatePayload).eq('id', existing.id);
    
    if (!error && note) {
      await supabase.from('protocol_events').insert({
        protocol_id: existing.id,
        actor_id: userId,
        event_type: updates.status ? 'status_change' : 'note',
        new_value: updates.status,
        note: note
      });
    }
    
    return !error;
  },

  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    const { data } = await supabase.from('protocol_events')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('created_at', { ascending: false });
    return (data || []).map(e => ({
      id: e.id,
      protocolId: e.protocol_id,
      eventType: e.event_type,
      oldValue: e.old_value,
      newValue: e.new_value,
      note: e.note,
      actorId: e.actor_id,
      createdAt: e.created_at
    }));
  },

  getProtocolConfig: () => ({ 
    departments: [
      { id: 'd1', name: 'Execução/Obra' }, { id: 'd2', name: 'Instalação' }, 
      { id: 'd3', name: 'SAC/Pós-Venda' }, { id: 'd4', name: 'Financeiro' }
    ] 
  }),
  getQuestions: (): Question[] => DEFAULT_QUESTIONS,
  calculateIDE: (calls: any[]) => calls.length > 0 ? 85 : 0,
  getStageAverages: (calls: any[]) => [],
  getDetailedStats: (calls: any[], protocols: any[]) => ({ questionAnalysis: [], resolutionStats: { satisfaction: [], repurchase: [] } })
};
