
import React from 'react';
import { 
  Play, Pause, SkipForward, PhoneForwarded, ClipboardCheck, 
  Copy, MessageCircle, Clock, MapPin, Box, AlertTriangle, 
  Check, Save, AlertCircle, X, ShieldAlert
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { SATISFACTION_EMOJIS, PROTOCOL_SLA } from '../constants';
import { CallRecord, CallType, Client, Task, Protocol, ProtocolStatus } from '../types';

const Queue: React.FC<{ user: any }> = ({ user }) => {
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string>('');
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  
  // Protocol State
  const [shouldOpenProtocol, setShouldOpenProtocol] = React.useState(false);
  const [protocolData, setProtocolData] = React.useState({
    title: '',
    departmentId: '',
    categoryId: '',
    description: '',
    priority: 'Média' as any
  });

  const timerRef = React.useRef<any>(null);
  const protocolConfig = dataService.getProtocolConfig();

  // Correctly await asynchronous client fetching
  const fetchNext = async () => {
    const tasks = dataService.getTasks().filter(t => t.assignedTo === user.id && t.status === 'pending');
    if (tasks.length > 0) {
      const task = tasks[0];
      const allClients = await dataService.getClients();
      const foundClient = allClients.find(c => c.id === task.clientId);
      setCurrentTask(task);
      setClient(foundClient || null);
      setResponses({});
      setShouldOpenProtocol(false);
      setProtocolData({ title: '', departmentId: protocolConfig.departments[0]?.id || '', categoryId: protocolConfig.categories[0]?.id || '', description: '', priority: 'Média' });
    } else {
      setCurrentTask(null);
      setClient(null);
    }
  };

  React.useEffect(() => { fetchNext(); }, [user]);

  React.useEffect(() => {
    if (isCalling) timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    else if (isFillingReport) timerRef.current = setInterval(() => setReportDuration(d => d + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [isCalling, isFillingReport]);

  const handleSave = async () => {
    if (!currentTask || !client) return;
    
    let pId: string | undefined;
    if (shouldOpenProtocol) {
      if (!protocolData.title || !protocolData.description) return alert("Preencha o título e descrição do protocolo.");
      const p: Protocol = {
        id: Math.random().toString(36).substr(2, 6).toUpperCase(),
        clientId: client.id,
        openedByOperatorId: user.id,
        ownerOperatorId: user.id,
        origin: 'Chamada Ativa',
        departmentId: protocolData.departmentId,
        categoryId: protocolData.categoryId,
        title: protocolData.title,
        description: protocolData.description,
        priority: protocolData.priority,
        status: ProtocolStatus.ABERTO,
        openedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActionAt: new Date().toISOString(),
        slaDueAt: new Date(Date.now() + PROTOCOL_SLA[protocolData.priority] * 3600000).toISOString()
      };
      await dataService.saveProtocol(p, user.id);
      pId = p.id;
    }

    await dataService.saveCall({
      id: Math.random().toString(36).substr(2, 9),
      taskId: currentTask.id,
      operatorId: user.id,
      clientId: client.id,
      startTime,
      endTime: new Date().toISOString(),
      duration: callDuration,
      reportTime: reportDuration,
      responses,
      type: currentTask.type,
      protocolId: pId
    });

    await dataService.updateTask(currentTask.id, { status: 'completed' });
    setIsFillingReport(false);
    setCallDuration(0);
    setReportDuration(0);
    fetchNext();
  };

  if (!currentTask) return <div className="p-20 text-center italic text-slate-400 font-bold">Fila Vazia</div>;

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex justify-between items-center animate-in slide-in-from-top-4 duration-500">
        <div className="space-y-2">
           <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{client?.name}</h2>
           <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-red-500" /> {client?.address}</span>
              <span className="flex items-center gap-1.5"><PhoneForwarded size={14} className="text-blue-500" /> {client?.phone}</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <span className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">{currentTask.type}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
           <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transition-all ${isCalling ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-300'}`}>
             <Clock size={32} />
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Duração</p>
           <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatTime(isCalling ? callDuration : reportDuration)}</p>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-center">
           {!isCalling && !isFillingReport ? (
             <button onClick={() => { setIsCalling(true); setStartTime(new Date().toISOString()); }} className="w-full py-10 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Iniciar Atendimento</button>
           ) : isCalling ? (
             <button onClick={() => { setIsCalling(false); setIsFillingReport(true); }} className="w-full py-10 bg-red-600 text-white rounded-[32px] font-black text-xl shadow-xl shadow-red-600/20 active:scale-95 transition-all">Encerrar Chamada</button>
           ) : (
             <div className="w-full space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Questionário do Operador</h3>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                   {dataService.getQuestions().filter(q => q.type === currentTask.type).map(q => (
                     <div key={q.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{q.text}</p>
                        <div className="flex flex-wrap gap-2">
                           {q.options.map(opt => (
                             <button key={opt} onClick={() => setResponses({...responses, [q.id]: opt})} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${responses[q.id] === opt ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100 text-slate-400'}`}>{opt}</button>
                           ))}
                        </div>
                     </div>
                   ))}

                   <div className={`p-6 rounded-3xl border-2 transition-all ${shouldOpenProtocol ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-red-600 font-black text-[10px] uppercase">
                            <ShieldAlert size={18} /> Abrir Protocolo?
                         </div>
                         <button onClick={() => setShouldOpenProtocol(!shouldOpenProtocol)} className={`w-12 h-6 rounded-full relative transition-all ${shouldOpenProtocol ? 'bg-red-600' : 'bg-slate-300'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shouldOpenProtocol ? 'left-7' : 'left-1'}`}></div>
                         </button>
                      </div>
                      {shouldOpenProtocol && (
                        <div className="mt-6 space-y-4 animate-in slide-in-from-top-2">
                           <input type="text" placeholder="Assunto do Problema..." value={protocolData.title} onChange={e => setProtocolData({...protocolData, title: e.target.value})} className="w-full p-3 bg-white border rounded-xl font-bold text-xs" />
                           <div className="grid grid-cols-2 gap-3">
                              <select value={protocolData.departmentId} onChange={e => setProtocolData({...protocolData, departmentId: e.target.value})} className="p-3 bg-white border rounded-xl text-[10px] font-black uppercase">
                                 {protocolConfig.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                              <select value={protocolData.priority} onChange={e => setProtocolData({...protocolData, priority: e.target.value as any})} className="p-3 bg-white border rounded-xl text-[10px] font-black uppercase">
                                 <option value="Baixa">Prioridade Baixa</option>
                                 <option value="Média">Prioridade Média</option>
                                 <option value="Alta">Prioridade Alta</option>
                              </select>
                           </div>
                           <textarea value={protocolData.description} onChange={e => setProtocolData({...protocolData, description: e.target.value})} placeholder="Relato completo do incidente..." className="w-full p-4 bg-white border rounded-xl text-xs h-24 resize-none" />
                        </div>
                      )}
                   </div>
                </div>

                <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all">Salvar e Concluir Tarefa</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Queue;
