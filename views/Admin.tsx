
import React from 'react';
import { 
  Upload, Users, FileSpreadsheet, X, UserPlus, CheckCircle2, 
  Loader2, Info, AlertCircle, Clock, Database, Trash2, Save,
  MessageSquarePlus, ChevronUp, ChevronDown, Trash, Edit3, RotateCcw,
  PhoneOff, RefreshCw, ListFilter, Plus, UserCheck, UserMinus, Phone, PlayCircle
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { User, UserRole, CallType, Question, Task } from '../types';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'import' | 'users' | 'questions' | 'skips'>('questions');
  const [users, setUsers] = React.useState<User[]>([]);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [skippedTasks, setSkippedTasks] = React.useState<any[]>([]);
  const [csvPreview, setCsvPreview] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = React.useState(false);
  
  const [userData, setUserData] = React.useState({ name: '', username: '', password: '', role: UserRole.OPERATOR });
  const [questionData, setQuestionData] = React.useState<Partial<Question>>({ text: '', options: [], type: 'ALL' as any, stageId: '' });
  const [optionInput, setOptionInput] = React.useState('');
  
  const [selectedOperatorId, setSelectedOperatorId] = React.useState<string>('');
  const [selectedCallType, setSelectedCallType] = React.useState<CallType>(CallType.POS_VENDA);

  const refreshData = async () => {
    setIsProcessing(true);
    try {
      const [userList, questionList, taskList, allClients] = await Promise.all([
        dataService.getUsers(),
        dataService.getQuestions(),
        dataService.getTasks(),
        dataService.getClients()
      ]);
      setUsers(userList);
      setQuestions(questionList);
      
      const skipped = taskList.filter(t => t.status === 'skipped').map(t => ({
        ...t,
        client: allClients.find(c => c.id === t.clientId)
      }));
      setSkippedTasks(skipped);

      const operators = userList.filter(u => u.role === UserRole.OPERATOR || u.role === UserRole.SUPERVISOR);
      if (operators.length > 0 && !selectedOperatorId) {
        setSelectedOperatorId(operators[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => { refreshData(); }, []);

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    setIsProcessing(true);
    try {
      await dataService.updateUser(id, updates);
      await refreshData();
    } catch (e) { 
      alert("Erro ao atualizar usuário."); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await dataService.createUser(userData);
      setIsUserModalOpen(false);
      setUserData({ name: '', username: '', password: '', role: UserRole.OPERATOR });
      await refreshData();
      alert("Usuário criado com sucesso!");
    } catch (e) {
      alert("Erro ao criar usuário.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionData.text || !questionData.options || questionData.options.length === 0) return alert("Preencha o texto e ao menos uma opção.");
    
    setIsProcessing(true);
    try {
      await dataService.saveQuestion({ ...questionData, order: questionData.order || questions.length + 1 });
      setIsQuestionModalOpen(false);
      setQuestionData({ text: '', options: [], type: 'ALL' as any, stageId: '' });
      await refreshData();
    } catch (e) { alert("Erro ao salvar pergunta."); }
    finally { setIsProcessing(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
          alert("O arquivo CSV está vazio ou contém apenas cabeçalhos.");
          return;
        }
        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ""));
        const rows = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim());
          return headers.reduce((acc, header, i) => { acc[header] = values[i] || ''; return acc; }, {} as any);
        });
        const mapped = rows.map(r => ({
          name: r.nome || r.cliente || r.name,
          phone: r.telefone || r.celular || r.phone,
          address: r.endereco || r.address,
          equipment: r.equipamento || r.item || r.equipment
        })).filter(r => r.name && r.phone);
        setCsvPreview(mapped);
      } catch (err) { 
        console.error(err);
        alert("Erro ao ler CSV. Verifique o formato."); 
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (csvPreview.length === 0 || isProcessing) return;
    if (!selectedOperatorId) {
      alert("Selecione um operador para atribuir as tarefas.");
      return;
    }

    setIsProcessing(true);
    try {
      let count = 0;
      for (const row of csvPreview) {
        const client = await dataService.upsertClient({ 
          name: row.name, 
          phone: row.phone, 
          address: row.address, 
          items: row.equipment ? [row.equipment] : [] 
        });
        await dataService.createTask({ 
          clientId: client.id, 
          type: selectedCallType, 
          assignedTo: selectedOperatorId 
        });
        count++;
      }
      alert(`${count} tarefas importadas com sucesso!`);
      setCsvPreview([]);
      await refreshData();
    } catch (e) {
      console.error(e);
      alert("Erro durante a importação.");
    } finally { setIsProcessing(false); }
  };

  const handleRecoverTask = async (taskId: string) => {
    setIsProcessing(true);
    try {
      await dataService.updateTask(taskId, { status: 'pending' });
      await refreshData();
      alert("Tarefa restaurada para a fila com sucesso!");
    } catch (e) {
      alert("Erro ao restaurar tarefa.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Gestão Operacional Dreon</h2>
          <p className="text-slate-500 text-sm font-medium">Controle total da plataforma.</p>
        </div>
        <button onClick={refreshData} disabled={isProcessing} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all disabled:opacity-50">
          <RefreshCw size={20} className={isProcessing ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'questions', label: 'Questionário', icon: ListFilter },
          { id: 'import', label: 'Carga CSV', icon: FileSpreadsheet },
          { id: 'skips', label: 'Recuperar Pulados', icon: RotateCcw },
          { id: 'users', label: 'Equipe', icon: Users }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Equipe e Permissões</h3>
                <p className="text-xs text-slate-400 font-bold">Gerencie os acessos e funções dos colaboradores.</p>
              </div>
              <button onClick={() => setIsUserModalOpen(true)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-2">
                <UserPlus size={18} /> Novo Usuário
              </button>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-slate-100">
                       <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Colaborador</th>
                       <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Função</th>
                       <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-all">
                         <td className="py-6 px-4">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{u.name.charAt(0)}</div>
                               <div>
                                  <p className="font-black text-slate-800">{u.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">@{u.username}</p>
                               </div>
                            </div>
                         </td>
                         <td className="py-6 px-4">
                            <select 
                              value={u.role} 
                              onChange={(e) => handleUpdateUser(u.id, { role: e.target.value as UserRole })}
                              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-slate-700 outline-none"
                            >
                               {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                         </td>
                         <td className="py-6 px-4">
                            <button 
                              onClick={() => handleUpdateUser(u.id, { active: !u.active })}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${u.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                            >
                               {u.active ? <><UserCheck size={14} /> Ativo</> : <><UserMinus size={14} /> Inativo</>}
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Gerenciador de Questionário</h3>
                <p className="text-xs text-slate-400 font-bold">Configure as perguntas dinâmicas do sistema.</p>
              </div>
              <button onClick={() => { setQuestionData({ text: '', options: [], type: CallType.POS_VENDA }); setIsQuestionModalOpen(true); }} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-2">
                <MessageSquarePlus size={18} /> Nova Pergunta
              </button>
           </div>
           
           <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] flex items-center gap-6 group hover:border-blue-200 transition-all">
                   <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">{q.type}</span>
                        <span className="text-slate-300 font-black text-[10px]">#ORDEM {q.order}</span>
                      </div>
                      <h4 className="font-black text-slate-800">{q.text}</h4>
                      <p className="text-xs text-slate-400 font-bold">{q.options.join(' • ')}</p>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => { setQuestionData(q); setIsQuestionModalOpen(true); }} className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-xl shadow-sm"><Edit3 size={16} /></button>
                      <button onClick={async () => { if(confirm("Remover pergunta?")) { await dataService.deleteQuestion(q.id); refreshData(); } }} className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm"><Trash size={16} /></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-10 animate-in fade-in duration-300">
           <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Carga de Trabalho (CSV)</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Importe clientes e crie tarefas em massa.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Selecione o Operador Destinatário</label>
                    <select 
                      value={selectedOperatorId} 
                      onChange={e => setSelectedOperatorId(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[11px] uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    >
                      <option value="">Selecione um operador...</option>
                      {users.filter(u => u.role === UserRole.OPERATOR || u.role === UserRole.SUPERVISOR).map(u => (
                        <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                      ))}
                    </select>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Tipo de Chamada</label>
                    <div className="grid grid-cols-2 gap-2">
                       {Object.values(CallType).map(type => (
                         <button 
                           key={type} 
                           onClick={() => setSelectedCallType(type)}
                           className={`p-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${selectedCallType === type ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                         >
                            {type}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Escolha o Arquivo</label>
                    <div className="relative group">
                       <input 
                         type="file" 
                         accept=".csv" 
                         onChange={handleFileUpload}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                       />
                       <div className="p-12 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center gap-4 group-hover:bg-slate-50 group-hover:border-blue-100 transition-all">
                          <Upload className="text-slate-300 group-hover:text-blue-500 transition-colors" size={48} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clique ou arraste o arquivo CSV</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100 flex flex-col">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Info size={14} /> Prévia da Importação
                 </h4>
                 <div className="flex-1 overflow-auto custom-scrollbar">
                    {csvPreview.length > 0 ? (
                       <table className="w-full text-left text-[10px] font-bold">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                             <tr>
                                <th className="pb-3 text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="pb-3 text-slate-400 uppercase tracking-widest text-right">Telefone</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {csvPreview.map((row, i) => (
                               <tr key={i}>
                                  <td className="py-3 text-slate-800">{row.name}</td>
                                  <td className="py-3 text-slate-500 text-right">{row.phone}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                          <FileSpreadsheet size={40} className="mb-4" />
                          <p className="uppercase font-black text-[9px] tracking-widest">Nenhum dado selecionado</p>
                       </div>
                    )}
                 </div>
                 {csvPreview.length > 0 && (
                   <button 
                     onClick={runImport} 
                     disabled={isProcessing}
                     className="mt-6 w-full py-6 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                   >
                     {isProcessing ? <Loader2 className="animate-spin" /> : <Database size={16} />} 
                     Processar {csvPreview.length} Registros
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'skips' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
           <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Tarefas Puladas</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Recupere contatos que foram ignorados pelos operadores.</p>
           </div>

           {skippedTasks.length === 0 ? (
             <div className="py-20 flex flex-col items-center justify-center gap-6 opacity-30">
                <RotateCcw size={64} className="text-slate-300" />
                <p className="font-black uppercase text-xs tracking-widest text-slate-400">Nenhuma tarefa ignorada encontrada.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {skippedTasks.map((task) => (
                   <div key={task.id} className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex flex-col justify-between group hover:border-blue-200 transition-all">
                      <div className="space-y-4">
                         <div className="flex justify-between items-start">
                            <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest">{task.type}</span>
                            <span className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1"><AlertCircle size={12}/> Pulado</span>
                         </div>
                         <div>
                            <h4 className="text-lg font-black text-slate-800 tracking-tighter">{task.client?.name || 'Cliente Desconhecido'}</h4>
                            <p className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-1"><Phone size={14} className="text-blue-500" /> {task.client?.phone}</p>
                         </div>
                         <div className="p-4 bg-white rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Motivo informado:</p>
                            <p className="text-xs font-bold text-slate-700 italic">"{task.skipReason || 'Não informado'}"</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleRecoverTask(task.id)}
                        disabled={isProcessing}
                        className="mt-8 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                      >
                         <PlayCircle size={14} /> Restaurar para Fila
                      </button>
                   </div>
                ))}
             </div>
           )}
        </div>
      )}

      {/* QUESTION MODAL */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black flex items-center gap-3">Nova Pergunta</h3>
                 <button onClick={() => setIsQuestionModalOpen(false)}><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveQuestion} className="p-8 space-y-5">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto da Pergunta</label>
                    <textarea required value={questionData.text} onChange={e => setQuestionData({...questionData, text: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm h-24 outline-none" />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opções (Pressione Enter)</label>
                    <input value={optionInput} onChange={e => setOptionInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(optionInput) { setQuestionData({...questionData, options: [...(questionData.options || []), optionInput]}); setOptionInput(''); } } }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" placeholder="Ex: Sim, Não, Talvez" />
                    <div className="flex flex-wrap gap-2">
                       {questionData.options?.map((opt, i) => (
                         <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                            {opt} <button type="button" onClick={() => setQuestionData({...questionData, options: questionData.options?.filter((_, idx) => idx !== i)})}><X size={12}/></button>
                         </span>
                       ))}
                    </div>
                 </div>
                 <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px]">Salvar Pergunta</button>
              </form>
           </div>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter">Novo Colaborador</h3>
                 <button onClick={() => setIsUserModalOpen(false)}><X size={24} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="p-8 space-y-4">
                 <input type="text" placeholder="Nome Completo" required value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 <input type="text" placeholder="Username (login)" required value={userData.username} onChange={e => setUserData({...userData, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 <input type="password" placeholder="Senha" required value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 <select value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as UserRole})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                    {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                 </select>
                 <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px]">Criar Usuário</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
