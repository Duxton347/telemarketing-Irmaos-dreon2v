
import React from 'react';
import { Lock, User as UserIcon, ShieldAlert, Loader2 } from 'lucide-react';
import { dataService } from '../services/dataService';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const user = await dataService.signIn(username, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Usuário ou senha incorretos.' : 'Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="bg-slate-900 p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-400"></div>
          <div className="w-24 h-24 bg-yellow-400 rounded-3xl rotate-6 flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-2xl transform hover:rotate-0 transition-transform duration-300">
            <span className="text-4xl font-black text-slate-900">ID</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Irmãos Dreon</h1>
          <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Plataforma de Performance</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs border border-red-100 font-bold flex items-center gap-3 animate-in shake">
              <ShieldAlert size={18} />
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuário do Colaborador</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input
                type="text"
                disabled={loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                placeholder="Ex: ecommerce adm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input
                type="password"
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-[28px] shadow-2xl shadow-blue-900/40 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Acessar Sistema'}
          </button>
        </form>
        
        <div className="p-6 bg-slate-50 text-center text-[9px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-100">
          &copy; Telemarketing Irmãos Dreon &bull; 2024
        </div>
      </div>
    </div>
  );
};

export default Login;
