
import React from 'react';
import L from 'leaflet';
import { dataService } from '../services/dataService';
import { Client, Prospect, Protocol, CallRecord, CallType, ProtocolStatus } from '../types';
import { 
  Filter, MapPin, Users, Phone, ShieldCheck, 
  AlertTriangle, FileBarChart, Loader2, Download, X,
  Maximize2, Minimize2, ChevronRight, Search, Wrench
} from 'lucide-react';

const MapView: React.FC = () => {
  const mapRef = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<L.LayerGroup | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const [filterType, setFilterType] = React.useState<'all' | 'client' | 'prospect' | 'protocol' | 'assistance'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [stats, setStats] = React.useState({
    clients: 0,
    prospects: 0,
    protocols: 0,
    assistance: 0
  });

  const initMap = React.useCallback(() => {
    if (mapRef.current) return;
    const map = L.map('map-container').setView([-23.5505, -46.6333], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      });
    }
  }, []);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allClients, allProspects, allProtocols] = await Promise.all([
        dataService.getClients(),
        dataService.getProspects(),
        dataService.getProtocols()
      ]);
      setClients(allClients);
      setProspects(allProspects);
      setProtocols(allProtocols);
      setStats({
        clients: allClients.length,
        prospects: allProspects.length,
        protocols: allProtocols.filter(p => p.status !== ProtocolStatus.FECHADO).length,
        assistance: allProtocols.filter(p => (p.departmentId === 'tecnico' || p.originCallType === CallType.ASSISTENCIA) && p.status !== ProtocolStatus.FECHADO).length
      });
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { initMap(); loadData(); }, [initMap, loadData]);

  const updateMarkers = React.useCallback(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();

    const createIcon = (color: string, isAssistance?: boolean) => L.divIcon({
      html: `<div style="background-color: ${color}; width: ${isAssistance ? '20px' : '14px'}; height: ${isAssistance ? '20px' : '14px'}; border: 2px solid white; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">${isAssistance ? '<span style="color: white; font-size: 10px; font-weight: 900;">W</span>' : ''}</div>`,
      className: 'custom-div-icon',
      iconSize: isAssistance ? [20, 20] : [14, 14],
      iconAnchor: isAssistance ? [10, 10] : [7, 7]
    });

    const icons = {
      client: createIcon('#2563eb'),
      prospect: createIcon('#f59e0b'),
      protocol: createIcon('#ef4444'),
      assistance: createIcon('#991b1b', true)
    };

    let bounds = L.latLngBounds([]);
    let count = 0;

    if (filterType === 'all' || filterType === 'prospect') {
      prospects.forEach(p => {
        if (p.latitude && p.longitude) {
          if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return;
          markersRef.current?.addLayer(L.marker([p.latitude, p.longitude], { icon: icons.prospect }).bindPopup(`<strong>${p.name}</strong><br/>Lead: ${p.status}`));
          bounds.extend([p.latitude, p.longitude]); count++;
        }
      });
    }

    if (filterType === 'all' || filterType === 'client') {
      clients.forEach(c => {
        if (c.latitude && c.longitude) {
          if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return;
          markersRef.current?.addLayer(L.marker([c.latitude, c.longitude], { icon: icons.client }).bindPopup(`<strong>${c.name}</strong><br/>Cliente Ativo`));
          bounds.extend([c.latitude, c.longitude]); count++;
        }
      });
    }

    if (filterType === 'all' || filterType === 'protocol' || filterType === 'assistance') {
      protocols.filter(p => p.status !== ProtocolStatus.FECHADO).forEach(p => {
        const isAssistance = p.departmentId === 'tecnico' || p.originCallType === CallType.ASSISTENCIA;
        if (filterType === 'assistance' && !isAssistance) return;
        if (filterType === 'protocol' && isAssistance) return;

        const entity = p.clientId ? clients.find(c => c.id === p.clientId) : prospects.find(pr => pr.id === p.prospectId);
        if (entity?.latitude && entity?.longitude) {
          if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return;
          markersRef.current?.addLayer(L.marker([entity.latitude, entity.longitude], { icon: isAssistance ? icons.assistance : icons.protocol })
            .bindPopup(`<strong>${isAssistance ? 'ASSISTÊNCIA' : 'Protocolo'}: ${p.title}</strong><br/>Ref: ${entity.name}`));
          bounds.extend([entity.latitude, entity.longitude]); count++;
        }
      });
    }

    if (count > 0 && mapRef.current) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, [clients, prospects, protocols, filterType, searchQuery]);

  React.useEffect(() => { updateMarkers(); }, [updateMarkers]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Mapa de Inteligência Dreon</h2>
          <p className="text-slate-500 text-sm font-bold">Localização estratégica de clientes, leads e assistências.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white px-6 py-3 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="Filtrar por nome..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs text-slate-700" />
           </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
         <div className="lg:col-span-3 space-y-6 flex flex-col overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter size={14} className="text-blue-600" /> Camadas</h3>
               <div className="space-y-2">
                  {[
                    { id: 'all', label: 'Todos os Pontos', icon: Maximize2, color: 'bg-slate-100 text-slate-600' },
                    { id: 'client', label: 'Clientes Ativos', icon: Users, color: 'bg-blue-50 text-blue-600' },
                    { id: 'prospect', label: 'Prospectos / Leads', icon: MapPin, color: 'bg-orange-50 text-orange-600' },
                    { id: 'assistance', label: 'Assistências Técnicas', icon: Wrench, color: 'bg-red-100 text-red-700' },
                    { id: 'protocol', label: 'Outros Protocolos', icon: AlertTriangle, color: 'bg-red-50 text-red-600' }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setFilterType(tab.id as any)} className={`w-full p-5 rounded-[24px] text-left transition-all flex items-center justify-between group ${filterType === tab.id ? 'bg-slate-900 text-white shadow-2xl' : 'hover:bg-slate-50'}`}>
                       <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${filterType === tab.id ? 'bg-white/20' : tab.color}`}><tab.icon size={18} /></div>
                          <span className="text-[10px] font-black uppercase tracking-tight">{tab.label}</span>
                       </div>
                    </button>
                  ))}
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[48px] text-white space-y-6 shadow-2xl">
               <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Resumo Regional</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase">Clientes</p><p className="text-xl font-black">{stats.clients}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase">Leads</p><p className="text-xl font-black">{stats.prospects}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase">Técnico</p><p className="text-xl font-black text-red-400">{stats.assistance}</p></div>
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10"><p className="text-[9px] font-bold text-slate-400 uppercase">Protocolos</p><p className="text-xl font-black">{stats.protocols}</p></div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-9 bg-white rounded-[56px] shadow-2xl border border-slate-100 relative overflow-hidden flex flex-col p-4">
            <div id="map-container" className="flex-1"></div>
            <div className="absolute bottom-10 right-10 z-[5] bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white flex gap-6 items-center">
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[9px] font-black uppercase text-slate-500">Ativos</span></div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-[9px] font-black uppercase text-slate-500">Leads</span></div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600"></div><span className="text-[9px] font-black uppercase text-slate-500">Técnico</span></div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MapView;
