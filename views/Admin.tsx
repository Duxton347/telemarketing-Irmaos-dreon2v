
import React from 'react';
import { 
  Upload, Users, FileSpreadsheet, X, UserPlus, CheckCircle2, 
  Loader2, Info, AlertCircle, Clock, Database, Trash2, Save
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { User, UserRole, CallType } from '../types';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'import' | 'users'>('import');
  const [users, setUsers] = React.useState<User[]>([]);
  const [csvPreview, setCsvPreview] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [userData, setUserData] = React.useState({ name: '', username: '', password: '', role: UserRole.OPERATOR });
  const [userError, setUserError] = React.useState('');

  const [selectedOperatorId, setSelectedOperatorId] = React.useState<string>('');
  const [selectedCallType, setSelectedCallType] = React.useState<CallType>(CallType.POS_VENDA);

  React.useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const list = await dataService.getUsers();
      setUsers(list);
      const firstOp = list.find(u => u.role === UserRole.OPERATOR);
      if (firstOp && !selectedOperatorId) setSelectedOperatorId(firstOp.id);
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return alert("Arquivo CSV vazio ou sem dados.");
        
        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ""));
        
        const rows = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim());
          return headers.reduce((acc, header, i) => { acc[header] = values[i] || ''; return acc; }, {} as any);
        });

        const mapped = rows.map(r => {
          const getValue = (keys: string[]) => {
            const foundKey = Object.keys(r).find(k => keys.includes(k));
            return foundKey ? r[foundKey] : '';
          };

          return {
            name: getValue(['nome', 'cliente', 'nome do cliente', 'name', 'customer']),
            phone: getValue(['telefone', 'celular', 'tel', 'phone', 'whatsapp', 'mobile']),
            address: getValue(['endereco', 'morada', 'local', 'address', 'endereço']),
            equipment: getValue(['equipamento', 'item', 'produto', 'itens', 'equipment', 'aparelho'])
          };
        }).filter(r => r.name && r.phone);

        if (mapped.length === 0) {
          alert("Não foi possível identificar colunas válidas (Nome e Telefone).");
        }
        setCsvPreview(mapped);
      } catch (err) { 
        alert("Erro ao ler CSV."); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const runImport = async () => {
    if (csvPreview.length === 0 || isProcessing) return;
    if (!selectedOperatorId) return alert("Selecione um operador de destino.");

    setIsProcessing(true);
    let count = 0;
    
    try {
      for (const row of csvPreview) {
        try {
          const client = await dataService.upsertClient({
            name: row.name,
            phone: row.phone,
            address: row.address,
            items: row.equipment ? [row.equipment] : []
          });

          if (client && client.id) {
            const success = await dataService.createTask({
              clientId: client.id,
              type: selectedCallType,
              assignedTo: selectedOperatorId,
              status: 'pending'
            });
            if (success) count++;
          }
        } catch (e) {
          console.error("Erro na importação da linha:", row.name, e);
        }
      }
      
      alert(`Sucesso! ${count} tarefas foram vinculadas ao operador.`);
      setCsvPreview([]);
      await refreshData();
    } catch (err: any) {
      alert("Houve um erro durante o processo de importação.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    setUserError('');
    try {
      await dataService.createUser(userData);
      setIsUserModalOpen(false);
      setUserData({ name: '', username: '', password: '', role: UserRole.OPERATOR });
      await refreshData();
      alert("Colaborador criado com sucesso!");
    } catch (err: any) {
      setUserError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Gestão Operacional Dreon</h2>
        <p className="text-slate-500 text-sm font-medium">Controle de equipe e distribuição de carga de trabalho.</p>
      </header>

      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button onClick={() => setActiveTab('import')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all ${activeTab === 'import' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Carga de Trabalho</button>
        <button onClick={() => setActiveTab('users')} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Equipe</button>
      </div>

      {activeTab === 'import' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador Destino</label>
              <select value={selectedOperatorId} onChange={e => setSelectedOperatorId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 transition-all">
                <option value="">-- Escolha o Atendente --</option>
                {users.filter(u => u.role === UserRole.OPERATOR).map(u => (
                  <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Atendimento</label>
              <select value={selectedCallType} onChange={e => setSelectedCallType(e.target.value as any)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none">
                {Object.values(CallType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="border-4 border-dashed border-slate-100 rounded-[40px] p-16 text-center hover:border-blue-300 transition-all cursor-pointer relative group">
            <input type="file" id="csv-up" hidden accept=".csv" onChange={handleFileUpload} />
            <label htmlFor="csv-up" className="cursor-pointer block">
              <Upload size={56} className="mx-auto text-slate-200 mb-4 group-hover:text-blue-500 transition-colors" />
              <h4 className="text-2xl font-black text-slate-800">Clique para selecionar CSV</h4>
              <p className="text-xs text-slate-400 font-bold mt-2">Colunas esperadas: Nome e Telefone</p>
            </label>
          </div>

          {csvPreview.length > 0 && (
            <div className="space-y-6 animate-in zoom-in">
              <div className="p-8 bg-blue-600 rounded-[32px] text-white flex justify-between items-center shadow-2xl shadow-blue-600/20">
                <div>
                   <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Carga Detectada</p>
                   <h4 className="font-black text-2xl">{csvPreview.length} Contatos para Importação</h4>
                </div>
                <button onClick={() => setCsvPreview([])} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><Trash2 /></button>
              </div>
              
              <button onClick={runImport} disabled={isProcessing || !selectedOperatorId} className="w-full py-7 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                {isProcessing ? <Loader2 className="animate-spin" /> : <Database size={20} />} 
                Distribuir Tarefas ao Operador Selecionado
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Equipe Dreon</h3>
                <p className="text-xs text-slate-400 font-bold">Gestão de acessos vinculados ao banco de dados.</p>
              </div>
              <button onClick={() => setIsUserModalOpen(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
                <UserPlus size={18} /> Novo Atendente
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {users.map(u => (
                <div key={u.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] flex items-center gap-4 group hover:border-blue-100 transition-all hover:shadow-lg">
                  <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">{u.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate">{u.name}</p>
                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">@{u.username}</p>
                    <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[8px] font-black uppercase mt-1 tracking-widest">{u.role}</span>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Modal Criar Colaborador */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black flex items-center gap-3"><UserPlus size={24} className="text-blue-400" /> Novo Acesso</h3>
                 <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                 {userError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black animate-in shake">{userError}</div>}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input required placeholder="Ex: João da Silva" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
                       <input required placeholder="joao" value={userData.username} onChange={e => setUserData({...userData, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                       <input required type="password" placeholder="******" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
                    <select value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer">
                      <option value={UserRole.OPERATOR}>Operador</option>
                      <option value={UserRole.ADMIN}>Administrador</option>
                      <option value={UserRole.SUPERVISOR}>Supervisor</option>
                    </select>
                 </div>
                 <button type="submit" disabled={isProcessing} className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                   {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />} Cadastrar Colaborador
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
