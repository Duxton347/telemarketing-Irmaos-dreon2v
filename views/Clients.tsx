
import React from 'react';
import { 
  Search, UserPlus, ChevronRight, Phone, History, Users, Calendar, X,
  MapPin, Tag, Save, Copy, MessageSquare, Edit2, Loader2, Database, ClipboardList, Clock, CheckCircle2, FileText, Download
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { SATISFACTION_EMOJIS } from '../constants';
import { Client, CallRecord, UserRole, Protocol, ProtocolStatus } from '../types';

const Clients: React.FC<{ user: any }> = ({ user }) => {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientHistory, setClientHistory] = React.useState<{ calls: CallRecord[], protocols: Protocol[] }>({ calls: [], protocols: [] });
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  
  const [clientData, setClientData] = React.useState({
    id: '',
    name: '',
    phone: '',
    address: '',
    items: ''
  });

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const allClients = await dataService.getClients();
      setClients(allClients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => { loadClients(); }, []);

  React.useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedClient) return;
      setHistoryLoading(true);
      try {
        const [allCalls, allProtocols] = await Promise.all([
          dataService.getCalls(),
          dataService.getProtocols()
        ]);
        setClientHistory({
          calls: allCalls.filter(c => c.clientId === selectedClient.id),
          protocols: allProtocols.filter(p => p.clientId === selectedClient.id)
        });
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
      } finally {
        setTimeout(() => setHistoryLoading(false), 300);
      }
    };
    fetchHistory();
  }, [selectedClient]);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.name || !clientData.phone) return;

    setIsProcessing(true);
    try {
      await dataService.upsertClient({
        id: clientData.id || undefined,
        name: clientData.name,
        phone: clientData.phone,
        address: clientData.address,
        items: clientData.items.split(',').map(i => i.trim()).filter(i => i),
      });

      setIsModalOpen(false);
      setEditMode(false);
      setClientData({ id: '', name: '', phone: '', address: '', items: '' });
      await loadClients();
    } catch (e) { alert("Erro ao salvar cliente."); }
    finally { setIsProcessing(false); }
  };

  const handleExportList = () => {
    const headers = "NOME;TELEFONE;ENDERECO;ITENS\n";
    const rows = filtered.map(c => `"${c.name}";"${c.phone}";"${c.address}";"${c.items.join(', ')}"`).join("\n");
    const blob = new Blob(["\ufeff" + headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `Lista_Segmentada_Dreon.csv`;
    link.click();
    document.body.removeChild(link);
  };

  const startEdit = (c: Client) => {
    setClientData({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      items: (c.items || []).join(', ')
    });
    setEditMode(true);
    setIsModalOpen(true);
  };

  const filtered = (clients || []).filter(c => 
    (c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.phone || '').includes(search)
  );

  const canEdit = [UserRole.ADMIN, UserRole.SUPERVISOR].includes(user.role);
  const canExport = [UserRole.ADMIN, UserRole.ANALISTA_MARKETING].includes(user.role);
  const canCreate = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR_TELEMARKETING].includes(user.role);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Base de Clientes</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">Consulta e gestão de contatos da base.</p>
        </div>
        <div className="flex gap-3">
           {canExport && filtered.length > 0 && (
             <button onClick={handleExportList} className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:border-emerald-500 transition-all">
               <Download size={18} /> Exportar Lista
             </button>
           )}
           {canCreate && (
             <button onClick={() => { setEditMode(false); setClientData({id:'', name:'', phone:'', address:'', items:''}); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all">
               <UserPlus size={18} /> Novo Cliente
             </button>
           )}
        </div>
      </header>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
         <Search className="text-slate-400 shrink-0" size={20} />
         <input 
          type="text" 
          placeholder="Pesquisar por nome ou telefone..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700 placeholder:text-slate-300"
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
        <div className="lg:col-span-4 space-y-4 h-full flex flex-col">
           {isLoading ? (
             <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-300">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</p>
             </div>
           ) : (
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {filtered.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedClient(c)}
                    className={`w-full p-6 bg-white border-2 rounded-[32px] flex items-center justify-between transition-all ${selectedClient?.id === c.id ? 'border-blue-600 shadow-xl shadow-blue-500/10' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`}
                  >
                     <div className="text-left">
                        <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">{c.name}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.phone}</span>
                     </div>
                     <ChevronRight size={18} className={selectedClient?.id === c.id ? 'text-blue-600' : 'text-slate-200'} />
                  </button>
                ))}
             </div>
           )}
        </div>

        <div className="lg:col-span-8 h-full">
           {selectedClient ? (
             <div className="bg-white h-full rounded-[56px] shadow-sm border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-right-4">
                <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                   <div className="space-y-4">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{selectedClient.name}</h3>
                      <div className="flex flex-wrap items-center gap-6">
                         <span className="flex items-center gap-2 text-sm font-black text-blue-600"><Phone size={16} /> {selectedClient.phone}</span>
                         <span className="flex items-start gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><MapPin size={16} className="shrink-0" /> {selectedClient.address || 'Sem endereço'}</span>
                      </div>
                   </div>
                   <div className="flex flex-col items-center gap-2">
                      <div className="text-6xl">{SATISFACTION_EMOJIS[selectedClient.satisfaction] || '😐'}</div>
                      {canEdit && (
                        <button onClick={() => startEdit(selectedClient)} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                          <Edit2 size={12} /> Editar
                        </button>
                      )}
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                   <section className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2"><Tag size={14} /> Equipamentos</h5>
                      <div className="flex flex-wrap gap-2">
                         {selectedClient.items?.map((item, i) => (
                           <span key={i} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase border border-blue-100">{item}</span>
                         ))}
                      </div>
                   </section>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <section className="space-y-4">
                         <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2"><History size={14} /> Ligações</h5>
                         {clientHistory.calls.length > 0 ? clientHistory.calls.map(call => (
                           <div key={call.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                              <p className="text-xs font-bold text-slate-700 italic">"{call.responses?.written_report || 'Sem resumo'}"</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase">{new Date(call.startTime).toLocaleDateString()}</p>
                           </div>
                         )) : <p className="text-[10px] font-black text-slate-300 uppercase py-4">Sem registros</p>}
                      </section>

                      <section className="space-y-4">
                         <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2"><ClipboardList size={14} /> Protocolos</h5>
                         {clientHistory.protocols.length > 0 ? clientHistory.protocols.map(proto => (
                           <div key={proto.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                              <h6 className="text-sm font-black text-slate-800 leading-tight">{proto.title}</h6>
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">{proto.status}</span>
                           </div>
                         )) : <p className="text-[10px] font-black text-slate-300 uppercase py-4">Sem registros</p>}
                      </section>
                   </div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-slate-50 border-4 border-dashed border-slate-100 rounded-[56px] flex flex-col items-center justify-center p-20 text-center gap-6 opacity-40">
                <Users size={64} className="text-slate-300" />
                <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Selecione um cliente para auditar o histórico</p>
             </div>
           )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                {editMode ? 'Editar Cadastro' : 'Novo Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveClient} className="p-10 space-y-6">
              <input type="text" placeholder="Nome Completo" required value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <input type="text" placeholder="Telefone" required value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <input type="text" placeholder="Itens (ex: Bomba, Filtro)" value={clientData.items} onChange={e => setClientData({...clientData, items: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <textarea placeholder="Endereço" value={clientData.address} onChange={e => setClientData({...clientData, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold h-24 resize-none" />
              <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px]">
                {editMode ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
