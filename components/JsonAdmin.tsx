
import React, { useState, useEffect } from 'react';
import { Settings2, Database, Globe, Save, RefreshCw, Eye, Code, Filter, Calculator, Plus, X, ArrowRight, Table, AlertCircle } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { smartAddDoc } from '../services/firestore';
import { fetchDocuments } from '../services/firestoreAdmin';

// Tipos para la configuración
interface ComputedField {
  id: string;
  name: string;
  formula: string; // "price * 1.2" (Nombres de campos simples)
}

interface JsonComponentConfig {
  id?: string;
  title: string;
  category: string;
  url: string;
  visibleKeys: string[];
  computedFields: ComputedField[];
}

export const JsonAdmin: React.FC = () => {
  const { app } = useFirebase();
  const [components, setComponents] = useState<JsonComponentConfig[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  
  // Selección
  const [selectedConfig, setSelectedConfig] = useState<JsonComponentConfig | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Estado del componente activo
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Edición
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editVisibleKeys, setEditVisibleKeys] = useState<string[]>([]);
  const [editComputed, setEditComputed] = useState<ComputedField[]>([]);

  // Filtros en Vista
  const [activeFilter, setActiveFilter] = useState<{key: string, value: string} | null>(null);

  useEffect(() => {
    if (app) loadComponents();
  }, [app]);

  const loadComponents = async () => {
    if (!app) return;
    setLoadingList(true);
    const result = await fetchDocuments(app, 'json_components_config');
    if (result.success) {
      setComponents(result.data || []);
    }
    setLoadingList(false);
  };

  const handleCreateNew = () => {
    const newConfig: JsonComponentConfig = {
      title: 'Nuevo Componente',
      category: 'General',
      url: '',
      visibleKeys: [],
      computedFields: []
    };
    setSelectedConfig(null);
    loadConfigIntoEditor(newConfig);
    setMode('edit');
    setFetchedData([]);
  };

  const handleSelect = (config: JsonComponentConfig) => {
    setSelectedConfig(config);
    loadConfigIntoEditor(config);
    setMode('view');
    fetchExternalJson(config.url);
  };

  const loadConfigIntoEditor = (config: JsonComponentConfig) => {
    setEditTitle(config.title);
    setEditCategory(config.category);
    setEditUrl(config.url);
    setEditVisibleKeys(config.visibleKeys || []);
    setEditComputed(config.computedFields || []);
    setFetchError('');
  };

  const fetchExternalJson = async (url: string) => {
    if (!url) return;
    setLoadingFetch(true);
    setFetchError('');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const arrayData = Array.isArray(data) ? data : (data.items || data.results || [data]);
      setFetchedData(arrayData);
      
      // Extract all keys from first object
      if (arrayData.length > 0) {
        setAllKeys(Object.keys(arrayData[0]));
      }
    } catch (e: any) {
      console.error(e);
      setFetchError("Error al cargar JSON. Verifica CORS y que la URL sea pública.");
      setFetchedData([]);
      setAllKeys([]);
    } finally {
      setLoadingFetch(false);
    }
  };

  const toggleKeyVisibility = (key: string) => {
    setEditVisibleKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const addComputedField = () => {
    const newField: ComputedField = {
      id: Date.now().toString(),
      name: 'Campo Nuevo',
      formula: ''
    };
    setEditComputed([...editComputed, newField]);
  };

  const updateComputedField = (id: string, field: string, value: string) => {
    setEditComputed(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteComputedField = (id: string) => {
    setEditComputed(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    if (!app) return;
    const payload: JsonComponentConfig = {
      title: editTitle,
      category: editCategory,
      url: editUrl,
      visibleKeys: editVisibleKeys,
      computedFields: editComputed
    };

    // Note: For simplicity in this lab, we always create a NEW doc. 
    // In a real app, we would update if ID exists.
    await smartAddDoc(app, 'json_components_config', payload);
    await loadComponents();
    setMode('view');
    // Auto select the new one logic omitted for brevity, just reload list
    alert("Configuración guardada");
  };

  // --- LOGIC ENGINE ---
  const evaluateRow = (row: any, formula: string) => {
    try {
      let expr = formula;
      
      // 1. MEJORA DE SEGURIDAD Y LÓGICA: Ordenar claves por longitud descendente
      // Esto evita que 'precio' reemplace parte de 'precio_total'
      const sortedKeys = [...allKeys].sort((a, b) => b.length - a.length);

      sortedKeys.forEach(key => {
         // Verificamos si la clave existe en la fórmula antes de reemplazar para optimizar
         if (expr.includes(key)) {
             const rawVal = row[key];
             // Forzar numérico si es posible, o mantener string entre comillas si es texto
             const val = isNaN(Number(rawVal)) ? `"${rawVal}"` : rawVal;
             
             // Reemplazo global seguro
             expr = expr.split(key).join(String(val));
         }
      });

      // eslint-disable-next-line no-new-func
      return new Function(`return ${expr}`)();
    } catch (e) {
      return "Error Calc";
    }
  };

  // --- RENDER HELPERS ---
  const renderSidebar = () => (
    <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
          <Settings2 size={14} /> Componentes Configurados
        </h3>
        <button 
          onClick={handleCreateNew}
          className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
        >
          <Plus size={16} /> Nuevo Componente
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {components.map((comp, idx) => (
          <button
            key={idx} // Using index as fallback ID for fetched non-id docs
            onClick={() => handleSelect(comp)}
            className={`w-full text-left p-3 rounded-lg text-sm border transition-all ${
              selectedConfig === comp 
                ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/20' 
                : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
            }`}
          >
            <div className="font-bold text-slate-700">{comp.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{comp.category}</div>
          </button>
        ))}
        {loadingList && <div className="p-4 text-center"><RefreshCw className="animate-spin text-slate-400 mx-auto" /></div>}
      </div>
    </div>
  );

  const renderConfigPanel = () => (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* BASIC INFO */}
      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
           <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full p-2 border rounded mt-1" />
        </div>
        <div>
           <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
           <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full p-2 border rounded mt-1" />
        </div>
      </div>
      <div>
         <label className="text-xs font-bold text-slate-500 uppercase">URL del JSON (CORS Enabled)</label>
         <div className="flex gap-2 mt-1">
            <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)} className="flex-1 p-2 border rounded font-mono text-sm" placeholder="https://..." />
            <button onClick={() => fetchExternalJson(editUrl)} className="px-3 bg-slate-100 border rounded hover:bg-slate-200"><RefreshCw size={16}/></button>
         </div>
      </div>

      {/* DETECTED KEYS */}
      {allKeys.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Eye size={16}/> Visibilidad de Columnas</h4>
          <div className="flex flex-wrap gap-2">
            {allKeys.map(key => (
              <button 
                key={key}
                onClick={() => toggleKeyVisibility(key)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  editVisibleKeys.includes(key) 
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* COMPUTED FIELDS */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex justify-between items-center mb-3">
           <h4 className="font-bold text-slate-700 flex items-center gap-2"><Calculator size={16}/> Campos Calculados</h4>
           <button onClick={addComputedField} className="text-xs text-indigo-600 font-bold hover:underline">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {editComputed.map((field) => (
            <div key={field.id} className="flex gap-2 items-center">
              <input 
                type="text" placeholder="Nombre" value={field.name}
                onChange={(e) => updateComputedField(field.id, 'name', e.target.value)}
                className="w-1/3 p-2 border rounded text-xs"
              />
              <ArrowRight size={14} className="text-slate-400" />
              <input 
                type="text" placeholder="Fórmula (ej: precio * 1.2)" value={field.formula}
                onChange={(e) => updateComputedField(field.id, 'formula', e.target.value)}
                className="flex-1 p-2 border rounded text-xs font-mono"
              />
              <button onClick={() => deleteComputedField(field.id)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
            </div>
          ))}
          {editComputed.length === 0 && <p className="text-xs text-slate-400 italic">Sin campos calculados.</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button onClick={handleSave} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex justify-center items-center gap-2">
          <Save size={18}/> Guardar Configuración
        </button>
      </div>
    </div>
  );

  const renderDataView = () => {
    if (loadingFetch) return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-slate-400" size={32}/></div>;
    if (fetchError) return <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2"><AlertCircle size={32}/>{fetchError}</div>;
    if (fetchedData.length === 0) return <div className="p-8 text-center text-slate-400">Sin datos. Carga una URL válida.</div>;

    // Filters Logic: Get unique values of the first visible text key for filtering
    const filterKey = editVisibleKeys[0];
    const uniqueValues = filterKey ? Array.from(new Set(fetchedData.map(d => d[filterKey]))) : [];
    
    const filteredData = activeFilter 
      ? fetchedData.filter(d => String(d[activeFilter.key]) === activeFilter.value)
      : fetchedData;

    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
           {filterKey && (
             <div className="flex items-center gap-2">
               <Filter size={16} className="text-slate-400" />
               <select 
                className="text-sm border border-slate-200 rounded p-1.5 bg-white outline-none"
                onChange={(e) => setActiveFilter(e.target.value ? {key: filterKey, value: e.target.value} : null)}
                value={activeFilter ? activeFilter.value : ''}
               >
                 <option value="">Todos ({filterKey})</option>
                 {uniqueValues.slice(0, 10).map((v: any) => (
                   <option key={String(v)} value={String(v)}>{String(v)}</option>
                 ))}
               </select>
             </div>
           )}
           <div className="text-xs text-slate-400 ml-auto">{filteredData.length} registros</div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
              <tr>
                {editVisibleKeys.map(key => <th key={key} className="px-6 py-3">{key}</th>)}
                {editComputed.map(field => <th key={field.id} className="px-6 py-3 text-indigo-600 bg-indigo-50/30">{field.name} (Calc)</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredData.map((row, i) => (
                 <tr key={i} className="hover:bg-slate-50">
                   {editVisibleKeys.map(key => (
                     <td key={key} className="px-6 py-3 text-slate-700 max-w-xs truncate" title={String(row[key])}>
                       {String(row[key])}
                     </td>
                   ))}
                   {editComputed.map(field => (
                     <td key={field.id} className="px-6 py-3 font-mono text-indigo-700 bg-indigo-50/10">
                       {evaluateRow(row, field.formula)}
                     </td>
                   ))}
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!app) return <div className="p-12 text-center text-slate-400">Firebase no inicializado.</div>;

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      {renderSidebar()}
      
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Bar */}
        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white px-6 h-[60px] shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
               <Database size={20} />
             </div>
             <div>
               <h2 className="font-bold text-slate-800">{editTitle || 'Editor JSON'}</h2>
               {editUrl && <span className="text-xs text-slate-400 flex items-center gap-1"><Globe size={10}/> {editUrl.substring(0, 40)}...</span>}
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setMode('view')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'view' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Table size={16} className="inline mr-2"/> Vista de Datos
            </button>
            <button 
              onClick={() => setMode('edit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'edit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Settings2 size={16} className="inline mr-2"/> Configuración
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {mode === 'edit' ? (
             <div className="h-full overflow-y-auto">{renderConfigPanel()}</div>
          ) : (
             renderDataView()
          )}
        </div>
      </div>
    </div>
  );
};
