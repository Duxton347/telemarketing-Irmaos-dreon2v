
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  X, Loader2, AlertCircle, TrendingUp, Target, Heart, Filter, PhoneOff, Zap, BarChart3, CheckCircle2, ClipboardList, Timer, Phone, Eye, Trophy, Clock, SkipForward, ArrowUpRight, Activity
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { CallRecord, User, Client, Protocol, Question, ProtocolStatus, Task, OperatorEvent, OperatorEventType } from '../types';

const Reports: React.FC<{ user: any }> = ({ user }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'protocols' | 'deep_dive' | 'operators'>('overview');
  const [startDate, setStartDate] = React.useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [operatorLogs, setOperatorLogs] = React.useState<OperatorEvent[]>([]);
  
  const [stageStats, setStageStats] = React.useState<any[]>([]);
  const [detailedStats, setDetailedStats] = React.useState<any>(null);
  const [consolidatedIDE, setConsolidatedIDE] = React.useState(0);

  const [drillDownData, setDrillDownData] = React.useState<{
    isOpen: boolean;
    title: string;
    filterLabel: string;
    data: any[];
    type: 'question' | 'protocol' | 'skip';
    selectedCallType?: string;
  }>({ isOpen: false, title: '', filterLabel: '', data: [], type: 'question' });

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allCalls, allProtocols, allClients, allUsers, allQuestions, allTasks, allEvents] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers(),
        dataService.getQuestions(),
        dataService.getTasks(),
        dataService.getOperatorEvents(startDate, endDate)
      ]);
      
      const fCalls = allCalls.filter(c => {
        const d = c.startTime?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });

      const fTasks = allTasks.filter(t => {
        const d = t.deadline?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });

      const fProtos = allProtocols.filter(p => {
        const d = p.openedAt?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });

      setCalls(fCalls);
      setProtocols(fProtos);
      setTasks(fTasks);
      setOperators(allUsers);
      setClients(allClients);
      setQuestions(allQuestions);
      setOperatorLogs(allEvents);
      
      setStageStats(await dataService.getStageAverages(fCalls));
      setDetailedStats(await dataService.getDetailedStats(fCalls, fProtos, fTasks));
      setConsolidatedIDE(await dataService.calculateIDE(fCalls));
    } catch (e) { 
      console.error("Erro Reports:", e); 
    } finally { setIsLoading(false); }
  }, [startDate, endDate]);

  React.useEffect(() => { load(); }, [load]);

  // CÁLCULO DO RANKING E INDICADORES DE OPERADOR (MÉTRICAS DE GAP E TMA)
  const operatorMetrics = React.useMemo(() => {
    if (!operators.length) return { ranking: [], tmaTimeline: [] };

    const opData: Record<string, any> = {};
    const tmaByDay: Record<string, { date: string, totalDur: number, count: number }> = {};

    operators.forEach(op => {
      if (op.role === 'ADMIN') return;
      
      const opEvents = operatorLogs.filter(e => e.operatorId === op.id);
      const opCalls = calls.filter(c => c.operatorId === op.id);
      const opCompleted = opCalls.length;
      const opSkips = tasks.filter(t => t.assignedTo === op.id && t.status === 'skipped').length;
      const totalAttempts = opCompleted + opSkips;

      // Calcular TMA (Tempo Médio de Atendimento)
      const totalCallDur = opCalls.reduce((acc, c) => acc + (c.duration || 0), 0);
      const avgTma = opCompleted > 0 ? totalCallDur / opCompleted : 0;

      // Timeline de TMA para o Gráfico de Curva
      opCalls.forEach(c => {
        const day = c.startTime.split('T')[0];
        if (!tmaByDay[day]) tmaByDay[day] = { date: day, totalDur: 0, count: 0 };
        tmaByDay[day].totalDur += (c.duration || 0);
        tmaByDay[day].count += 1;
      });

      // Calcular GAPs (Tempo entre FINALIZAR_ATENDIMENTO e próximo INICIAR ou PULAR)
      const gaps: number[] = [];
      let lastFinalizeTimestamp: number | null = null;

      // Ordenamos os eventos por tempo para garantir o cálculo correto do GAP
      const sortedEvents = [...opEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      sortedEvents.forEach(evt => {
        if (evt.eventType === OperatorEventType.FINALIZAR_ATENDIMENTO) {
          lastFinalizeTimestamp = new Date(evt.timestamp).getTime();
        } else if (lastFinalizeTimestamp && (evt.eventType === OperatorEventType.INICIAR_PROXIMO_ATENDIMENTO || evt.eventType === OperatorEventType.PULAR_ATENDIMENTO)) {
          const gapMs = new Date(evt.timestamp).getTime() - lastFinalizeTimestamp;
          // Consideramos GAPs de até 2 horas como válidos (acima disso pode ser almoço/fim de turno)
          if (gapMs > 0 && gapMs < 7200000) { 
            gaps.push(gapMs / 1000); // Em segundos
          }
          lastFinalizeTimestamp = null;
        }
      });

      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
      
      // Regra de Ranking: (Concluídos * 10) - (AvgGapMinutos * 5) - (TMA_Excedente_Penalidade)
      // Penaliza quem demora a iniciar a próxima ligação
      const score = (opCompleted * 10) - ((avgGap / 60) * 5);

      opData[op.id] = {
        id: op.id,
        name: op.name,
        completed: opCompleted,
        skips: opSkips,
        tma: Math.round(avgTma),
        skipPercentage: totalAttempts > 0 ? Math.round((opSkips / totalAttempts) * 100) : 0,
        avgGap: Math.round(avgGap),
        maxGap: Math.round(maxGap),
        score: Math.max(0, Math.round(score * 10) / 10)
      };
    });

    const ranking = Object.values(opData).sort((a, b) => b.score - a.score);
    const tmaTimeline = Object.values(tmaByDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        name: new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        tma: Math.round(d.totalDur / d.count)
      }));

    return { ranking, tmaTimeline };
  }, [operators, operatorLogs, calls, tasks]);

  const deduplicatedAnalysis = React.useMemo(() => {
    if (!detailedStats?.questionAnalysis) return [];
    const map = new Map();
    const normalizeText = (str: string) => str ? str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "") : "";
    detailedStats.questionAnalysis.forEach((q: any) => {
      const current = map.get(q.order);
      const textNorm = normalizeText(q.text);
      if (!current) map.set(q.order, q);
      else {
        const isCorrect7 = q.order === 7 && textNorm.includes('insatisfacao');
        const isCorrect8 = q.order === 8 && textNorm.includes('explorado');
        if (isCorrect7 || isCorrect8) map.set(q.order, q);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [detailedStats]);

  const openAuditGrid = (question: Question, value?: string) => {
    const filtered = calls.filter(c => {
      const resp = dataService.getResponseValue(c.responses, question);
      if (!value) return resp !== undefined;
      return String(resp).trim().toLowerCase() === value.trim().toLowerCase();
    }).map(c => ({
      ...c,
      client: clients.find(cl => cl.id === c.clientId),
      operator: operators.find(op => op.id === c.operatorId),
    }));
    setDrillDownData({ 
      isOpen: true, title: question.text, filterLabel: value || 'Todos os Registros', 
      data: filtered, type: 'question', selectedCallType: question.type === 'ALL' ? undefined : question.type
    });
  };

  const openProtocolDrillDown = (deptId: string, deptName: string) => {
    const filtered = protocols.filter(p => p.departmentId === deptId).map(p => ({
      ...p,
      client: clients.find(cl => cl.id === p.clientId),
      operator: operators.find(op => op.id === p.ownerOperatorId)
    }));
    setDrillDownData({ isOpen: true, title: `Protocolos: ${deptName}`, filterLabel: deptName, data: filtered, type: 'protocol' });
  };

  const openSkipDrillDown = (reason: string) => {
    const filtered = tasks.filter(t => t.status === 'skipped' && (t.skipReason || 'Não informado') === reason).map(t => ({
      ...t,
      client: clients.find(cl => cl.id === t.clientId),
      operator: operators.find(op => op.id === t.assignedTo)
    }));
    setDrillDownData({ isOpen: true, title: `Pulos Auditados: ${reason}`, filterLabel: reason, data: filtered, type: 'skip' });
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-8 pb-20 relative animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Relatórios Irmãos Dreon</h2>
          <p className="text-slate-500 font-bold mt-1">Inteligência operacional em tempo real.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-[24px] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
           {[
             { id: 'overview', label: 'Score Global', icon: Target },
             { id: 'operators', label: 'Operadores & Ranking', icon: Trophy },
             { id: 'protocols', label: 'Setores & Pulos', icon: Timer },
             { id: 'deep_dive', label: 'Métricas Detalhadas', icon: Zap }
           ].map(tab => (
             <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
             >
               <tab.icon size={14} /> {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-3 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro Temporal</label>
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
          </div>
        </div>
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-blue-50 p-6 rounded-[32px] text-center border border-blue-100">
              <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">IDE Global</p>
              <p className="text-3xl font-black text-blue-600">{consolidatedIDE}%</p>
           </div>
           <div className="bg-slate-900 p-6 rounded-[32px] text-center">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Amostragem Real</p>
              <p className="text-3xl font-black text-white">{calls.length}</p>
           </div>
           <div className="bg-red-50 p-6 rounded-[32px] text-center border border-red-100">
              <p className="text-[9px] font-black uppercase text-red-400 tracking-widest mb-1">Fugas/Pulos</p>
              <p className="text-3xl font-black text-red-600">{tasks.filter(t => t.status === 'skipped').length}</p>
           </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-300 gap-4">
          <Loader2 className="animate-spin" size={64} />
          <p className="font-black uppercase text-xs tracking-[0.3em]">Extraindo Inteligência de Dados...</p>
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-6 duration-700">
          
          {activeTab === 'operators' && (
            <div className="space-y-8">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* RANKING TABLE */}
                  <div className="lg:col-span-12 bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
                     <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={18} /> Ranking de Performance (Vendas + Agilidade)
                     </h4>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="border-b border-slate-100">
                                 <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Operador</th>
                                 <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">TMA</th>
                                 <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">GAP Transição</th>
                                 <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">Concluídos</th>
                                 <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">Pulos (%)</th>
                                 <th className="pb-6 text-[10px] font-black text-slate-900 uppercase tracking-widest px-4 text-right">Pontuação</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {operatorMetrics.ranking.map((op, i) => (
                                <tr key={op.id} className="group hover:bg-slate-50 transition-all">
                                   <td className="py-6 px-4">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{op.name.charAt(0)}</div>
                                         <span className="font-black text-slate-800">{op.name}</span>
                                      </div>
                                   </td>
                                   <td className="py-6 px-4 text-center">
                                      <span className="font-black text-slate-600 flex items-center justify-center gap-1"><Clock size={12} className="text-blue-400"/> {formatTime(op.tma)}</span>
                                   </td>
                                   <td className="py-6 px-4 text-center">
                                      <div className="flex flex-col items-center">
                                         <span className={`font-black flex items-center gap-1 ${op.avgGap > 120 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            <Timer size={12}/> {formatTime(op.avgGap)}
                                         </span>
                                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Pico: {formatTime(op.maxGap)}</span>
                                      </div>
                                   </td>
                                   <td className="py-6 px-4 text-center">
                                      <span className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-[11px] font-black">{op.completed}</span>
                                   </td>
                                   <td className="py-6 px-4 text-center">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${op.skipPercentage > 15 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>{op.skipPercentage}%</span>
                                   </td>
                                   <td className="py-6 px-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                         {i === 0 && <Trophy size={16} className="text-yellow-500 animate-bounce" />}
                                         <span className="text-2xl font-black text-slate-900">{op.score}</span>
                                      </div>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* TMA CURVE CHART */}
                  <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm">
                     <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-12 flex items-center gap-3">
                        <Activity className="text-blue-600" size={24} /> Curva de Tempo Médio de Atendimento (TMA)
                     </h4>
                     <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={operatorMetrics.tmaTimeline}>
                              <defs>
                                <linearGradient id="colorTma" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip cursor={{stroke: '#2563eb', strokeWidth: 1}} content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                                       <p className="text-[10px] font-black uppercase tracking-widest mb-2">{payload[0].payload.name}</p>
                                       <p className="text-xs font-bold text-blue-400">TMA Médio: {formatTime(payload[0].value as number)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }} />
                              <Area type="monotone" dataKey="tma" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorTma)" />
                           </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </div>

                  {/* GAP TRANSITION HISTOGRAM */}
                  <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm">
                     <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-12 flex items-center gap-3">
                        <Clock className="text-indigo-600" size={24} /> Eficiência de Engajamento (GAP Médio)
                     </h4>
                     <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={operatorMetrics.ranking}>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                              <YAxis hide />
                              <Tooltip cursor={{fill: '#f8fafc'}} content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                                       <p className="font-black text-[10px] uppercase mb-2">{d.name}</p>
                                       <p className="text-xs font-bold text-blue-400">Tempo de Espera: {formatTime(d.avgGap)}</p>
                                       <p className="text-[8px] uppercase font-black text-slate-400 mt-2">Menor é melhor</p>
                                    </div>
                                  );
                                }
                                return null;
                              }} />
                              <Bar dataKey="avgGap" radius={[12, 12, 12, 12]} barSize={40}>
                                 {operatorMetrics.ranking.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={entry.avgGap < 100 ? '#10b981' : entry.avgGap < 300 ? '#f59e0b' : '#ef4444'} />
                                 ))}
                              </Bar>
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-white p-12 rounded-[64px] shadow-sm border border-slate-100">
                 <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 mb-12">
                    <TrendingUp className="text-blue-600" size={24} /> Saúde Operacional por Estágio (IDE)
                 </h4>
                 {stageStats.length > 0 ? (
                   <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={stageStats}>
                            <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="percentage" radius={[16, 16, 16, 16]} barSize={45}>
                               {stageStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                 ) : (
                    <div className="h-[400px] flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Sem dados no período</div>
                 )}
              </div>
              <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[56px] text-white shadow-2xl flex flex-col justify-between">
                 <div>
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">IPM - Indice de Performance Médio</h5>
                    <div className="space-y-6">
                       <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-400">Total Ligações</span><span className="text-xl font-black text-blue-400">{calls.length}</span></div>
                       <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-400">Média TMA</span><span className="text-xl font-black text-white">{formatTime(calls.length > 0 ? calls.reduce((a,b)=>a+b.duration,0)/calls.length : 0)}</span></div>
                       <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-400">Taxa de Pulos</span><span className="text-xl font-black text-red-500">{tasks.length > 0 ? Math.round((tasks.filter(t=>t.status==='skipped').length/tasks.length)*100) : 0}%</span></div>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'deep_dive' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {deduplicatedAnalysis.map((q: any) => {
                 const baseQuestion = questions.find(base => base.id === q.id || base.text === q.text || base.order === q.order);
                 return (
                  <div key={q.id} className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col group hover:border-blue-200 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">IP: {q.positivity}%</div>
                        <span className="text-[10px] font-black text-slate-300">ORDEM {q.order}</span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 leading-tight mb-10 h-12 line-clamp-2">{q.text}</h4>
                      <div className="flex-1 space-y-6">
                         {q.distribution.map((d: any, idx: number) => {
                            const normalizeValue = (s: string) => s ? s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "") : "";
                            const normName = normalizeValue(d.name);
                            const isExcellent = ['sim', 'otimo', 'atendeu', 'no prazo', 'boa', 'alto', 'quimicos', 'fotovoltaico', 'aquecedores'].includes(normName);
                            const isBad = ['nao', 'ruim', 'precisa melhorar', 'com problema', 'baixo', 'não, cliente perdido'].includes(normName);
                            const colorClass = isExcellent ? 'bg-emerald-500' : isBad ? 'bg-red-500' : 'bg-amber-500';
                            const percentage = q.responsesCount > 0 ? (d.value / q.responsesCount) * 100 : 0;
                            return (
                               <div key={idx} className="space-y-2 group/item cursor-pointer" onClick={() => baseQuestion && openAuditGrid(baseQuestion, d.name)}>
                                  <div className="flex items-center justify-between">
                                     <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{d.name}</span>
                                     <span className="text-[12px] font-black text-slate-900">{d.value}</span>
                                  </div>
                                  <div className="w-full h-3.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                     <div className={`h-full ${colorClass} transition-all duration-1000 shadow-sm`} style={{ width: `${percentage}%` }}></div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                  </div>
                 );
               })}
            </div>
          )}

          {activeTab === 'protocols' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2"><ClipboardList className="text-blue-500" size={18} /> Protocolos por Setor</h4>
                  <div className="h-80">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detailedStats?.protocolCategoryStats} onClick={(d: any) => d?.activePayload?.[0] && openProtocolDrillDown(d.activePayload[0].payload.id, d.activePayload[0].payload.name)}>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                           <Tooltip cursor={{fill: '#f8fafc'}} />
                           <Bar dataKey="value" fill="#2563eb" radius={[12, 12, 0, 0]} barSize={40} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               
               <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2"><PhoneOff className="text-red-500" size={18} /> Motivos de Pulos (Skips)</h4>
                  <div className="h-80">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detailedStats?.skipStats} onClick={(d: any) => d?.activePayload?.[0] && openSkipDrillDown(d.activePayload[0].payload.name)}>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                           <Tooltip cursor={{fill: '#f8fafc'}} />
                           <Bar dataKey="value" fill="#ef4444" radius={[12, 12, 0, 0]} barSize={40} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* AUDIT MODAL */}
      {drillDownData.isOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-2 md:p-8">
           <div className="bg-white w-full h-full max-w-[98vw] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl">ID</div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Auditoria Dreon</h3>
                      <p className="text-blue-400 text-[10px] font-black uppercase mt-1 tracking-[0.2em]">{drillDownData.title} &bull; <span className="text-white">{drillDownData.filterLabel}</span></p>
                    </div>
                 </div>
                 <button onClick={() => setDrillDownData({ ...drillDownData, isOpen: false })} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={28} /></button>
              </div>
              
              <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar">
                 {drillDownData.data.length > 0 ? (
                   <div className="p-4 md:p-8 min-w-max">
                    <table className="w-full text-left border-separate border-spacing-0 bg-white rounded-3xl shadow-sm border border-slate-200">
                        <thead>
                          <tr className="bg-slate-50">
                              <th className="sticky left-0 bg-slate-50 z-20 py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Cliente</th>
                              <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Operador</th>
                              <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Tipo</th>
                              <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Data</th>
                              {drillDownData.type === 'question' && questions
                                .filter(q => !drillDownData.selectedCallType || q.type === drillDownData.selectedCallType || q.type === 'ALL')
                                .map(q => (
                                  <th key={q.id} className="py-5 px-6 text-[10px] font-black uppercase text-blue-600 tracking-widest border-b border-slate-200 min-w-[200px] bg-blue-50/20">{q.text}</th>
                              ))}
                              {drillDownData.type === 'protocol' && <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Status</th>}
                              {drillDownData.type === 'skip' && <th className="py-5 px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">Motivo Pulo</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {drillDownData.data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 py-5 px-6 border-r border-slate-50">
                                   <p className="font-black text-slate-800 text-sm">{item.client?.name || item.clients?.name || 'Manual'}</p>
                                   <span className="text-[10px] font-bold text-blue-600">{item.client?.phone || item.clients?.phone}</span>
                                </td>
                                <td className="py-5 px-6">
                                  <span className="font-bold text-slate-600 text-xs">@{item.operator?.name || item.profiles?.username_display}</span>
                                </td>
                                <td className="py-5 px-6">
                                  <span className="px-2 py-1 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-500">{item.type || 'CHAMADA'}</span>
                                </td>
                                <td className="py-5 px-6 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                  {new Date(item.startTime || item.openedAt || item.deadline).toLocaleString('pt-BR')}
                                </td>
                                {drillDownData.type === 'question' && questions
                                  .filter(q => !drillDownData.selectedCallType || q.type === drillDownData.selectedCallType || q.type === 'ALL')
                                  .map(q => {
                                    const ans = dataService.getResponseValue(item.responses, q);
                                    return (
                                      <td key={q.id} className="py-5 px-6 bg-slate-50/10 text-[9px] font-black uppercase text-slate-600">{ans || '-'}</td>
                                    );
                                })}
                                {drillDownData.type === 'protocol' && (
                                  <td className="py-5 px-6"><span className="bg-slate-900 text-white px-3 py-1 rounded-md text-[9px] font-black uppercase">{item.status}</span></td>
                                )}
                                {drillDownData.type === 'skip' && (
                                  <td className="py-5 px-6 font-bold text-red-500 italic text-xs">{item.skipReason}</td>
                                )}
                            </tr>
                          ))}
                        </tbody>
                    </table>
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <AlertCircle size={64} className="animate-pulse" />
                      <p className="font-black uppercase text-xs mt-6 tracking-[0.3em]">Nenhum registro encontrado.</p>
                   </div>
                 )}
              </div>
              <div className="p-8 bg-white border-t border-slate-100 flex justify-end">
                 <button onClick={() => setDrillDownData({ ...drillDownData, isOpen: false })} className="px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all">Fechar Auditoria</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
