
import React from 'react';
import { 
  Search, User, Plus, X, 
  History, UserCheck, Clock, CheckCircle2, 
  Play, RotateCcw, UserPlus, Save, MessageSquare, AlertTriangle, MoreVertical,
  ChevronRight, ThumbsUp, ThumbsDown
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

  // Correctly await asynchronous data fetching
  const loadData = React.useCallback(async () => {
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
    }
  }, [user]);

  React.useEffect(() => { loadData(); }, [loadData]);

  // Fetch events when a protocol is selected
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

    const pId = 'PR' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const slaHours = PROTOCOL_SLA[newProto.priority] || 48;
    const now = new Date();

    const p: Protocol = {
      id: pId,
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
      alert(`Protocolo #${pId} aberto com sucesso!`);
    }
  };

  const handleUpdateStatus = async (pId: string, status: ProtocolStatus) => {
    if (status === ProtocolStatus.RESOLVIDO_PENDENTE) {
      const p = protocols.find(p => p.id === pId);
      if (p) setResolveProtocol(p);
      return;
    }

    if (await dataService.updateProtocol(pId, { status }, user.id)) {
      await loadData();
    }
  };

  const handleAdminApprove = async (pId: string) => {
    if (confirm("Confirmar resolução e ENCERRAR este protocolo definitivamente?")) {
      const success = await dataService.updateProtocol(
        pId, 
        { status: ProtocolStatus.FECHADO, closedAt: new Date().toISOString() }, 
        user.id, 
        "RESOLUÇÃO APROVADA PELO GESTOR. Protocolo finalizado."
      );
      
      if (success) {
        await loadData();
        alert("Protocolo Aprovado e Encerrado com sucesso!");
      } else {
        alert("Erro ao tentar atualizar o protocolo.");
      }
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
      alert("Protocolo enviado para aprovação do gestor!");
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
          onClick={() => {
            setNewProto(prev => ({ 
              ...prev, 
              ownerOperatorId: user.id, 
              departmentId: config.departments[0]?.id || '' 
            }));
            setIsNewModalOpen(true);
          }}
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

      <div className="grid grid-cols-1 gap-4">
        {filtered.map(p => {
          const client = clients.find(c => c.id === p.clientId);
          const owner = operators.find(o => o.id === p.ownerOperatorId);
          const isOwner = p.ownerOperatorId === user.id;
          const isAdmin = user.role === UserRole.ADMIN;
          const isPendingConfirm = p.status === ProtocolStatus.RESOLVIDO_PENDENTE;
          const isClosed = p.status === ProtocolStatus.FECHADO;

          return (
            <div key={p.id} className={`bg-white p-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row gap-6 items-center ${isPendingConfirm ? 'border-orange-200 bg-orange-50/10' : isClosed ? 'border-green-100' : 'border-slate-50 hover:border-blue-100'}`}>
              <div onClick={() => setSelectedProtocol(p)} className="flex-1 space-y-2 w-full cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    isPendingConfirm ? 'bg-orange-100 text-orange-600' : 
                    isClosed ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{isClosed ? 'APROVADO / FECHADO' : p.status}</span>
                  <span className="text-[10px] font-black text-slate-300">#{p.id}</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight truncate">{p.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5"><User size={12} className="text-blue-500" /> {client?.name || 'Manual'}</span>
                  <span className="flex items-center gap-1.5"><UserCheck size={12} className="text-indigo-500" /> {owner?.name || 'N/A'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex gap-2">
                  {/* AÇÕES OPERADOR */}
                  {isOwner && p.status === ProtocolStatus.ABERTO && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.EM_ANDAMENTO); }} title="Iniciar Atendimento" className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                      <Play size={16} />
                    </button>
                  )}
                  {isOwner && (p.status === ProtocolStatus.ABERTO || p.status === ProtocolStatus.EM_ANDAMENTO) && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.RESOLVIDO_PENDENTE); }} title="Informar Resolução" className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm">
                      <CheckCircle2 size={16} />
                    </button>
                  )}

                  {/* AÇÕES ADMIN (APROVAÇÃO) */}
                  {isAdmin && isPendingConfirm && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleAdminApprove(p.id); }} title="Aprovar Resolução e Fechar" className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md active:scale-90">
                        <ThumbsUp size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setRejectProtocol(p); }} title="Rejeitar e Reabrir" className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-90">
                        <ThumbsDown size={16} />
                      </button>
                    </>
                  )}

                  {/* REATRIBUIÇÃO ADMIN */}
                  {isAdmin && !isClosed && (
                    <button onClick={(e) => { e.stopPropagation(); setReassignProtocol(p); }} title="Reatribuir Operador" className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
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

      {/* MODAL REJEIÇÃO (ADMIN) */}
      {rejectProtocol && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-600 p-8 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-sm tracking-widest">Rejeitar Resolução</h3>
              <button onClick={() => setRejectProtocol(null)}><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo da Rejeição</label>
                <textarea 
                  required
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-red-500/10" 
                  placeholder="Explique o que ainda precisa ser feito..."
                />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setRejectProtocol(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={handleAdminReject} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px]">Reabrir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REATRIBUIÇÃO (ADMIN) */}
      {reassignProtocol && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-sm tracking-widest">Reatribuir Protocolo</h3>
              <button onClick={() => setReassignProtocol(null)}><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-xs text-slate-500 font-bold mb-4">Escolha o operador responsável por: <br/><span className="text-slate-900">#{reassignProtocol.id} - {reassignProtocol.title}</span></p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {operators.filter(u => u.role === UserRole.OPERATOR && u.active).map(op => (
                  <button key={op.id} onClick={() => handleReassign(op.id)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-indigo-50 hover:border-indigo-200 transition-all">
                    <span className="font-black text-slate-800 text-sm">{op.name}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESOLUÇÃO (OPERADOR) */}
      {resolveProtocol && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-green-600 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black uppercase text-lg tracking-tight">Questionário de Resolução</h3>
                <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest">Protocolo #{resolveProtocol.id}</p>
              </div>
              <button onClick={() => setResolveProtocol(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qual foi a resolução?</label>
                <textarea 
                  required
                  value={resolveForm.summary} 
                  onChange={e => setResolveForm({...resolveForm, summary: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-green-500/10" 
                  placeholder="Relate como o problema foi resolvido..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Satisfação do Cliente</label>
                  <select value={resolveForm.satisfaction} onChange={e => setResolveForm({...resolveForm, satisfaction: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase cursor-pointer">
                    <option value="Boa">Boa 😊</option>
                    <option value="Regular">Regular 😐</option>
                    <option value="Ruim">Ruim 😞</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Retornou a comprar?</label>
                  <select value={resolveForm.repurchase} onChange={e => setResolveForm({...resolveForm, repurchase: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase cursor-pointer">
                    <option value="Sim">Sim 💰</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleFinalResolve}
                className="w-full py-6 bg-green-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-green-700 transition-all active:scale-95"
              >
                Enviar para Aprovação do Gestor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2"><Plus size={24} className="text-blue-400" /> Registro de Protocolo</h3>
                 <button onClick={() => setIsNewModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                 <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Cliente</h4>
                    <select value={newProto.clientId} onChange={e => setNewProto({...newProto, clientId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none cursor-pointer">
                      <option value="">-- NOVO CLIENTE (MANUAL) --</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                    </select>
                    {!newProto.clientId && (
                      <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" placeholder="Nome do Cliente" value={newProto.manualName} onChange={e => setNewProto({...newProto, manualName: e.target.value})} className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                          <input type="text" placeholder="Telefone" value={newProto.manualPhone} onChange={e => setNewProto({...newProto, manualPhone: e.target.value})} className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                          <input type="text" placeholder="Endereço" value={newProto.manualAddress} onChange={e => setNewProto({...newProto, manualAddress: e.target.value})} className="md:col-span-2 p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                        </div>
                      </div>
                    )}
                 </section>

                 <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Ocorrência</h4>
                    <input type="text" placeholder="Título (Ex: Bomba não liga)" value={newProto.title} onChange={e => setNewProto({...newProto, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    <textarea placeholder="Descrição completa..." value={newProto.description} onChange={e => setNewProto({...newProto, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <select value={newProto.departmentId} onChange={e => setNewProto({...newProto, departmentId: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase cursor-pointer">
                          <option value="">Setor Destino</option>
                          {config.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                       </select>
                       <select value={newProto.priority} onChange={e => setNewProto({...newProto, priority: e.target.value as any})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase cursor-pointer">
                          <option value="Baixa">Baixa</option>
                          <option value="Média">Média</option>
                          <option value="Alta">Alta</option>
                       </select>
                       <select value={newProto.ownerOperatorId} onChange={e => setNewProto({...newProto, ownerOperatorId: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase cursor-pointer">
                          <option value={user.id}>Comigo</option>
                          {operators.filter(u => u.role === UserRole.OPERATOR).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                       </select>
                    </div>
                 </section>

                 <button 
                   type="button"
                   onClick={handleManualSave}
                   className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all hover:bg-slate-800"
                 >
                    Abrir Protocolo Oficial
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DETALHE */}
      {selectedProtocol && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-hidden">
           <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-start shrink-0">
                 <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                         selectedProtocol.status === ProtocolStatus.FECHADO ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                       }`}>{selectedProtocol.status === ProtocolStatus.FECHADO ? 'APROVADO / FECHADO' : selectedProtocol.status}</span>
                       <span className="text-slate-400 text-[10px] font-black tracking-widest">#{selectedProtocol.id}</span>
                    </div>
                    <h3 className="text-3xl font-black leading-tight tracking-tighter">{selectedProtocol.title}</h3>
                 </div>
                 <button onClick={() => setSelectedProtocol(null)} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={28} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-12 gap-10 custom-scrollbar">
                 <div className="md:col-span-8 space-y-10">
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><User size={24} /></div>
                          <div className="min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                             <p className="font-black text-slate-800 truncate">{clients.find(c => c.id === selectedProtocol.clientId)?.name || 'Manual'}</p>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><UserCheck size={24} /></div>
                          <div className="min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador Responsável</p>
                             <p className="font-black text-slate-800 truncate">{operators.find(o => o.id === selectedProtocol.ownerOperatorId)?.name || 'N/A'}</p>
                          </div>
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Relato da Ocorrência</h4>
                       <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-slate-700 text-sm font-medium leading-relaxed shadow-inner whitespace-pre-wrap">
                          {selectedProtocol.description}
                       </div>
                    </section>
                    
                    {selectedProtocol.resolutionSummary && (
                      <section className="space-y-4">
                         <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-green-100 pb-2">Resolução Oficial</h4>
                         <div className="p-8 bg-green-50 rounded-[32px] border border-green-100 text-green-800 text-sm font-bold leading-relaxed shadow-inner italic">
                            {selectedProtocol.resolutionSummary}
                         </div>
                      </section>
                    )}

                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Linha do Tempo</h4>
                       <div className="space-y-6 ml-4">
                          {(protocolEvents || []).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((e) => (
                            <div key={e.id} className="flex gap-5 relative">
                               <div className="w-8 h-8 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shrink-0 z-10 border-4 border-white shadow-sm">
                                  <History size={14} />
                               </div>
                               <div className="flex-1 pb-4">
                                  <div className="flex items-center justify-between mb-1">
                                     <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                       {e.eventType === 'created' ? 'Protocolo Aberto' : e.eventType === 'status_changed' ? `Status: ${e.newValue}` : e.eventType === 'owner_changed' ? 'Troca de Responsável' : 'Atualização'}
                                     </p>
                                     <span className="text-[9px] text-slate-400 font-black uppercase">{new Date(e.createdAt).toLocaleString()}</span>
                                  </div>
                                  {e.note && <p className="text-[10px] text-slate-500 font-medium italic">{e.note}</p>}
                               </div>
                            </div>
                          ))}
                       </div>
                    </section>
                 </div>

                 <div className="md:col-span-4 space-y-8">
                    <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 border-b border-slate-800 pb-4 text-center">Gestão SLA</h5>
                       <div className="space-y-8">
                          <div className="text-center">
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                             <p className={`font-black text-2xl tracking-tighter uppercase ${selectedProtocol.status === ProtocolStatus.RESOLVIDO_PENDENTE ? 'text-orange-400' : 'text-blue-400'}`}>{selectedProtocol.status}</p>
                          </div>
                          <div className="text-center">
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Idade do Protocolo</p>
                             <p className="font-black text-2xl text-white tracking-tighter">{calculateTimeOpen(selectedProtocol.openedAt)}</p>
                          </div>
                          {selectedProtocol.status !== ProtocolStatus.FECHADO && (
                            <div className="text-center">
                               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Prazo Máximo</p>
                               <p className="font-black text-lg text-slate-300 tracking-tighter">{new Date(selectedProtocol.slaDueAt).toLocaleString()}</p>
                            </div>
                          )}
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
