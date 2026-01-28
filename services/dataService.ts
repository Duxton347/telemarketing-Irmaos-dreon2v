
import { supabase, normalizePhone, getInternalEmail, slugify } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, ProtocolEvent,
  OperatorEventType, OperatorEvent 
} from '../types';
import { SCORE_MAP, STAGE_CONFIG } from '../constants';

const normalize = (str: string) => 
  str ? str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "") : "";

export const dataService = {
  getResponseValue: (responses: any, question: Question) => {
    if (!responses) return undefined;
    if (responses[question.id] !== undefined) return responses[question.id];
    const questionTextNorm = normalize(question.text);
    const keys = Object.keys(responses);
    for (const key of keys) {
      if (normalize(key) === questionTextNorm) return responses[key];
    }
    const legacyKey = `pv${question.order}`;
    if (responses[legacyKey] !== undefined) return responses[legacyKey];
    return undefined;
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('username_display');
      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        name: p.username_display || 'Sem Nome',
        username: p.username_slug || '',
        role: (p.role as UserRole) || UserRole.OPERATOR,
        active: p.active ?? true
      }));
    } catch (e) { return []; }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    const payload: any = {};
    if (updates.role) payload.role = updates.role;
    if (updates.active !== undefined) payload.active = updates.active;
    if (updates.name) payload.username_display = updates.name;
    await supabase.from('profiles').update(payload).eq('id', userId);
  },

  createUser: async (user: Partial<User>): Promise<void> => {
    const email = getInternalEmail(user.username || '');
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: user.password! });
    if (authError) throw authError;
    await supabase.from('profiles').insert({
      id: authData.user!.id,
      username_display: user.name,
      username_slug: slugify(user.username || ''),
      role: user.role,
      active: true
    });
  },

  signIn: async (username: string, password: string): Promise<User> => {
    const email = getInternalEmail(username);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user!.id).single();
    return {
      id: profile.id,
      name: profile.username_display,
      username: profile.username_slug,
      role: profile.role as UserRole,
      active: profile.active
    };
  },

  getQuestions: async (): Promise<Question[]> => {
    try {
      const { data, error } = await supabase.from('questions').select('*').order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []).map(q => ({
        id: q.id,
        text: q.text,
        options: q.options || [],
        type: q.type as any,
        order: q.order_index,
        stageId: q.stage_id
      }));
    } catch (e) { return []; }
  },

  saveQuestion: async (q: Partial<Question>): Promise<void> => {
    const payload = { text: q.text, options: q.options, type: q.type, order_index: q.order, stage_id: q.stageId };
    if (q.id) await supabase.from('questions').update(payload).eq('id', q.id);
    else await supabase.from('questions').insert(payload);
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await supabase.from('questions').delete().eq('id', id);
  },

  getTasks: async (): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(t => ({
      id: t.id,
      clientId: t.client_id,
      type: t.type as CallType,
      deadline: t.created_at,
      assignedTo: t.assigned_to,
      status: t.status as any,
      skipReason: t.skip_reason
    }));
  },

  createTask: async (task: Partial<Task>): Promise<void> => {
    await supabase.from('tasks').insert({
      client_id: task.clientId,
      type: task.type,
      assigned_to: task.assignedTo,
      status: task.status || 'pending'
    });
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<void> => {
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.skipReason) payload.skip_reason = updates.skipReason;
    await supabase.from('tasks').update(payload).eq('id', taskId);
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },

  deleteTasksByOperator: async (operatorId: string): Promise<void> => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('assigned_to', operatorId)
      .in('status', ['pending', 'skipped']);
    if (error) throw error;
  },

  deleteDuplicateTasks: async (): Promise<number> => {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, client_id, assigned_to, type, status')
      .eq('status', 'pending');
    
    if (error || !tasks) return 0;

    const seen = new Set();
    const toDelete = [];

    for (const task of tasks) {
      const key = `${task.client_id}-${task.assigned_to}-${task.type}`;
      if (seen.has(key)) {
        toDelete.push(task.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from('tasks')
        .delete()
        .in('id', toDelete);
      if (delError) throw delError;
    }

    return toDelete.length;
  },

  getCalls: async (): Promise<CallRecord[]> => {
    const { data, error } = await supabase.from('call_logs').select('*').order('start_time', { ascending: false });
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      taskId: c.task_id,
      operatorId: c.operator_id,
      clientId: c.client_id,
      startTime: c.start_time,
      endTime: c.end_time,
      duration: c.duration,
      reportTime: c.report_time,
      responses: c.responses || {},
      type: (c.call_type as CallType) || CallType.POS_VENDA,
      protocolId: c.protocol_id
    }));
  },

  checkRecentCall: async (clientId: string): Promise<boolean> => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const { data, error } = await supabase
      .from('call_logs')
      .select('id')
      .eq('client_id', clientId)
      .gte('start_time', threeDaysAgo.toISOString())
      .limit(1);
    
    if (error) return false;
    return data && data.length > 0;
  },

  saveCall: async (call: CallRecord): Promise<void> => {
    await supabase.from('call_logs').insert({
      task_id: call.taskId,
      operator_id: call.operatorId,
      client_id: call.clientId,
      call_type: call.type,
      responses: call.responses,
      duration: call.duration,
      report_time: call.reportTime,
      start_time: call.startTime,
      end_time: call.endTime,
      protocol_id: call.protocolId
    });
    
    await supabase.from('clients').update({ last_interaction: new Date().toISOString() }).eq('id', call.clientId);
  },

  getDetailedCallsToday: async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('call_logs')
      .select('*, clients(*), profiles:operator_id(*)')
      .gte('start_time', `${todayStr}T00:00:00`)
      .order('start_time', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getDetailedPendingTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, clients(*), profiles:assigned_to(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(t => ({ ...t, duration: 0 }));
  },

  logOperatorEvent: async (operatorId: string, type: OperatorEventType, taskId?: string, note?: string) => {
    await supabase.from('operator_events').insert({
      operator_id: operatorId,
      event_type: type,
      task_id: taskId,
      note: note
    });
  },

  getOperatorEvents: async (startDate: string, endDate: string): Promise<OperatorEvent[]> => {
    const { data, error } = await supabase
      .from('operator_events')
      .select('*')
      .gte('timestamp', `${startDate}T00:00:00`)
      .lte('timestamp', `${endDate}T23:59:59`)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      operatorId: e.operator_id,
      taskId: e.task_id,
      eventType: e.event_type as OperatorEventType,
      timestamp: e.timestamp,
      note: e.note
    }));
  },

  getClients: async (): Promise<Client[]> => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      name: c.name || 'Sem Nome',
      phone: c.phone || '',
      address: c.address || '',
      items: c.items || [],
      acceptance: (c.acceptance as any) || 'medium',
      satisfaction: (c.satisfaction as any) || 'medium'
    }));
  },

  upsertClient: async (client: Partial<Client>): Promise<Client> => {
    const phone = normalizePhone(client.phone || '');
    if (!phone) throw new Error("Telefone obrigatório");

    const { data: existing } = await supabase.from('clients').select('*').eq('phone', phone).maybeSingle();
    
    const payload: any = { 
      name: client.name, 
      phone, 
      address: client.address || existing?.address || '', 
      items: Array.from(new Set([...(existing?.items || []), ...(client.items || [])])),
      last_interaction: existing?.last_interaction || new Date().toISOString()
    };

    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'phone' }).select().single();
    if (error) throw error;
    return data;
  },

  getProtocolConfig: () => ({
    departments: [
      { id: 'atendimento', name: 'Atendimento/Vendas' },
      { id: 'tecnico', name: 'Suporte Técnico' },
      { id: 'financeiro', name: 'Financeiro' },
      { id: 'logistica', name: 'Logística/Entrega' }
    ]
  }),

  getProtocols: async (): Promise<Protocol[]> => {
    const { data, error } = await supabase.from('protocols').select('*').order('opened_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      clientId: p.client_id,
      openedByOperatorId: p.opened_by_id,
      ownerOperatorId: p.owner_id,
      origin: p.origin || 'Atendimento',
      departmentId: p.department_id,
      categoryId: '',
      title: p.title || 'Sem Título',
      description: p.description || '',
      priority: (p.priority as any) || 'Média',
      status: (p.status as ProtocolStatus) || ProtocolStatus.ABERTO,
      openedAt: p.opened_at,
      updatedAt: p.updated_at,
      closedAt: p.closed_at,
      lastActionAt: p.updated_at,
      slaDueAt: p.opened_at,
      resolutionSummary: p.resolution_summary,
      protocolNumber: p.protocol_number
    }));
  },

  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
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

  saveProtocol: async (p: Protocol, actorId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('protocols').insert({
        client_id: p.clientId,
        opened_by_id: p.openedByOperatorId,
        owner_id: p.ownerOperatorId,
        origin: p.origin || 'Manual',
        department_id: p.departmentId,
        title: p.title,
        description: p.description,
        priority: p.priority,
        status: p.status,
        opened_at: p.openedAt,
        updated_at: p.updatedAt,
        sla_due_at: p.slaDueAt
      }).select().single();
      
      if (error) {
        console.error("[dataService.saveProtocol] Insert Error:", error);
        throw error;
      }
      
      await supabase.from('protocol_events').insert({
        protocol_id: data.id,
        event_type: 'creation',
        note: 'Protocolo aberto manualmente',
        actor_id: actorId
      });
      return true;
    } catch (err) {
      console.error("[dataService.saveProtocol] Fatal Error:", err);
      throw err;
    }
  },

  updateProtocol: async (protocolId: string, updates: Partial<Protocol>, actorId: string, note?: string): Promise<boolean> => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.ownerOperatorId) payload.owner_id = updates.ownerOperatorId;
    if (updates.resolutionSummary) payload.resolution_summary = updates.resolutionSummary;
    if (updates.closedAt) payload.closed_at = updates.closedAt;
    const { error } = await supabase.from('protocols').update(payload).eq('id', protocolId);
    if (error) throw error;
    await supabase.from('protocol_events').insert({
      protocol_id: protocolId,
      event_type: updates.status ? 'status_change' : 'update',
      note: note || 'Atualização de protocolo',
      actor_id: actorId
    });
    return true;
  },

  calculateIDE: async (calls: CallRecord[]) => {
    if (!calls || calls.length === 0) return 0;
    const questions = await dataService.getQuestions();
    const recommendationQuestion = questions.find(q => normalize(q.text).includes('recomendaria'));
    if (!recommendationQuestion) return 0;
    let totalScore = 0;
    let totalResp = 0;
    calls.forEach(call => {
      const val = dataService.getResponseValue(call.responses, recommendationQuestion);
      if (val) {
        const score = SCORE_MAP[String(val)];
        if (score !== undefined) {
          totalScore += (score / 2) * 100;
          totalResp++;
        }
      }
    });
    return totalResp > 0 ? Math.round(totalScore / totalResp) : 0;
  },

  getStageAverages: async (calls: CallRecord[]) => {
    const questions = await dataService.getQuestions();
    const stages: Record<string, { total: number, count: number, color: string }> = {};
    calls.forEach(call => {
      questions.forEach(question => {
        if (!question.stageId) return;
        const val = dataService.getResponseValue(call.responses, question);
        if (val) {
          const config = STAGE_CONFIG[question.stageId as keyof typeof STAGE_CONFIG];
          if (!stages[config.label]) stages[config.label] = { total: 0, count: 0, color: config.color };
          const score = SCORE_MAP[String(val)];
          if (score !== undefined) {
            stages[config.label].total += (score / 2) * 100;
            stages[config.label].count++;
          }
        }
      });
    });
    return Object.entries(stages).map(([stage, data]) => ({ stage, percentage: data.count > 0 ? Math.round(data.total / data.count) : 0, color: data.color }));
  },

  getDetailedStats: async (calls: CallRecord[], protocols: Protocol[], tasks: Task[]) => {
    const questions = await dataService.getQuestions();
    const questionAnalysis = questions.map(q => {
      const responses = calls.map(c => dataService.getResponseValue(c.responses, q)).filter(r => r !== undefined);
      const distribution = q.options.map(opt => ({
        name: opt,
        value: responses.filter(r => normalize(String(r)) === normalize(String(opt))).length
      }));
      const posOpts = ['sim', 'otimo', 'atendeu', 'no prazo', 'alto', 'boa'];
      const posCount = responses.filter(r => posOpts.some(p => normalize(String(r)) === p)).length;
      return {
        id: q.id,
        text: q.text,
        order: q.order,
        distribution,
        responsesCount: responses.length,
        positivity: responses.length > 0 ? Math.round((posCount / responses.length) * 100) : 0
      };
    });
    const skips = tasks.filter(t => t.status === 'skipped');
    const skipStats = Array.from(new Set(skips.map(s => s.skipReason || 'Não informado'))).map(reason => ({
      name: reason,
      value: skips.filter(s => (s.skipReason || 'Não informado') === reason).length
    }));
    const protocolCategoryStats = dataService.getProtocolConfig().departments.map(dept => ({
      name: dept.name,
      id: dept.id,
      value: protocols.filter(p => p.departmentId === dept.id).length
    }));
    return { questionAnalysis, protocolCategoryStats, skipStats };
  }
};
