
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Calendar, TrendingUp, Layout, Award, AlertCircle, Download, Clock, ShieldCheck,
  Search, Users, ChevronRight, MessageSquare, ThumbsUp, DollarSign
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { UserRole, CallType, CallRecord, User, Client, Protocol, ProtocolStatus } from '../types';

const Reports: React.FC<{ user: any }> = ({ user }) => {
  if (!user) return <div className="p-20 text-center font-black uppercase text-slate-300">Carregando Relatórios...</div>;

  const [activeTab, setActiveTab] = React.useState<'overview' | 'questions' | 'protocols'>('overview');
  const [startDate, setStartDate] = React.useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [filterOp, setFilterOp] = React.useState<string>(user?.role === UserRole.OPERATOR ? user?.id : 'all');
  const [filterClient, setFilterClient] = React.useState<string>('all');
  
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [allProtocols, setAllProtocols] = React.useState<Protocol[]>([]);
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [ide, setIde] = React.useState(0);
  const [stageAverages, setStageAverages] = React.useState<any[]>([]);
  const [detailedStats, setDetailedStats] = React.useState<any>(null);

  // Correctly await asynchronous calls in load callback
  const load = React.useCallback(async () => {
    try {
      const [allCalls, protocols, allClients, allUsers] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers()
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

      setCalls(filteredCalls);
      setAllProtocols(filteredProtocols);
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

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Analytics Dreon</h2>
          <p className="text-slate-500 text-sm font-medium">Relatórios intuitivos e dados granulares para decisão.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
           <button onClick={() => setActiveTab('overview')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Desempenho Geral</button>
           <button onClick={() => setActiveTab('questions')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'questions' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Voz do Cliente (Perguntas)</button>
           <button onClick={() => setActiveTab('protocols')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'protocols' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Resolutividade (Protocolos)</button>
        </div>
      </header>

      {/* FILTROS AVANÇADOS */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">De / Até</label>
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operador Responsável</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <select value={filterOp} onChange={e => setFilterOp(e.target.value)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer">
              <option value="all">Time Completo</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente Específico</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer">
              <option value="all">Todos os Clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xl animate-in zoom-in duration-300">
           <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Índice IDE</span>
              <span className="text-2xl font-black text-blue-400 leading-none mt-1">{ide}</span>
           </div>
           <TrendingUp size={24} className="text-blue-500 opacity-30" />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <Layout className="text-blue-600" size={20} /> Pipeline de Satisfação (IDE)
                  </h3>
               </div>
               <div className="space-y-8">
                  {stageAverages.map((s, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between text-[11px] font-black uppercase tracking-tight">
                          <span className="text-slate-500">{s.stage}</span>
                          <span className="text-slate-900">{s.percentage}%</span>
                       </div>
                       <div className="h-4 bg-slate-50 rounded-full overflow-hidden flex shadow-inner border border-slate-100">
                          <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${s.percentage}%`, backgroundColor: s.color }}></div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col">
               <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 flex items-center gap-3">
                 <TrendingUp className="text-indigo-600" size={20} /> Evolução Histórica (Score)
               </h3>
               <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={ideTrend}>
                        <defs>
                          <linearGradient id="colorIde" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                        <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
                        <Area type="monotone" dataKey="ide" stroke="#2563eb" fillOpacity={1} fill="url(#colorIde)" strokeWidth={4} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {detailedStats?.questionAnalysis.length > 0 ? detailedStats.questionAnalysis.map((q: any) => (
            <div key={q.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col hover:shadow-xl transition-all">
               <div className="mb-6">
                  <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black uppercase rounded-lg tracking-widest mb-3 inline-block">{q.type}</span>
                  <h4 className="text-sm font-black text-slate-800 leading-tight mb-2">{q.text}</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{Math.round(q.avgScore)}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Satisfação Média</span>
                  </div>
               </div>
               
               <div className="flex-1 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.distribution} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: '800'}} width={80} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={14}>
                          {q.distribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Ótimo' || entry.name === 'Sim' || entry.name === 'No prazo' || entry.name === 'Atendeu' || entry.name === 'Boa' ? '#10b981' : entry.name.includes('Atraso') || entry.name.includes('problema') || entry.name === 'Não' || entry.name === 'Ruim' ? '#ef4444' : '#f59e0b'} />
                          ))}
                       </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-4 text-center">{q.responsesCount} respostas coletadas</p>
            </div>
          )) : (
            <div className="col-span-full py-40 text-center opacity-20">
              <MessageSquare size={80} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest">Nenhuma resposta encontrada para este filtro.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'protocols' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 self-start flex items-center gap-3">
                    <ThumbsUp size={20} className="text-green-600" /> Nível de Satisfação Pós-Resolução
                 </h3>
                 <div className="w-full h-64">
                    {detailedStats?.resolutionStats.satisfaction.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detailedStats.resolutionStats.satisfaction} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={10} dataKey="value">
                             {detailedStats.resolutionStats.satisfaction.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'Boa' ? '#10b981' : entry.name === 'Regular' ? '#f59e0b' : '#ef4444'} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '24px', border: 'none'}} />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center italic text-slate-300">Sem dados de confirmação</div>}
                 </div>
              </div>

              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-10 self-start flex items-center gap-3">
                    <DollarSign size={20} className="text-blue-600" /> Taxa de Retorno à Compra (Pós-Protocolo)
                 </h3>
                 <div className="w-full h-64">
                    {detailedStats?.resolutionStats.repurchase.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detailedStats.resolutionStats.repurchase} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={10} dataKey="value">
                             {detailedStats.resolutionStats.repurchase.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'Sim' ? '#2563eb' : '#94a3b8'} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '24px', border: 'none'}} />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center italic text-slate-300">Sem dados de recompra</div>}
                 </div>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3">
                 <ShieldCheck size={20} className="text-indigo-600" /> Resumo de Protocolos Encerrados
              </h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-slate-100">
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assunto</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolução</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {allProtocols.filter(p => p.status === ProtocolStatus.FECHADO).map(p => (
                          <tr key={p.id} className="group hover:bg-slate-50 transition-all">
                             <td className="py-4 font-black text-xs text-slate-300">#{p.id}</td>
                             <td className="py-4 font-black text-xs text-slate-800">{p.title}</td>
                             <td className="py-4 text-xs font-bold text-slate-500">{clients.find(c => c.id === p.clientId)?.name || 'Manual'}</td>
                             <td className="py-4 text-xs font-medium text-slate-400 italic max-w-xs truncate">{p.resolutionSummary}</td>
                          </tr>
                       ))}
                       {allProtocols.filter(p => p.status === ProtocolStatus.FECHADO).length === 0 && (
                         <tr><td colSpan={4} className="py-10 text-center text-slate-300 italic">Sem registros neste filtro.</td></tr>
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
