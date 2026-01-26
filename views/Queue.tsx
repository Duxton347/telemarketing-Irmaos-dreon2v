
import React from 'react';
import { 
  PhoneForwarded, Clock, MapPin, 
  Save, ShieldAlert, PhoneOff, MessageSquare,
  ClipboardList, Package, FileText, Loader2
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

  const timerRef = React.useRef<any>(null);

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
      } else {
        setCurrentTask(null);
      }
    } catch (e) {
      console.error(e);
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

  const handleFinish = async () => {
    if (!currentTask || !client) return;
    try {
      let pId;
      if (shouldOpenProtocol) {
        // Fix: Pass user.id as second argument to saveProtocol to match its signature
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
        responses: { ...responses, summary: callSummary },
        type: currentTask.type,
        protocolId: pId
      });

      await dataService.updateTask(currentTask.id, { status: 'completed' });
      setIsFillingReport(false);
      setCallDuration(0);
      setReportDuration(0);
      fetchQueue();
    } catch (e) {
      alert("Erro ao salvar: " + e);
    }
  };

  if (isLoading) return <div className="flex flex-col items-center py-40 gap-4"><Loader2 className="animate-spin text-blue-600" size={40} /><p className="font-black text-slate-400">CARREGANDO FILA...</p></div>;

  if (!currentTask) return <div className="flex flex-col items-center py-40 gap-4 opacity-30"><ClipboardList size={60} /><p className="font-black text-slate-500">SUA FILA ESTÁ VAZIA</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 flex justify-between items-center">
        <div className="space-y-2">
          <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{currentTask.type}</span>
          <h2 className="text-4xl font-black text-slate-900">{client?.name}</h2>
          <p className="text-slate-500 font-bold flex items-center gap-2"><MapPin size={16} /> {client?.address || 'Sem endereço'}</p>
        </div>
        <div className="bg-slate-900 text-white p-8 rounded-[40px] text-center shadow-2xl">
           <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">{isCalling ? 'Em Linha' : 'Relatório'}</p>
           <p className="text-3xl font-mono font-black">{Math.floor((isCalling ? callDuration : reportDuration)/60).toString().padStart(2,'0')}:{(isCalling ? callDuration : reportDuration % 60).toString().padStart(2,'0')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 bg-white p-10 rounded-[48px] shadow-sm border border-slate-100">
           {!isCalling && !isFillingReport ? (
             <div className="text-center py-20 space-y-6">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto"><PhoneForwarded size={40} /></div>
                <h3 className="text-2xl font-black">Pronto para iniciar?</h3>
                <button onClick={() => { setIsCalling(true); setStartTime(new Date().toISOString()); }} className="px-12 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Discar para Cliente</button>
             </div>
           ) : (
             <div className="space-y-8">
                {dataService.getQuestions().filter(q => q.type === currentTask.type || q.type === 'ALL').map(q => (
                  <div key={q.id} className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                     <p className="text-sm font-black text-slate-700 uppercase">{q.text}</p>
                     <div className="flex flex-wrap gap-2">
                        {q.options.map(opt => (
                          <button key={opt} onClick={() => setResponses({...responses, [q.id]: opt})} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${responses[q.id] === opt ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-400'}`}>{opt}</button>
                        ))}
                     </div>
                  </div>
                ))}
                <textarea value={callSummary} onChange={e => setCallSummary(e.target.value)} placeholder="Observações importantes da conversa..." className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl h-32 resize-none outline-none font-bold text-sm" />
                
                {isCalling ? (
                  <button onClick={() => { setIsCalling(false); setIsFillingReport(true); }} className="w-full py-6 bg-red-600 text-white rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3"><PhoneOff /> Encerrar e Salvar</button>
                ) : (
                  <button onClick={handleFinish} className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3"><Save /> Concluir Atendimento</button>
                )}
             </div>
           )}
        </div>

        <div className="md:col-span-4">
           <div className={`p-8 rounded-[48px] border-4 transition-all ${shouldOpenProtocol ? 'bg-red-50 border-red-200' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center justify-between mb-6">
                 <h4 className="font-black uppercase text-xs tracking-widest flex items-center gap-2"><ShieldAlert className={shouldOpenProtocol ? 'text-red-600' : 'text-slate-300'} /> Protocolo</h4>
                 <button onClick={() => setShouldOpenProtocol(!shouldOpenProtocol)} className={`w-12 h-6 rounded-full relative transition-all ${shouldOpenProtocol ? 'bg-red-600' : 'bg-slate-200'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shouldOpenProtocol ? 'left-7' : 'left-1'}`}></div></button>
              </div>
              {shouldOpenProtocol && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                   <input placeholder="Título do Incidente" value={protocolData.title} onChange={e => setProtocolData({...protocolData, title: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-xs font-bold outline-none" />
                   <select value={protocolData.departmentId} onChange={e => setProtocolData({...protocolData, departmentId: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl text-[10px] font-black uppercase outline-none">
                      {dataService.getProtocolConfig().departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                   </select>
                   <textarea placeholder="Relato técnico..." value={protocolData.description} onChange={e => setProtocolData({...protocolData, description: e.target.value})} className="w-full p-4 bg-white border border-red-100 rounded-2xl h-24 text-xs font-bold resize-none outline-none" />
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Queue;
