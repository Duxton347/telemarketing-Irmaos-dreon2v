
import { supabase, createAuthClient, normalizePhone, getInternalEmail, slugify } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, ProtocolEvent 
} from '../types';
import { DEFAULT_QUESTIONS, SCORE_MAP, STAGE_CONFIG, PROTOCOL_SLA } from '../constants';

const handleAuthError = (err: any) => {
  const message = err?.message || '';
  const status = err?.status;
  console.error("[Auth Error Details]", { message, status, err });

  if (message.includes('rate limit exceeded') || status === 429) {
    throw new Error('Limite de segurança excedido. Por favor, aguarde de 15 a 30 minutos antes de tentar novamente.');
  }
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    throw new Error('Usuário ou senha incorretos.');
  }
  if (message.includes('User already registered') || message.includes('already exists')) {
    throw new Error('Este usuário ou e-mail já está em uso.');
  }
  
  throw new Error(message || 'Ocorreu um erro na autenticação.');
};

export const dataService = {
  // --- USUÁRIOS & AUTH ---
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data.map(p => ({
        id: p.id,
        name: p.username_display,
        username: p.username_slug,
        role: p.role as UserRole,
        active: p.active
      }));
    } catch (e) {
      return [];
    }
  },

  signIn: async (username: string, password: string): Promise<User> => {
    const email = getInternalEmail(username);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return handleAuthError(authError);
      if (!authData.user) throw new Error('Falha na sessão.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', authData.user.id).single();
      if (profileError || !profile) throw new Error('Perfil não localizado.');

      return {
        id: profile.id,
        name: profile.username_display,
        username: profile.username_slug,
        role: profile.role as UserRole,
        active: profile.active
      };
    } catch (err: any) {
      throw err;
    }
  },

  createUser: async (userData: Partial<User>): Promise<void> => {
    const rawUsername = userData.username || '';
    const email = getInternalEmail(rawUsername);
    const normalizedSlug = slugify(rawUsername);
    const password = userData.password || 'dreon123';
    const authClient = createAuthClient();
    try {
      const { data: authUser, error: authError } = await authClient.auth.signUp({
        email, password, options: { data: { display_name: userData.name, username: normalizedSlug } }
      });
      if (authError) return handleAuthError(authError);
      if (!authUser.user) throw new Error('Falha ao gerar credenciais.');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authUser.user.id,
        username_display: userData.name,
        username_slug: normalizedSlug,
        role: userData.role || UserRole.OPERATOR,
        active: true
      });
      if (profileError) throw profileError;
    } catch (err: any) {
      throw err;
    }
  },

  // --- TAREFAS ---
  getTasks: async (): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (error) return [];
    return data.map(t => ({
      id: t.id,
      clientId: t.client_id,
      type: t.type as CallType,
      deadline: t.deadline,
      assignedTo: t.assigned_to,
      status: t.status,
      skipReason: t.skip_reason
    }));
  },

  createTask: async (task: Partial<Task>): Promise<boolean> => {
    const { error } = await supabase.from('tasks').insert({
      client_id: task.clientId,
      type: task.type,
      assigned_to: task.assignedTo,
      status: task.status || 'pending',
      deadline: task.deadline || new Date(Date.now() + 86400000).toISOString()
    });
    return !error;
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<boolean> => {
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.skipReason) payload.skip_reason = updates.skipReason;
    if (updates.assignedTo) payload.assigned_to = updates.assignedTo;
    const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
    return !error;
  },

  // --- CLIENTES ---
  getClients: async (): Promise<Client[]> => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) return [];
    return data.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      items: c.items || [],
      acceptance: c.acceptance,
      satisfaction: c.satisfaction,
      invalid: c.invalid,
      last_interaction: c.last_interaction
    }));
  },

  upsertClient: async (client: Partial<Client>): Promise<Client> => {
    const phone = normalizePhone(client.phone || '');
    const clientPayload = {
      name: client.name || 'Cliente Sem Nome',
      phone: phone,
      address: client.address || '',
      items: client.items || [],
      last_interaction: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('clients')
      .upsert(clientPayload, { onConflict: 'phone' })
      .select().single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      items: data.items,
      acceptance: data.acceptance,
      satisfaction: data.satisfaction,
      lastInteraction: data.last_interaction
    };
  },

  // --- CHAMADAS ---
  getCalls: async (): Promise<CallRecord[]> => {
    const { data, error } = await supabase.from('call_logs').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(c => ({
      id: c.id,
      taskId: c.task_id,
      operatorId: c.operator_id,
      clientId: c.client_id,
      startTime: c.start_time,
      endTime: c.end_time,
      duration: c.duration,
      reportTime: c.report_time,
      responses: c.responses,
      type: c.call_type as CallType,
      protocolId: c.protocol_id
    }));
  },

  saveCall: async (call: CallRecord): Promise<void> => {
    const { error } = await supabase.from('call_logs').insert({
      task_id: call.taskId,
      operator_id: call.operatorId,
      client_id: call.clientId,
      call_type: call.type,
      start_time: call.startTime,
      end_time: call.endTime,
      duration: call.duration,
      report_time: call.reportTime,
      responses: call.responses,
      protocol_id: call.protocolId
    });
    if (error) throw error;
    await supabase.from('clients').update({ last_interaction: new Date().toISOString() }).eq('id', call.clientId);
  },

  // --- PROTOCOLOS & ANALYTICS (Inalterados para brevidade) ---
  getProtocols: async (): Promise<Protocol[]> => {
    const { data, error } = await supabase.from('protocols').select('*').order('opened_at', { ascending: false });
    if (error) return [];
    return data.map(p => ({
      id: p.protocol_number || p.id,
      clientId: p.client_id,
      openedByOperatorId: p.opened_by_id,
      ownerOperatorId: p.owner_id,
      origin: p.origin,
      departmentId: p.department_id,
      categoryId: p.category_id,
      title: p.title,
      description: p.description,
      priority: p.priority as any,
      status: p.status as ProtocolStatus,
      openedAt: p.opened_at,
      updatedAt: p.updated_at,
      closedAt: p.closed_at,
      lastActionAt: p.updated_at,
      slaDueAt: p.sla_due_at,
      resolution_summary: p.resolution_summary
    }));
  },

  saveProtocol: async (protocol: Protocol, userId: string): Promise<string> => {
    const { data, error } = await supabase.from('protocols').insert({
      client_id: protocol.clientId,
      opened_by_id: protocol.openedByOperatorId,
      owner_id: protocol.ownerOperatorId,
      origin: protocol.origin,
      department_id: protocol.departmentId,
      category_id: protocol.categoryId,
      title: protocol.title,
      description: protocol.description,
      priority: protocol.priority,
      status: protocol.status,
      sla_due_at: protocol.slaDueAt
    }).select().single();
    if (error) throw error;
    await dataService.addProtocolEvent({ id: crypto.randomUUID(), protocolId: data.id, eventType: 'created', createdByUserId: userId, note: 'Aberto via sistema.', createdAt: new Date().toISOString() });
    return data.protocol_number || data.id;
  },

  updateProtocol: async (pId: string, updates: Partial<Protocol>, userId: string, note?: string): Promise<boolean> => {
    const { data: existing } = await supabase.from('protocols').select('id').or(`id.eq.${pId},protocol_number.eq.${pId}`).single();
    if (!existing) return false;
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.ownerOperatorId) payload.owner_id = updates.ownerOperatorId;
    if (updates.resolutionSummary) payload.resolution_summary = updates.resolutionSummary;
    if (updates.closedAt) payload.closed_at = updates.closedAt;
    const { error } = await supabase.from('protocols').update(payload).eq('id', existing.id);
    if (error) return false;
    if (note) await dataService.addProtocolEvent({ id: crypto.randomUUID(), protocolId: existing.id, eventType: updates.status ? 'status_changed' : 'note_added', note, createdByUserId: userId, createdAt: new Date().toISOString() });
    return true;
  },

  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    const { data: p } = await supabase.from('protocols').select('id').or(`id.eq.${protocolId},protocol_number.eq.${protocolId}`).single();
    if (!p) return [];
    const { data, error } = await supabase.from('protocol_events').select('*').eq('protocol_id', p.id).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(e => ({ id: e.id, protocolId, eventType: e.event_type as any, note: e.note, createdByUserId: e.actor_id, createdAt: e.created_at }));
  },

  addProtocolEvent: async (event: ProtocolEvent): Promise<void> => {
    await supabase.from('protocol_events').insert({ protocol_id: event.protocolId, actor_id: event.createdByUserId, event_type: event.eventType, note: event.note });
  },

  calculateIDE: (calls: CallRecord[]) => {
    if (!calls || calls.length === 0) return 0;
    const stageScores: Record<string, { sum: number, count: number }> = {};
    calls.forEach(call => {
      Object.entries(call.responses).forEach(([qId, resp]) => {
        const q = DEFAULT_QUESTIONS.find(x => x.id === qId);
        if (q?.stageId) {
          if (!stageScores[q.stageId]) stageScores[q.stageId] = { sum: 0, count: 0 };
          stageScores[q.stageId].sum += SCORE_MAP[resp as string] ?? 1;
          stageScores[q.stageId].count++;
        }
      });
    });
    let ide = 0, totalW = 0;
    Object.entries(STAGE_CONFIG).forEach(([sId, cfg]) => {
      const stats = stageScores[sId];
      if (stats?.count > 0) { ide += ((stats.sum / stats.count) / 2 * 100) * cfg.weight; totalW += cfg.weight; }
    });
    return totalW > 0 ? Math.round(ide / totalW) : 0;
  },

  getStageAverages: (calls: CallRecord[]) => {
    return Object.entries(STAGE_CONFIG).map(([sId, cfg]) => {
      const stageQs = DEFAULT_QUESTIONS.filter(q => q.stageId === sId).map(q => q.id);
      let sum = 0, cnt = 0;
      calls.forEach(c => stageQs.forEach(qId => { if (c.responses[qId] !== undefined) { sum += SCORE_MAP[c.responses[qId]] ?? 1; cnt++; } }));
      return { stage: cfg.label, percentage: cnt > 0 ? Math.round((sum / (cnt * 2)) * 100) : 0, color: cfg.color };
    });
  },

  getDetailedStats: (calls: CallRecord[], protocols: Protocol[]) => {
    const questions = DEFAULT_QUESTIONS;
    const questionAnalysis = questions.map(q => {
      const dist: Record<string, number> = {};
      q.options.forEach(o => dist[o] = 0);
      let cnt = 0, sum = 0;
      calls.forEach(c => {
        const r = c.responses?.[q.id];
        if (r && q.options.includes(r)) { dist[r]++; cnt++; sum += SCORE_MAP[r] ?? 1; }
      });
      return { id: q.id, text: q.text, type: q.type, responsesCount: cnt, avgScore: cnt > 0 ? (sum / (cnt * 2)) * 100 : 0, distribution: Object.entries(dist).map(([name, value]) => ({ name, value })) };
    }).filter(q => q.responsesCount > 0);
    return { questionAnalysis, resolutionStats: { satisfaction: [], repurchase: [] } };
  },

  getProtocolConfig: () => ({ departments: [{ id: 'd1', name: 'Execução/Obra' }, { id: 'd2', name: 'Instalação' }, { id: 'd3', name: 'SAC/Pós-Venda' }, { id: 'd4', name: 'Financeiro' }], categories: [] }),
  getQuestions: (): Question[] => DEFAULT_QUESTIONS
};
