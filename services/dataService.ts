
import { supabase, normalizePhone, getInternalEmail } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, ProtocolEvent 
} from '../types';
import { DEFAULT_QUESTIONS, SCORE_MAP, STAGE_CONFIG, PROTOCOL_SLA } from '../constants';

export const dataService = {
  // --- USUÁRIOS & AUTH ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) return [];
    
    return data.map(p => ({
      id: p.id,
      name: p.username_display,
      username: p.username_slug,
      role: p.role as UserRole,
      active: p.active
    }));
  },

  signIn: async (username: string, password: string): Promise<User> => {
    const email = getInternalEmail(username);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil de colaborador não encontrado no banco de dados.');
    }

    return {
      id: profile.id,
      name: profile.username_display,
      username: profile.username_slug,
      role: profile.role as UserRole,
      active: profile.active
    };
  },

  createUser: async (userData: Partial<User>): Promise<void> => {
    const email = getInternalEmail(userData.username || '');
    
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password: userData.password || 'dreon123',
      options: {
        data: {
          display_name: userData.name,
          username: userData.username
        }
      }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('Falha ao criar credenciais de acesso.');

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        username_display: userData.name,
        username_slug: userData.username,
        role: userData.role || UserRole.OPERATOR,
        active: true
      });

    if (profileError) throw new Error('Erro ao salvar perfil no banco de dados.');
  },

  // --- TAREFAS (FILA DE ATENDIMENTO) ---
  getTasks: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });
    
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

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<boolean> => {
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.skipReason) payload.skip_reason = updates.skipReason;
    if (updates.assignedTo) payload.assigned_to = updates.assignedTo;

    const { error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId);

    return !error;
  },

  // --- CLIENTES ---
  getClients: async (): Promise<Client[]> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    
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
      lastInteraction: c.last_interaction
    }));
  },

  upsertClient: async (client: Partial<Client>): Promise<Client> => {
    const phone = normalizePhone(client.phone || '');
    
    const clientPayload = {
      name: client.name || 'Cliente Sem Nome',
      phone: phone,
      address: client.address || '',
      items: client.items || [],
      acceptance: client.acceptance || 'medium',
      satisfaction: client.satisfaction || 'medium',
      invalid: client.invalid || false,
      last_interaction: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('clients')
      .upsert(clientPayload, { onConflict: 'phone' })
      .select()
      .single();

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
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
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
    const { error } = await supabase
      .from('call_logs')
      .insert({
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

    await supabase
      .from('clients')
      .update({ last_interaction: new Date().toISOString() })
      .eq('id', call.clientId);
  },

  // --- PROTOCOLOS ---
  getProtocols: async (): Promise<Protocol[]> => {
    const { data, error } = await supabase
      .from('protocols')
      .select('*')
      .order('opened_at', { ascending: false });
    
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
      resolutionSummary: p.resolution_summary
    }));
  },

  saveProtocol: async (protocol: Protocol, userId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('protocols')
      .insert({
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
      })
      .select()
      .single();

    if (error) throw error;

    await dataService.addProtocolEvent({
      id: crypto.randomUUID(),
      protocolId: data.id,
      eventType: 'created',
      createdByUserId: userId,
      note: 'Protocolo aberto via sistema.',
      createdAt: new Date().toISOString()
    });

    return data.protocol_number;
  },

  updateProtocol: async (pId: string, updates: Partial<Protocol>, userId: string, note?: string): Promise<boolean> => {
    const { data: existing } = await supabase
      .from('protocols')
      .select('id')
      .or(`id.eq.${pId},protocol_number.eq.${pId}`)
      .single();

    if (!existing) return false;

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.ownerOperatorId) payload.owner_id = updates.ownerOperatorId;
    if (updates.resolutionSummary) payload.resolution_summary = updates.resolutionSummary;
    if (updates.closedAt) payload.closed_at = updates.closedAt;

    const { error } = await supabase
      .from('protocols')
      .update(payload)
      .eq('id', existing.id);

    if (error) return false;

    if (note) {
      await dataService.addProtocolEvent({
        id: crypto.randomUUID(),
        protocolId: existing.id,
        eventType: updates.status ? 'status_changed' : 'note_added',
        newValue: updates.status || updates.ownerOperatorId,
        note,
        createdByUserId: userId,
        createdAt: new Date().toISOString()
      });
    }

    return true;
  },

  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    const { data: p } = await supabase
      .from('protocols')
      .select('id')
      .or(`id.eq.${protocolId},protocol_number.eq.${protocolId}`)
      .single();

    if (!p) return [];

    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .eq('protocol_id', p.id)
      .order('created_at', { ascending: false });
    
    if (error) return [];

    return data.map(e => ({
      id: e.id,
      protocolId: protocolId,
      eventType: e.event_type as any,
      oldValue: e.old_value,
      newValue: e.new_value,
      note: e.note,
      createdByUserId: e.actor_id,
      createdAt: e.created_at
    }));
  },

  addProtocolEvent: async (event: ProtocolEvent): Promise<void> => {
    const { error } = await supabase
      .from('protocol_events')
      .insert({
        protocol_id: event.protocolId,
        actor_id: event.createdByUserId,
        event_type: event.eventType,
        old_value: event.oldValue,
        new_value: event.newValue,
        note: event.note
      });
    
    if (error) console.error("Event error:", error);
  },

  // --- ANALYTICS & HELPERS ---
  calculateIDE: (calls: CallRecord[]) => {
    if (!calls || calls.length === 0) return 0;
    const stageScores: Record<string, { sum: number, count: number }> = {};
    calls.forEach(call => {
      Object.entries(call.responses).forEach(([qId, response]) => {
        const question = DEFAULT_QUESTIONS.find(q => q.id === qId);
        if (question?.stageId) {
          if (!stageScores[question.stageId]) stageScores[question.stageId] = { sum: 0, count: 0 };
          stageScores[question.stageId].sum += SCORE_MAP[response as string] ?? 1;
          stageScores[question.stageId].count += 1;
        }
      });
    });
    let ide = 0, totalWeight = 0;
    Object.entries(STAGE_CONFIG).forEach(([stageId, config]) => {
      const stats = stageScores[stageId];
      if (stats && stats.count > 0) {
        ide += ((stats.sum / stats.count) / 2 * 100) * config.weight;
        totalWeight += config.weight;
      }
    });
    return totalWeight > 0 ? Math.round(ide / totalWeight) : 0;
  },

  getStageAverages: (calls: CallRecord[]) => {
    return Object.entries(STAGE_CONFIG).map(([stageId, config]) => {
      const stageQuestions = DEFAULT_QUESTIONS.filter(q => q.stageId === stageId).map(q => q.id);
      let sum = 0, count = 0;
      calls.forEach(c => {
        stageQuestions.forEach(qId => {
          if (c.responses[qId] !== undefined) {
            sum += SCORE_MAP[c.responses[qId]] ?? 1;
            count++;
          }
        });
      });
      return { stage: config.label, percentage: count > 0 ? Math.round((sum / (count * 2)) * 100) : 0, color: config.color };
    });
  },

  getDetailedStats: (calls: CallRecord[], protocols: Protocol[]) => {
    const questions = DEFAULT_QUESTIONS;
    const questionAnalysis = questions.map(q => {
      const distribution: Record<string, number> = {};
      q.options.forEach(opt => distribution[opt] = 0);
      let responsesCount = 0;
      let scoreSum = 0;
      calls.forEach(call => {
        const resp = call.responses?.[q.id];
        if (resp && q.options.includes(resp)) {
          distribution[resp] = (distribution[resp] || 0) + 1;
          responsesCount++;
          scoreSum += SCORE_MAP[resp] ?? 1;
        }
      });
      return {
        id: q.id, text: q.text, type: q.type, responsesCount,
        avgScore: responsesCount > 0 ? (scoreSum / (responsesCount * 2)) * 100 : 0,
        distribution: Object.entries(distribution).map(([name, value]) => ({ name, value }))
      };
    }).filter(q => q.responsesCount > 0);

    return { 
      questionAnalysis, 
      resolutionStats: { 
        satisfaction: [], 
        repurchase: [] 
      } 
    };
  },

  getProtocolConfig: () => ({
    departments: [
      { id: 'd1', name: 'Execução/Obra' }, { id: 'd2', name: 'Instalação' }, 
      { id: 'd3', name: 'SAC/Pós-Venda' }, { id: 'd4', name: 'Financeiro' }
    ],
    categories: []
  }),

  getQuestions: (): Question[] => DEFAULT_QUESTIONS
};
