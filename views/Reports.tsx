
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Calendar, TrendingUp, Layout, Award, AlertCircle, Download, Clock, ShieldCheck,
  Search, Users, ChevronRight, MessageSquare, ThumbsUp, DollarSign, SkipForward,
  Filter, FileText
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { UserRole, CallType, CallRecord, User, Client, Protocol, ProtocolStatus, Task } from '../types';

const Reports: React.FC<{ user: any }> = ({ user }) => {
  if (!user) return <div className="p-20 text-center font-black uppercase text-slate-300">Carregando Analytics...</div>;

  const [activeTab, setActiveTab] = React.useState<'overview' | 'questions' | 'protocols' | 'skips'>('overview');
  const [startDate, setStartDate] = React.useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [filterOp, setFilterOp] = React.useState<string>(user?.role === UserRole.OPERATOR ? user?.id : 'all');
  const [filterClient, setFilterClient] = React.useState<string>('all');
  
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [allProtocols, setAllProtocols] = React.useState<Protocol[]>([]);
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [ide, setIde] = React.useState(0);
  const [stageAverages, setStageAverages] = React.useState<any[]>([]);
  const [detailedStats, setDetailedStats] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    try {
      const [allCalls, protocols, allClients, allUsers, allTasks] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers(),
        dataService.getTasks()
      ]);
      
      const filteredCalls = allCalls.filter(c => {
        if (!c || !c.startTime) return false;
        const date = c.startTime.split('T')[0];
        const matchDate = date >= startDate && date <= endDate;
        const matchOp = filterOp === 'all' || c.operatorId === filterOp;
        const matchClient = filterClient === 'all' || c.clientId === filterClient;
        return matchDate && matchOp && matchClient;
      });

      const filteredProtocols = protocols.filter(p => {
        const date = p.openedAt.split('T')[0];
        const matchDate = date >= startDate && date <= endDate;
        const matchOp = filterOp === 'all' || p.ownerOperatorId === filterOp || p.openedByOperatorId === filterOp;
        const matchClient = filterClient === 'all' || p.clientId === filterClient;
        return matchDate && matchOp && matchClient;
      });

      const filteredTasks = allTasks.filter(t => {
        const matchOp = filterOp === 'all' || t.assignedTo === filterOp;
        const matchClient = filterClient === 'all' || t.clientId === filterClient;
        return matchOp && matchClient;
      });

      setCalls(filteredCalls);
      setAllProtocols(filteredProtocols);
      setTasks(filteredTasks);
      setOperators(allUsers.filter(u => u && u.role === UserRole.OPERATOR));
      setClients(allClients);
      setIde(dataService.calculateIDE(filteredCalls));
      setStageAverages(dataService.getStageAverages(filteredCalls));
      setDetailedStats(dataService.getDetailedStats(filteredCalls, filteredProtocols));
    } catch (e) {
      console.error("Erro ao carregar relatórios:", e);
    }
  }, [startDate, endDate, filterOp, filterClient]);

  React.useEffect(() => { load(); }, [load]);

  const ideTrend = React.useMemo(() => {
    const map: Record<string, CallRecord[]> = {};
    calls.forEach(c => {
      const d = c.startTime.split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(c);
    });
    return Object.entries(map).map(([date, dayCalls]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      ide: dataService.calculateIDE(dayCalls)
    })).sort((a,b) => a.date.localeCompare(b.date));
  }, [calls]);

  const skippedData = React.useMemo(() => {
    const skips = tasks.filter(t => t.status === 'skipped');
    const reasons: Record<string, number> = {};
    skips.forEach(s => {
      const r = s.skipReason || 'Sem Motivo';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    return Object.entries(reasons).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  return (
    <div className="space-y-6 pb-20 max-w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Business Analytics Dreon</h2>
          <p className="text-slate-500 text-sm font-medium">Relatórios críticos e inteligência de dados operacionais.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
           <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Visão Geral</button>
           <button onClick={() => setActiveTab('questions')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'questions' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Voz do Cliente</button>
           <button onClick={() => setActiveTab('protocols')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'protocols' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Protocolos</button>
           <button onClick={() => setActiveTab('skips')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'skips' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Descartes (Skips)</button>
        </div>
      </header>

      {/* FILTROS AVANÇADOS */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Período de Análise</label>
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro por Colaborador</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <select value={filterOp} onChange={e => setFilterOp(e.target.value)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer">
              <option value="all">Fila Geral</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente Específico</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer">
              <option value="all">Base Completa</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-xl animate-in zoom-in">
           <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">Score IDE Dreon</span>
              <span className="text-3xl font-black text-blue-400 leading-none mt-1">{ide}%</span>
           </div>
           <Award size={32} className="text-blue-500 opacity-20" />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
          <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm">
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 flex items-center gap-3">
               <TrendingUp className="text-blue-600" size={24} /> Desempenho por Estágio de Compra
             </h3>
             <div className="space-y-10">
                {stageAverages.map((s, i) => (
                  <div key={i} className="space-y-3">
                     <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">{s.stage}</span>
                        <span className="text-slate-900">{s.percentage}%</span>
                     </div>
                     <div className="h-6 bg-slate-50 rounded-full overflow-hidden flex shadow-inner border border-slate-100">
                        <div className="h-full transition-all duration-1000 ease-out shadow-2xl" style={{ width: `${s.percentage}%`, backgroundColor: s.color }}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col">
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 flex items-center gap-3">
               <Calendar className="text-indigo-600" size={24} /> Evolução Diária de Qualidade
             </h3>
             <div className="flex-1 min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={ideTrend}>
                      <defs>
                        <linearGradient id="colorIde" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                      <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
                      <Area type="monotone" dataKey="ide" stroke="#2563eb" fillOpacity={1} fill="url(#colorIde)" strokeWidth={5} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
          {detailedStats?.questionAnalysis.map((q: any) => (
            <div key={q.id} className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col hover:-translate-y-1 transition-all">
               <div className="mb-8">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg tracking-widest mb-4 inline-block">{q.type}</span>
                  <h4 className="text-lg font-black text-slate-800 leading-tight mb-4">{q.text}</h4>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl font-black text-slate-900">{Math.round(q.avgScore)}%</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aprovação<br/>Geral</div>
                  </div>
               </div>
               
               <div className="flex-1 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.distribution} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: '900'}} width={100} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Bar dataKey="value" fill="#2563eb" radius={[0, 12, 12, 0]} barSize={20}>
                          {q.distribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Ótimo' || entry.name === 'Sim' || entry.name === 'No prazo' || entry.name === 'Atendeu' || entry.name === 'Boa' ? '#10b981' : entry.name.includes('Atraso') || entry.name.includes('problema') || entry.name === 'Não' || entry.name === 'Ruim' ? '#ef4444' : '#f59e0b'} />
                          ))}
                       </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="mt-6 flex justify-between items-center border-t border-slate-50 pt-4">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{q.responsesCount} amostras</span>
                  <Award size={18} className="text-slate-100" />
               </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'skips' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 self-start flex items-center gap-3">
                    <SkipForward size={24} className="text-red-600" /> Motivos de Descarte de Tarefas
                 </h3>
                 <div className="w-full h-[400px]">
                    {skippedData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie 
                              data={skippedData} 
                              cx="50%" 
                              cy="50%" 
                              innerRadius={100} 
                              outerRadius={140} 
                              paddingAngle={5} 
                              dataKey="value"
                            >
                               {skippedData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6366f1'][index % 5]} />
                               ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '24px', border: 'none'}} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" />
                         </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-20">
                         <SkipForward size={80} />
                         <p className="font-black uppercase tracking-widest text-sm mt-4">Nenhum descarte registrado</p>
                      </div>
                    )}
                 </div>
              </div>

              <div className="bg-slate-900 p-12 rounded-[56px] text-white shadow-2xl">
                 <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-3">
                    <FileText size={24} className="text-blue-400" /> Histórico Analítico de Descartes
                 </h3>
                 <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                    {tasks.filter(t => t.status === 'skipped').map(t => (
                      <div key={t.id} className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
                         <div className="flex justify-between items-start mb-2">
                            <span className="font-black text-sm text-white">{clients.find(c => c.id === t.clientId)?.name}</span>
                            <span className="px-2 py-0.5 bg-red-600 rounded text-[8px] font-black uppercase">{t.type}</span>
                         </div>
                         <p className="text-xs text-blue-400 font-bold mb-3 flex items-center gap-2">
                           <SkipForward size={12} /> {t.skipReason}
                         </p>
                         <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                            <span>Op: {operators.find(o => o.id === t.assignedTo)?.name}</span>
                            <span>ID: {t.id.substring(0,8)}</span>
                         </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.status === 'skipped').length === 0 && (
                      <p className="text-center text-slate-500 italic py-20 uppercase font-black tracking-widest text-[10px]">Sem dados para exibir</p>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'protocols' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 self-start flex items-center gap-3">
                    <ThumbsUp size={24} className="text-green-600" /> Satisfação Pós-Resolução
                 </h3>
                 <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={detailedStats?.resolutionStats.satisfaction} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={10} dataKey="value">
                           {detailedStats?.resolutionStats.satisfaction.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Boa' ? '#10b981' : entry.name === 'Regular' ? '#f59e0b' : '#ef4444'} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '24px', border: 'none'}} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 self-start flex items-center gap-3">
                    <DollarSign size={24} className="text-blue-600" /> Taxa de Recompra (Pós-Incidente)
                 </h3>
                 <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={detailedStats?.resolutionStats.repurchase} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={10} dataKey="value">
                           {detailedStats?.resolutionStats.repurchase.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Sim' ? '#2563eb' : '#94a3b8'} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '24px', border: 'none'}} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm overflow-hidden">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3">
                 <ShieldCheck size={24} className="text-indigo-600" /> Relatório Consolidado de Soluções
              </h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b-2 border-slate-100">
                          <th className="py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo</th>
                          <th className="py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entidade / Assunto</th>
                          <th className="py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duração Total</th>
                          <th className="py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Desfecho Técnico</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {allProtocols.filter(p => p.status === ProtocolStatus.FECHADO).map(p => (
                          <tr key={p.id} className="group hover:bg-slate-50 transition-all">
                             <td className="py-6 px-4 font-black text-xs text-slate-300">#{p.protocolNumber || p.id.substring(0,8)}</td>
                             <td className="py-6 px-4">
                                <p className="font-black text-sm text-slate-800">{p.title}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{clients.find(c => c.id === p.clientId)?.name}</p>
                             </td>
                             <td className="py-6 px-4">
                                <span className="text-xs font-black text-slate-600 flex items-center gap-2"><Clock size={12} /> {Math.round((new Date(p.closedAt || '').getTime() - new Date(p.openedAt).getTime()) / 3600000)}h</span>
                             </td>
                             <td className="py-6 px-4">
                                <div className="p-4 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-500 italic border border-slate-100">
                                   {p.resolutionSummary}
                                </div>
                             </td>
                          </tr>
                       ))}
                       {allProtocols.filter(p => p.status === ProtocolStatus.FECHADO).length === 0 && (
                         <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic font-black uppercase tracking-widest text-[10px]">Sem protocolos encerrados para os filtros atuais.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
