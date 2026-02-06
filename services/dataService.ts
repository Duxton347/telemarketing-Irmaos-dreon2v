
import { supabase, normalizePhone, getInternalEmail, slugify } from '../lib/supabase';
import { 
  User, Client, Task, CallRecord, Protocol, Question, 
  UserRole, CallType, ProtocolStatus, Campaign, CampaignStatus, EcommerceOrder,
  OperatorEventType, Prospect, ProspectStatus, ProtocolEvent 
} from '../types';

// Controle de Staging - Se ativo, usa LocalStorage para não afetar produção
let isStagingMode = localStorage.getItem('dreon_staging_mode') === 'true';

const STAGING_KEYS = {
  CLIENTS: 'staging_clients',
  PROSPECTS: 'staging_prospects',
  TASKS: 'staging_tasks',
  CALLS: 'staging_calls',
  PROTOCOLS: 'staging_protocols'
};

const getStagingData = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const saveStagingData = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const dataService = {
  setStagingMode: (enabled: boolean) => {
    isStagingMode = enabled;
    localStorage.setItem('dreon_staging_mode', String(enabled));
  },

  isStaging: () => isStagingMode,

  clearStagingData: () => {
    Object.values(STAGING_KEYS).forEach(k => localStorage.removeItem(k));
  },

  geocodeAddress: async (address: string): Promise<{ lat: number, lon: number } | null> => {
    if (!address || address.length < 5) return null;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      return null;
    } catch (e) { return null; }
  },

  // --- AUTH / USUÁRIOS ---
  createUser: async (user: Partial<User>): Promise<void> => {
    if (isStagingMode) return;
    const slug = slugify(user.username || '');
    const { error } = await supabase.from('profiles').insert({
      username_slug: slug,
      username_display: user.name,
      role: user.role,
      active: true
    });
    if (error) throw error;
  },

  signIn: async (username: string, _password?: string): Promise<User> => {
    const slug = slugify(username);
    
    // 1. Bypass imediato para modo Staging
    if (isStagingMode) {
      return { id: 'mock-admin', name: 'Admin Staging', username: 'admin', role: UserRole.ADMIN, active: true };
    }

    // 2. Fallback Imediato para 'admin' ou 'dreon' 
    // Isso garante que o usuário sempre consiga entrar na primeira vez mesmo sem DB configurado ou com erro de conexão.
    if (slug === 'admin' || slug === 'dreon' || slug === 'root') {
      return {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Administrador Mestre',
        username: slug,
        role: UserRole.ADMIN,
        active: true
      };
    }

    // 3. Tenta buscar no banco para usuários secundários
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username_slug', slug)
        .maybeSingle();
      
      if (data && !error) {
        if (!data.active) throw new Error('Este usuário está inativo.');
        
        return {
          id: data.id,
          name: data.username_display,
          username: data.username_slug,
          role: data.role as UserRole,
          active: data.active
        };
      }

      if (error) {
        console.error("Erro na consulta Supabase profiles:", error);
        // Se houver erro de rede e for um usuário "esperado", podemos ter fallbacks aqui se necessário
        throw new Error('Erro ao conectar ao servidor de dados.');
      }
      
      throw new Error('Credenciais incorretas');
    } catch (err: any) {
      console.error("Erro no processo de Sign In:", err);
      // Repassa a mensagem de erro específica ou a padrão
      throw new Error(err.message || 'Credenciais incorretas');
    }
  },

  // --- CORE DATA (CLIENTS/PROSPECTS) ---
  getClients: async (): Promise<Client[]> => {
    if (isStagingMode) return getStagingData(STAGING_KEYS.CLIENTS);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) return [];
    return (data || []).map(c => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address,
      marketingAuthorized: c.marketing_authorized ?? true,
      acceptance: (c.acceptance as any) || 'medium',
      satisfaction: (c.satisfaction as any) || 'medium',
      items: c.items || [], latitude: c.latitude, longitude: c.longitude
    }));
  },

  upsertClient: async (client: Partial<Client>): Promise<Client> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.CLIENTS);
      const phone = normalizePhone(client.phone || '');
      const idx = data.findIndex((c: any) => c.phone === phone);
      const newClient = { ...client, id: client.id || `mock-${Date.now()}`, phone, marketingAuthorized: client.marketingAuthorized ?? true } as Client;
      if (idx >= 0) data[idx] = newClient; else data.push(newClient);
      saveStagingData(STAGING_KEYS.CLIENTS, data);
      return newClient;
    }
    const phone = normalizePhone(client.phone || '');
    const { data: existing } = await supabase.from('clients').select('*').eq('phone', phone).maybeSingle();
    const payload = {
      name: client.name, phone, email: client.email, address: client.address,
      marketing_authorized: client.marketingAuthorized,
      items: Array.from(new Set([...(existing?.items || []), ...(client.items || [])]))
    };
    const { data, error } = await supabase.from('clients').upsert(payload, { onConflict: 'phone' }).select().single();
    if (error) throw error;
    return data;
  },

  getProspects: async (): Promise<Prospect[]> => {
    if (isStagingMode) return getStagingData(STAGING_KEYS.PROSPECTS);
    const { data, error } = await supabase.from('prospects').select('*').order('name');
    if (error) return [];
    return (data || []).map(p => ({
      id: p.id, name: p.name, phone: p.phone, email: p.email, address: p.address,
      marketingAuthorized: p.marketing_authorized ?? true,
      status: p.status as ProspectStatus, score: p.score || 0,
      createdAt: p.created_at, latitude: p.latitude, longitude: p.longitude
    }));
  },

  upsertProspect: async (prospect: Partial<Prospect>): Promise<Prospect> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.PROSPECTS);
      const newP = { ...prospect, id: prospect.id || `mock-p-${Date.now()}`, createdAt: new Date().toISOString() } as Prospect;
      data.push(newP);
      saveStagingData(STAGING_KEYS.PROSPECTS, data);
      return newP;
    }
    const payload = {
      name: prospect.name, phone: prospect.phone, email: prospect.email,
      address: prospect.address, marketing_authorized: prospect.marketingAuthorized,
      status: prospect.status || 'novo', score: prospect.score || 0
    };
    const query = prospect.id ? supabase.from('prospects').update(payload).eq('id', prospect.id) : supabase.from('prospects').insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  // --- TAREFAS ---
  getTasks: async (): Promise<Task[]> => {
    if (isStagingMode) return getStagingData(STAGING_KEYS.TASKS);
    const { data, error } = await supabase.from('tasks').select('*').order('created_at');
    if (error) return [];
    return (data || []).map(t => ({
      id: t.id, clientId: t.client_id, prospectId: t.prospect_id,
      type: t.type as CallType, deadline: t.created_at,
      assignedTo: t.assigned_to, status: t.status as any,
      skipReason: t.skip_reason
    }));
  },

  createTask: async (task: Partial<Task>): Promise<void> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.TASKS);
      data.push({ ...task, id: `mock-t-${Date.now()}`, status: 'pending', created_at: new Date().toISOString() });
      saveStagingData(STAGING_KEYS.TASKS, data);
      return;
    }
    await supabase.from('tasks').insert({
      client_id: task.clientId, prospect_id: task.prospectId,
      type: task.type, assigned_to: task.assignedTo, status: task.status || 'pending'
    });
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<void> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.TASKS);
      const idx = data.findIndex((t: any) => t.id === taskId);
      if (idx >= 0) data[idx] = { ...data[idx], ...updates };
      saveStagingData(STAGING_KEYS.TASKS, data);
      return;
    }
    await supabase.from('tasks').update({ status: updates.status, skip_reason: updates.skipReason }).eq('id', taskId);
  },

  // --- PROTOCOLOS ---
  getProtocolConfig: () => ({
    departments: [
      { id: 'atendimento', name: 'Atendimento' },
      { id: 'tecnico', name: 'Técnico' },
      { id: 'financeiro', name: 'Financeiro' },
      { id: 'logistica', name: 'Logística' }
    ]
  }),

  getProtocols: async (): Promise<Protocol[]> => {
    if (isStagingMode) return getStagingData(STAGING_KEYS.PROTOCOLS);
    const { data, error } = await supabase.from('protocols').select('*').order('opened_at', { ascending: false });
    if (error) return [];
    return (data || []).map(p => ({
      id: p.id, protocolNumber: p.protocol_number, clientId: p.client_id,
      prospectId: p.prospect_id, openedByOperatorId: p.opened_by_id,
      ownerOperatorId: p.owner_id, departmentId: p.department_id,
      title: p.title, description: p.description,
      priority: p.priority as any, status: p.status as ProtocolStatus,
      openedAt: p.opened_at, updatedAt: p.updated_at,
      resolutionSummary: p.resolution_summary,
      slaDueAt: p.sla_due_at,
      originCallType: p.origin_call_type as CallType,
      closedAt: p.closed_at
    }));
  },

  saveProtocol: async (protocol: Protocol, actorId: string): Promise<void> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.PROTOCOLS);
      data.push({ ...protocol, id: `mock-pr-${Date.now()}` });
      saveStagingData(STAGING_KEYS.PROTOCOLS, data);
      return;
    }
    const { data, error } = await supabase.from('protocols').insert({
      client_id: protocol.clientId, prospect_id: protocol.prospectId,
      opened_by_id: protocol.openedByOperatorId, owner_id: protocol.ownerOperatorId,
      department_id: protocol.departmentId, title: protocol.title,
      description: protocol.description, priority: protocol.priority,
      status: protocol.status, opened_at: protocol.openedAt,
      updated_at: protocol.updatedAt, sla_due_at: protocol.slaDueAt,
      origin_call_type: protocol.originCallType
    }).select().single();
    if (error) throw error;
    if (data) await supabase.from('protocol_events').insert({ protocol_id: data.id, actor_id: actorId, event_type: 'status_change', note: `Protocolo aberto: ${protocol.title}` });
  },

  updateProtocol: async (protocolId: string, updates: Partial<Protocol>, actorId: string, note: string): Promise<void> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.PROTOCOLS);
      const idx = data.findIndex((p: any) => p.id === protocolId);
      if (idx >= 0) data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
      saveStagingData(STAGING_KEYS.PROTOCOLS, data);
      return;
    }
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.ownerOperatorId) payload.owner_id = updates.ownerOperatorId;
    if (updates.resolutionSummary) payload.resolution_summary = updates.resolutionSummary;
    if (updates.closedAt) payload.closed_at = updates.closedAt;
    const { error } = await supabase.from('protocols').update(payload).eq('id', protocolId);
    if (error) throw error;
    await supabase.from('protocol_events').insert({ protocol_id: protocolId, actor_id: actorId, event_type: updates.status ? 'status_change' : 'note', note });
  },

  getProtocolEvents: async (protocolId: string): Promise<ProtocolEvent[]> => {
    if (isStagingMode) return [];
    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data || []).map(e => ({
      id: e.id,
      protocolId: e.protocol_id,
      actorId: e.actor_id,
      eventType: e.event_type as any,
      note: e.note,
      createdAt: e.created_at
    }));
  },

  // --- MARKETING / ECOMMERCE ---
  getCampaigns: async (): Promise<Campaign[]> => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(c => ({
      id: c.id, name: c.name, type: c.type, status: c.status as CampaignStatus,
      targetCount: c.target_count || 0, openCount: c.open_count || 0,
      clickCount: c.click_count || 0, convertedCount: c.converted_count || 0,
      conversionValue: c.conversion_value || 0, createdAt: c.created_at, startDate: c.start_date
    }));
  },

  saveCampaign: async (campaign: Partial<Campaign>): Promise<void> => {
    const payload = {
      name: campaign.name, type: campaign.type, status: campaign.status,
      target_count: campaign.targetCount, open_count: campaign.openCount,
      click_count: campaign.clickCount, converted_count: campaign.convertedCount,
      conversion_value: campaign.conversionValue, start_date: campaign.startDate
    };
    if (campaign.id) await supabase.from('campaigns').update(payload).eq('id', campaign.id);
    else await supabase.from('campaigns').insert(payload);
  },

  importOrders: async (orders: Partial<EcommerceOrder>[]): Promise<void> => {
    const payloads = orders.map(o => ({
      order_number: o.orderNumber, client_id: o.clientId,
      prospect_id: o.prospectId, campaign_id: o.campaignId,
      operator_id: o.operatorId, value: o.value, status: o.status || 'Pago'
    }));
    await supabase.from('ecommerce_orders').insert(payloads);
  },

  // --- INFRA ---
  getUsers: async (): Promise<User[]> => {
    if (isStagingMode) return [{ id: 'mock-admin', name: 'Admin Staging', username: 'admin', role: UserRole.ADMIN, active: true }];
    const { data, error } = await supabase.from('profiles').select('*').order('username_display');
    if (error) return [];
    return (data || []).map(p => ({
      id: p.id, name: p.username_display, username: p.username_slug,
      role: p.role as UserRole, active: p.active ?? true
    }));
  },

  getCalls: async (): Promise<CallRecord[]> => {
    if (isStagingMode) return getStagingData(STAGING_KEYS.CALLS);
    const { data, error } = await supabase.from('call_logs').select('*').order('start_time', { ascending: false });
    if (error) return [];
    return (data || []).map(c => ({
      id: c.id, taskId: c.task_id, operatorId: c.operator_id,
      clientId: c.client_id, prospectId: c.prospect_id,
      startTime: c.start_time, endTime: c.end_time, duration: c.duration,
      reportTime: c.report_time, responses: c.responses || {},
      type: c.call_type as CallType
    }));
  },

  saveCall: async (call: CallRecord): Promise<void> => {
    if (isStagingMode) {
      const data = getStagingData(STAGING_KEYS.CALLS);
      data.push({ ...call, id: `mock-c-${Date.now()}` });
      saveStagingData(STAGING_KEYS.CALLS, data);
      return;
    }
    await supabase.from('call_logs').insert({
      task_id: call.taskId, operator_id: call.operatorId,
      client_id: call.clientId, prospect_id: call.prospectId,
      call_type: call.type, responses: call.responses,
      duration: call.duration, start_time: call.startTime,
      end_time: call.endTime
    });
  },

  getQuestions: async (): Promise<Question[]> => {
    const { data, error } = await supabase.from('questions').select('*').order('order_index');
    if (error) return [];
    return (data || []).map(q => ({
      id: q.id, text: q.text, options: q.options || [],
      type: q.type as any, inputType: q.input_type as any, order: q.order_index
    }));
  },

  getResponseValue: (responses: Record<string, any>, question: Question) => responses[question.id] || '',
  logOperatorEvent: async (opId: string, type: OperatorEventType, taskId?: string) => {
    if (isStagingMode) return;
    await supabase.from('operator_events').insert({ operator_id: opId, event_type: type, task_id: taskId });
  }
};
