
import React from 'react';
import { 
  Upload, Users, FileSpreadsheet, X, UserPlus, CheckCircle2, 
  Loader2, Info, AlertCircle, Clock, Database, ChevronDown
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

  // Configurações de Carga Manual
  const [selectedOperatorId, setSelectedOperatorId] = React.useState<string>('');
  const [selectedCallType, setSelectedCallType] = React.useState<CallType>(CallType.POS_VENDA);

  React.useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    const list = await dataService.getUsers();
    setUsers(list);
    if (list.length > 0 && !selectedOperatorId) {
      const firstOp = list.find(u => u.role === UserRole.OPERATOR);
      if (firstOp) setSelectedOperatorId(firstOp.id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return alert("Arquivo CSV vazio ou inválido.");
        
        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
        
        const rows = lines.slice(1).filter(l => l.trim() !== '').map(line => {
          const values = line.split(separator).map(v => v.trim());
          return headers.reduce((acc, header, i) => { acc[header] = values[i] || ''; return acc; }, {} as any);
        });

        const mapped = rows.map(r => ({
          name: r.nome || r.cliente || r['nome do cliente'] || r.name || '',
          phone: r.telefone || r.celular || r.tel || r.phone || '',
          address: r.endereco || r.morada || r.local || r.address || '',
          equipment: r.equipamento || r.item || r.produto || r.itens || ''
        })).filter(r => r.name && r.phone);

        if (mapped.length === 0) {
          alert("Erro: Certifique-se de que o CSV tenha as colunas 'nome' e 'telefone'.");
        }

        setCsvPreview(mapped);
      } catch (err) { 
        console.error(err);
        alert("Erro ao processar CSV. Use formato UTF-8."); 
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (csvPreview.length === 0 || isProcessing) return;
    if (!selectedOperatorId) return alert("Selecione um operador para receber a carga.");

    setIsProcessing(true);
    let successCount = 0;
    
    try {
      for (const row of csvPreview) {
        try {
          // 1. Criar ou Atualizar Cliente com o Equipamento
          const itemsArray = row.equipment ? row.equipment.split(',').map((i: string) => i.trim()).filter((i: string) => i) : [];
          
          const client = await dataService.upsertClient({
            name: row.name,
            phone: row.phone,
            address: row.address,
            items: itemsArray
          });

          // 2. Gerar Tarefa para o Operador Selecionado
          await dataService.createTask({
            clientId: client.id,
            type: selectedCallType,
            assignedTo: selectedOperatorId,
            status: 'pending'
          });

          successCount++;
        } catch (e) {
          console.error("Erro no registro individual:", e);
        }
      }
      
      alert(`Sucesso! ${successCount} contatos foram enviados para a fila do operador.`);
      setCsvPreview([]);
    } catch (err: any) {
      alert("Erro crítico na importação: " + err.message);
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
      refreshData();
      alert('Colaborador criado!');
    } catch (err: any) {
      setUserError(err.message || 'Erro ao criar usuário');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestão Irmãos Dreon</h2>
        <p className="text-slate-500 text-sm font-medium">Controle de equipe e distribuição de carga de trabalho.</p>
      </header>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button onClick={() => setActiveTab('import')} className={`flex items-center gap-3 px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all ${activeTab === 'import' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
          <FileSpreadsheet size={18} /> Carga de Trabalho
        </button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
          <Users size={18} /> Equipe Dreon
        </button>
      </div>

      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Importar Planilha</h3>
                  <p className="text-xs text-slate-400 font-bold">Suba o arquivo CSV para distribuir as ligações.</p>
                </div>
              </div>

              {/* Configuração da Carga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destinar ao Operador</label>
                  <select 
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="">Selecione o Operador</option>
                    {users.filter(u => u.role === UserRole.OPERATOR).map(u => (
                      <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Ligação</label>
                  <select 
                    value={selectedCallType}
                    onChange={(e) => setSelectedCallType(e.target.value as CallType)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value={CallType.POS_VENDA}>Pós-Venda</option>
                    <option value={CallType.VENDA}>Venda</option>
                    <option value={CallType.PROSPECCAO}>Prospecção</option>
                  </select>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center hover:border-blue-300 transition-all group bg-slate-50/50 relative">
                <input type="file" id="bulk-csv" hidden accept=".csv" onChange={handleFileUpload} />
                <label htmlFor="bulk-csv" className="cursor-pointer block">
                  <Upload size={48} className="text-slate-300 group-hover:text-blue-500 mx-auto mb-4 transition-colors" />
                  <h4 className="text-lg font-black text-slate-800">Clique para selecionar CSV</h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">Colunas sugeridas: nome, telefone, endereço, equipamento</p>
                </label>
              </div>

              {csvPreview.length > 0 && (
                <div className="mt-8 space-y-4 animate-in zoom-in duration-300">
                  <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Planilha Processada</p>
                      <h4 className="text-lg font-black text-slate-800">{csvPreview.length} registros prontos para carga</h4>
                    </div>
                    <button onClick={() => setCsvPreview([])} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/50">
                    <table className="w-full text-left text-[10px]">
                      <thead className="sticky top-0 bg-white border-b">
                        <tr>
                          <th className="p-3 font-black uppercase text-slate-400">Cliente</th>
                          <th className="p-3 font-black uppercase text-slate-400">Telefone</th>
                          <th className="p-3 font-black uppercase text-slate-400">Equipamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.map((r, i) => (
                          <tr key={i}>
                            <td className="p-3 font-bold text-slate-700">{r.name}</td>
                            <td className="p-3 font-medium text-slate-500">{r.phone}</td>
                            <td className="p-3 text-blue-600 font-bold truncate max-w-[150px]">{r.equipment || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button 
                    onClick={runImport} 
                    disabled={isProcessing || !selectedOperatorId} 
                    className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} 
                    Confirmar e Enviar para o Operador
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl sticky top-8">
              <div className="flex items-center gap-3 mb-6 text-yellow-400">
                <Info size={24} />
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Importante</h4>
              </div>
              <ul className="space-y-4 text-[11px] font-medium text-slate-300 leading-relaxed">
                <li className="flex gap-3"><span className="text-yellow-400 font-black">•</span> O sistema ignora cabeçalhos que não sejam: nome, telefone, endereço, equipamento.</li>
                <li className="flex gap-3"><span className="text-yellow-400 font-black">•</span> Use ponto e vírgula (;) ou vírgula (,) como separador.</li>
                <li className="flex gap-3"><span className="text-yellow-400 font-black">•</span> Ao clicar em Confirmar, o operador verá as tarefas imediatamente em seu dashboard.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black tracking-tight">Equipe e Logins</h3>
              <p className="text-xs text-slate-400 font-bold">Gestão de acessos da plataforma.</p>
            </div>
            <button onClick={() => { setIsUserModalOpen(true); setUserError(''); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"><UserPlus size={18} /> Criar Colaborador</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(u => (
              <div key={u.id} className="p-6 border-2 border-slate-50 bg-slate-50/30 rounded-[32px] flex items-center gap-4 group hover:border-blue-100 transition-all">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">{u.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 truncate leading-none mb-1">{u.name}</p>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 w-fit px-1.5 py-0.5 rounded">@{u.username}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{u.role}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-400'}`}></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><UserPlus size={24} className="text-blue-400" /> Novo Acesso</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              {userError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black flex items-center gap-2">
                  <AlertCircle size={16} /> {userError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input required type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username (@)</label>
                  <input required type="text" value={userData.username} onChange={e => setUserData({...userData, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                  <input required type="password" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                </div>
              </div>
              <select value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                <option value={UserRole.OPERATOR}>Operador</option>
                <option value={UserRole.ADMIN}>Administrador</option>
                <option value={UserRole.SUPERVISOR}>Supervisor</option>
              </select>
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />} Criar Acesso
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
