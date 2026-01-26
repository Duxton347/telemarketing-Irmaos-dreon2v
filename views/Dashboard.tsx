
import React from 'react';
import { 
  PhoneCall, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  BarChart3,
  Users,
  ClipboardList,
  Filter,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip
} from 'recharts';
import { dataService } from '../services/dataService';
import { UserRole, CallType, ProtocolStatus, CallRecord, User, Protocol, Client } from '../types';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  user: any;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [operators, setOperators] = React.useState<User[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedFilter, setSelectedFilter] = React.useState<string>('all');
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

  // Correctly await asynchronous call to getUsers
  React.useEffect(() => {
    const fetchOperators = async () => {
      const allUsers = await dataService.getUsers();
      setOperators(allUsers.filter(u => u && u.role === UserRole.OPERATOR));
    };
    fetchOperators();
  }, []);

  // Correctly await asynchronous calls in loadData
  React.useEffect(() => {
    const loadData = async () => {
      // FIX: Added dataService.getTasks() to Promise.all to correctly await its completion
      const [calls, protocols, allClients, tasks] = await Promise.all([
        dataService.getCalls(),
        dataService.getProtocols(),
        dataService.getClients(),
        dataService.getTasks()
      ]);
      setClients(allClients);
      
      let filterId = user?.role === UserRole.OPERATOR ? user?.id : selectedFilter;
      
      const displayCalls = filterId === 'all' ? calls : calls.filter(c => c && c.operatorId === filterId);
      const displayTasks = filterId === 'all' 
        ? tasks.filter(t => t && t.status === 'pending')
        : tasks.filter(t => t && t.assignedTo === filterId && t.status === 'pending');
      
      const displayProtocols = filterId === 'all' ? protocols : protocols.filter(p => p && (p.openedByOperatorId === filterId || p.ownerOperatorId === filterId));
      
      const urgentProtocols = displayProtocols
        .filter(p => p && p.status !== ProtocolStatus.FECHADO)
        .sort((a,b) => {
          if (a.priority === 'Alta' && b.priority !== 'Alta') return -1;
          if (b.priority === 'Alta' && a.priority !== 'Alta') return 1;
          return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
        })
        .slice(0, 3);

      setOpenProtocols(urgentProtocols);

      const totalDuration = displayCalls.reduce((acc, c) => acc + (c.duration || 0), 0);
      const totalReport = displayCalls.reduce((acc, c) => acc + (c.reportTime || 0), 0);
      const avgSeconds = displayCalls.length > 0 ? Math.floor(totalDuration / displayCalls.length) : 0;
      const avgReportSeconds = displayCalls.length > 0 ? Math.floor(totalReport / displayCalls.length) : 0;
      
      setStats({
        totalCalls: displayCalls.length,
        pendingTasks: displayTasks.length,
        openProtocolsCount: displayProtocols.filter(p => p && p.status !== ProtocolStatus.FECHADO).length,
        avgCallTime: `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`,
        avgReportTime: `${Math.floor(avgReportSeconds / 60)}m ${avgReportSeconds % 60}s`,
      });

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString('pt-BR', { weekday: 'short' });
      }).reverse();

      const volumeData = last7Days.map(day => {
        const dayCalls = displayCalls.filter(c => {
          if (!c || !c.startTime) return false;
          const callDate = new Date(c.startTime).toLocaleDateString('pt-BR', { weekday: 'short' });
          return callDate === day;
        });
        return { 
          name: day, 
          venda: dayCalls.filter(c => c.type === CallType.VENDA).length,
          posVenda: dayCalls.filter(c => c.type === CallType.POS_VENDA).length,
          prospeccao: dayCalls.filter(c => c.type === CallType.PROSPECCAO).length,
        };
      });
      setChartData(volumeData);

      const pData = [
        { name: 'Aberto', value: displayProtocols.filter(p => p && p.status === ProtocolStatus.ABERTO).length },
        { name: 'Andamento', value: displayProtocols.filter(p => p && p.status === ProtocolStatus.EM_ANDAMENTO).length },
        { name: 'Resolvido', value: displayProtocols.filter(p => p && p.status === ProtocolStatus.FECHADO).length },
      ].filter(item => item.value > 0);
      setProtocolData(pData);
    };

    loadData();
  }, [user, selectedFilter]);

  const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        {subValue && <p className="text-xs text-slate-400 mt-1 font-bold">{subValue}</p>}
      </div>
      <div className={`p-4 rounded-2xl ${color} shadow-lg`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Operacional</h2>
          <p className="text-slate-500 text-sm">Visão geral Dreon de performance e demandas.</p>
        </div>
        {user?.role === UserRole.ADMIN && (
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-slate-700 cursor-pointer"
            >
              <option value="all">Visão: Setor Completo</option>
              {operators.map(op => op && (
                <option key={op.id} value={op.id}>Operador: {op.name}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {openProtocols.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-[32px] p-8 animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-red-800 flex items-center gap-2 uppercase tracking-widest text-sm">
                <AlertCircle size={20} className="animate-pulse" /> Incidentes em Aberto
              </h3>
              <p className="text-xs text-red-600 font-medium mt-1">Atenda as demandas críticas com prioridade.</p>
            </div>
            <button onClick={() => navigate('/protocols')} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 transition-all">
              Gerenciar Todos
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {openProtocols.map(p => p && (
                <div key={p.id} onClick={() => navigate('/protocols')} className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm hover:border-red-400 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${p.priority === 'Alta' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'}`}>
                      {p.priority}
                    </span>
                    <span className="text-[9px] font-black text-slate-400">ID: #{p.id}</span>
                  </div>
                  <p className="text-sm font-black text-slate-800 truncate mb-1 group-hover:text-red-600 transition-colors">{p.title}</p>
                  <p className="text-[10px] text-slate-500 font-bold mb-2 truncate">Cliente: {clients.find(c => c && c.id === p.clientId)?.name}</p>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-red-600 uppercase">
                    <Clock size={12} /> SLA: {p.slaDueAt ? new Date(p.slaDueAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Calls Atendidas" value={stats.totalCalls} icon={PhoneCall} color="bg-blue-600" />
        <StatCard title="Fila Pendente" value={stats.pendingTasks} icon={ClipboardList} color="bg-yellow-500" />
        <StatCard title="Protocolos Ativos" value={stats.openProtocolsCount} icon={AlertCircle} color="bg-red-500" />
        <StatCard title="Duração Média" value={stats.avgCallTime} icon={Clock} color="bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" /> Volume Semanal (Operacional)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="venda" stackId="a" fill="#2563eb" />
                <Bar dataKey="posVenda" stackId="a" fill="#10b981" />
                <Bar dataKey="prospeccao" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" /> Distribuição Protocolos
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            {protocolData.length > 0 ? (
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={protocolData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="value">
                      <Cell fill="#ef4444" stroke="none" />
                      <Cell fill="#f59e0b" stroke="none" />
                      <Cell fill="#10b981" stroke="none" />
                    </Pie>
                    <PieTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-10 opacity-30">
                <BarChart3 size={48} className="mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase">Sem protocolos</p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-4 w-full">
               <div className="text-center"><p className="text-[10px] font-bold text-red-500 uppercase">Abertos</p><p className="font-black text-slate-800">{protocolData.find(d => d.name === 'Aberto')?.value || 0}</p></div>
               <div className="text-center"><p className="text-[10px] font-bold text-yellow-500 uppercase">Fila</p><p className="font-black text-slate-800">{protocolData.find(d => d.name === 'Andamento')?.value || 0}</p></div>
               <div className="text-center"><p className="text-[10px] font-bold text-green-500 uppercase">Resolv.</p><p className="font-black text-slate-800">{protocolData.find(d => d.name === 'Resolvido')?.value || 0}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
