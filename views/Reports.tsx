
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, Legend, PieChart, Pie
} from 'recharts';
import { 
  X, Loader2, TrendingUp, Target, Zap, BarChart3, CheckCircle2, 
  ClipboardList, Timer, Phone, Trophy, Clock, FileSpreadsheet, 
  Filter, Users, Wrench, ShoppingBag, Heart, AlertTriangle
} from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import { CallRecord, User, Client, Protocol, Question, ProtocolStatus, CallType, Prospect, UserRole } from '../types.ts';

const Reports: React.FC<{ user: any }> = ({ user }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<CallType | 'TODOS'>('TODOS');
  const [startDate, setStartDate] = React.useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [questions, setQuestions] = React.useState<Question[]>([]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allCalls, allProtocols, allClients, allUsers, allQuestions, allProspects] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getUsers(),
        dataService.getQuestions(),
        dataService.getProspects()
      ]);
      
      const filteredCalls = allCalls.filter(c => {
        const d = c.startTime?.split('T')[0];
        const matchesDate = d && d >= startDate && d <= endDate;
        const matchesType = selectedType === 'TODOS' || c.type === selectedType;
        return matchesDate && matchesType;
      });

      const filteredProtos = allProtocols.filter(p => {
        const d = p.openedAt?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });

      setCalls(filteredCalls);
      setProtocols(filteredProtos);
      setClients(allClients);
      setOperators(allUsers);
      setQuestions(allQuestions);
      setProspects(allProspects);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedType]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const canExport = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALISTA_MARKETING].includes(user.role);

  const handleExport = () => {
    if (!canExport || calls.length === 0) return;
    setIsExporting(true);
    
    const relevantQuestions = questions
      .filter(q => selectedType === 'TODOS' || q.type === selectedType || q.type === 'ALL')
      .sort((a, b) => a.order - b.order);

    const headers = [
      "DATA", "OPERADOR", "CLIENTE", "TIPO", "DURACAO",
      ...relevantQuestions.map(q => q.text.toUpperCase())
    ];

    const rows = calls.map(c => {
      const op = operators.find(o => o.id === c.operatorId)?.name || 'N/A';
      const client = clients.find(cl => cl.id === c.clientId)?.name || prospects.find(p => p.id === c.prospectId)?.name || 'N/A';
      const resps = relevantQuestions.map(q => dataService.getResponseValue(c.responses, q) || '-');
      
      return [
        new Date(c.startTime).toLocaleDateString(),
        op,
        client,
        c.type,
        `${Math.floor(c.duration/60)}m`,
        ...resps
      ].map(v => `"${v}"`).join(";");
    });

    const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `Relatorio_Dreon_${selectedType}_${startDate}_${endDate}.csv`;
    link.click();
    document.body.removeChild(link);
    setIsExporting(false);
  };

  const metrics = React.useMemo(() => {
    const total = calls.length;
    if (total === 0) return null;
    const avgDuration = calls.reduce((acc, c) => acc + (c.duration || 0), 0) / total;

    return {
      kpis: [
        { label: 'Total Atendimentos', value: total, icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Tempo Médio (TMA)', value: `${Math.floor(avgDuration/60)}m ${Math.round(avgDuration%60)}s`, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
        { label: 'Protocolos Ativos', value: protocols.filter(p => p.status !== ProtocolStatus.FECHADO).length, icon: ClipboardList, color: 'text-red-600', bg: 'bg-red-50' }
      ]
    };
  }, [calls, protocols]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Painel de Performance</h2>
          <p className="text-slate-500 text-sm font-bold">Inteligência de dados e KPIs.</p>
        </div>
        <div className="flex gap-3">
           {canExport && (
             <button 
              onClick={handleExport}
              disabled={isExporting || calls.length === 0}
              className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center gap-2"
             >
                {isExporting ? <Loader2 className="animate-spin" size={16}/> : <FileSpreadsheet size={16}/>}
                Exportar CSV
             </button>
           )}
        </div>
      </header>

      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 items-end">
         <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Segmentação</label>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
               {['TODOS', ...Object.values(CallType)].map(type => (
                 <button 
                  key={type} 
                  onClick={() => setSelectedType(type as any)}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   {type}
                 </button>
               ))}
            </div>
         </div>
         <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Período</label>
            <div className="flex gap-2">
               <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" />
               <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" />
            </div>
         </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-300 gap-4">
           <Loader2 className="animate-spin" size={48} />
           <p className="font-black uppercase text-[10px] tracking-widest">Carregando métricas...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {metrics?.kpis.map((kpi, idx) => (
               <div key={idx} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-between group">
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                     <h3 className={`text-4xl font-black ${kpi.color}`}>{kpi.value}</h3>
                  </div>
                  <div className={`p-5 rounded-3xl ${kpi.bg} ${kpi.color}`}>
                     <kpi.icon size={28} />
                  </div>
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-8 bg-white p-10 rounded-[56px] border border-slate-100 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">Volume de Atendimento</h4>
                <div className="h-[350px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={calls.reduce((acc: any[], call) => {
                         const date = new Date(call.startTime).toLocaleDateString();
                         const existing = acc.find(i => i.name === date);
                         if (existing) existing.total += 1;
                         else acc.push({ name: date, total: 1 });
                         return acc;
                      }, []).slice(-10)}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                         <Tooltip />
                         <Bar dataKey="total" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[56px] shadow-2xl flex flex-col justify-between overflow-hidden relative">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Participação por Operador</h4>
                <div className="space-y-6">
                   {operators.filter(o => o.role === UserRole.OPERATOR_TELEMARKETING).map(op => {
                      const opCalls = calls.filter(c => c.operatorId === op.id).length;
                      const percentage = calls.length ? (opCalls / calls.length) * 100 : 0;
                      return (
                        <div key={op.id} className="space-y-2">
                           <div className="flex justify-between items-center text-white">
                              <span className="text-xs font-black uppercase">{op.name}</span>
                              <span className="text-sm font-black">{opCalls} calls</span>
                           </div>
                           <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${percentage}%` }}></div>
                           </div>
                        </div>
                      );
                   }).slice(0, 5)}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
