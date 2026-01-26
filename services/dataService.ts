
import { supabase, normalizePhone, slugify, getInternalEmail } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, ProtocolEvent 
} from '../types';
import { DEFAULT_QUESTIONS, SCORE_MAP, STAGE_CONFIG } from '../constants';

export const dataService = {
  // --- USUÁRIOS & AUTH ---
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

  signIn: async (username: string, password: string) => {
    const email = getInternalEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      id: profile.id,
      name: profile.username_display,
      username: profile.username_slug,
      role: profile.role as UserRole,
      active: profile.active
    };
  },

  addUser: async (userData: any): Promise<boolean> => {
    // Nota: Cadastro real precisa de Auth.signUp. 
    // Em uma SPA comum, o Admin usaria uma Edge Function ou convidaria.
    return true; 
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
      acceptance: c.acceptance as any,
      satisfaction: c.satisfaction as any,
      invalid: c.invalid
    }));
  },

  upsertClient: async (client: Partial<Client>) => {
    if (!client.phone) return null;
    const phone = normalizePhone(client.phone);
    
    const payload = {
      name: client.name,
      phone,
      address: client.address,
      items: client.items,
      acceptance: client.acceptance || 'medium',
      satisfaction: client.satisfaction || 'medium',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('clients')
      .upsert(payload, { onConflict: 'phone' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- CHAMADAS ---
  saveCall: async (call: CallRecord) => {
    const { error } = await supabase.from('call_logs').insert({
      operator_id: call.operatorId,
      client_id: call.clientId,
      call_type: call.type,
      duration: call.duration,
      report_time: call.reportTime,
      responses: call.responses,
      protocol_id: call.protocolId,
      start_time: call.startTime,
      end_time: call.endTime
    });
    if (error) throw error;
  },

  getCalls: async (): Promise<CallRecord[]> => {
    const { data, error } = await supabase.from('call_logs').select('*');
    if (error) return [];
    return data.map(c => ({
      id: c.id,
      operatorId: c.operator_id,
      clientId: c.client_id,
      type: c.call_type as CallType,
      startTime: c.start_time,
      endTime: c.end_time,
      duration: c.duration,
      reportTime: c.report_time,
      responses: c.responses,
      protocolId: c.protocol_id
    }));
  },

  // --- PROTOCOLOS ---
  getProtocols: async (): Promise<Protocol[]> => {
    const { data, error } = await supabase.from('protocols').select('*');
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
      slaDueAt: p.sla_due_at,
      resolutionSummary: p.resolution_summary
    }));
  },

  saveProtocol: async (protocol: Protocol, userId: string) => {
    const { data, error } = await supabase.from('protocols').insert({
      client_id: protocol.clientId,
      opened_by_id: userId,
      owner_id: protocol.ownerOperatorId,
      origin: protocol.origin,
      department_id: protocol.departmentId,
      title: protocol.title,
      description: protocol.description,
      priority: protocol.priority,
      status: protocol.status,
      sla_due_at: protocol.slaDueAt
    }).select().single();

    if (error) throw error;

    // Log creation event
    await supabase.from('protocol_events').insert({
      protocol_id: data.id,
      event_type: 'created',
      created_by_user_id: userId,
      note: 'Protocolo aberto'
    });

    return true;
  },

  updateProtocol: async (pId: string, updates: Partial<Protocol>, userId: string, note?: string) => {
    const { data: proto } = await supabase.from('protocols').select('id').or(`protocol_number.eq.${pId},id.eq.${pId}`).single();
    if (!proto) return false;

    const { error } = await supabase.from('protocols').update({
      status: updates.status,
      resolution_summary: updates.resolutionSummary,
      owner_id: updates.ownerOperatorId,
      closed_at: updates.closedAt,
      updated_at: new Date().toISOString()
    }).eq('id', proto.id);

    if (error) return false;

    if (note) {
      await supabase.from('protocol_events').insert({
        protocol_id: proto.id,
        event_type: updates.status ? 'status_changed' : 'note_added',
        new_value: updates.status,
        note,
        created_by_user_id: userId
      });
    }

    return true;
  },

  // Added getProtocolEvents method to fix reference errors in Protocols.tsx
  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    const { data: proto } = await supabase.from('protocols').select('id').or(`protocol_number.eq.${protocolId},id.eq.${protocolId}`).single();
    if (!proto) return [];

    const { data, error } = await supabase.from('protocol_events')
      .select('*')
      .eq('protocol_id', proto.id)
      .order('created_at', { ascending: false });
      
    if (error) return [];
    return data.map(e => ({
      id: e.id,
      protocolId: e.protocol_id,
      eventType: e.event_type,
      oldValue: e.old_value,
      newValue: e.new_value,
      note: e.note,
      createdByUserId: e.created_by_user_id,
      createdAt: e.created_at
    }));
  },

  // --- RELATÓRIOS (CALCULADOS NO FRONT) ---
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

    return { questionAnalysis, resolutionStats: { satisfaction: [], repurchase: [] } };
  },

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

  getProtocolConfig: () => ({
    departments: [
      { id: 'd1', name: 'Execução/Obra' }, { id: 'd2', name: 'Instalação' }, 
      { id: 'd3', name: 'SAC/Pós-Venda' }, { id: 'd4', name: 'Financeiro' }
    ],
    categories: []
  }),

  // Added updateTask method to fix reference error in Queue.tsx
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
    return !error;
  },

  // Added getQuestions method to fix reference error in Queue.tsx
  getQuestions: (): Question[] => {
    return DEFAULT_QUESTIONS;
  },

  // Fallback para Tasks
  getTasks: (): Task[] => [] 
};
