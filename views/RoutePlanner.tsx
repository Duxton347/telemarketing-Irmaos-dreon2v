
import React from 'react';
import { 
  MapPin, Users, Wrench, ClipboardList, Search, 
  ChevronRight, Play, Download, Trash2, Clock, 
  Map as MapIcon, Navigation, Calendar, Loader2, Filter, Save, CheckSquare, Square
} from 'lucide-react';
import L from 'leaflet';
import { dataService } from '../services/dataService.ts';
import { routeService, RoutePoint, OptimizedRoute } from '../services/routeService.ts';
import { Client, Prospect, Protocol, CallType, ProtocolStatus } from '../types.ts';

const RoutePlanner: React.FC = () => {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPlanning, setIsPlanning] = React.useState(false);
  
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [plannedRoute, setPlannedRoute] = React.useState<OptimizedRoute | null>(null);
  const [visitDuration, setVisitDuration] = React.useState(30); // minutos
  const [startTime, setStartTime] = React.useState("08:00");

  const mapRef = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<L.LayerGroup | null>(null);
  const polylineRef = React.useRef<L.Polyline | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allClients, allProspects, allProtocols] = await Promise.all([
        dataService.getClients(),
        dataService.getProspects(),
        dataService.getProtocols()
      ]);
      setClients(allClients.filter(c => c.latitude && c.longitude));
      setProspects(allProspects.filter(p => p.latitude && p.longitude));
      setProtocols(allProtocols.filter(p => p.status !== ProtocolStatus.FECHADO));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
    const map = L.map('route-map').setView([-23.5505, -46.6333], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM'
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); };
  }, [loadData]);

  const allSelectable = React.useMemo(() => {
    const list: RoutePoint[] = [];
    clients.forEach(c => list.push({ id: c.id, name: c.name, address: c.address || '', lat: c.latitude!, lng: c.longitude!, type: 'CLIENTE', phone: c.phone }));
    prospects.forEach(p => list.push({ id: p.id, name: p.name, address: p.address || '', lat: p.latitude!, lng: p.longitude!, type: 'PROSPECTO', phone: p.phone }));
    
    // Filtro básico de busca
    return list.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.address.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, prospects, search]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleGenerateRoute = async () => {
    if (selectedIds.size < 2) return alert("Selecione pelo menos 2 pontos para gerar uma rota.");
    
    setIsPlanning(true);
    const pointsToOptimize = allSelectable.filter(p => selectedIds.has(p.id));
    
    try {
      const optimized = await routeService.optimizeRoute(pointsToOptimize);
      setPlannedRoute(optimized);

      // Atualizar Mapa
      if (markersRef.current && mapRef.current) {
        markersRef.current.clearLayers();
        if (polylineRef.current) polylineRef.current.remove();

        const latlngs: L.LatLngExpression[] = [];
        const bounds = L.latLngBounds([]);

        optimized.points.forEach((p, idx) => {
          const color = p.type === 'CLIENTE' ? '#2563eb' : '#f59e0b';
          const marker = L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: 'custom-route-icon',
              html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3)">${idx + 1}</div>`,
              iconSize: [24, 24]
            })
          }).bindPopup(`<strong>${idx + 1}. ${p.name}</strong><br/>${p.type}`);
          
          markersRef.current?.addLayer(marker);
          latlngs.push([p.lat, p.lng]);
          bounds.extend([p.lat, p.lng]);
        });

        const polyline = L.polyline(latlngs, { color: '#6366f1', weight: 4, dashArray: '10, 10', opacity: 0.8 }).addTo(mapRef.current);
        polylineRef.current = polyline;
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (e) {
      alert("Erro ao otimizar rota.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExportCSV = () => {
    if (!plannedRoute) return;
    const headers = "ORDEM;HORARIO;NOME;TIPO;TELEFONE;ENDERECO\n";
    let currentTime = new Date(`2000-01-01T${startTime}:00`);

    const rows = plannedRoute.points.map((p, i) => {
      const timeStr = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const row = `${i + 1};${timeStr};${p.name};${p.type};${p.phone};${p.address}`;
      // Incrementa tempo para o próximo (visita + fixo 15 min deslocamento simplificado para o CSV)
      currentTime = new Date(currentTime.getTime() + (visitDuration + 15) * 60000);
      return row;
    }).join('\n');

    const blob = new Blob(["\ufeff" + headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `Cronograma_Visitas_Dreon_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    document.body.removeChild(link);
  };

  const calculateScheduleTime = (index: number) => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const totalMinutes = index * (visitDuration + 15); // 15 min deslocamento base
    const current = new Date(start.getTime() + totalMinutes * 60000);
    return current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-3">
             <Navigation className="text-blue-600" /> Planejador de Rotas
          </h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Otimização logística para visitas presenciais.</p>
        </div>
        <div className="flex gap-4">
           {plannedRoute && (
             <button 
               onClick={handleExportCSV}
               className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
             >
               <Download size={16} /> Exportar Cronograma
             </button>
           )}
           <button 
             onClick={handleGenerateRoute}
             disabled={isPlanning || selectedIds.size < 2}
             className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
           >
             {isPlanning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
             Gerar Rota Otimizada ({selectedIds.size})
           </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
        {/* SELEÇÃO LATERAL */}
        <div className="lg:col-span-4 flex flex-col space-y-6 overflow-hidden">
          <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm flex flex-col min-h-0">
             <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome ou endereço..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {isLoading ? (
                  <div className="py-20 text-center opacity-30"><Loader2 className="animate-spin mx-auto mb-4" /> <p className="font-black text-[10px] uppercase">Carregando Pontos...</p></div>
                ) : allSelectable.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`w-full p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-4 ${selectedIds.has(item.id) ? 'bg-blue-50 border-blue-600 shadow-lg' : 'bg-white border-slate-50 hover:border-slate-200'}`}
                  >
                     <div className={`p-2 rounded-lg ${selectedIds.has(item.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {selectedIds.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-[11px] truncate uppercase">{item.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 truncate">{item.address}</p>
                     </div>
                     <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${item.type === 'CLIENTE' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{item.type}</span>
                  </button>
                ))}
             </div>
          </div>
          
          <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6 shadow-2xl">
             <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={14}/> Configurações de Agendamento</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início do Turno</label>
                   <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-black text-white outline-none" />
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Min/Visita</label>
                   <input type="number" value={visitDuration} onChange={e => setVisitDuration(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-black text-white outline-none" />
                </div>
             </div>
          </div>
        </div>

        {/* MAPA E RESULTADO */}
        <div className="lg:col-span-8 flex flex-col space-y-6 min-h-0">
           <div id="route-map" className="flex-1 bg-white rounded-[48px] shadow-2xl border-4 border-white overflow-hidden relative">
              {!plannedRoute && (
                <div className="absolute inset-0 z-[5] bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                   <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl border border-slate-100 text-center animate-bounce">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Selecione pontos e clique em "Gerar Rota"</p>
                   </div>
                </div>
              )}
           </div>
           
           {plannedRoute && (
             <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                   <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                      <Clock className="text-indigo-600" size={18}/> Cronograma Sugerido
                   </h4>
                   <div className="flex gap-4">
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Distância:</span>
                         <span className="text-[11px] font-black text-slate-800">{(plannedRoute.totalDistance / 1000).toFixed(1)} km</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Estimativa Total:</span>
                         <span className="text-[11px] font-black text-slate-800">{Math.round((plannedRoute.totalDuration / 60) + (plannedRoute.points.length * visitDuration))} min</span>
                      </div>
                   </div>
                </div>
                
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="border-b border-slate-100">
                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">Ordem</th>
                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Horário Est.</th>
                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Destino</th>
                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Contatos</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {plannedRoute.points.map((p, i) => (
                           <tr key={p.id} className="hover:bg-slate-50 transition-all">
                              <td className="py-4 px-4 text-center">
                                 <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-xs mx-auto shadow-md">{i + 1}</div>
                              </td>
                              <td className="py-4 px-4">
                                 <span className="font-black text-blue-600 text-sm">{calculateScheduleTime(i)}</span>
                              </td>
                              <td className="py-4 px-4">
                                 <p className="font-black text-slate-800 text-xs uppercase">{p.name}</p>
                                 <p className="text-[9px] font-bold text-slate-400 truncate max-w-[200px]">{p.address}</p>
                              </td>
                              <td className="py-4 px-4">
                                 <p className="font-black text-slate-600 text-[10px]">{p.phone}</p>
                                 <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${p.type === 'CLIENTE' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{p.type}</span>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default RoutePlanner;
