
import React from 'react';
import { 
  FlaskConical, Microscope, Terminal, CheckCircle2, XCircle, 
  Loader2, Play, RotateCcw, ShieldCheck, ShieldAlert, 
  ClipboardCheck, ListTodo, Save, Trash2, Database, Bug,
  ArrowRight, Info, ChevronRight
} from 'lucide-react';
import { testService } from '../services/testService';
import { dataService } from '../services/dataService';
import { TestResult, ChecklistTask } from '../types';

const QualityCenter: React.FC = () => {
  const [tests, setTests] = React.useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isStaging, setIsStaging] = React.useState(dataService.isStaging());
  
  const [checklist, setChecklist] = React.useState<ChecklistTask[]>(() => {
    const saved = localStorage.getItem('dreon_qa_checklist');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'c1', category: 'Fluxo Prospecto', text: 'Importar CSV de leads fictícios', completed: false },
      { id: 'c2', category: 'Fluxo Prospecto', text: 'Realizar ligação e preencher formulário natural', completed: false },
      { id: 'c3', category: 'Fluxo Prospecto', text: 'Converter prospecto em cliente base', completed: false },
      { id: 'c4', category: 'Pós-Venda', text: 'Realizar pós-venda e gerar protocolo de assistência', completed: false },
      { id: 'c5', category: 'Assistência', text: 'Agendar visita técnica no protocolo', completed: false },
      { id: 'c6', category: 'Assistência', text: 'Aprovar fechamento do protocolo pelo Admin', completed: false },
      { id: 'c7', category: 'Relatórios', text: 'Gerar relatório CSV com filtros de data', completed: false },
      { id: 'c8', category: 'Mapas', text: 'Validar geolocalização no mapa de calor', completed: false }
    ];
  });

  const runTests = async () => {
    setIsRunning(true);
    const results = await testService.runAllTests();
    setTests(results);
    setIsRunning(false);
  };

  const toggleStaging = (val: boolean) => {
    dataService.setStagingMode(val);
    setIsStaging(val);
    if (!val) {
      alert("ATENÇÃO: Você saiu do modo Staging. Toda ação agora afetará a produção (Supabase).");
    } else {
      alert("MODO STAGING ATIVADO: Use LocalStorage para testes sem risco.");
    }
  };

  const toggleCheck = (id: string) => {
    const next = checklist.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setChecklist(next);
    localStorage.setItem('dreon_qa_checklist', JSON.stringify(next));
  };

  const clearData = () => {
    if (confirm("Limpar dados de mock do Staging?")) {
      dataService.clearStagingData();
      alert("Mock limpo.");
    }
  };

  const completedCount = checklist.filter(c => c.completed).length;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
             <Microscope className="text-blue-600" size={32} /> Quality Center
          </h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ambiente de Staging e Testes Automatizados</p>
        </div>
        <div className="flex bg-white p-2 rounded-3xl border border-slate-200 shadow-sm items-center gap-4">
           <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isStaging ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isStaging ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>}
              {isStaging ? 'Ambiente: Staging (Local)' : 'Ambiente: Produção (Live)'}
           </div>
           <button 
            onClick={() => toggleStaging(!isStaging)}
            className={`px-6 py-2 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isStaging ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
           >
              Mudar Ambiente
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         {/* AUTOMATED TESTS */}
         <div className="lg:col-span-7 space-y-8">
            <div className="bg-white p-10 rounded-[56px] border border-slate-100 shadow-sm space-y-10">
               <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                     <Terminal size={18} className="text-blue-600" /> Testes de Unidade e Integração
                  </h3>
                  <button 
                    onClick={runTests} 
                    disabled={isRunning}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                     {isRunning ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>}
                     Rodar Bateria de Testes
                  </button>
               </div>

               <div className="space-y-4">
                  {tests.length === 0 ? (
                    <div className="py-20 text-center opacity-30">
                       <Bug size={48} className="mx-auto mb-4" />
                       <p className="font-black uppercase text-[9px] tracking-widest">Nenhum teste executado recentemente</p>
                    </div>
                  ) : (
                    tests.map(test => (
                      <div key={test.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            {test.status === 'passed' ? <CheckCircle2 className="text-emerald-500" /> : <XCircle className="text-red-500" />}
                            <div>
                               <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{test.name}</p>
                               {test.error && <p className="text-[10px] font-bold text-red-500 mt-1">{test.error}</p>}
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="text-[9px] font-black text-slate-300 uppercase">{test.duration}ms</span>
                         </div>
                      </div>
                    ))
                  )}
               </div>

               <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
                  <div className="flex gap-4">
                     <button onClick={clearData} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-black uppercase text-[9px] tracking-widest transition-all">
                        <Trash2 size={14}/> Limpar Mock Data
                     </button>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 font-black uppercase text-[9px]">
                     <Database size={14}/> {tests.filter(t => t.status === 'passed').length} / {tests.length} Sucessos
                  </div>
               </div>
            </div>
         </div>

         {/* MANUAL CHECKLIST */}
         <div className="lg:col-span-5 space-y-8">
            <div className="bg-slate-900 p-10 rounded-[56px] text-white shadow-2xl space-y-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5"><FlaskConical size={120} /></div>
               <div>
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                     <ClipboardCheck size={18} className="text-emerald-400" /> Validação Manual
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-2">Checklist obrigatório para homologação de versão.</p>
               </div>

               <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {checklist.map(task => (
                    <button 
                      key={task.id} 
                      onClick={() => toggleCheck(task.id)}
                      className={`w-full p-5 rounded-[24px] text-left transition-all border flex items-center gap-4 ${task.completed ? 'bg-white/10 border-emerald-500/50 opacity-50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                       <div className={`p-2 rounded-lg ${task.completed ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'}`}>
                          {task.completed ? <CheckCircle2 size={16} /> : <ListTodo size={16} />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{task.category}</p>
                          <p className="font-bold text-sm tracking-tight">{task.text}</p>
                       </div>
                       <ChevronRight size={16} className="text-white/20" />
                    </button>
                  ))}
               </div>

               <div className="pt-8 border-t border-white/10 flex items-center justify-between">
                  <div>
                     <p className="text-[9px] font-black text-slate-500 uppercase">Progresso</p>
                     <p className="text-2xl font-black">{completedCount} / {checklist.length}</p>
                  </div>
                  <div className="h-2 flex-1 mx-10 bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(completedCount / checklist.length) * 100}%` }}></div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-blue-50 rounded-[40px] border border-blue-100 flex items-start gap-4">
               <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Info size={20}/></div>
               <div>
                  <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Dica de QA</h4>
                  <p className="text-xs font-medium text-blue-600 leading-relaxed">Sempre utilize o Modo Staging para testar importações de CSV em larga escala antes de subir para o Supabase oficial.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default QualityCenter;
