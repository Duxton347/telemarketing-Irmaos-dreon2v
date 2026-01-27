
import React from 'react';
import { 
  Search, User, Plus, X, 
  History, UserCheck, Clock, CheckCircle2, 
  Play, RotateCcw, UserPlus, Save, MessageSquare, AlertTriangle, MoreVertical,
  ChevronRight, ThumbsUp, ThumbsDown, Loader2
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Protocol, ProtocolStatus, UserRole, ProtocolEvent, User as UserType, Client } from '../types';
import { PROTOCOL_SLA } from '../constants';

const Protocols: React.FC<{ user: UserType }> = ({ user }) => {
  if (!user || !user.id) return <div className="p-20 text-center font-black uppercase text-slate-300 animate-pulse">Autenticando sessão...</div>;

  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [operators, setOperators] = React.useState<UserType[]>([]);
  const [protocolEvents, setProtocolEvents] = React.useState<ProtocolEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [operatorFilter, setOperatorFilter] = React.useState<string>('all');
  
  const [selectedProtocol, setSelectedProtocol] = React.useState<Protocol | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);
  
  const [reassignProtocol, setReassignProtocol] = React.useState<Protocol | null>(null);
  const [resolveProtocol, setResolveProtocol] = React.useState<Protocol | null>(null);
  const [rejectProtocol, setRejectProtocol] = React.useState<Protocol | null>(null);
  
  const [resolveForm, setResolveForm] = React.useState({
    summary: '',
    satisfaction: 'Boa' as 'Boa' | 'Ruim' | 'Regular',
    repurchase: 'Sim' as 'Sim' | 'Não'
  });

  const [rejectReason, setRejectReason] = React.useState('');

  const config = dataService.getProtocolConfig();

  const [newProto, setNewProto] = React.useState({
    clientId: '',
    manualName: '',
    manualPhone: '',
    manualAddress: '',
    manualItems: [] as string[],
    title: '',
    description: '',
    departmentId: config.departments[0]?.id || '',
    priority: 'Média' as 'Baixa' | 'Média' | 'Alta',
    ownerOperatorId: user.id
  });

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allProtocols, allClients, allUsers] = await Promise.all([
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers()
      ]);

      setClients(allClients);
      setOperators(allUsers);

      const visible = user.role === UserRole.ADMIN 
        ? allProtocols 
        : allProtocols.filter(p => p && (p.ownerOperatorId === user.id || p.openedByOperatorId === user.id));
      
      setProtocols(visible);
    } catch (e) {
      console.error("Erro ao carregar dados dos protocolos:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => { loadData(); }, [loadData]);

  React.useEffect(() => {
    const fetchEvents = async () => {
      if (selectedProtocol) {
        const events = await dataService.getProtocolEvents(selectedProtocol.id);
        setProtocolEvents(events);
      }
    };
    fetchEvents();
  }, [selectedProtocol]);

  const handleManualSave = async () => {
    if (!newProto.title.trim() || !newProto.description.trim() || !newProto.departmentId) {
      return alert("Por favor, preencha o Título, a Descrição e selecione um Setor.");
    }

    let clientId = newProto.clientId;
    if (!clientId) {
      if (!newProto.manualName.trim() || !newProto.manualPhone.trim()) {
        return alert("Preencha nome e telefone para cadastrar o cliente.");
      }
      const client = await dataService.upsertClient({
        name: newProto.manualName.trim(),
        phone: newProto.manualPhone.trim(),
        address: newProto.manualAddress.trim(),
        items: newProto.manualItems
      });
      if (client) clientId = client.id;
    }

    if (!clientId) return alert("Erro ao identificar ou criar cliente.");

    const slaHours = PROTOCOL_SLA[newProto.priority] || 48;
    const now = new Date();

    const p: Protocol = {
      id: '',
      clientId,
      openedByOperatorId: user.id,
      ownerOperatorId: newProto.ownerOperatorId || user.id,
      origin: 'Manual',
      departmentId: newProto.departmentId,
      categoryId: '',
      title: newProto.title.trim(),
      description: newProto.description.trim(),
      priority: newProto.priority,
      status: ProtocolStatus.ABERTO,
      openedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastActionAt: now.toISOString(),
      slaDueAt: new Date(now.getTime() + slaHours * 3600000).toISOString()
    };

    if (await dataService.saveProtocol(p, user.id)) {
      setIsNewModalOpen(false);
      setNewProto({
        clientId: '',
        manualName: '',
        manualPhone: '',
        manualAddress: '',
        manualItems: [],
        title: '',
        description: '',
        departmentId: config.departments[0]?.id || '',
        priority: 'Média',
        ownerOperatorId: user.id
      });
      await loadData();
    }
  };

  const handleUpdateStatus = async (pId: string, status: ProtocolStatus) => {
    if (status === ProtocolStatus.RESOLVIDO_PENDENTE) {
      const p = protocols.find(p => p.id === pId);
      if (p) setResolveProtocol(p);
      return;
    }

    if (await dataService.updateProtocol(pId, { status }, user.id, `Status alterado para ${status}`)) {
      await loadData();
    }
  };

  const handleAdminApprove = async (pId: string) => {
    setIsLoading(true);
    try {
      const success = await dataService.updateProtocol(
        pId, 
        { status: ProtocolStatus.FECHADO, closedAt: new Date().toISOString() }, 
        user.id, 
        "RESOLUÇÃO APROVADA PELO GESTOR. Protocolo finalizado."
      );
      
      if (success) {
        await loadData();
        alert("Protocolo Aprovado e Encerrado!");
      } else {
        alert("Erro ao tentar atualizar o protocolo.");
      }
    } catch (e) {
      console.error(e);
      alert("Falha técnica ao aprovar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminReject = async () => {
    if (!rejectProtocol) return;
    if (!rejectReason.trim()) return alert("Informe o motivo da rejeição.");

    if (await dataService.updateProtocol(rejectProtocol.id, { status: ProtocolStatus.ABERTO }, user.id, `RESOLUÇÃO REJEITADA PELO ADM: ${rejectReason}`)) {
      setRejectProtocol(null);
      setRejectReason('');
      await loadData();
      alert("Resolução rejeitada. O protocolo foi reaberto.");
    }
  };

  const handleReassign = async (targetUserId: string) => {
    if (!reassignProtocol) return;
    if (await dataService.updateProtocol(reassignProtocol.id, { ownerOperatorId: targetUserId }, user.id, `Reatribuído para ${operators.find(o => o.id === targetUserId)?.name}`)) {
      setReassignProtocol(null);
      await loadData();
      alert("Protocolo reatribuído com sucesso!");
    }
  };

  const handleFinalResolve = async () => {
    if (!resolveProtocol) return;
    if (!resolveForm.summary.trim()) return alert("Descreva a resolução do problema.");

    const note = `Resolução: ${resolveForm.summary} | Satisfação: ${resolveForm.satisfaction} | Retornou Compra: ${resolveForm.repurchase}`;
    if (await dataService.updateProtocol(resolveProtocol.id, { status: ProtocolStatus.RESOLVIDO_PENDENTE, resolutionSummary: resolveForm.summary }, user.id, note)) {
      setResolveProtocol(null);
      setResolveForm({ summary: '', satisfaction: 'Boa', repurchase: 'Sim' });
      await loadData();
      alert("Protocolo enviado para aprovação!");
    }
  };

  const calculateTimeOpen = (openedAt: string) => {
    if (!openedAt) return '0h';
    const diff = new Date().getTime() - new Date(openedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
  };

  const filtered = protocols.filter(p => {
    if (!p) return false;
    const matchSearch = (p.title || "").toLowerCase().includes(search.toLowerCase()) || (p.id || "").includes(search.toUpperCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchDept = deptFilter === 'all' || p.departmentId === deptFilter;
    const matchOp = operatorFilter === 'all' || p.ownerOperatorId === operatorFilter;
    return matchSearch && matchStatus && matchDept && matchOp;
  }).sort((a, b) => {
    if (a.priority === 'Alta' && b.priority !== 'Alta') return -1;
    return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Protocolos</h2>
          <p className="text-slate-500 text-sm font-medium">Controle de incidentes Dreon.</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Novo Protocolo
        </button>
      </header>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar ID ou Assunto..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer">
          <option value="all">Status: Todos</option>
          {Object.values(ProtocolStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer">
          <option value="all">Setor: Todos</option>
          {config.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {user.role === UserRole.ADMIN && (
          <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer">
            <option value="all">Operador: Todos</option>
            {operators.filter(u => u.role === UserRole.OPERATOR).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 relative min-h-[200px]">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[32px]">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        )}
        
        {filtered.map(p => {
          const client = clients.find(c => c.id === p.clientId);
          const owner = operators.find(o => o.id === p.ownerOperatorId);
          const isOwner = p.ownerOperatorId === user.id;
          const isAdmin = user.role === UserRole.ADMIN;
          const isPendingConfirm = p.status === ProtocolStatus.RESOLVIDO_PENDENTE;
          const isClosed = p.status === ProtocolStatus.FECHADO;

          return (
            <div key={p.id} className={`bg-white p-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row gap-6 items-center ${isPendingConfirm ? 'border-orange-200 bg-orange-50/10' : isClosed ? 'border-green-100 opacity-80' : 'border-slate-50 hover:border-blue-100'}`}>
              <div onClick={() => setSelectedProtocol(p)} className="flex-1 space-y-2 w-full cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    isPendingConfirm ? 'bg-orange-100 text-orange-600 animate-pulse' : 
                    isClosed ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{p.status}</span>
                  <span className="text-[10px] font-black text-slate-300">#{p.id?.substring(0,8)}</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight truncate">{p.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5"><User size={12} className="text-blue-500" /> {client?.name || 'Manual'}</span>
                  <span className="flex items-center gap-1.5"><UserCheck size={12} className="text-indigo-500" /> {owner?.name || 'N/A'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex gap-2">
                  {/* BOTÕES OPERADOR */}
                  {isOwner && p.status === ProtocolStatus.ABERTO && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.EM_ANDAMENTO); }} title="Iniciar" className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                      <Play size={16} />
                    </button>
                  )}
                  {isOwner && (p.status === ProtocolStatus.ABERTO || p.status === ProtocolStatus.EM_ANDAMENTO) && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.RESOLVIDO_PENDENTE); }} title="Resolver" className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm">
                      <CheckCircle2 size={16} />
                    </button>
                  )}

                  {/* BOTÕES ADMIN - APROVAÇÃO E REJEIÇÃO */}
                  {isAdmin && isPendingConfirm && (
                    <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl shadow-2xl">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAdminApprove(p.id); }} 
                        className="px-4 py-2 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95"
                      >
                        <ThumbsUp size={14} /> Aprovar
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRejectProtocol(p); }} 
                        className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </div>
                  )}

                  {isAdmin && !isClosed && (
                    <button onClick={(e) => { e.stopPropagation(); setReassignProtocol(p); }} title="Reatribuir" className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
                
                <div className="text-right border-l pl-4 border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aberto há</p>
                  <p className="font-black text-sm text-slate-800">{calculateTimeOpen(p.openedAt)}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${p.priority === 'Alta' ? 'bg-red-500' : p.priority === 'Média' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
              </div>
            </div>
          );
        })}
      </div>

      {rejectProtocol && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-600 p-8 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-sm tracking-widest">Rejeitar Resolução</h3>
              <button onClick={() => setRejectProtocol(null)}><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <textarea 
                required
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-red-500/10" 
                placeholder="Informe o motivo para o operador corrigir..."
              />
              <div className="flex gap-4">
                <button onClick={() => setRejectProtocol(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={handleAdminReject} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px]">Confirmar Rejeição</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProtocol && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-hidden">
           <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-start shrink-0">
                 <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className="px-3 py-1 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">{selectedProtocol.status}</span>
                       <span className="text-slate-400 text-[10px] font-black tracking-widest">#{selectedProtocol.id?.substring(0,8)}</span>
                    </div>
                    <h3 className="text-3xl font-black leading-tight tracking-tighter">{selectedProtocol.title}</h3>
                 </div>
                 <button onClick={() => setSelectedProtocol(null)} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={28} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-12 gap-10 custom-scrollbar">
                 <div className="md:col-span-8 space-y-10">
                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-slate-700 font-medium whitespace-pre-wrap">
                       {selectedProtocol.description}
                    </div>
                    
                    {selectedProtocol.resolutionSummary && (
                      <div className="p-8 bg-green-50 rounded-[32px] border border-green-100 text-green-800 font-bold italic">
                         RESOLUÇÃO: {selectedProtocol.resolutionSummary}
                      </div>
                    )}

                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Histórico de Eventos</h4>
                       <div className="space-y-4">
                          {protocolEvents.map((e) => (
                            <div key={e.id} className="flex gap-4">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0"><History size={16} /></div>
                               <div>
                                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{e.eventType === 'status_change' ? 'Mudança de Status' : 'Nota de Auditoria'}</p>
                                  <p className="text-xs text-slate-500 font-medium italic">{e.note}</p>
                                  <span className="text-[8px] text-slate-400 font-black uppercase">{new Date(e.createdAt).toLocaleString()}</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </section>
                 </div>

                 <div className="md:col-span-4">
                    <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl space-y-6">
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Responsável</p>
                          <p className="font-black text-lg text-blue-400">{operators.find(o => o.id === selectedProtocol.ownerOperatorId)?.name || 'N/A'}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Tempo de Abertura</p>
                          <p className="font-black text-2xl text-white">{calculateTimeOpen(selectedProtocol.openedAt)}</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Protocols;
