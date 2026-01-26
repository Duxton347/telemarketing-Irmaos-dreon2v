
import React from 'react';
import { 
  Play, PhoneForwarded, Clock, MapPin, Box, 
  Save, ShieldAlert, PhoneOff, MessageSquare,
  ClipboardList, Package, FileText, Copy, ExternalLink
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { PROTOCOL_SLA } from '../constants';
import { CallType, Client, Task, Protocol, ProtocolStatus } from '../types';

const Queue: React.FC<{ user: any }> = ({ user }) => {
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [isCalling, setIsCalling] = React.useState(false);
  const [isFillingReport, setIsFillingReport] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [reportDuration, setReportDuration] = React.useState(0);
  const [startTime, setStartTime] = React.useState<string>('');
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [callSummary, setCallSummary] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  
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

  const fetchNext = async () => {
    const allTasks = await dataService.getTasks();
    const tasks = allTasks.filter(t => t.assignedTo === user.id && t.status === 'pending');
    if (tasks.length > 0) {
      const task = tasks[0];
      const allClients = await dataService.getClients();
      const foundClient = allClients.find(c => c.id === task.clientId);
      setCurrentTask(task);
      setClient(foundClient || null);
      setResponses({});
      setCallSummary('');
      setShouldOpenProtocol(false);
      setProtocolData({ 
        title: '', 
        departmentId: protocolConfig.departments[0]?.id || '', 
        categoryId: protocolConfig.categories[0]?.id || '', 
        description: '', 
        priority: 'Média' 
      });
    } else {
      setCurrentTask(null);
      setClient(null);
    }
  };

  React.useEffect(() => { fetchNext(); }, [user]);

  React.useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else if (isFillingReport) {
      timerRef.current = setInterval(() => setReportDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
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

    // Inclui o sumário geral nas respostas
    const finalResponses = { ...responses, _call_summary: callSummary };

    await dataService.saveCall({
      id: Math.random().toString(36).substr(2, 9),
      taskId: currentTask.id,
      operatorId: user.id,
      clientId: client.id,
      startTime,
      endTime: new Date().toISOString(),
      duration: callDuration,
      reportTime: reportDuration,
      responses: finalResponses,
      type: currentTask.type,
      protocolId: pId
    });

    await dataService.updateTask(currentTask.id, { status: 'completed' });
    setIsFillingReport(false);
    setCallDuration(0);
    setReportDuration(0);
    fetchNext();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (!currentTask) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
      <ClipboardList size={64} className="text-slate-300" />
      <p className="text-lg font-black uppercase tracking-widest text-slate-400">Nenhuma tarefa pendente na fila</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header do Cliente */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
           <div className="flex items-center gap-3">
             <span className="bg-slate-900 text-white px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.2em]">{currentTask.type}</span>
             <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{client?.name}</h2>
           </div>
           <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-red-500" /> {client?.address}</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <PhoneForwarded size={14} /> {client?.phone}
                </span>
                <button 
                  onClick={() => copyToClipboard(client?.phone || '')}
                  title="Copiar número"
                  className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                >
                  <Copy size={12} />
                </button>
                <button 
                  onClick={() => openWhatsApp(client?.phone || '')}
                  title="Abrir no WhatsApp"
                  className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                >
                  <MessageSquare size={12} />
                </button>
              </div>
           </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
           <div className={`p-3 rounded-2xl flex items-center justify-center ${isCalling ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-white text-slate-400'}`}>
             <Clock size={20} />
           </div>
           <div className="pr-4">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tempo em {isCalling ? 'Linha' : 'Relatório'}</p>
             <p className="text-xl font-black text-slate-800 font-mono tracking-tighter">{formatTime(isCalling ? callDuration : reportDuration)}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Scripts e Perguntas */}
        <div className="lg:col-span-8 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
           <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3">
                 <FileText size={18} className="text-blue-400" /> Roteiro de Atendimento
              </h3>
              {!isCalling && !isFillingReport && (
                 <span className="text-[10px] font-bold text-slate-400 uppercase">Aguardando Início</span>
              )}
           </div>

           <div className="flex-1 p-8 space-y-6 relative">
              {(!isCalling && !isFillingReport) ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
                   <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mb-2">
                      <Play size={32} />
                   </div>
                   <div>
                      <h4 className="text-xl font-black text-slate-800 tracking-tight">Pronto para começar?</h4>
                      <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">Clique no botão abaixo para disparar o cronômetro e liberar o questionário.</p>
                   </div>
                   <button 
                     onClick={() => { setIsCalling(true); setStartTime(new Date().toISOString()); }} 
                     className="px-12 py-5 bg-blue-600 text-white rounded-[32px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"
                   >
                     Iniciar Atendimento
                   </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500 pb-10">
                   {/* Perguntas Dinâmicas */}
                   <div className="space-y-4">
                      {dataService.getQuestions().filter(q => q.type === currentTask.type || q.type === 'ALL').map(q => (
                        <div key={q.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 hover:border-blue-100 transition-colors">
                           <p className="text-xs font-black text-slate-600 uppercase tracking-tight">{q.text}</p>
                           <div className="flex flex-wrap gap-2">
                              {q.options.map(opt => (
                                <button 
                                  key={opt} 
                                  onClick={() => setResponses({...responses, [q.id]: opt})} 
                                  className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-tight transition-all ${responses[q.id] === opt ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                >
                                  {opt}
                                </button>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>

                   {/* Resumo de Produtos do Cliente */}
                   <div className="p-8 bg-slate-900 rounded-[32px] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-3 text-blue-400">
                         <Package size={20} />
                         <h4 className="text-[10px] font-black uppercase tracking-widest">Itens Vinculados ao Cliente</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         {client?.items && client.items.length > 0 ? client.items.map((item, idx) => (
                           <span key={idx} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700">
                             {item}
                           </span>
                         )) : <p className="text-xs text-slate-500 italic">Nenhum produto cadastrado para este cliente.</p>}
                      </div>
                   </div>

                   {/* Relatório Descritivo Final */}
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-400">
                         <MessageSquare size={18} />
                         <label className="text-[10px] font-black uppercase tracking-widest">Observações e Relato da Chamada</label>
                      </div>
                      <textarea 
                        value={callSummary}
                        onChange={e => setCallSummary(e.target.value)}
                        placeholder="Escreva aqui um breve resumo do que foi conversado ou observações importantes..."
                        className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] font-medium text-sm text-slate-700 h-32 outline-none focus:border-blue-100 transition-all resize-none shadow-inner"
                      />
                   </div>

                   {/* Ação de Status */}
                   {isCalling && (
                     <button 
                       onClick={() => { setIsCalling(false); setIsFillingReport(true); }} 
                       className="w-full py-6 bg-red-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                     >
                       <PhoneOff size={20} /> Encerrar Ligação e Finalizar Relatório
                     </button>
                   )}

                   {isFillingReport && (
                     <button 
                       onClick={handleSave} 
                       className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                     >
                       <Save size={20} /> Salvar e Concluir Atendimento
                     </button>
                   )}
                </div>
              )}
           </div>
        </div>

        {/* Lateral de Protocolo */}
        <div className="lg:col-span-4 space-y-6">
           <div className={`p-8 rounded-[40px] border-2 transition-all h-fit ${shouldOpenProtocol ? 'bg-red-50 border-red-200 shadow-xl' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${shouldOpenProtocol ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                       <ShieldAlert size={24} />
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Protocolo</h4>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Abrir incidente?</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShouldOpenProtocol(!shouldOpenProtocol)} 
                   disabled={!isCalling && !isFillingReport}
                   className={`w-14 h-8 rounded-full relative transition-all shadow-inner disabled:opacity-30 ${shouldOpenProtocol ? 'bg-red-600' : 'bg-slate-200'}`}
                 >
                    <div className={`absolute top-1.5 w-5 h-5 bg-white rounded-full transition-all shadow-md ${shouldOpenProtocol ? 'left-8' : 'left-1.5'}`}></div>
                 </button>
              </div>

              {shouldOpenProtocol && (
                <div className="space-y-5 animate-in slide-in-from-top-4 duration-300">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Problema</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Piscina vazando..." 
                        value={protocolData.title} 
                        onChange={e => setProtocolData({...protocolData, title: e.target.value})} 
                        className="w-full p-4 bg-white border border-red-100 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
                      />
                   </div>
                   
                   <div className="grid grid-cols-1 gap-4">
                      <select 
                        value={protocolData.departmentId} 
                        onChange={e => setProtocolData({...protocolData, departmentId: e.target.value})} 
                        className="p-4 bg-white border border-red-100 rounded-2xl font-black text-[10px] uppercase cursor-pointer outline-none"
                      >
                         {protocolConfig.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select 
                        value={protocolData.priority} 
                        onChange={e => setProtocolData({...protocolData, priority: e.target.value as any})} 
                        className="p-4 bg-white border border-red-100 rounded-2xl font-black text-[10px] uppercase cursor-pointer outline-none"
                      >
                         <option value="Baixa">Baixa</option>
                         <option value="Média">Média</option>
                         <option value="Alta">Alta</option>
                      </select>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Relato do Problema</label>
                      <textarea 
                        value={protocolData.description} 
                        onChange={e => setProtocolData({...protocolData, description: e.target.value})} 
                        placeholder="Descreva detalhadamente a reclamação do cliente..." 
                        className="w-full p-4 bg-white border border-red-100 rounded-2xl text-xs h-32 resize-none outline-none focus:ring-4 focus:ring-red-500/10" 
                      />
                   </div>
                </div>
              )}
           </div>

           <div className="p-8 bg-blue-600 rounded-[40px] text-white shadow-xl shadow-blue-500/20">
              <h5 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4 text-center">Apoio Dreon</h5>
              <p className="text-[11px] font-bold leading-relaxed text-center italic">
                "O foco do pós-venda não é apenas resolver problemas, mas garantir que a experiência Dreon seja inesquecível."
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Queue;
