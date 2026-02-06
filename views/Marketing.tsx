
import React from 'react';
import { 
  Megaphone, Plus, Target, BarChart3, TrendingUp, Users, 
  Mail, MessageCircle, MapPin, Loader2, Download, Save, X,
  ShieldCheck, ShieldAlert, ArrowUpRight, Zap, RefreshCw, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { dataService } from '../services/dataService';
import { Campaign, CampaignStatus, Client, Prospect, UserRole } from '../types';

const Marketing: React.FC<{ user: any }> = ({ user }) => {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  
  const [newCampaign, setNewCampaign] = React.useState({
    name: '',
    type: 'WhatsApp' as any,
    targetType: 'Prospect' as 'Client' | 'Prospect',
    startDate: new Date().toISOString().split('T')[0]
  });

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allCampaigns, allClients, allProspects] = await Promise.all([
        dataService.getCampaigns(),
        dataService.getClients(),
        dataService.getProspects()
      ]);
      setCampaigns(allCampaigns);
      setClients(allClients);
      setProspects(allProspects);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = newCampaign.targetType === 'Client' ? clients : prospects;
    const authorizedTargets = targets.filter(t => t.marketingAuthorized);
    
    const campaign: Partial<Campaign> = {
      name: newCampaign.name,
      type: newCampaign.type,
      status: CampaignStatus.ATIVA,
      targetCount: authorizedTargets.length,
      startDate: newCampaign.startDate,
      openCount: 0,
      clickCount: 0,
      convertedCount: 0,
      conversionValue: 0
    };

    try {
      await dataService.saveCampaign(campaign);
      setIsModalOpen(false);
      await loadData();
    } catch (e) { alert("Erro ao criar campanha."); }
  };

  const handleExportList = (campaign: Campaign) => {
    // Simula a exportação filtrada por Opt-In
    const targets = prospects.filter(p => p.marketingAuthorized);
    const headers = "NOME;TELEFONE;EMAIL;CIDADE\n";
    const rows = targets.map(t => `"${t.name}";"${t.phone}";"${t.email || ''}";"${t.address || ''}"`).join("\n");
    const blob = new Blob(["\ufeff" + headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `Segmentacao_Campanha_${campaign.name}.csv`;
    link.click();
    document.body.removeChild(link);
  };

  const summaryStats = React.useMemo(() => {
    const totalSpent = 0; // Seria vindo de custos
    const totalReturn = campaigns.reduce((acc, c) => acc + c.conversionValue, 0);
    const totalLeads = prospects.length;
    const authorized = prospects.filter(p => p.marketingAuthorized).length;

    return { totalReturn, totalLeads, authorizedPercentage: (authorized / totalLeads) * 100 };
  }, [campaigns, prospects]);

  if (isLoading) return (
    <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Escaneando Mercado...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Marketing & Growth</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestão de autoridade e conversão</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setIsModalOpen(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center gap-3">
             <Plus size={18} /> Criar Campanha
           </button>
        </div>
      </header>

      {/* METRICAS DE CONFORMIDADE E GROWTH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-between group">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Autorização Marketing</p>
               <h3 className="text-4xl font-black text-emerald-500">{summaryStats.authorizedPercentage.toFixed(1)}%</h3>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
               <ShieldCheck size={28} />
            </div>
         </div>
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-between group">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retorno (ROAS)</p>
               <h3 className="text-4xl font-black text-blue-600">R$ {summaryStats.totalReturn.toLocaleString()}</h3>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
               <TrendingUp size={28} />
            </div>
         </div>
         <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl flex items-center justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={80} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Prospectos</p>
               <h3 className="text-4xl font-black">{summaryStats.totalLeads}</h3>
            </div>
            <div className="p-4 rounded-2xl bg-white/10">
               <Users size={28} />
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* LISTA DE CAMPANHAS */}
         <div className="lg:col-span-8 bg-white p-10 rounded-[56px] border border-slate-100 shadow-sm space-y-8">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3"><Megaphone size={18} className="text-blue-600"/> Campanhas Ativas</h4>
            <div className="space-y-4">
               {campaigns.map(c => (
                 <div key={c.id} className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-blue-200 transition-all">
                    <div className="flex-1 space-y-2">
                       <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${c.status === 'Ativa' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{c.status}</span>
                          <span className="text-[10px] font-black text-slate-300">#{c.type}</span>
                       </div>
                       <h5 className="text-xl font-black text-slate-800 tracking-tight">{c.name}</h5>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início: {new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0 text-center">
                       <div><p className="text-[8px] font-black text-slate-400 uppercase">Alcance</p><p className="font-black text-slate-800">{c.targetCount}</p></div>
                       <div><p className="text-[8px] font-black text-slate-400 uppercase">Cliques</p><p className="font-black text-blue-600">{c.clickCount}</p></div>
                       <div><p className="text-[8px] font-black text-slate-400 uppercase">Conversão</p><p className="font-black text-emerald-600">{c.convertedCount}</p></div>
                       <div><p className="text-[8px] font-black text-slate-400 uppercase">Valor</p><p className="font-black text-slate-900">R${c.conversionValue}</p></div>
                    </div>

                    <div className="flex items-center gap-2">
                       <button onClick={() => handleExportList(c)} className="p-4 bg-white text-slate-400 hover:text-blue-600 rounded-2xl shadow-sm border border-slate-100 transition-all"><Download size={20}/></button>
                       <button className="p-4 bg-white text-slate-400 hover:text-emerald-600 rounded-2xl shadow-sm border border-slate-100 transition-all"><RefreshCw size={20}/></button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* FUNIL DE MARKETING */}
         <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[56px] text-white shadow-2xl flex flex-col justify-between overflow-hidden relative">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10">Funil de Conversão</h4>
            <div className="space-y-12">
               {[
                 { label: 'Autorizados', value: summaryStats.authorizedPercentage.toFixed(0) + '%', color: 'bg-emerald-500' },
                 { label: 'Engajados', value: '45%', color: 'bg-blue-500' },
                 { label: 'Vendas', value: '12%', color: 'bg-indigo-500' }
               ].map((step, i) => (
                 <div key={i} className="space-y-4">
                    <div className="flex justify-between items-end">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{step.label}</p>
                       <p className="text-3xl font-black">{step.value}</p>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className={`h-full ${step.color}`} style={{ width: step.value }}></div>
                    </div>
                 </div>
               ))}
            </div>
            <div className="pt-10 border-t border-white/5 mt-10">
               <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center gap-4">
                  <ShieldCheck className="text-emerald-400" />
                  <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditado LGPD</p>
                     <p className="text-[11px] font-bold">100% dos envios são autorizados</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* MODAL NOVA CAMPANHA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">Planejar Campanha</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-10 space-y-6">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Título da Ação</label>
                 <input type="text" placeholder="Ex: Black Friday Piscina" required value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal</label>
                    <select value={newCampaign.type} onChange={e => setNewCampaign({...newCampaign, type: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                       <option value="WhatsApp">WhatsApp</option>
                       <option value="E-mail">E-mail</option>
                       <option value="Visita">Visita Comercial</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Início</label>
                    <input type="date" value={newCampaign.startDate} onChange={e => setNewCampaign({...newCampaign, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs" />
                 </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Público Alvo</label>
                 <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setNewCampaign({...newCampaign, targetType: 'Prospect'})} className={`p-4 rounded-xl text-[10px] font-black uppercase border transition-all ${newCampaign.targetType === 'Prospect' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400'}`}>Prospectos</button>
                    <button type="button" onClick={() => setNewCampaign({...newCampaign, targetType: 'Client'})} className={`p-4 rounded-xl text-[10px] font-black uppercase border transition-all ${newCampaign.targetType === 'Client' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400'}`}>Clientes Base</button>
                 </div>
              </div>
              <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl flex items-center gap-3">
                 <ShieldCheck size={18} />
                 <p className="text-[10px] font-black uppercase">O sistema filtrará apenas contatos com opt-in autorizado.</p>
              </div>
              <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all">Lançar Campanha</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketing;
