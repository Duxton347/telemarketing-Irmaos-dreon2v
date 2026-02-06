
import React from 'react';
import { 
  PhoneCall, Clock, AlertCircle, TrendingUp, BarChart3, Users, 
  ClipboardList, Filter, X, ChevronRight, Loader2, Target, 
  Zap, Calendar, Activity, ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { dataService } from '../services/dataService';
import { UserRole, CallType, ProtocolStatus, User, Protocol } from '../types';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();
  const [operators, setOperators] = React.useState<User[]>([]);
  // Fix: UserRole.OPERATOR does not exist, using UserRole.OPERATOR_TELEMARKETING
  const [selectedFilter, setSelectedFilter] = React.useState<string>(user?.role === UserRole.OPERATOR_TELEMARKETING ? user.id : 'all');
  const [isLoading, setIsLoading] = React.useState(true);

  const [stats, setStats] = React.useState({
    totalCalls: 0,
    pendingTasks: 0,
    openProtocols: 0,
    avgTime: '0:00',
    conversionRate: 0
  });

  const [chartData, setChartData] = React.useState<any[]>([]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [calls, protocols, tasks, allUsers] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getTasks(),
        dataService.getUsers()
      ]);

      // Fix: UserRole.OPERATOR does not exist, using UserRole.OPERATOR_TELEMARKETING
      const filterId = user?.role === UserRole.OPERATOR_TELEMARKETING ? user.id : selectedFilter;
      const filteredCalls = filterId === 'all' ? calls : calls.filter(c => c.operatorId === filterId);
      const filteredTasks = filterId === 'all' ? tasks.filter(t => t.status === 'pending') : tasks.filter(t => t.assignedTo === filterId && t.status === 'pending');
      
      const totalDur = filteredCalls.reduce((acc, c) => acc + (c.duration || 0), 0);
      const avg = filteredCalls.length ? Math.floor(totalDur / filteredCalls.length) : 0;

      setStats({
        totalCalls: filteredCalls.length,
        pendingTasks: filteredTasks.length,
        openProtocols: protocols.filter(p => p.status !== ProtocolStatus.FECHADO).length,
        avgTime: `${Math.floor(avg/60)}m ${avg%60}s`,
        conversionRate: 15 // Placeholder para lógica de prospecção
      });

      // Fix: UserRole.OPERATOR does not exist, using UserRole.OPERATOR_TELEMARKETING
      setOperators(allUsers.filter(u => u.role === UserRole.OPERATOR_TELEMARKETING));
      
      // Mock chart data for week
      setChartData([
        { name: 'Seg', volume: 45 }, { name: 'Ter', volume: 52 }, { name: 'Qua', volume: 38 },
        { name: 'Qui', volume: 65 }, { name: 'Sex', volume: 48 }, { name: 'Sab', volume: 24 }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedFilter]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const MetricCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${color} text-white`}>
          <Icon size={24} />
        </div>
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{sub}</span>
      </div>
      <div>
        <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{value}</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            {user.role === UserRole.ADMIN ? 'Panorama Executivo' : `Olá, ${user.name.split(' ')[0]}`}
          </h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Status da operação em tempo real</p>
        </div>
        {user.role === UserRole.ADMIN && (
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
            <Filter size={16} className="ml-2 text-slate-400" />
            <select 
              value={selectedFilter} 
              onChange={e => setSelectedFilter(e.target.value)}
              className="bg-transparent border-none outline-none font-black text-[10px] uppercase tracking-widest px-4 py-2 cursor-pointer"
            >
              <option value="all">Visão Consolidada</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Chamadas Hoje" value={stats.totalCalls} sub="VOLUME" icon={PhoneCall} color="bg-blue-600" />
        <MetricCard title="Tarefas em Fila" value={stats.pendingTasks} sub="PENDÊNCIA" icon={ClipboardList} color="bg-amber-500" />
        <MetricCard title="Protocolos Ativos" value={stats.openProtocols} sub="ALERTA" icon={AlertCircle} color="bg-red-500" />
        <MetricCard title="Tempo Médio" value={stats.avgTime} sub="PERFORMANCE" icon={Clock} color="bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-10 rounded-[56px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Activity size={20} /></div>
              <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-widest">Atividade Semanal</h3>
            </div>
            <div className="flex gap-2">
               <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full">+12% vs anterior</span>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                <YAxis hide />
                <Tooltip cursor={{stroke: '#2563eb', strokeWidth: 2}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorVol)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[56px] text-white shadow-2xl flex flex-col justify-between overflow-hidden relative">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 blur-3xl rounded-full"></div>
           <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-2">
                 <Zap size={14} className="text-yellow-400" /> Conversão Rápida
              </h4>
              <div className="space-y-8">
                 <div className="flex items-end justify-between">
                    <div>
                       <p className="text-5xl font-black text-white">{stats.conversionRate}%</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Taxa de Qualificação</p>
                    </div>
                    <ArrowUpRight size={32} className="text-emerald-400" />
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${stats.conversionRate}%` }}></div>
                 </div>
              </div>
           </div>
           
           <div className="pt-8 border-t border-white/5">
              <button 
                onClick={() => navigate('/queue')}
                className="w-full py-5 bg-white text-slate-900 rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                 Acessar Minha Fila
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
