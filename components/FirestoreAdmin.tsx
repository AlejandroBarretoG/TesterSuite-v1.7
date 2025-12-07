import React, { useState, useEffect } from 'react';
import { Database, Plus, Save, Trash2, Loader2, AlertCircle, CheckCircle2, FileJson, FolderTree, RefreshCw, Layout, Settings, Search } from 'lucide-react';
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from '../services/firestoreAdmin';
import { getRegisteredCollections, registerCollection } from '../services/registryService';
import { FirestoreSourceBadge } from './FirestoreSourceBadge';
import { useFirebase } from '../context/FirebaseContext';

const DEFAULT_COLLECTIONS = ['users', '_app_registry'];

export const FirestoreAdmin: React.FC = () => {
  const { app: firebaseInstance } = useFirebase();

  // Registry State
  const [knownCollections, setKnownCollections] = useState<string[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [manualCollectionInput, setManualCollectionInput] = useState('');
  
  // Selection State
  const [collectionName, setCollectionName] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editor State
  const [jsonContent, setJsonContent] = useState('');
  const [isNewDoc, setIsNewDoc] = useState(false);
  
  // Feedback State
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (firebaseInstance) {
      loadRegistry();
    }
  }, [firebaseInstance]);

  const loadRegistry = async () => {
    if (!firebaseInstance) return;
    setLoadingRegistry(true);
    const result = await getRegisteredCollections(firebaseInstance);
    
    // Combine defaults with dynamic results, deduplicate, and sort
    const dynamicCollections = (result.success && result.collections) ? result.collections : [];
    const merged = Array.from(new Set([...DEFAULT_COLLECTIONS, ...dynamicCollections])).sort();

    setKnownCollections(merged);
    setLoadingRegistry(false);
  };

  const handleManualAddCollection = async () => {
    const name = manualCollectionInput.trim();
    if (!name || !firebaseInstance) return;

    // Optimistic Update
    if (!knownCollections.includes(name)) {
      setKnownCollections(prev => [...prev, name].sort());
    }
    
    // Background Register
    registerCollection(firebaseInstance, name);
    
    // Select it immediately
    handleSelectCollection(name);
    setManualCollectionInput('');
  };

  const handleSelectCollection = (name: string) => {
    setCollectionName(name);
    handleLoadCollection(name);
  };

  const handleLoadCollection = async (name: string) => {
    if (!firebaseInstance) return;
    setStatus('loading');
    setMessage('');
    setSelectedDocId(null);
    setDocuments([]);
    
    const result = await fetchDocuments(firebaseInstance, name);
    
    if (result.success) {
      setDocuments(result.data || []);
      setStatus('idle');
      setJsonContent('');
      setIsNewDoc(false);
    } else {
      setStatus('error');
      setMessage(result.error || 'Error al cargar colección');
    }
  };

  const handleSelectDoc = (doc: any) => {
    setSelectedDocId(doc.id);
    setIsNewDoc(false);
    const { id, ...data } = doc;
    setJsonContent(JSON.stringify(data, null, 2));
    setMessage('');
  };

  const handleNewDoc = () => {
    setSelectedDocId(null);
    setIsNewDoc(true);
    setJsonContent('{\n  "key": "value"\n}');
    setMessage('');
  };

  const handleSave = async () => {
    if (!firebaseInstance) return;
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (e) {
      setStatus('error');
      setMessage('JSON Inválido. Revisa la sintaxis.');
      return;
    }

    setStatus('loading');
    setMessage('');

    let result;
    if (isNewDoc) {
      result = await createDocument(firebaseInstance, collectionName, parsedData);
    } else if (selectedDocId) {
      result = await updateDocument(firebaseInstance, collectionName, selectedDocId, parsedData);
    } else {
      return;
    }

    if (result.success) {
      setStatus('success');
      setMessage(isNewDoc ? 'Documento guardado.' : 'Actualizado.');
      
      // Refresh doc list
      const refresh = await fetchDocuments(firebaseInstance, collectionName);
      if (refresh.success) {
        setDocuments(refresh.data || []);
        if (isNewDoc && result.data?.id) {
           const newDoc = refresh.data?.find((d: any) => d.id === result.data.id);
           if (newDoc) handleSelectDoc(newDoc);
        } else if (selectedDocId) {
           const current = refresh.data?.find((d: any) => d.id === selectedDocId);
           if (current) handleSelectDoc(current);
        }
      }
    } else {
      setStatus('error');
      setMessage(result.error || 'Error al guardar.');
    }
  };

  const handleDelete = async () => {
    if (!selectedDocId || !firebaseInstance) return;
    if (!confirm('¿Eliminar documento?')) return;

    setStatus('loading');
    const result = await deleteDocument(firebaseInstance, collectionName, selectedDocId);

    if (result.success) {
      setStatus('success');
      setMessage('Eliminado.');
      setDocuments(prev => prev.filter(d => d.id !== selectedDocId));
      setSelectedDocId(null);
      setJsonContent('');
      setIsNewDoc(false);
    } else {
      setStatus('error');
      setMessage(result.error || 'Error al eliminar.');
    }
  };

  if (!firebaseInstance) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 animate-in fade-in">
        <Database size={48} className="mb-4 opacity-50" />
        <p>Conecta Firebase primero para usar el Administrador de BD.</p>
      </div>
    );
  }

  // Filter documents for search
  const filteredDocs = documents.filter(doc => 
    doc.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-200px)] flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      {/* ... Left Sidebar & Main Content Logic is identical to previous layout but cleaner ... */}
      
      {/* COLUMN 1: SIDEBAR */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <FolderTree size={14} /> Colecciones
            </h3>
            <button onClick={loadRegistry} disabled={loadingRegistry} className="text-slate-400 hover:text-blue-500 transition-colors" title="Refrescar Lista">
              <RefreshCw size={14} className={loadingRegistry ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              value={manualCollectionInput}
              onChange={(e) => setManualCollectionInput(e.target.value)}
              placeholder="Añadir manual..."
              className="flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleManualAddCollection()}
            />
            <button 
              onClick={handleManualAddCollection}
              className="px-2 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 rounded text-slate-500 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {knownCollections.map(col => {
            const isSystem = col.startsWith('_');
            const isActive = collectionName === col;
            return (
              <button
                key={col}
                onClick={() => handleSelectCollection(col)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-white text-orange-600 shadow-sm border border-slate-100 ring-1 ring-black/5' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {isSystem ? (
                  <Settings size={14} className={isActive ? "text-orange-500" : "text-slate-400"} />
                ) : (
                  <Database size={14} className={isActive ? "text-orange-500" : "text-slate-300"} />
                )}
                <span className={`truncate ${isSystem ? "font-mono text-xs opacity-80" : ""}`}>{col}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 flex min-w-0 bg-white">
        
        {/* COLUMN 2: LIST */}
        <div className="w-64 border-r border-slate-200 flex flex-col bg-white shrink-0">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 h-[73px] justify-center">
            <div className="flex justify-between items-center">
               <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                 <FileJson size={14} /> Docs 
                 <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{documents.length}</span>
               </h3>
               {collectionName && <FirestoreSourceBadge collectionName={collectionName} />}
            </div>
          </div>
          
          {collectionName && (
             <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar ID..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
             </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!collectionName ? (
               <div className="p-8 text-center text-slate-300 text-xs">
                 <Layout size={32} className="mx-auto mb-2 opacity-20" />
                 Selecciona una colección
               </div>
            ) : (
              <div className="divide-y divide-slate-50">
                 {filteredDocs.map(doc => (
                   <button
                     key={doc.id}
                     onClick={() => handleSelectDoc(doc)}
                     className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                       selectedDocId === doc.id ? 'bg-orange-50 text-orange-700 border-l-2 border-orange-500' : 'text-slate-600 border-l-2 border-transparent'
                     }`}
                   >
                     <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedDocId === doc.id ? 'bg-orange-500' : 'bg-slate-300'}`} />
                     <span className="truncate">{doc.id}</span>
                   </button>
                 ))}
                 <button 
                   onClick={handleNewDoc}
                   className="w-full py-3 text-xs text-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors border-t border-slate-100 font-medium sticky bottom-0 bg-white/90 backdrop-blur"
                 >
                   + Crear Documento
                 </button>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: EDITOR */}
        <div className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
          {(selectedDocId || isNewDoc) ? (
              <>
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white px-6 h-[73px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isNewDoc ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                      {isNewDoc ? <Plus size={18} /> : <Save size={18} />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {isNewDoc ? 'Nuevo Documento' : 'Editando'}
                      </span>
                      <span className="font-mono text-xs text-slate-700 font-medium truncate block">
                        {isNewDoc ? 'Auto-ID' : selectedDocId}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pl-2">
                    {message && (
                      <span className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap animate-in fade-in slide-in-from-right-2 ${
                        status === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 
                        status === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : ''
                      }`}>
                        {status === 'error' ? <AlertCircle size={12}/> : <CheckCircle2 size={12}/>}
                        {message}
                      </span>
                    )}
                    
                    {!isNewDoc && (
                      <button 
                        onClick={handleDelete}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    
                    <button
                      onClick={handleSave}
                      disabled={status === 'loading'}
                      className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
                    >
                      {status === 'loading' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      {isNewDoc ? 'Guardar' : 'Actualizar'}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 relative">
                  <textarea
                    value={jsonContent}
                    onChange={(e) => setJsonContent(e.target.value)}
                    className="w-full h-full p-6 font-mono text-sm text-slate-800 bg-transparent outline-none resize-none"
                    spellCheck={false}
                    placeholder="{ ... }"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                   <FileJson size={32} />
                </div>
                <p className="text-sm font-medium">Selecciona un documento para ver sus propiedades</p>
                <p className="text-xs mt-1 opacity-70">O crea uno nuevo en esta colección</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
