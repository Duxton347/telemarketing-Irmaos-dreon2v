
import React from 'react';
import { 
  Upload, Users, HelpCircle, Plus, FileSpreadsheet, X, UserPlus, CheckCircle2, 
  Loader2
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { User, UserRole } from '../types';
import { supabase, getInternalEmail, ENV } from '../lib/supabase';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'import' | 'users' | 'questions'>('import');
  const [users, setUsers] = React.useState<User[]>([]);
  const [csvPreview, setCsvPreview] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [userData, setUserData] = React.useState({ name: '', username: '', password: '', role: UserRole.OPERATOR });

  React.useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    const list = await dataService.getUsers();
    setUsers(list);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        if (lines.length < 2) return alert("Arquivo CSV inválido.");
        const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).filter(l => l.trim() !== '').map(line => {
          const values = line.split(/[,;]/).map(v => v.trim());
          return headers.reduce((acc, header, i) => { acc[header] = values[i] || ''; return acc; }, {} as any);
        });
        const mapped = rows.map(r => ({
          name: r.nome || r['nome do cliente'] || r.cliente || r.name,
          phone: r.telefone || r.celular || r.tel || r.phone || r.whatsapp,
          address: r.endereco || r.morada || r.local || r.address,
          items: (r.item || r['item comprado'] || r.equipamento || r.produto || '').split(',').map((i: string) => i.trim()).filter((i: string) => i),
        })).filter(r => r.name && r.phone);
        setCsvPreview(mapped);
      } catch (err) { alert("Erro ao processar CSV."); }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setIsProcessing(true);
    let count = 0;
    try {
      for (let i = 0; i < csvPreview.length; i += 50) {
        const chunk = csvPreview.slice(i, i + 50);
        for (const item of chunk) {
          await dataService.upsertClient(item);
          count++;
        }
      }
      alert(`${count} clientes processados e deduplicados com sucesso.`);
      setCsvPreview([]);
    } catch (err: any) {
      alert("Erro na importação: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const email = getInternalEmail(userData.username);
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password: userData.password,
        options: { data: { username: userData.username } }
      });

      if (error) throw error;

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user?.id,
        username_display: userData.name,
        username_slug: userData.username,
        role: userData.role
      });

      if (profileError) console.warn("Erro ao criar perfil:", profileError);

      setIsUserModalOpen(false);
      setUserData({ name: '', username: '', password: '', role: UserRole.OPERATOR });
      refreshData();
      alert('Colaborador criado com sucesso!');
    } catch (err: any) {
      alert("Erro ao criar usuário: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Administrativo</h2>
        <p className="text-slate-500 text-sm font-medium">Gestão centralizada Supabase + Dreon.</p>
      </header>

      <div className="flex border-b border-slate-200">
        {[
          { id: 'import', label: 'Carga de Dados', icon: FileSpreadsheet },
          { id: 'users', label: 'Equipe e Acessos', icon: Users },
          { id: 'questions', label: 'Questionários', icon: HelpCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && (
        <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="max-w-md w-full">
                <input type="file" id="bulk-csv" hidden accept=".csv" onChange={handleFileUpload} />
                <label htmlFor="bulk-csv" className="cursor-pointer group">
                   <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-50 transition-all border-2 border-dashed border-slate-200 group-hover:border-blue-200">
                      <Upload size={32} className="text-slate-300 group-hover:text-blue-500" />
                   </div>
                   <h4 className="text-xl font-black text-slate-800 tracking-tight">Importar Base de Clientes</h4>
                   <p className="text-sm text-slate-400 font-medium mt-1">Deduplicação automática por telefone.</p>
                </label>
                {csvPreview.length > 0 && (
                  <div className="mt-10 p-6 bg-blue-50 border border-blue-100 rounded-3xl animate-in zoom-in">
                     <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-4">{csvPreview.length} registros detectados</p>
                     <button onClick={runImport} disabled={isProcessing} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Confirmar Upsert
                     </button>
                  </div>
                )}
             </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black tracking-tight">Equipe Dreon</h3>
            <button onClick={() => setIsUserModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"><UserPlus size={18} /> Novo Acesso</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(u => (
              <div key={u.id} className="p-6 border-2 border-slate-50 bg-slate-50/30 rounded-[32px] flex items-center gap-4 group hover:border-blue-100 transition-all">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg">{u.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 truncate">{u.name}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">@{u.username} • {u.role}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-400'}`}></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
           <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black flex items-center gap-2"><UserPlus size={24} className="text-blue-400" /> Novo Acesso</h3>
                 <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Colaborador</label>
                    <input required type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" placeholder="Ex: João Silva" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input required type="text" placeholder="username" value={userData.username} onChange={e => setUserData({...userData, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    <input required type="password" placeholder="senha" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                 </div>
                 <select value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none">
                    <option value={UserRole.OPERATOR}>Operador</option>
                    <option value={UserRole.SUPERVISOR}>Supervisor</option>
                    <option value={UserRole.ADMIN}>Administrador</option>
                 </select>
                 <button disabled={isProcessing} type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-2">
                   {isProcessing && <Loader2 className="animate-spin" />} Criar no Supabase
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
