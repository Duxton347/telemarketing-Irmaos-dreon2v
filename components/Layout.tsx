
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, PhoneCall, Users, ClipboardList, Settings, 
  LogOut, Menu, X, FileBarChart, Navigation, Map as MapIcon,
  Zap, Megaphone, Microscope
} from 'lucide-react';
import { UserRole } from '../types.ts';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: Object.values(UserRole) },
    { label: 'Atendimento', icon: PhoneCall, path: '/queue', roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR_TELEMARKETING] },
    { label: 'Marketing', icon: Megaphone, path: '/marketing', roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALISTA_MARKETING] },
    { label: 'Logística', icon: Navigation, path: '/routes', roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.VENDEDOR] },
    { label: 'Mapa', icon: MapIcon, path: '/map', roles: Object.values(UserRole) },
    { label: 'Clientes', icon: Users, path: '/clients', roles: Object.values(UserRole) },
    { label: 'Protocolos', icon: ClipboardList, path: '/protocols', roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR_TELEMARKETING] },
    { label: 'Relatórios', icon: FileBarChart, path: '/reports', roles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALISTA_MARKETING] },
    { label: 'Qualidade', icon: Microscope, path: '/qa', roles: [UserRole.ADMIN] },
    { label: 'Admin', icon: Settings, path: '/admin', roles: [UserRole.ADMIN] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 p-8 shrink-0">
        <div className="mb-12 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl">ID</div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-tight">Irmãos Dreon</h1>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Growth Engine</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all group ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-blue-400' : 'group-hover:text-blue-600'} />
                <span className="font-black uppercase text-[10px] tracking-widest">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-100">
          <div className="bg-slate-50 p-6 rounded-[32px] mb-6">
             <p className="text-[10px] font-black text-slate-900 truncate uppercase">{user.name}</p>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-4 w-full px-6 py-4 rounded-[20px] text-red-500 hover:bg-red-50 transition-all font-black uppercase text-[10px] tracking-widest"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg">ID</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-900">
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-24 p-6 animate-in slide-in-from-right duration-300">
          <nav className="space-y-4">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-6 p-6 rounded-[28px] bg-slate-50 text-slate-900"
                >
                  <Icon size={24} />
                  <span className="font-black uppercase text-xs tracking-widest">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <main className="flex-1 p-6 lg:p-12 pt-24 lg:pt-12 overflow-y-auto max-w-full">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
