
import { supabase, normalizePhone, getInternalEmail, slugify } from '../lib/supabase';
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

  // --- BUSCAS DETALHADAS DASHBOARD (Auditoria Admin) ---
  getDetailedCallsToday: async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        profiles:operator_id(username_display),
        clients:client_id(name, phone, items)
      `)
      .gte('start_time', `${today}T00:00:00`)
      .order('start_time', { ascending: false });
    
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
      status: t.status as any,
      skipReason: t.skip_reason
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
      status: updates.status,
      skip_reason: updates.skipReason
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
      acceptance: c.acceptance as any || 'medium',
      satisfaction: c.satisfaction as any || 'medium'
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
      report_time: call.reportTime,
      start_time: call.startTime,
      end_time: call.endTime,
      protocol_id: call.protocolId
    });
    if (error) throw error;
  },

  getCalls: async () => {
    const { data } = await supabase.from('call_logs').select('*').order('start_time', { ascending: false });
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
  
  // Lógica de cálculo de IDE para o relatório
  calculateIDE: (calls: any[]) => {
    if (!calls || calls.length === 0) return 0;
    let totalScore = 0;
    let totalQuestions = 0;

    calls.forEach(call => {
      Object.entries(call.responses || {}).forEach(([qId, response]) => {
        if (qId === 'summary' || qId === 'written_report' || qId === 'call_type') return;
        const score = SCORE_MAP[response as string];
        if (score !== undefined) {
          totalScore += (score / 2) * 100;
          totalQuestions++;
        }
      });
    });

    return totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;
  },

  getStageAverages: (calls: any[]) => {
    const stages: Record<string, { total: number, count: number, color: string }> = {};
    
    calls.forEach(call => {
      Object.entries(call.responses || {}).forEach(([qId, response]) => {
        const question = DEFAULT_QUESTIONS.find(q => q.id === qId);
        if (question && question.stageId) {
          const config = STAGE_CONFIG[question.stageId as keyof typeof STAGE_CONFIG];
          if (!stages[config.label]) stages[config.label] = { total: 0, count: 0, color: config.color };
          
          const score = SCORE_MAP[response as string];
          if (score !== undefined) {
            stages[config.label].total += (score / 2) * 100;
            stages[config.label].count++;
          }
        }
      });
    });

    return Object.entries(stages).map(([stage, data]) => ({
      stage,
      percentage: Math.round(data.total / data.count),
      color: data.color
    }));
  },

  getDetailedStats: (calls: any[], protocols: any[]) => {
    const questionAnalysis = DEFAULT_QUESTIONS.map(q => {
      const responses = calls
        .map(c => c.responses?.[q.id])
        .filter(r => r !== undefined);
      
      const distribution = q.options.map(opt => ({
        name: opt,
        value: responses.filter(r => r === opt).length
      }));

      const scores = responses.map(r => SCORE_MAP[r] || 0);
      const avgScore = scores.length > 0 
        ? (scores.reduce((a, b) => a + b, 0) / (scores.length * 2)) * 100 
        : 0;

      return {
        id: q.id,
        text: q.text,
        type: q.type,
        distribution,
        avgScore,
        responsesCount: responses.length
      };
    }).filter(q => q.responsesCount > 0);

    return {
      questionAnalysis,
      resolutionStats: {
        satisfaction: [
          { name: 'Boa', value: protocols.filter(p => p.resolution_summary?.includes('Satisfação: Boa')).length },
          { name: 'Regular', value: protocols.filter(p => p.resolution_summary?.includes('Satisfação: Regular')).length },
          { name: 'Ruim', value: protocols.filter(p => p.resolution_summary?.includes('Satisfação: Ruim')).length }
        ],
        repurchase: [
          { name: 'Sim', value: protocols.filter(p => p.resolution_summary?.includes('Retornou Compra: Sim')).length },
          { name: 'Não', value: protocols.filter(p => p.resolution_summary?.includes('Retornou Compra: Não')).length }
        ]
      }
    };
  }
};
