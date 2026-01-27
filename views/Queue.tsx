
import React from 'react';
import { 
  PhoneForwarded, Clock, MapPin, 
  Save, ShieldAlert, PhoneOff, MessageSquare,
  ClipboardList, Package, FileText, Loader2,
  Copy, Check, SkipForward, AlertTriangle, X, ExternalLink
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { CallType, Client, Task, Protocol, ProtocolStatus } from '../types';

const Queue: React.FC<{ user: any }> = ({ user }) => {
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string>('');
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [callSummary, setCallSummary] = React.useState('');
  const [shouldOpenProtocol, setShouldOpenProtocol] = React.useState(false);
  const [protocolData, setProtocolData] = React.useState({ title: '', departmentId: '', description: '', priority: 'Média' as any });

  // Skip states
  const [isSkipModalOpen, setIsSkipModalOpen] = React.useState(false);
  const [skipReason, setSkipReason] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const timerRef = React.useRef<any>(null);

  const SKIP_REASONS = [
    'Número Ocupado / Caixa Postal',
    'Telefone Não Existe / Incorreto',
    'Não Atende (Várias Tentativas)',
    'Cliente pediu para retornar depois',
    'Desistência (Não quer falar)',
    'Erro de Cadastro / Duplicidade'
  ];

  const fetchQueue = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const allTasks = await dataService.getTasks();
      const myTasks = allTasks.filter(t => t.assignedTo === user.id && t.status === 'pending');
      
      if (myTasks.length > 0) {
        const task = myTasks[0];
        const allClients = await dataService.getClients();
        const foundClient = allClients.find(c => c.id === task.clientId);
        
        setCurrentTask(task);
        setClient(foundClient || null);
        setResponses({});
        setCallSummary('');
        setCallDuration(0);
        setReportDuration(0);
      } else {
        setCurrentTask(null);
      }
    } catch (e) {
      console.error("Erro ao buscar fila:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  React.useEffect(() => { fetchQueue(); }, [fetchQueue]);

  React.useEffect(() => {
    if (isCalling) timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    else if (isFillingReport) timerRef.current = setInterval(() => setReportDuration(d => d + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [isCalling, isFillingReport]);

  const handleCopy = () => {
    if (client?.phone) {
      navigator.clipboard.writeText(client.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (client?.phone) {
      const cleanPhone = client.phone.replace(/\D/g, '');
      const text = encodeURIComponent(`Olá ${client.name}, tudo bem? Aqui é o(a) ${user.name} da Irmãos Dreon. Gostaria de conversar um minuto sobre o seu equipamento.`);
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    }
  };

  const handleSkip = async () => {
    if (!currentTask || !skipReason) return;
    try {
      await dataService.updateTask(currentTask.id, { 
        status: 'skipped', 
        skipReason: skipReason 
      });
      setIsSkipModalOpen(false);
      setSkipReason('');
      fetchQueue();
    } catch (e) {
      alert("Erro ao descartar tarefa: " + e);
    }
  };

  const handleFinish = async () => {
    if (!currentTask || !client) return;
    try {
      let pId;
      if (shouldOpenProtocol) {
        pId = await dataService.saveProtocol({
          id: '',
          clientId: client.id,
          openedByOperatorId: user.id,
          ownerOperatorId: user.id,
          title: protocolData.title,
          description: protocolData.description,
          status: ProtocolStatus.ABERTO,
          priority: protocolData.priority,
          departmentId: protocolData.departmentId,
          openedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActionAt: new Date().toISOString(),
          slaDueAt: new Date().toISOString(),
          origin: 'Ativo',
          categoryId: ''
        }, user.id);
      }

      // IMPORTANTE: Salva todas as respostas e o relatório final
      await dataService.saveCall({
        id: '',
        taskId: currentTask.id,
        operatorId: user.id,
        clientId: client.id,
        startTime,
        endTime: new Date().toISOString(),
        duration: callDuration,
        reportTime: reportDuration,
        responses: { 
          ...responses, 
          written_report: callSummary, // Relatório final do operador
          call_type: currentTask.type 
        },
        type: currentTask.type,
        protocolId: pId
      });

      await dataService.updateTask(currentTask.id, { status: 'completed' });
      setIsFillingReport(false);
      setShouldOpenProtocol(false);
      fetchQueue();
    } catch (e) {
      alert("Falha ao salvar atendimento: " + e);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center py-40 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando Banco de Dados...</p>
    </div>
  );

  if (!currentTask) return (
    <div className="flex flex-col items-center py-40 gap-4 opacity-30">
      <ClipboardList size={60} />
      <p className="font-black text-slate-500 uppercase tracking-widest text-sm text-center">
        Parabéns!<br/>Sua fila de hoje foi concluída.
      </p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* FICHA DO CLIENTE EM DESTAQUE */}
      <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
             <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{currentTask.type}</span>
             <span className="text-slate-300 font-black text-xs uppercase tracking-widest">#{currentTask.id.substring(0,8)}</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tighter">{client?.name}</h2>
          
          <div className="flex flex-wrap items-center gap-4 pt-2">
             <div className="flex items-center gap-2 bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100 shadow-sm">
                <span className="text-blue-600 font-black text-xl tracking-tight">{client?.phone}</span>
                <div className="flex gap-1 ml-2 border-l border-blue-200 pl-3">
                  <button onClick={handleCopy} className={`p-2 rounded-xl transition-all ${copied ? 'bg-green-100 text-green-600' : 'text-blue-400 hover:bg-blue-100'}`}>
                     {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                  <button onClick={handleWhatsApp} className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all">
                     <MessageSquare size={20} />
                  </button>
                </div>
             </div>
             <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-slate-50 px-4 py-3 rounded-2xl">
                <MapPin size={16} className="text-red-500" /> {client?.address || 'Sem endereço'}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {!isCalling && !isFillingReport && (
             <button 
               onClick={() => setIsSkipModalOpen(true)}
               className="p-5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[32px] transition-all group shadow-sm"
               title="Pular Tarefa"
             >
                <SkipForward size={24} className="group-hover:translate-x-1 transition-transform" />
             </button>
           )}
           <div className="bg-slate-900 text-white px-10 py-8 rounded-[40px] text-center shadow-2xl border-b-4 border-yellow-400">
              <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">{isCalling ? 'Em Linha' : isFillingReport ? 'Relatório' : 'Pronto'}</p>
              <p className="text-4xl font-mono font-black">
                {Math.floor((isCalling ? callDuration : reportDuration)/60).toString().padStart(2,'0')}:{(isCalling ? callDuration : reportDuration % 60).toString().padStart(2,'0')}
              </p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-8">
           {/* EQUIPAMENTOS / ITENS */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Package size={14} className="text-blue-500" /> Equipamento Adquirido / Itens do Contrato
              </h3>
              <div className="flex flex-wrap gap-2">
                 {client?.items && client.items.length > 0 ? client.items.map(item => (
                   <span key={item} className="px-5 py-3 bg-blue-50/50 border border-blue-100 text-blue-700 rounded-2xl text-xs font-black uppercase tracking-tight shadow-sm">
                     {item}
                   </span>
                 )) : <span className="text-slate-300 italic text-sm font-medium p-2">Nenhum equipamento listado no cadastro</span>}
              </div>
           </div>

           {/* QUESTIONÁRIO E RELATÓRIO */}
           <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 min-h-[400px]">
              {!isCalling && !isFillingReport ? (
                <div className="text-center py-20 space-y-8">
                   <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto shadow-inner"><PhoneForwarded size={48} /></div>
                   <div className="space-y-2">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">Preparar Ligação</h3>
                      <p className="text-slate-400 font-bold max-w-sm mx-auto">Confirme os dados acima antes de iniciar. O cronômetro começará ao clicar abaixo.</p>
                   </div>
                   <button 
                    onClick={() => { setIsCalling(true); setStartTime(new Date().toISOString()); }} 
                    className="px-16 py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95"
                   >
                     Iniciar Conversa
                   </button>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                   <div className="grid grid-cols-1 gap-6">
                      {dataService.getQuestions().filter(q => q.type === currentTask.type || q.type === 'ALL').map(q => (
                        <div key={q.id} className="space-y-4 p-8 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-blue-200 transition-all">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{q.text}</p>
                           <div className="flex flex-wrap gap-3">
                              {q.options.map(opt => (
                                <button 
                                  key={opt} 
                                  onClick={() => setResponses({...responses, [q.id]: opt})} 
                                  className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm ${responses[q.id] === opt ? 'bg-slate-900 text-white ring-4 ring-slate-900/10' : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                >
                                  {opt}
                                </button>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Relatório Final (Obrigatório)</label>
                      <textarea 
                        required
                        value={callSummary} 
                        onChange={e => setCallSummary(e.target.value)} 
                        placeholder="Descreva detalhadamente como foi a conversa, as objeções do cliente e os próximos passos..." 
                        className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] h-48 resize-none outline-none font-bold text-sm focus:border-blue-200 focus:bg-white transition-all shadow-inner" 
                      />
                   </div>
                   
                   {isCalling ? (
                     <button onClick={() => { setIsCalling(false); setIsFillingReport(true); }} className="w-full py-7 bg-red-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 shadow-xl shadow-red-600/20 active:scale-95 transition-all">
                       <PhoneOff size={20} /> Desligar e Finalizar Ficha
                     </button>
                   ) : (
                     <button 
                       onClick={handleFinish} 
                       disabled={!callSummary.trim()}
                       className="w-full py-7 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                     >
                       <Save size={20} /> Salvar Tudo e Próximo Cliente
                     </button>
                   )}
                </div>
              )}
           </div>
        </div>

        {/* SIDEBAR DE PROTOCOLOS */}
        <div className="md:col-span-4 space-y-6">
           <div className={`p-10 rounded-[48px] border-4 transition-all shadow-sm ${shouldOpenProtocol ? 'bg-red-50 border-red-200 shadow-red-200/50' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <ShieldAlert className={shouldOpenProtocol ? 'text-red-600' : 'text-slate-300'} size={24} />
                    <h4 className="font-black uppercase text-[10px] tracking-widest">Protocolo Crítico</h4>
                 </div>
                 <button onClick={() => setShouldOpenProtocol(!shouldOpenProtocol)} className={`w-14 h-7 rounded-full relative transition-all shadow-inner ${shouldOpenProtocol ? 'bg-red-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${shouldOpenProtocol ? 'left-8' : 'left-1'}`}></div>
                 </button>
              </div>
              
              {shouldOpenProtocol ? (
                <div className="space-y-5 animate-in slide-in-from-top-4">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">O que aconteceu?</label>
                      <input placeholder="Título resumido do problema" value={protocolData.title} onChange={e => setProtocolData({...protocolData, title: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-xs font-bold outline-none" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Setor Destino</label>
                      <select value={protocolData.departmentId} onChange={e => setProtocolData({...protocolData, departmentId: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-[10px] font-black uppercase outline-none cursor-pointer">
                         {dataService.getProtocolConfig().departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalhes Técnicos</label>
                      <textarea placeholder="Relate as falhas ou reclamações..." value={protocolData.description} onChange={e => setProtocolData({...protocolData, description: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl h-32 text-xs font-bold resize-none outline-none" />
                   </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium italic">Ative apenas se o cliente apresentar problemas técnicos ou reclamações graves que exijam suporte.</p>
              )}
           </div>
        </div>
      </div>

      {/* MODAL AUDITADO DE DESCARTE */}
      {isSkipModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <AlertTriangle className="text-yellow-400" /> Auditoria de Descarte
                 </h3>
                 <button onClick={() => setIsSkipModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X /></button>
              </div>
              <div className="p-10 space-y-8">
                 <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Selecione o motivo real:</p>
                    <div className="grid grid-cols-1 gap-2">
                       {SKIP_REASONS.map(reason => (
                         <button 
                           key={reason} 
                           onClick={() => setSkipReason(reason)}
                           className={`w-full text-left p-4 rounded-2xl text-xs font-black uppercase transition-all border-2 ${skipReason === reason ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                         >
                            {reason}
                         </button>
                       ))}
                    </div>
                 </div>
                 
                 <div className="pt-4 flex gap-4">
                    <button onClick={() => setIsSkipModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button 
                      onClick={handleSkip} 
                      disabled={!skipReason}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 disabled:opacity-50"
                    >
                      Confirmar Descarte
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Queue;
