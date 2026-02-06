
import React from 'react';
import { 
  Phone, PhoneOff, SkipForward, Play, CheckCircle2, 
  Loader2, Clock, MapPin, User, FileText, AlertCircle, Save, X, 
  MessageCircle, Copy, Check, ChevronRight, AlertTriangle, 
  ClipboardList, Zap, Tag, Wrench, History
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Task, Client, Question, CallType, OperatorEventType, ProtocolStatus, Prospect } from '../types';
import { SKIP_REASONS, PROTOCOL_SLA } from '../constants';

const Queue: React.FC<{ user: any }> = ({ user }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [entity, setEntity] = React.useState<Client | Prospect | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  
  const [responses, setResponses] = React.useState<Record<string, any>>({});
  const [callSummary, setCallSummary] = React.useState('');
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [isSkipModalOpen, setIsSkipModalOpen] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string | null>(null);

  const fetchQueue = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTasks, allQuestions, allClients, allProspects] = await Promise.all([
        dataService.getTasks(),
        dataService.getQuestions(),
        dataService.getClients(),
        dataService.getProspects()
      ]);
      
      const myTask = allTasks.find(t => t.assignedTo === user.id && t.status === 'pending');
      setQuestions(allQuestions);
      
      if (myTask) {
        const found = myTask.clientId 
          ? allClients.find(c => c.id === myTask.clientId)
          : allProspects.find(p => p.id === myTask.prospectId);
        
        setCurrentTask(myTask);
        setEntity(found || null);
      } else {
        setCurrentTask(null);
        setEntity(null);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [user.id]);

  React.useEffect(() => { fetchQueue(); }, [fetchQueue]);

  React.useEffect(() => {
    let interval: any;
    if (isCalling || isFillingReport) {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling, isFillingReport]);

  const handleStartCall = async () => {
    setIsCalling(true);
    setStartTime(new Date().toISOString());
    await dataService.logOperatorEvent(user.id, OperatorEventType.INICIAR_PROXIMO_ATENDIMENTO, currentTask?.id);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setIsFillingReport(true);
  };

  const handleSubmit = async () => {
    if (!currentTask || !entity) return;
    setIsProcessing(true);
    try {
      const callData: any = {
        taskId: currentTask.id,
        operatorId: user.id,
        clientId: currentTask.clientId,
        prospectId: currentTask.prospectId,
        startTime: startTime!,
        endTime: new Date().toISOString(),
        duration: callDuration,
        reportTime: 0,
        responses: { ...responses, written_report: callSummary, call_type: currentTask.type },
        type: currentTask.type,
      };
      await dataService.saveCall(callData);
      await dataService.updateTask(currentTask.id, { status: 'completed' });
      await fetchQueue();
      setIsFillingReport(false);
      setCallDuration(0);
      setResponses({});
      setCallSummary('');
    } catch (e) { alert("Erro ao salvar."); }
    finally { setIsProcessing(false); }
  };

  if (isLoading) return (
    <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Preparando Atendimento...</p>
    </div>
  );

  if (!currentTask || !entity) return (
    <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
      <div className="w-24 h-24 bg-slate-100 rounded-[40px] flex items-center justify-center text-slate-300">
        <PhoneOff size={48} />
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Sua Fila está Limpa!</h3>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Aguardando nova carga de trabalho.</p>
      </div>
      <button onClick={fetchQueue} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">Sincronizar Agora</button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)] animate-in fade-in duration-700">
      
      {/* COLUNA 1: CONTEXTO (ESQUERDA) */}
      <div className="lg:col-span-3 space-y-6 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
           <div className="space-y-4">
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${currentTask.type === CallType.ASSISTENCIA ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {currentTask.type}
              </span>
              <h3 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tighter">{entity.name}</h3>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                 <div className="p-2 bg-slate-100 rounded-lg"><Phone size={16} /></div>
                 {entity.phone}
              </div>
              <div className="flex items-start gap-3 text-slate-400 font-bold text-xs leading-relaxed">
                 <div className="p-2 bg-slate-100 rounded-lg shrink-0"><MapPin size={16} /></div>
                 {entity.address || 'Endereço não informado'}
              </div>
           </div>

           {'items' in entity && (
             <div className="pt-8 border-t border-slate-50">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={14} /> Equipamentos</h4>
                <div className="flex flex-wrap gap-2">
                   {(entity as Client).items?.map((it, i) => (
                     <span key={i} className="px-3 py-1 bg-slate-50 text-[10px] font-black text-slate-600 rounded-lg border border-slate-100">{it}</span>
                   ))}
                </div>
             </div>
           )}
        </div>

        <div className="bg-slate-900 p-8 rounded-[48px] text-white space-y-6 shadow-2xl">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Último Contato</h4>
           <p className="text-xs font-bold leading-relaxed opacity-70 italic">"Cliente relatou interesse em novo aquecedor, mas pediu retorno após o dia 15."</p>
           <p className="text-[9px] font-black uppercase text-blue-400">Há 12 dias • Operador: João</p>
        </div>
      </div>

      {/* COLUNA 2: INTERAÇÃO (CENTRO) */}
      <div className="lg:col-span-6 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-white min-h-full rounded-[56px] shadow-sm border border-slate-100 p-10 space-y-12">
           {!isCalling && !isFillingReport ? (
             <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-8 opacity-40">
                <div className="p-8 bg-blue-50 text-blue-600 rounded-full animate-pulse"><Phone size={48} /></div>
                <div>
                   <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Pronto para começar?</h4>
                   <p className="text-sm font-bold text-slate-400 mt-2">Clique no botão "Iniciar" na barra lateral.</p>
                </div>
             </div>
           ) : (
             <div className="space-y-12 animate-in slide-in-from-bottom-4">
                <section className="space-y-8">
                   <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ClipboardList size={24} /></div>
                      <div>
                         <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Roteiro de Atendimento</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responda conforme a conversa evolui</p>
                      </div>
                   </div>

                   <div className="space-y-10">
                      {questions.filter(q => q.type === currentTask.type).map(q => (
                        <div key={q.id} className="space-y-4">
                           <p className="font-black text-slate-800 text-base leading-tight">{q.order}. {q.text}</p>
                           <div className="flex flex-wrap gap-2">
                              {q.options.map(opt => (
                                <button 
                                  key={opt}
                                  onClick={() => setResponses({...responses, [q.id]: opt})}
                                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${responses[q.id] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                >
                                   {opt}
                                </button>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                </section>

                <section className="space-y-6 pt-10 border-t border-slate-50">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><FileText size={20} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações do Operador</h4>
                   </div>
                   <textarea 
                    value={callSummary}
                    onChange={e => setCallSummary(e.target.value)}
                    className="w-full p-8 bg-slate-50 rounded-[40px] border border-slate-100 font-bold text-slate-800 h-48 resize-none outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    placeholder="Anote detalhes específicos que não estão no questionário..."
                   />
                </section>
             </div>
           )}
        </div>
      </div>

      {/* COLUNA 3: CONTROLES (DIREITA) */}
      <div className="lg:col-span-3 space-y-6">
         <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-xl sticky top-0 space-y-8">
            <div className="text-center space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cronômetro de Atendimento</p>
               <h2 className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">
                  {Math.floor(callDuration/60)}:{String(callDuration%60).padStart(2, '0')}
               </h2>
            </div>

            <div className="space-y-4 pt-8 border-t border-slate-50">
               {!isCalling && !isFillingReport ? (
                 <>
                   <button 
                    onClick={handleStartCall}
                    className="w-full py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                   >
                      <Play size={20} /> Iniciar Chamada
                   </button>
                   <button 
                    onClick={() => setIsSkipModalOpen(true)}
                    className="w-full py-5 bg-slate-100 text-slate-500 rounded-[28px] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-slate-200 transition-all"
                   >
                      <SkipForward size={18} /> Pular Contato
                   </button>
                 </>
               ) : isCalling ? (
                 <button 
                  onClick={handleEndCall}
                  className="w-full py-6 bg-red-600 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 animate-pulse"
                 >
                    <PhoneOff size={20} /> Finalizar Ligação
                 </button>
               ) : (
                 <button 
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                 >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={20} />} Salvar e Próximo
                 </button>
               )}
            </div>

            <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100 space-y-4">
               <h5 className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> Atalhos Rápidos</h5>
               <button className="w-full py-3 bg-white border border-blue-200 rounded-xl text-[9px] font-black uppercase text-blue-600 shadow-sm flex items-center justify-center gap-2"><MessageCircle size={14}/> Abrir WhatsApp</button>
               <button className="w-full py-3 bg-white border border-blue-200 rounded-xl text-[9px] font-black uppercase text-blue-600 shadow-sm flex items-center justify-center gap-2"><Wrench size={14}/> Solicitar Suporte</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Queue;
