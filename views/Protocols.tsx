
import React from 'react';
import { 
  Search, User, Plus, X, 
  History, UserCheck, Clock, CheckCircle2, 
  Play, RotateCcw, UserPlus, Save, MessageSquare, AlertTriangle, MoreVertical,
  ChevronRight, ThumbsUp, ThumbsDown, Loader2, MapPin, Tag, ClipboardList,
  Check, Send, ClipboardCheck, ListChecks
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Protocol, ProtocolStatus, UserRole, ProtocolEvent, User as UserType, Client, Question, CallType } from '../types';
import { PROTOCOL_SLA } from '../constants';

const Protocols: React.FC<{ user: UserType }> = ({ user }) => {
  if (!user || !user.id) return <div className="p-20 text-center font-black uppercase text-slate-300 animate-pulse">Autenticando sessão...</div>;

  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [operators, setOperators] = React.useState<UserType[]>([]);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [protocolEvents, setProtocolEvents] = React.useState<ProtocolEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [operatorFilter, setOperatorFilter] = React.useState<string>('all');
  
  const [selectedProtocol, setSelectedProtocol] = React.useState<Protocol | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);
  
  // Estados para o formulário de resolução
  const [resolutionSummary, setResolutionSummary] = React.useState('');
  const [resolutionResponses, setResolutionResponses] = React.useState<Record<string, string>>({});
  
  const [reassignProtocol, setReassignProtocol] = React.useState<Protocol | null>(null);
  const [rejectProtocol, setRejectProtocol] = React.useState<Protocol | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const config = dataService.getProtocolConfig();

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
      const [allProtocols, allClients, allUsers, allQuestions] = await Promise.all([
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers(),
        dataService.getQuestions()
      ]);

      setClients(allClients);
      setOperators(allUsers);
      setQuestions(allQuestions.filter(q => q.type === CallType.CONFIRMACAO_PROTOCOLO));

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
        setResolutionSummary(selectedProtocol.resolutionSummary || '');
        setResolutionResponses({});
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
      if (!clientId) {
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

      const p: Partial<Protocol> = {
        clientId,
        openedByOperatorId: user.id,
        ownerOperatorId: user.id,
        origin: 'Manual',
        departmentId: newProto.departmentId,
        title: newProto.title.trim(),
        description: newProto.description.trim(),
        priority: newProto.priority,
        status: ProtocolStatus.ABERTO,
        openedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        slaDueAt: new Date(now.getTime() + slaHours * 3600000).toISOString()
      };

      await dataService.saveProtocol(p as Protocol, user.id);
      setIsNewModalOpen(false);
      setNewProto({
        clientId: '', clientSearch: '', manualName: '', manualPhone: '', manualAddress: '',
        title: '', description: '', departmentId: 'atendimento', priority: 'Média', ownerOperatorId: user.id
      });
      await loadData();
      alert("Protocolo aberto com sucesso!");
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (pId: string, status: ProtocolStatus, note?: string) => {
    setIsProcessing(true);
    try {
      if (status === ProtocolStatus.RESOLVIDO_PENDENTE) {
        if (!resolutionSummary.trim()) {
          alert("Por favor, descreva o que foi feito para resolver o protocolo.");
          setIsProcessing(false);
          return;
        }
        if (Object.keys(resolutionResponses).length < questions.length) {
          alert("Por favor, responda a todas as perguntas do questionário de confirmação.");
          setIsProcessing(false);
          return;
        }
      }

      let finalSummary = resolutionSummary;
      if (status === ProtocolStatus.RESOLVIDO_PENDENTE) {
        const qTexts = questions.map(q => `${q.text}: ${resolutionResponses[q.id]}`).join('\n');
        finalSummary = `RESPOSTAS DE AUDITORIA:\n${qTexts}\n\nRESUMO DA AÇÃO:\n${resolutionSummary}`;
      }

      const result = await dataService.updateProtocol(
        pId, 
        { 
          status, 
          resolutionSummary: status === ProtocolStatus.RESOLVIDO_PENDENTE ? finalSummary : undefined 
        }, 
        user.id, 
        note || `Mudança de Status para: ${status}`
      );

      if (result) {
        await loadData();
        setSelectedProtocol(null);
        alert(status === ProtocolStatus.RESOLVIDO_PENDENTE ? "Protocolo enviado para aprovação!" : "Status atualizado!");
      }
    } catch (e) {
      alert("Erro ao atualizar status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminApprove = async (pId: string) => {
    setIsProcessing(true);
    try {
      if (await dataService.updateProtocol(pId, { status: ProtocolStatus.FECHADO, closedAt: new Date().toISOString() }, user.id, "Resolução aprovada. Protocolo Encerrado.")) {
        await loadData();
        setSelectedProtocol(null);
        alert("Protocolo aprovado e encerrado!");
      }
    } catch (e) {
      alert("Erro ao aprovar.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminReject = async () => {
    if (!rejectProtocol || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      if (await dataService.updateProtocol(rejectProtocol.id, { status: ProtocolStatus.EM_ANDAMENTO }, user.id, `REJEITADO: ${rejectReason}`)) {
        setRejectProtocol(null);
        setRejectReason('');
        await loadData();
        setSelectedProtocol(null);
        alert("Protocolo devolvido para o operador.");
      }
    } catch (e) {
      alert("Erro ao rejeitar.");
    } finally {
      setIsProcessing(false);
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

  const clientSuggestions = newProto.clientSearch.length > 2 && !newProto.clientId
    ? clients.filter(c => c.name.toLowerCase().includes(newProto.clientSearch.toLowerCase()) || c.phone.includes(newProto.clientSearch)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão de Protocolos</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">Clique para abrir detalhes, responder auditoria e aprovar resoluções.</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 active:scale-95 flex items-center gap-2"
        >
          <Plus size={18} /> Novo Protocolo
        </button>
      </header>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título ou nº protocolo..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
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
          const isAberto = p.status === ProtocolStatus.ABERTO || p.status === ProtocolStatus.REABERTO;

          return (
            <div 
              key={p.id} 
              onClick={() => setSelectedProtocol(p)}
              className={`p-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row gap-6 items-center cursor-pointer 
                ${isAberto ? 'bg-red-50/30 border-red-500 shadow-xl shadow-red-500/10 animate-in fade-in' : 
                  isPendingConfirm ? 'bg-orange-50/20 border-orange-400' : 
                  isClosed ? 'bg-white border-slate-100 opacity-60' : 'bg-white border-slate-50 shadow-sm hover:border-blue-400'}`}
            >
              <div className="flex-1 space-y-2 w-full">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isAberto ? 'bg-red-600 text-white' : isClosed ? 'bg-slate-500 text-white' : isPendingConfirm ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>{p.status}</span>
                  <span className="text-[10px] font-black text-slate-300">ID: {p.protocolNumber || p.id?.substring(0,8)}</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">{p.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5"><User size={12} className="text-blue-500" /> {client?.name || 'Manual'}</span>
                  <span className="flex items-center gap-1.5"><UserCheck size={12} className="text-indigo-500" /> Responsável: {owner?.name || 'N/A'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 shrink-0">
                <div className="flex gap-2">
                  {p.ownerOperatorId === user.id && isAberto && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(p.id, ProtocolStatus.EM_ANDAMENTO); }} className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2"><Play size={14} /> Assumir Agora</button>
                  )}
                  {user.role === UserRole.ADMIN && isPendingConfirm && (
                    <div className="flex gap-2">
                       <button onClick={(e) => { e.stopPropagation(); handleAdminApprove(p.id); }} className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 transition-all shadow-lg flex items-center gap-2"><Check size={14}/> Aprovar</button>
                       <button onClick={(e) => { e.stopPropagation(); setRejectProtocol(p); }} className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg"><ThumbsDown size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="text-right border-l pl-4 border-slate-100 min-w-[80px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aberto há</p>
                  <p className={`font-black text-sm ${isAberto ? 'text-red-600' : 'text-slate-800'}`}>{calculateTimeOpen(p.openedAt)}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${p.priority === 'Alta' ? 'bg-red-500 shadow-lg shadow-red-500/30' : p.priority === 'Média' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/30' : 'bg-green-500 shadow-lg shadow-green-500/30'}`}></div>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest opacity-40 flex flex-col items-center gap-4">
             <ClipboardList size={48} /> Nenhum protocolo registrado.
          </div>
        )}
      </div>

      {/* MODAL DETALHES E AUDITORIA */}
      {selectedProtocol && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300 overflow-hidden">
           <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[56px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
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
                    <section>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Relato Original</h4>
                       <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-slate-700 font-medium whitespace-pre-wrap leading-relaxed shadow-sm italic">
                          "{selectedProtocol.description}"
                       </div>
                    </section>
                    
                    {/* ÁREA DE RESOLUÇÃO PARA O OPERADOR RESPONSÁVEL */}
                    {selectedProtocol.status === ProtocolStatus.EM_ANDAMENTO && selectedProtocol.ownerOperatorId === user.id && (
                       <section className="space-y-8 p-10 bg-blue-50/30 rounded-[48px] border-2 border-blue-200 animate-in slide-in-from-bottom-6">
                          <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-3">
                             <ListChecks size={22} /> Questionário de Auditoria & Finalização
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {questions.map(q => (
                                <div key={q.id} className="p-5 bg-white rounded-3xl border border-blue-100 shadow-sm space-y-4">
                                   <p className="text-[10px] font-black text-slate-700 leading-tight uppercase tracking-tight">{q.text}</p>
                                   <div className="flex flex-wrap gap-2">
                                      {q.options.map(opt => (
                                         <button 
                                          key={opt}
                                          onClick={() => setResolutionResponses({ ...resolutionResponses, [q.id]: opt })}
                                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${resolutionResponses[q.id] === opt ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                         >
                                            {opt}
                                         </button>
                                      ))}
                                   </div>
                                </div>
                             ))}
                          </div>

                          <div className="space-y-4">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">O que foi feito de fato? (Descrição técnica/comercial)</h4>
                             <textarea 
                               placeholder="Ex: Trocamos o filtro X por Y, cliente ficou satisfeito com a nova proposta..." 
                               value={resolutionSummary}
                               onChange={e => setResolutionSummary(e.target.value)}
                               className="w-full p-6 bg-white border border-blue-100 rounded-[32px] font-bold text-slate-800 h-48 resize-none outline-none focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner"
                             />
                          </div>

                          <button 
                            onClick={() => handleUpdateStatus(selectedProtocol.id, ProtocolStatus.RESOLVIDO_PENDENTE)}
                            disabled={isProcessing}
                            className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                             {isProcessing ? <Loader2 className="animate-spin" /> : <ClipboardCheck size={20} />} Finalizar e Enviar para Aprovação Gestora
                          </button>
                       </section>
                    )}

                    {/* SOLUÇÃO PROPOSTA - VISÍVEL APÓS O ENVIO */}
                    {selectedProtocol.resolutionSummary && (
                      <section className="space-y-6">
                         <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4 flex items-center gap-2">
                           <CheckCircle2 size={18} /> Solução Registrada pelo Responsável
                         </h4>
                         <div className="p-8 bg-emerald-50 rounded-[32px] border border-emerald-100 text-emerald-950 font-bold whitespace-pre-wrap leading-relaxed shadow-sm">
                            {selectedProtocol.resolutionSummary}
                         </div>
                         
                         {user.role === UserRole.ADMIN && selectedProtocol.status === ProtocolStatus.RESOLVIDO_PENDENTE && (
                           <div className="flex gap-4 p-8 bg-slate-900 rounded-[40px] animate-in zoom-in border-4 border-slate-800">
                              <button onClick={() => handleAdminApprove(selectedProtocol.id)} className="flex-1 py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-xl transition-all">
                                 <ThumbsUp size={18} /> Aprovar Resolução
                              </button>
                              <button onClick={() => setRejectProtocol(selectedProtocol)} className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-red-700 shadow-xl transition-all">
                                 <ThumbsDown size={18} /> Devolver com Correções
                              </button>
                           </div>
                         )}
                      </section>
                    )}

                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                          <History size={14} /> Histórico de Auditoria
                       </h4>
                       <div className="space-y-4">
                          {protocolEvents.map((e) => (
                            <div key={e.id} className="flex gap-4 animate-in slide-in-from-left-2">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0"><Clock size={16} /></div>
                               <div className="flex-1 bg-slate-50/50 p-5 rounded-[24px] border border-slate-100">
                                  <p className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">{e.eventType === 'status_change' ? 'Alteração de Status' : 'Registro de Evento'}</p>
                                  <p className="text-xs text-slate-500 font-bold italic mt-2">"{e.note}"</p>
                                  <div className="flex items-center justify-between mt-3">
                                     <span className="text-[8px] text-slate-400 font-black uppercase">{new Date(e.createdAt).toLocaleString()}</span>
                                     <span className="text-[8px] text-blue-500 font-black uppercase tracking-widest">ID Ator: {e.actorId.substring(0,6)}</span>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </section>
                 </div>

                 <div className="md:col-span-4 space-y-6">
                    <div className="p-8 bg-slate-900 rounded-[40px] text-white shadow-2xl space-y-6">
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Responsável Atual</p>
                          <p className="font-black text-lg text-blue-400">{operators.find(o => o.id === selectedProtocol.ownerOperatorId)?.name || 'N/A'}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Aberto em</p>
                          <p className="font-black text-sm text-white">{new Date(selectedProtocol.openedAt).toLocaleDateString()}</p>
                       </div>
                       <div className="text-center pt-4 border-t border-slate-800">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Tempo Total de Aberto</p>
                          <p className="text-2xl font-black text-white">{calculateTimeOpen(selectedProtocol.openedAt)}</p>
                       </div>
                    </div>
                    
                    <div className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm space-y-4">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={12} /> Dados do Cliente</h5>
                        <p className="font-black text-slate-800 text-sm truncate">{clients.find(c => c.id === selectedProtocol.clientId)?.name}</p>
                        <p className="text-[10px] font-bold text-blue-600">{clients.find(c => c.id === selectedProtocol.clientId)?.phone}</p>
                    </div>

                    {user.role === UserRole.ADMIN && (
                       <button onClick={() => setReassignProtocol(selectedProtocol)} className="w-full p-5 bg-indigo-50 text-indigo-600 rounded-[28px] font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                          <UserPlus size={16} /> Reatribuir Chamado
                       </button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAIS AUXILIARES - REJEIÇÃO */}
      {rejectProtocol && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-red-600 p-8 text-white flex justify-between items-center">
                 <h3 className="font-black uppercase text-sm tracking-widest">Rejeitar Solução e Reabrir</h3>
                 <button onClick={() => setRejectProtocol(null)}><X size={24} /></button>
              </div>
              <div className="p-10 space-y-6">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informe o motivo da devolução:</p>
                 <textarea 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm h-40 resize-none outline-none focus:ring-8 focus:ring-red-500/5 transition-all" 
                  placeholder="Ex: Cliente informou que o problema persiste. Operador deve retornar ao local..."
                 />
                 <button onClick={handleAdminReject} className="w-full py-6 bg-red-600 text-white rounded-[32px] font-black uppercase text-[10px] shadow-xl hover:bg-red-700 transition-all">Confirmar Devolução</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL NOVO PROTOCOLO (FIX) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl flex flex-col overflow-hidden">
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
                        placeholder="Pesquisar por nome ou telefone..." 
                        value={newProto.clientSearch}
                        onChange={e => setNewProto({...newProto, clientSearch: e.target.value})}
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10"
                       />
                       {newProto.clientId && (
                         <button onClick={() => setNewProto({...newProto, clientId: '', clientSearch: ''})} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"><X size={16} /></button>
                       )}
                       {clientSuggestions.length > 0 && (
                         <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden">
                            {clientSuggestions.map(c => (
                              <button key={c.id} onClick={() => setNewProto({...newProto, clientId: c.id, clientSearch: c.name})} className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between group">
                                 <div><p className="font-black text-slate-800 text-sm">{c.name}</p><p className="text-[10px] text-slate-400 font-bold">{c.phone}</p></div>
                                 <ChevronRight size={14} className="text-slate-200 group-hover:text-blue-600 transition-all" />
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                 </section>
                 <section className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Detalhes da Solicitação</label>
                    <input placeholder="Ex: Bomba de piscina com vazamento..." value={newProto.title} onChange={e => setNewProto({...newProto, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    <textarea placeholder="Explique detalhadamente o que o cliente relatou..." value={newProto.description} onChange={e => setNewProto({...newProto, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-32 resize-none outline-none" />
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
                          <option value="Baixa">Baixa (72h)</option><option value="Média">Média (48h)</option><option value="Alta">Alta (24h)</option>
                       </select>
                    </div>
                 </div>
              </div>
              <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                 <button onClick={handleSaveProtocol} disabled={isProcessing} className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center gap-2 hover:bg-blue-700 transition-all">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />} Abrir Protocolo Oficial
                 </button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};

export default Protocols;
