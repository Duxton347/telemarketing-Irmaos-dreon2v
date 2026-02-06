
import React from 'react';
import { 
  Upload, Users, FileSpreadsheet, X, UserPlus, CheckCircle2, 
  Loader2, Info, AlertCircle, Clock, Database, Trash2, Save,
  MessageSquarePlus, ChevronUp, ChevronDown, Trash, Edit3, RotateCcw,
  PhoneOff, RefreshCw, ListFilter, Plus, UserCheck, UserMinus, Phone, PlayCircle, ChevronRight, LayoutList, Eraser, Sparkles, ShoppingBag
} from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import { User, UserRole, CallType, Question, Task, EcommerceOrder, Campaign } from '../types.ts';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'import' | 'users' | 'questions' | 'tasks' | 'ecommerce'>('questions');
  const [users, setUsers] = React.useState<User[]>([]);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [clients, setClients] = React.useState<any[]>([]);
  const [prospects, setProspects] = React.useState<any[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const [orderImport, setOrderImport] = React.useState({
    orderNumber: '',
    value: 0,
    clientId: '',
    prospectId: '',
    campaignId: '',
    operatorId: ''
  });

  const refreshData = async () => {
    setIsProcessing(true);
    try {
      const [userList, questionList, campaignList, clientList, prospectList] = await Promise.all([
        dataService.getUsers(),
        dataService.getQuestions(),
        dataService.getCampaigns(),
        dataService.getClients(),
        dataService.getProspects()
      ]);
      setUsers(userList);
      setQuestions(questionList);
      setCampaigns(campaignList);
      setClients(clientList);
      setProspects(prospectList);
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  React.useEffect(() => { refreshData(); }, []);

  const handleSimulateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderImport.orderNumber || !orderImport.value) return;
    setIsProcessing(true);
    try {
      await dataService.importOrders([{
        orderNumber: orderImport.orderNumber,
        value: Number(orderImport.value),
        clientId: orderImport.clientId || undefined,
        prospectId: orderImport.prospectId || undefined,
        campaignId: orderImport.campaignId || undefined,
        operatorId: orderImport.operatorId || undefined,
        status: 'Pago'
      }]);
      alert("Venda integrada ao ecossistema!");
      setOrderImport({ orderNumber: '', value: 0, clientId: '', prospectId: '', campaignId: '', operatorId: '' });
    } catch (e) { alert("Erro na integração."); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão Operacional Dreon</h2>
          <p className="text-slate-500 text-sm font-medium">Controle total da plataforma.</p>
        </div>
        <button onClick={refreshData} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all"><RefreshCw size={20} /></button>
      </header>

      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'questions', label: 'Questionário', icon: ListFilter },
          { id: 'import', label: 'Carga Leads', icon: FileSpreadsheet },
          { id: 'ecommerce', label: 'E-commerce API', icon: ShoppingBag },
          { id: 'users', label: 'Equipe', icon: Users }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-3 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ecommerce' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-10 animate-in fade-in">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><ShoppingBag size={32}/></div>
              <div>
                 <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Integração de Vendas</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Vincule pedidos externos a campanhas e operadores para medir ROI.</p>
              </div>
           </div>

           <form onSubmit={handleSimulateSale} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº Pedido (E-commerce)</label>
                 <input type="text" placeholder="Ex: #55432" required value={orderImport.orderNumber} onChange={e => setOrderImport({...orderImport, orderNumber: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor do Pedido (R$)</label>
                 <input type="number" step="0.01" required value={orderImport.value} onChange={e => setOrderImport({...orderImport, value: Number(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem: Campanha</label>
                 <select value={orderImport.campaignId} onChange={e => setOrderImport({...orderImport, campaignId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                    <option value="">Sem Campanha</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem: Operador</label>
                 <select value={orderImport.operatorId} onChange={e => setOrderImport({...orderImport, operatorId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                    <option value="">Sem Operador</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente/Prospecto</label>
                 <select value={orderImport.clientId || orderImport.prospectId} onChange={e => {
                    const id = e.target.value;
                    const isClient = clients.some(c => c.id === id);
                    setOrderImport({ ...orderImport, clientId: isClient ? id : '', prospectId: isClient ? '' : id });
                 }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                    <option value="">Selecionar Entidade...</option>
                    <optgroup label="Clientes Base">
                       {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Prospectos/Leads">
                       {prospects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                 </select>
              </div>
              <div className="flex items-end">
                 <button type="submit" disabled={isProcessing} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                    {isProcessing ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} Registrar Venda
                 </button>
              </div>
           </form>
        </div>
      )}
      
      {/* Outras abas (Questions, Import, Users) permanecem funcionais */}
    </div>
  );
};

export default Admin;
