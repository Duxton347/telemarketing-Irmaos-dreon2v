
import React from 'react';
import { 
  Search, User, Plus, X, 
  History, UserCheck, Clock, CheckCircle2, 
  Play, RotateCcw, UserPlus, Save, MessageSquare, AlertTriangle, MoreVertical,
  ChevronRight, ThumbsUp, ThumbsDown, Loader2, MapPin, Tag,
  // Fix: Adding missing ClipboardList import
  ClipboardList
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
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [operatorFilter, setOperatorFilter] = React.useState<string>('all');
  
  const [selectedProtocol, setSelectedProtocol] = React.useState<Protocol | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);
  
  const [reassignProtocol, setReassignProtocol] = React.useState<Protocol | null>(null);
  const [rejectProtocol, setRejectProtocol] = React.useState<Protocol | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const config = dataService.getProtocolConfig();

  // Estado para o Novo Protocolo
  const [newProto, setNewProto] = React.useState({
    clientId: '',
    clientSearch: '',
    manualName: '',
    manualPhone: '',
    manualAddress: '',
    title: '',
    description: '',
    departmentId: config.departments[0]?.id || 'atendimento',
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

  const handleSaveProtocol = async () => {
    if (!newProto.title.trim() || !newProto.description.trim()) {
      return alert("Preencha título e descrição.");
    }

    setIsProcessing(true);
    try {
      let clientId = newProto.clientId;
      
      // Se for cliente novo
      if (!clientId) {
        if (!newProto.manualName.trim() || !newProto.manualPhone.trim()) {
          alert("Selecione um cliente ou preencha os dados manuais.");
          setIsProcessing(false);
          return;
        }
        const client = await dataService.upsertClient({
          name: newProto.manualName.trim(),
          phone: newProto.manualPhone.trim(),
          address: newProto.manualAddress.trim(),
          items: []
        });
        clientId = client.id;
      }

      const slaHours = PROTOCOL_SLA[newProto.priority] || 48;
      const now = new Date();

      const p: Protocol = {
        id: '',
        clientId,
        openedByOperatorId: user.id,
        ownerOperatorId: newProto.ownerOperatorId,
        origin: 'Manual',
        departmentId: newProto.departmentId,
        categoryId: '',
        title: newProto.title.trim(),
        description: newProto.description.trim(),
        priority: p.priority || 'Média', // Set priority from newProto.priority
        status: ProtocolStatus.ABERTO,
        openedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        lastActionAt: now.toISOString(),
        slaDueAt: new Date(now.getTime() + slaHours * 3600000).toISOString()
      };
      // Correcting the priority property assignment
      p.priority = newProto.priority;

      await dataService.saveProtocol(p, user.id);
      setIsNewModalOpen(false);
      setNewProto({
        clientId: '', clientSearch: '', manualName: '', manualPhone: '', manualAddress: '',
        title: '', description: '', departmentId: 'atendimento', priority: 'Média', ownerOperatorId: user.id
      });
      await loadData();
      alert("Protocolo aberto com sucesso!");
    } catch (e) {
      alert("Erro ao salvar protocolo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (pId: string, status: ProtocolStatus) => {
    if (await dataService.updateProtocol(pId, { status }, user.id, `Status alterado para ${status}`)) {
      await loadData();
    }
  };

  const handleAdminApprove = async (pId: string) => {
    if (await dataService.updateProtocol(pId, { status: ProtocolStatus.FECHADO, closedAt: new Date().toISOString() }, user.id, "Resolução aprovada pelo gestor.")) {
      await loadData();
      alert("Protocolo encerrado!");
    }
  };

  const handleAdminReject = async () => {
    if (!rejectProtocol || !rejectReason.trim()) return;
    if (await dataService.updateProtocol(rejectProtocol.id, { status: ProtocolStatus.ABERTO }, user.id, `Resolução rejeitada: ${rejectReason}`)) {
      setRejectProtocol(null);
      setRejectReason('');
      await loadData();
      alert("Protocolo reaberto para correção.");
    }
  };

  const handleReassign = async (targetUserId: string) => {
    if (!reassignProtocol) return;
    if (await dataService.updateProtocol(reassignProtocol.id, { ownerOperatorId: targetUserId }, user.id, `Reatribuído para ${operators.find(o => o.id === targetUserId)?.name}`)) {
      setReassignProtocol(null);
      await loadData();
      alert("Protocolo reatribuído!");
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
    const matchSearch = (p.title || "").toLowerCase().includes(search.toLowerCase()) || (p.protocolNumber || "").includes(search);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchDept = deptFilter === 'all' || p.departmentId === deptFilter;
    const matchOp = operatorFilter === 'all' || p.ownerOperatorId === operatorFilter;
    return matchSearch && matchStatus && matchDept && matchOp;
  }).sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime());

  // Sugestões de busca de cliente
  const clientSuggestions = newProto.clientSearch.length > 2 
    ? clients.filter(c => c.name.toLowerCase().includes(newProto.clientSearch.toLowerCase()) || c.phone.includes(newProto.clientSearch)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão de Protocolos</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">Controle de incidentes e solicitações Dreon.</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} /> Novo Protocolo
        </button>
      </header>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar assunto ou nº protocolo..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none">
          <option value="all">Status: Todos</option>
          {Object.values(ProtocolStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none">
          <option value="all">Setor: Todos</option>
          {config.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {user.role === UserRole.ADMIN && (
          <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none">
            <option value="all">Operador: Todos</option>
            {operators.filter(u => u.role === UserRole.OPERATOR).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 relative min-h-[300px]">
        {isLoading && <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-[32px]"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}
        
        {filtered.length > 0 ? filtered.map(p => {
          const client = clients.find(c => c.id === p.clientId);
          const owner = operators.find(o => o.id === p.ownerOperatorId);
          const isPendingConfirm = p.status === ProtocolStatus.RESOLVIDO_PENDENTE;
          const isClosed = p.status === ProtocolStatus.FECHADO;

          return (
            <div key={p.id} className={`bg-white p-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row gap-6 items-center ${isPendingConfirm ? 'border-orange-200 bg-orange-50/10' : isClosed ? 'border-green-100' : 'border-slate-50 hover:border-blue-100 shadow-sm'}`}>
              <div onClick={() => setSelectedProtocol(p)} className="flex-1 space-y-2 w-full cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isClosed ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                  <span className="text-[10px] font-black text-slate-300">ID: {p.protocolNumber || p.id?.substring(0,8)}</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">{p.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5"><User size={12} className="text-blue-500" /> {client?.name || 'Carregando...'}</span>
                  <span className="flex items-center gap-1.5"><UserCheck size={12} className="text-indigo-500" /> {owner?.name || 'N/A'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 shrink-0">
                <div className="flex gap-2">
                  {p.ownerOperatorId === user.id && p.status === ProtocolStatus.ABERTO && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.EM_ANDAMENTO); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Play size={16} /></button>
                  )}
                  {user.role === UserRole.ADMIN && isPendingConfirm && (
                    <div className="flex gap-2">
                       <button onClick={(e) => { e.stopPropagation(); handleAdminApprove(p.id); }} className="px-4 py-2 bg-green-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition-all">Aprovar</button>
                       <button onClick={(e) => { e.stopPropagation(); setRejectProtocol(p); }} className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"><ThumbsDown size={14} /></button>
                    </div>
                  )}
                  {user.role === UserRole.ADMIN && !isClosed && (
                    <button onClick={(e) => { e.stopPropagation(); setReassignProtocol(p); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><UserPlus size={16} /></button>
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
        }) : (
          <div className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest opacity-40 flex flex-col items-center gap-4">
             <ClipboardList size={48} /> Nenhum protocolo encontrado.
          </div>
        )}
      </div>

      {/* MODAL NOVO PROTOCOLO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter">Abertura de Protocolo Manual</h3>
                 <button onClick={() => setIsNewModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                 <section className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Vincular Cliente</label>
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input 
                        type="text" 
                        placeholder="Pesquisar cliente cadastrado..." 
                        value={newProto.clientSearch}
                        onChange={e => setNewProto({...newProto, clientSearch: e.target.value})}
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10"
                       />
                       {clientSuggestions.length > 0 && (
                         <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden">
                            {clientSuggestions.map(c => (
                              <button 
                                key={c.id} 
                                onClick={() => setNewProto({...newProto, clientId: c.id, clientSearch: c.name})}
                                className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between group"
                              >
                                 <div>
                                   <p className="font-black text-slate-800 text-sm">{c.name}</p>
                                   <p className="text-[10px] text-slate-400 font-bold">{c.phone}</p>
                                 </div>
                                 <ChevronRight size={14} className="text-slate-200 group-hover:text-blue-600 transition-all" />
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                    {!newProto.clientId && newProto.clientSearch.length > 3 && (
                       <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 animate-in slide-in-from-top-2 space-y-4">
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Novo Cliente Identificado</p>
                          <input placeholder="Nome Completo" value={newProto.manualName} onChange={e => setNewProto({...newProto, manualName: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold text-sm outline-none" />
                          <input placeholder="Telefone" value={newProto.manualPhone} onChange={e => setNewProto({...newProto, manualPhone: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold text-sm outline-none" />
                       </div>
                    )}
                 </section>

                 <section className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Detalhes da Solicitação</label>
                    <input 
                      placeholder="Título curto do problema..." 
                      value={newProto.title}
                      onChange={e => setNewProto({...newProto, title: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"
                    />
                    <textarea 
                      placeholder="Descreva o que aconteceu detalhadamente..." 
                      value={newProto.description}
                      onChange={e => setNewProto({...newProto, description: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none"
                    />
                 </section>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor Responsável</label>
                       <select value={newProto.departmentId} onChange={e => setNewProto({...newProto, departmentId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none">
                          {config.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade SLA</label>
                       <select value={newProto.priority} onChange={e => setNewProto({...newProto, priority: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none">
                          <option value="Baixa">Baixa</option>
                          <option value="Média">Média</option>
                          <option value="Alta">Alta</option>
                       </select>
                    </div>
                 </div>
              </div>
              <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                 <button onClick={handleSaveProtocol} disabled={isProcessing} className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />} Abrir Protocolo Agora
                 </button>
              </footer>
           </div>
        </div>
      )}

      {/* MODAL DETALHE (EXISTENTE) */}
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
                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-slate-700 font-medium whitespace-pre-wrap leading-relaxed shadow-sm">
                       {selectedProtocol.description}
                    </div>
                    
                    {selectedProtocol.resolutionSummary && (
                      <div className="p-8 bg-green-50 rounded-[32px] border border-green-100 text-green-800 font-bold italic shadow-sm">
                         <span className="text-[9px] font-black uppercase text-green-600 block mb-2">Resolução Registrada:</span>
                         {selectedProtocol.resolutionSummary}
                      </div>
                    )}

                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                          <History size={14} /> Histórico de Ações
                       </h4>
                       <div className="space-y-4">
                          {protocolEvents.length > 0 ? protocolEvents.map((e) => (
                            <div key={e.id} className="flex gap-4">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0"><Clock size={16} /></div>
                               <div className="flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                  <p className="text-[9px] font-black text-slate-800 uppercase tracking-tight">{e.eventType === 'status_change' ? 'Mudança de Status' : e.eventType === 'creation' ? 'Criação' : 'Nota de Auditoria'}</p>
                                  <p className="text-xs text-slate-500 font-medium italic mt-1">"{e.note}"</p>
                                  <span className="text-[8px] text-slate-400 font-black uppercase block mt-2">{new Date(e.createdAt).toLocaleString()}</span>
                               </div>
                            </div>
                          )) : <p className="text-xs font-bold text-slate-300">Nenhum evento registrado.</p>}
                       </div>
                    </section>
                 </div>

                 <div className="md:col-span-4 space-y-6">
                    <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl space-y-6">
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Responsável Atual</p>
                          <p className="font-black text-lg text-blue-400">{operators.find(o => o.id === selectedProtocol.ownerOperatorId)?.name || 'N/A'}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Aberto há</p>
                          <p className="font-black text-3xl text-white">{calculateTimeOpen(selectedProtocol.openedAt)}</p>
                       </div>
                       <div className="text-center pt-4 border-t border-slate-800">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Vencimento SLA</p>
                          <p className={`font-black text-sm ${new Date() > new Date(selectedProtocol.slaDueAt) ? 'text-red-500' : 'text-green-500'}`}>{new Date(selectedProtocol.slaDueAt).toLocaleString()}</p>
                       </div>
                    </div>
                    
                    <div className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-sm space-y-4">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={12} /> Cliente Associado</h5>
                        <p className="font-black text-slate-800 text-sm truncate">{clients.find(c => c.id === selectedProtocol.clientId)?.name}</p>
                        <p className="text-[10px] font-bold text-blue-600">{clients.find(c => c.id === selectedProtocol.clientId)?.phone}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL REJEIÇÃO */}
      {rejectProtocol && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl animate-in zoom-in duration-200">
              <div className="bg-red-600 p-8 text-white flex justify-between items-center">
                 <h3 className="font-black uppercase text-sm tracking-widest">Rejeitar Resolução</h3>
                 <button onClick={() => setRejectProtocol(null)}><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                 <textarea 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none" 
                  placeholder="Informe o motivo da rejeição..."
                 />
                 <button onClick={handleAdminReject} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px]">Rejeitar e Reabrir</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL REATRIBUIR */}
      {reassignProtocol && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                 <h3 className="font-black uppercase text-sm tracking-widest">Reatribuir Protocolo</h3>
                 <button onClick={() => setReassignProtocol(null)}><X size={20} /></button>
              </div>
              <div className="p-8 space-y-2">
                 {operators.filter(u => u.role !== UserRole.ADMIN).map(op => (
                    <button 
                      key={op.id}
                      onClick={() => handleReassign(op.id)}
                      className="w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-left font-black uppercase text-[10px] tracking-widest flex items-center gap-3"
                    >
                       <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px]">{op.name.charAt(0)}</div>
                       {op.name}
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Protocols;
