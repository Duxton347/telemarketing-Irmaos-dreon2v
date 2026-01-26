
import React from 'react';
import { 
  PhoneCall, Clock, AlertCircle, TrendingUp, BarChart3, Users, ClipboardList, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip
} from 'recharts';
import { dataService } from '../services/dataService';
import { UserRole, CallType, ProtocolStatus, User, Protocol, Client } from '../types';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  user: any;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedFilter, setSelectedFilter] = React.useState<string>(user?.role === UserRole.OPERATOR ? user.id : 'all');
  const [openProtocols, setOpenProtocols] = React.useState<Protocol[]>([]);
  const [stats, setStats] = React.useState({
    totalCalls: 0,
    pendingTasks: 0,
    openProtocolsCount: 0,
    avgCallTime: '00:00',
    avgReportTime: '00:00',
  });

  const [chartData, setChartData] = React.useState<any[]>([]);
  const [protocolData, setProtocolData] = React.useState<any[]>([]);

  const fetchBaseData = React.useCallback(async () => {
    const [calls, protocols, allClients, tasks, allUsers] = await Promise.all([
      dataService.getCalls(),
      dataService.getProtocols(),
      dataService.getClients(),
      dataService.getTasks(),
      dataService.getUsers()
    ]);

    setClients(allClients);
    setOperators(allUsers.filter(u => u && u.role === UserRole.OPERATOR));
    
    const filterId = user?.role === UserRole.OPERATOR ? user.id : selectedFilter;
    
    const displayCalls = filterId === 'all' ? calls : calls.filter(c => c.operatorId === filterId);
    const displayTasks = filterId === 'all' 
      ? tasks.filter(t => t.status === 'pending')
      : tasks.filter(t => t.assignedTo === filterId && t.status === 'pending');
    
    const displayProtocols = filterId === 'all' ? protocols : protocols.filter(p => p.ownerOperatorId === filterId || p.openedByOperatorId === filterId);
    
    setOpenProtocols(displayProtocols.filter(p => p.status !== ProtocolStatus.FECHADO).sort((a,b) => {
      if (a.priority === 'Alta') return -1;
      return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
    }).slice(0, 3));

    const totalDur = displayCalls.reduce((acc, c) => acc + (c.duration || 0), 0);
    const avgSec = displayCalls.length > 0 ? Math.floor(totalDur / displayCalls.length) : 0;
    
    setStats({
      totalCalls: displayCalls.length,
      pendingTasks: displayTasks.length,
      openProtocolsCount: displayProtocols.filter(p => p.status !== ProtocolStatus.FECHADO).length,
      avgCallTime: `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`,
      avgReportTime: 'N/A',
    });

    // Chart Data logic...
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('pt-BR', { weekday: 'short' });
    }).reverse();

    setChartData(last7Days.map(day => {
      const dayCalls = displayCalls.filter(c => new Date(c.startTime).toLocaleDateString('pt-BR', { weekday: 'short' }) === day);
      return { 
        name: day, 
        venda: dayCalls.filter(c => c.type === CallType.VENDA).length,
        posVenda: dayCalls.filter(c => c.type === CallType.POS_VENDA).length,
        prospeccao: dayCalls.filter(c => c.type === CallType.PROSPECCAO).length,
      };
    }));

    setProtocolData([
      { name: 'Aberto', value: displayProtocols.filter(p => p.status === ProtocolStatus.ABERTO).length },
      { name: 'Andamento', value: displayProtocols.filter(p => p.status === ProtocolStatus.EM_ANDAMENTO).length },
      { name: 'Fechado', value: displayProtocols.filter(p => p.status === ProtocolStatus.FECHADO).length },
    ].filter(i => i.value > 0));

  }, [user, selectedFilter]);

  React.useEffect(() => {
    fetchBaseData();
    const interval = setInterval(fetchBaseData, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [fetchBaseData]);

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
      </div>
      <div className={`p-4 rounded-2xl ${color} shadow-lg shadow-black/10`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Operacional</h2>
          <p className="text-slate-500 text-sm">Visão em tempo real das metas e atendimentos.</p>
        </div>
        {user?.role === UserRole.ADMIN && (
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <Filter size={18} className="text-slate-400" />
            <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)} className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-slate-700 cursor-pointer">
              <option value="all">Visão Geral</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Ligações de Hoje" value={stats.totalCalls} icon={PhoneCall} color="bg-blue-600" />
        <StatCard title="Fila Pendente" value={stats.pendingTasks} icon={ClipboardList} color="bg-yellow-500" />
        <StatCard title="Protocolos Ativos" value={stats.openProtocolsCount} icon={AlertCircle} color="bg-red-500" />
        <StatCard title="Média de Tempo" value={stats.avgCallTime} icon={Clock} color="bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" /> Volume de Atendimento
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="posVenda" stackId="a" fill="#10b981" />
                <Bar dataKey="venda" stackId="a" fill="#2563eb" />
                <Bar dataKey="prospeccao" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
          <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest mb-8 self-start flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" /> Status de Protocolos
          </h3>
          <div className="w-full h-[220px]">
            {protocolData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={protocolData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#10b981" />
                  </Pie>
                  <PieTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <BarChart3 size={40} />
                <p className="text-[10px] font-black uppercase mt-2">Sem protocolos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
