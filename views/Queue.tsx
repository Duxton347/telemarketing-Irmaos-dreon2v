
import React from 'react';
import { 
  PhoneForwarded, Clock, MapPin, 
  Save, ShieldAlert, PhoneOff, MessageSquare,
  ClipboardList, Package, FileText, Loader2,
  Copy, Check, SkipForward, AlertTriangle, X, RotateCcw
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { CallType, Client, Task, Protocol, ProtocolStatus } from '../types';

const Queue: React.FC<{ user: any }> = ({ user }) => {
  const [viewMode, setViewMode] = React.useState<'pending' | 'skipped'>('pending');
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  // Call states
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string>('');
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [callSummary, setCallSummary] = React.useState('');
  const [shouldOpenProtocol, setShouldOpenProtocol] = React.useState(false);
  const [protocolData, setProtocolData] = React.useState({ title: '', departmentId: '', description: '', priority: 'Média' as any });

  // Skip / Re-attempt states
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

  const fetchQueue = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const allTasks = await dataService.getTasks();
      // Filtra tarefas do usuário logado conforme o status (Pendente ou Pulada)
      const myTasks = allTasks.filter(t => t.assignedTo === user.id && t.status === viewMode);
      
      if (myTasks.length > 0) {
        const task = myTasks[0];
        const allClients = await dataService.getClients();
        const foundClient = allClients.find(c => c.id === task.clientId);
        
        setCurrentTask(task);
        setClient(foundClient || null);
        
        // Reseta estados de atendimento
        setResponses({});
        setCallSummary('');
        setCallDuration(0);
        setReportDuration(0);
        setIsCalling(false);
        setIsFillingReport(false);
        setShouldOpenProtocol(false);
      } else {
        setCurrentTask(null);
        setClient(null);
      }
    } catch (e) {
      console.error("Erro ao buscar fila:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user.id, viewMode]);

  // Carrega a fila ao mudar de modo ou ao iniciar
  React.useEffect(() => { 
    fetchQueue(); 
  }, [fetchQueue]);

  // Cronômetros
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

  // FUNÇÃO CORRIGIDA: Pular tarefa com transição imediata
  const handleSkip = async () => {
    if (!currentTask || !skipReason || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // 1. Atualiza no banco de dados
      const success = await dataService.updateTask(currentTask.id, { 
        status: 'skipped', 
        skipReason: skipReason 
      });
      
      if (success) {
        // 2. Limpa estados locais e fecha o modal IMEDIATAMENTE
        setIsSkipModalOpen(false);
        setSkipReason('');
        setCurrentTask(null);
        setClient(null);
        
        // 3. Busca a próxima tarefa e reseta o processamento
        await fetchQueue();
      } else {
        alert("Falha ao salvar descarte. Verifique sua conexão ou permissões.");
      }
    } catch (e) {
      console.error("Erro no Skip:", e);
      alert("Erro ao descartar tarefa.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = async () => {
    if (!currentTask || !client || isProcessing) return;
    setIsProcessing(true);
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
          written_report: callSummary,
          call_type: currentTask.type 
        },
        type: currentTask.type,
        protocolId: pId
      });

      await dataService.updateTask(currentTask.id, { status: 'completed' });
      setCurrentTask(null); 
      await fetchQueue();
    } catch (e) {
      alert("Falha ao salvar atendimento: " + e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading && !currentTask) return (
    <div className="flex flex-col items-center py-40 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando fila...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* SELETOR DE FILA */}
      <div className="flex bg-white p-2 rounded-[32px] border border-slate-200 shadow-sm w-fit mx-auto mb-10">
         <button 
           disabled={isProcessing}
           onClick={() => setViewMode('pending')} 
           className={`px-10 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'pending' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
         >
           Fila de Hoje
         </button>
         <button 
           disabled={isProcessing}
           onClick={() => setViewMode('skipped')} 
           className={`px-10 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'skipped' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-400 hover:text-red-600'}`}
         >
           Chamadas Puladas / Retorno
         </button>
      </div>

      {!currentTask ? (
        <div className="flex flex-col items-center py-40 gap-4 opacity-30 text-center animate-in fade-in duration-700">
          <ClipboardList size={60} />
          <p className="font-black text-slate-500 uppercase tracking-widest text-sm">
            {viewMode === 'pending' ? 'Excelente! Sua fila de hoje está vazia.' : 'Nenhuma chamada pulada para retornar.'}
          </p>
          {viewMode === 'skipped' && (
            <button onClick={() => setViewMode('pending')} className="mt-4 text-blue-600 font-black uppercase text-[10px] underline">Voltar para fila principal</button>
          )}
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-6 duration-500">
          {/* FICHA DO CLIENTE */}
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                 <span className={`${viewMode === 'skipped' ? 'bg-red-600' : 'bg-slate-900'} text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest`}>
                    {viewMode === 'skipped' ? 'RETORNO PENDENTE' : currentTask.type}
                 </span>
                 <span className="text-slate-300 font-black text-xs uppercase tracking-widest">#{currentTask.id.substring(0,8)}</span>
                 {viewMode === 'skipped' && (
                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center gap-2">
                       <AlertTriangle size={12} /> Pulado por: {currentTask.skipReason}
                    </span>
                 )}
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
               {viewMode === 'pending' && !isCalling && !isFillingReport && (
                 <button 
                   onClick={() => setIsSkipModalOpen(true)}
                   className="p-5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[32px] transition-all group shadow-sm active:scale-90"
                   title="Pular / Retornar Depois"
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-8">
            <div className="md:col-span-8 space-y-8">
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Package size={14} className="text-blue-500" /> Itens de Contrato / Equipamento
                  </h3>
                  <div className="flex flex-wrap gap-2">
                     {client?.items && client.items.length > 0 ? client.items.map(item => (
                       <span key={item} className="px-5 py-3 bg-blue-50/50 border border-blue-100 text-blue-700 rounded-2xl text-xs font-black uppercase tracking-tight shadow-sm">
                         {item}
                       </span>
                     )) : <span className="text-slate-300 italic text-sm font-medium p-2">Sem equipamentos no cadastro</span>}
                  </div>
               </div>

               <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 min-h-[400px]">
                  {!isCalling && !isFillingReport ? (
                    <div className="text-center py-20 space-y-8">
                       <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto shadow-inner ${viewMode === 'skipped' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          {viewMode === 'skipped' ? <RotateCcw size={48} /> : <PhoneForwarded size={48} />}
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                             {viewMode === 'skipped' ? 'Nova Tentativa' : 'Iniciar Chamada'}
                          </h3>
                          <p className="text-slate-400 font-bold max-w-sm mx-auto">
                             {viewMode === 'skipped' ? 'Retomando contato descartado anteriormente.' : 'Certifique-se de que o número está correto no discador.'}
                          </p>
                       </div>
                       <button 
                        onClick={() => { setIsCalling(true); setStartTime(new Date().toISOString()); }} 
                        className={`px-16 py-6 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:-translate-y-1 transition-all active:scale-95 ${viewMode === 'skipped' ? 'bg-red-600 shadow-red-600/30' : 'bg-blue-600 shadow-blue-600/30'}`}
                       >
                         {viewMode === 'skipped' ? 'Tentar de Novo' : 'Discar Agora'}
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
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Relatório Detalhado</label>
                          <textarea 
                            required
                            value={callSummary} 
                            onChange={e => setCallSummary(e.target.value)} 
                            placeholder="Descreva as objeções ou elogios do cliente..." 
                            className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] h-48 resize-none outline-none font-bold text-sm focus:border-blue-200 focus:bg-white transition-all shadow-inner" 
                          />
                       </div>
                       
                       {isCalling ? (
                         <button onClick={() => { setIsCalling(false); setIsFillingReport(true); }} className="w-full py-7 bg-red-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 shadow-xl shadow-red-600/20 active:scale-95 transition-all">
                           <PhoneOff size={20} /> Finalizar Linha
                         </button>
                       ) : (
                         <button 
                           onClick={handleFinish} 
                           disabled={!callSummary.trim() || isProcessing}
                           className="w-full py-7 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                         >
                           {isProcessing ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Salvar Ficha e Ir Próximo</>}
                         </button>
                       )}
                    </div>
                  )}
               </div>
            </div>

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
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                          <input placeholder="Título resumido" value={protocolData.title} onChange={e => setProtocolData({...protocolData, title: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-xs font-bold outline-none" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Para quem?</label>
                          <select value={protocolData.departmentId} onChange={e => setProtocolData({...protocolData, departmentId: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-[10px] font-black uppercase outline-none cursor-pointer">
                             {dataService.getProtocolConfig().departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                          <textarea placeholder="O que o cliente reclamou?" value={protocolData.description} onChange={e => setProtocolData({...protocolData, description: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl h-32 text-xs font-bold resize-none outline-none" />
                       </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">Abra um protocolo se houver problemas graves ou falhas de produto.</p>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUDITADO DE DESCARTE (SKIP) */}
      {isSkipModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <AlertTriangle className="text-yellow-400" /> Motivo do Descarte
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
                           disabled={isProcessing}
                           onClick={() => setSkipReason(reason)}
                           className={`w-full text-left p-4 rounded-2xl text-xs font-black uppercase transition-all border-2 ${skipReason === reason ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                         >
                            {reason}
                         </button>
                       ))}
                    </div>
                 </div>
                 
                 <div className="pt-4 flex gap-4">
                    <button onClick={() => setIsSkipModalOpen(false)} disabled={isProcessing} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button 
                      onClick={handleSkip} 
                      disabled={!skipReason || isProcessing}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-black/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Mover para Retorno'}
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
