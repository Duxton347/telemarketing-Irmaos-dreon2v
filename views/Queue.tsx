import React from 'react';
import { 
  Phone, PhoneOff, SkipForward, Play, CheckCircle2, 
  Loader2, Clock, MapPin, User, FileText, AlertCircle, Save, X, MessageCircle, Copy, Check, ChevronRight
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Task, Client, Question, CallType, OperatorEventType } from '../types';
import { SKIP_REASONS } from '../constants';

interface QueueProps {
  user: any;
}

const Queue: React.FC<QueueProps> = ({ user }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [responses, setResponses] = React.useState<Record<string, any>>({});
  const [callSummary, setCallSummary] = React.useState('');
  
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [isSkipModalOpen, setIsSkipModalOpen] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);

  const resetState = React.useCallback(() => {
    setIsCalling(false);
    setIsFillingReport(false);
    setIsSkipModalOpen(false);
    setCallDuration(0);
    setReportDuration(0);
    setResponses({});
    setCallSummary('');
    setStartTime(null);
  }, []);

  const fetchQueue = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTasks, allQuestions, allClients] = await Promise.all([
        dataService.getTasks(),
        dataService.getQuestions(),
        dataService.getClients()
      ]);
      setQuestions(allQuestions);
      const myTask = allTasks.find(t => t.assignedTo === user.id && t.status === 'pending');
      if (myTask) {
        const foundClient = allClients.find(c => c.id === myTask.clientId);
        setCurrentTask(myTask);
        setClient(foundClient || null);
      } else {
        setCurrentTask(null);
        setClient(null);
      }
      resetState();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user.id, resetState]);

  React.useEffect(() => { fetchQueue(); }, [fetchQueue]);

  React.useEffect(() => {
    let interval: any;
    if (isCalling) interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    else if (isFillingReport) interval = setInterval(() => setReportDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isCalling, isFillingReport]);

  const handleStartCall = async () => { 
    setIsCalling(true); 
    setStartTime(new Date().toISOString()); 
    if (currentTask) {
      await dataService.logOperatorEvent(user.id, OperatorEventType.INICIAR_PROXIMO_ATENDIMENTO, currentTask.id);
    }
  };

  const handleEndCall = () => { 
    setIsCalling(false); 
    setIsFillingReport(true); 
  };

  const handleCopyPhone = () => {
    if (client) {
      navigator.clipboard.writeText(client.phone);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (client) {
      const phone = client.phone.replace(/\D/g, '');
      const url = `https://wa.me/55${phone}`;
      window.open(url, '_blank');
    }
  };

  const handleSkipTask = async (reason: string) => {
    if (!currentTask) return;
    setIsProcessing(true);
    try {
      await dataService.updateTask(currentTask.id, { status: 'skipped', skipReason: reason });
      await dataService.logOperatorEvent(user.id, OperatorEventType.PULAR_ATENDIMENTO, currentTask.id, reason);
      await fetchQueue();
    } catch (e) {
      alert("Erro ao pular contato.");
    } finally {
      setIsProcessing(false);
      setIsSkipModalOpen(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!currentTask || !client) return;
    
    const pendingNotes = questions.some(q => {
      const isSaleQ = q.text.toLowerCase().includes('explorado') || q.text.toLowerCase().includes('comprar');
      return isSaleQ && responses[q.id] && !responses[`${q.id}_note`];
    });

    if (pendingNotes) {
      alert("Por favor, preencha a justificativa sobre a possibilidade de venda.");
      return;
    }

    setIsProcessing(true);
    try {
      const callData = {
        id: '',
        taskId: currentTask.id,
        operatorId: user.id,
        clientId: client.id,
        startTime: startTime!,
        endTime: new Date().toISOString(),
        duration: callDuration,
        reportTime: reportDuration,
        responses: { ...responses, written_report: callSummary, call_type: currentTask.type },
        type: currentTask.type
      };
      await dataService.saveCall(callData);
      await dataService.updateTask(currentTask.id, { status: 'completed' });
      await dataService.logOperatorEvent(user.id, OperatorEventType.FINALIZAR_ATENDIMENTO, currentTask.id);
      await fetchQueue();
    } catch (e) { alert("Erro ao salvar relatório."); }
    finally { setIsProcessing(false); }
  };

  if (isLoading) return <div className="h-full flex items-center justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (!currentTask || !client) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-20 bg-white rounded-[56px] border border-dashed border-slate-200">
        <Phone size={48} className="text-slate-200" />
        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Nenhuma chamada pendente</h3>
        <button onClick={fetchQueue} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Atualizar</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 pb-20">
      {/* FICHA DO CLIENTE */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl space-y-8">
           <div>
             <span className="px-3 py-1 bg-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{currentTask.type}</span>
             <h3 className="text-3xl font-black mt-4 tracking-tighter uppercase">{client.name}</h3>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-400 flex items-center gap-2">
                  <Phone size={18} /> {client.phone}
                </div>
                <div className="flex gap-2">
                   <button onClick={handleCopyPhone} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
                      {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                   </button>
                   <button onClick={handleWhatsApp} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-all">
                      <MessageCircle size={16} />
                   </button>
                </div>
              </div>
              <p className="font-bold text-slate-400 flex items-start gap-2"><MapPin size={18} className="shrink-0" /> {client.address || 'Sem endereço'}</p>
           </div>

           <div className="pt-6 border-t border-slate-800">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Portfólio de Equipamentos</p>
              <div className="flex flex-wrap gap-2">
                 {client.items && client.items.length > 0 ? client.items.map((it, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-800 text-[10px] font-black uppercase text-slate-300 rounded-md border border-slate-700">{it}</span>
                 )) : (
                   <span className="text-xs text-slate-600 italic">Nenhum equipamento cadastrado</span>
                 )}
              </div>
           </div>
        </div>

        {!isCalling && !isFillingReport && (
          <div className="grid grid-cols-2 gap-4">
             <button onClick={handleStartCall} className="py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Play size={20} /> Iniciar
             </button>
             <button onClick={() => setIsSkipModalOpen(true)} disabled={isProcessing} className="py-6 bg-slate-200 text-slate-600 rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-sm flex items-center justify-center gap-3 hover:bg-slate-300 active:scale-95 transition-all">
                <SkipForward size={20} /> Pular
             </button>
          </div>
        )}
      </div>

      {/* ÁREA DE QUESTIONÁRIO E REPORT */}
      <div className="lg:col-span-8">
        {(isCalling || isFillingReport) ? (
          <div className="bg-white rounded-[56px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px] animate-in slide-in-from-right-4">
             <header className="bg-slate-900 p-8 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse"><Phone size={20} /></div>
                   <div>
                     <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400">Status Atendimento</h4>
                     <p className="text-xl font-black">{isFillingReport ? 'Preenchendo Relatório' : 'Ligação em Curso'}</p>
                   </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase">Tempo</p>
                      <p className="font-black text-lg">{Math.floor(callDuration / 60)}m {callDuration % 60}s</p>
                   </div>
                   {isCalling && <button onClick={handleEndCall} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all">Desligar</button>}
                </div>
             </header>

             <div className="flex-1 p-10 space-y-12 overflow-y-auto">
                <section className="space-y-6">
                   <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-blue-600" /> Questionário Obrigatório
                   </h5>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {questions.filter(q => q.type === currentTask.type || q.type === 'ALL').map(q => (
                         <div key={q.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                            <p className="font-black text-slate-800 text-sm leading-tight">{q.text}</p>
                            <div className="flex flex-wrap gap-2">
                               {q.options.map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => setResponses({ ...responses, [q.id]: opt })}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${responses[q.id] === opt ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'}`}
                                  >
                                     {opt}
                                  </button>
                               ))}
                            </div>
                            {(q.text.toLowerCase().includes('explorado') || q.text.toLowerCase().includes('comprar')) && responses[q.id] && (
                              <div className="mt-4 animate-in slide-in-from-top-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Justificativa da Venda</label>
                                 <textarea 
                                    value={responses[`${q.id}_note`] || ''}
                                    onChange={e => setResponses({...responses, [`${q.id}_note`]: e.target.value})}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none h-20 resize-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    placeholder="Explique o porquê desta oportunidade..."
                                 />
                              </div>
                            )}
                         </div>
                      ))}
                   </div>
                </section>
                <section className="space-y-4">
                   <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                      <FileText size={18} className="text-blue-600" /> Resumo da Conversa
                   </h5>
                   <textarea value={callSummary} onChange={e => setCallSummary(e.target.value)} className="w-full p-8 bg-slate-50 rounded-[40px] border border-slate-100 font-bold text-slate-800 h-48 outline-none resize-none focus:ring-8 focus:ring-blue-500/5 transition-all" placeholder="O que foi conversado? Anote detalhes importantes para o próximo contato." />
                </section>
             </div>
             
             {isFillingReport && (
               <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button onClick={handleSubmitReport} disabled={isProcessing} className="px-12 py-5 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                     {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar e Próximo
                  </button>
               </footer>
             )}
          </div>
        ) : (
          <div className="h-full bg-slate-50 border-4 border-dashed border-slate-100 rounded-[56px] flex flex-col items-center justify-center p-20 text-center gap-6 opacity-30">
             <Phone size={64} className="text-slate-300" />
             <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Aguardando início do atendimento</p>
          </div>
        )}
      </div>

      {/* MODAL DE MOTIVOS DE PULO */}
      {isSkipModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter">Motivo do Pulo</h3>
                 <button onClick={() => setIsSkipModalOpen(false)}><X size={24} /></button>
              </div>
              <div className="p-8 space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Selecione o motivo para pular este contato:</p>
                 {SKIP_REASONS.map(reason => (
                    <button 
                      key={reason}
                      onClick={() => handleSkipTask(reason)}
                      disabled={isProcessing}
                      className="w-full p-5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl text-left font-black uppercase text-[10px] tracking-widest text-slate-700 transition-all active:scale-95 flex justify-between items-center group"
                    >
                       {reason}
                       <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>
                 ))}
                 <button onClick={() => setIsSkipModalOpen(false)} className="w-full py-4 mt-4 text-[9px] font-black uppercase text-slate-300 tracking-widest hover:text-red-500 transition-colors">Cancelar Operação</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Queue;