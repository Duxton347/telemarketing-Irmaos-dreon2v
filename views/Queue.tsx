
import React from 'react';
import { 
  Phone, PhoneOff, SkipForward, Play, CheckCircle2, 
  Loader2, Clock, MapPin, User, FileText, AlertCircle, Save, X, MessageCircle
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Task, Client, Question, CallType, OperatorEventType } from '../types';

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
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string | null>(null);

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
        setResponses({});
        setCallSummary('');
      } else {
        setCurrentTask(null);
        setClient(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

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
    // Log do evento obrigatório de INICIAR
    if (currentTask) {
      await dataService.logOperatorEvent(user.id, OperatorEventType.INICIAR_PROXIMO_ATENDIMENTO, currentTask.id);
    }
  };

  const handleEndCall = () => { setIsCalling(false); setIsFillingReport(true); };

  const handleSkipTask = async () => {
    if (!currentTask) return;
    const reason = prompt("Informe o motivo do pulo:");
    if (!reason) return;

    setIsProcessing(true);
    try {
      await dataService.updateTask(currentTask.id, { status: 'skipped', skipReason: reason });
      // Log do evento obrigatório de PULAR
      await dataService.logOperatorEvent(user.id, OperatorEventType.PULAR_ATENDIMENTO, currentTask.id, reason);
      await fetchQueue();
    } catch (e) {
      alert("Erro ao pular contato.");
    } finally {
      setIsProcessing(false);
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
      // Log do evento obrigatório de FINALIZAR
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
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl">
           <span className="px-3 py-1 bg-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{currentTask.type}</span>
           <h3 className="text-3xl font-black mt-4 tracking-tighter">{client.name}</h3>
           <p className="mt-8 font-bold text-slate-400 flex items-center gap-2"><Phone size={18} /> {client.phone}</p>
           <p className="mt-2 font-bold text-slate-400 flex items-start gap-2"><MapPin size={18} /> {client.address}</p>
        </div>
        {!isCalling && !isFillingReport && (
          <div className="grid grid-cols-2 gap-4">
             <button onClick={handleStartCall} className="py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Play size={20} /> Iniciar
             </button>
             <button onClick={handleSkipTask} disabled={isProcessing} className="py-6 bg-slate-200 text-slate-600 rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-sm flex items-center justify-center gap-3 hover:bg-slate-300 active:scale-95 transition-all">
                <SkipForward size={20} /> Pular
             </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-8">
        {(isCalling || isFillingReport) && (
          <div className="bg-white rounded-[56px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
             <header className="bg-slate-900 p-8 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse"><Phone size={20} /></div>
                   <div><h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400">Tempo de Chamada</h4><p className="text-xl font-black">{Math.floor(callDuration / 60)}m {callDuration % 60}s</p></div>
                </div>
                {isCalling && <button onClick={handleEndCall} className="px-8 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px]">Finalizar</button>}
             </header>

             <div className="flex-1 p-10 space-y-12">
                <section className="space-y-6">
                   <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Questionário Operacional</h5>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {questions.filter(q => q.type === currentTask.type || q.type === 'ALL').map(q => (
                         <div key={q.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                            <p className="font-black text-slate-800 text-sm">{q.text}</p>
                            <div className="flex flex-wrap gap-2">
                               {q.options.map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => setResponses({ ...responses, [q.id]: opt })}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${responses[q.id] === opt ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200'}`}
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
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none h-20 resize-none"
                                    placeholder="Explique o porquê desta oportunidade..."
                                 />
                              </div>
                            )}
                         </div>
                      ))}
                   </div>
                </section>
                <section className="space-y-4">
                   <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Resumo do Atendimento</h5>
                   <textarea value={callSummary} onChange={e => setCallSummary(e.target.value)} className="w-full p-8 bg-slate-50 rounded-[40px] border border-slate-100 font-bold text-slate-800 h-48 outline-none resize-none" placeholder="O que foi conversado?" />
                </section>
             </div>
             {isFillingReport && (
               <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button onClick={handleSubmitReport} disabled={isProcessing} className="px-12 py-5 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center gap-3">
                     {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar Atendimento
                  </button>
               </footer>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Queue;
