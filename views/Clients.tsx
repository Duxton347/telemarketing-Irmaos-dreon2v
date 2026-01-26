
import React from 'react';
import { 
  Search, 
  UserPlus, 
  ChevronRight, 
  Phone, 
  History,
  Users,
  Calendar,
  X,
  MapPin,
  Tag,
  Save,
  Copy,
  MessageSquare
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { SATISFACTION_EMOJIS } from '../constants';
import { Client, CallRecord } from '../types';

const Clients: React.FC = () => {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [search, setSearch] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientHistory, setClientHistory] = React.useState<CallRecord[]>([]);
  const [copied, setCopied] = React.useState(false);
  
  // States Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newClient, setNewClient] = React.useState({
    name: '',
    phone: '',
    address: '',
    items: ''
  });

  const loadClients = async () => {
    const allClients = await dataService.getClients();
    setClients(allClients);
  };

  React.useEffect(() => {
    loadClients();
  }, []);

  // Correctly await asynchronous calls in history effect
  React.useEffect(() => {
    const loadHistory = async () => {
      if (selectedClient) {
        const allCalls = await dataService.getCalls();
        const filtered = allCalls.filter(c => c.clientId === selectedClient.id);
        setClientHistory(filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      }
    };
    loadHistory();
  }, [selectedClient]);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) return;

    await dataService.upsertClient({
      name: newClient.name,
      phone: newClient.phone,
      address: newClient.address,
      items: newClient.items.split(',').map(i => i.trim()).filter(i => i),
      acceptance: 'medium',
      satisfaction: 'medium'
    });

    setIsModalOpen(false);
    setNewClient({ name: '', phone: '', address: '', items: '' });
    await loadClients();
    alert('Cliente cadastrado com sucesso!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Base de Clientes</h2>
          <p className="text-slate-500">Cadastro centralizado e histórico de interações.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <UserPlus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-[600px] flex flex-col">
          <div className="p-4 border-b border-slate-50 font-black text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50">
            Lista de Clientes ({filteredClients.length})
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`w-full text-left p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedClient?.id === client.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-bold text-slate-900 truncate">{client.name}</h4>
                    <p className="text-xs text-slate-500">{client.phone}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{SATISFACTION_EMOJIS[client.satisfaction]}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm italic">Nenhum cliente encontrado.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
          {selectedClient ? (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start border-b border-slate-50 pb-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{selectedClient.name}</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-blue-500" /> {selectedClient.phone}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => copyToClipboard(selectedClient.phone)}
                          title="Copiar número"
                          className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                        >
                          <Copy size={12} />
                        </button>
                        <button 
                          onClick={() => openWhatsApp(selectedClient.phone)}
                          title="Abrir no WhatsApp"
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                        >
                          <MessageSquare size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-sm font-bold">
                      <MapPin size={14} className="text-red-500" /> {selectedClient.address || 'Sem endereço'}
                    </div>
                  </div>
                </div>
                <span className="text-4xl filter drop-shadow-md">{SATISFACTION_EMOJIS[selectedClient.satisfaction]}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Portfólio do Cliente</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.items.length > 0 ? selectedClient.items.map(item => (
                      <span key={item} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold shadow-sm">
                        {item}
                      </span>
                    )) : <span className="text-xs text-slate-400 italic">Nenhum item vinculado</span>}
                  </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Status de Atendimento</h4>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${
                      selectedClient.acceptance === 'high' ? 'bg-green-600 text-white' :
                      selectedClient.acceptance === 'medium' ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'
                    }`}>
                      Aceitação {selectedClient.acceptance === 'high' ? 'Alta' : selectedClient.acceptance === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <History size={20} className="text-blue-600" />
                  Linha do Tempo de Interações
                </h4>
                <div className="space-y-4">
                  {clientHistory.length > 0 ? (
                    clientHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${
                            h.type === 'VENDA' ? 'bg-blue-600' : h.type === 'PÓS-VENDA' ? 'bg-green-500' : 'bg-yellow-500'
                          }`}>
                            {h.type.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{h.type}</p>
                            <p className="text-xs text-slate-400 font-medium">
                              {new Date(h.startTime).toLocaleDateString('pt-BR')} às {new Date(h.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-sm font-black text-slate-700">{Math.floor(h.duration / 60)}m {h.duration % 60}s</span>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Tempo em linha</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <History size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 text-sm font-medium">Sem interações registradas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-300 space-y-4">
              <Users size={80} strokeWidth={1} />
              <p className="font-bold uppercase tracking-widest text-xs">Selecione um cliente para detalhamento</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserPlus size={24} className="text-blue-400" />
                Novo Cadastro de Cliente
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveClient} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Nome do Cliente</label>
                <input 
                  type="text" 
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                  placeholder="Nome completo ou Razão Social"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Telefone (Whatsapp)</label>
                  <input 
                    type="text" 
                    required
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                    placeholder="Ex: 11999999999"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Equipamentos (separados por vírgula)</label>
                  <input 
                    type="text" 
                    value={newClient.items}
                    onChange={(e) => setNewClient({...newClient, items: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                    placeholder="Ex: Piscina, Filtro, Capa"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Endereço de Atendimento</label>
                <textarea 
                  value={newClient.address}
                  onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium h-24 resize-none"
                  placeholder="Rua, Número, Bairro, Cidade..."
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
