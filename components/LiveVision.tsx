
import React, { useRef, useState, useEffect } from 'react';
import { Camera, Aperture, RefreshCw, Zap, Image as ImageIcon, AlertCircle, Monitor, Mic, MicOff, StopCircle, Video, MessageSquare, Keyboard, Send } from 'lucide-react';
import { runGeminiTests } from '../services/gemini';

export const LiveVision: React.FC = () => {
  // --- Refs & State ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  // Media State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sourceType, setSourceType] = useState<'camera' | 'screen' | 'none'>('none');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Analysis State
  const [prompt, setPrompt] = useState("Describe detalladamente qué ves en esta imagen. Identifica objetos, colores y contexto.");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  
  // Audio Input State (STT)
  const [isListening, setIsListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);

  // UI State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    if (key) setApiKey(key);

    // Check Speech Recognition Support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSttSupported(false);
    }

    return () => {
      stopMedia();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  // --- Media Handlers ---

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setSourceType('none');
  };

  const startCamera = async () => {
    stopMedia();
    setErrorMsg(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      handleStreamSuccess(s, 'camera');
    } catch (err: any) {
      handleMediaError(err);
    }
  };

  const startScreenShare = async () => {
    stopMedia();
    setErrorMsg(null);
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      handleStreamSuccess(s, 'screen');
    } catch (err: any) {
      handleMediaError(err);
    }
  };

  const handleStreamSuccess = (s: MediaStream, type: 'camera' | 'screen') => {
    setStream(s);
    setSourceType(type);
    setCapturedImage(null);
    setAnalysisResult(null);
    
    if (videoRef.current) {
      videoRef.current.srcObject = s;
    }

    // Detectar si el usuario detiene la compartición desde el navegador
    s.getVideoTracks()[0].onended = () => {
      stopMedia();
    };
  };

  const handleMediaError = (err: any) => {
    console.error("Media Error:", err);
    setSourceType('none');
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setErrorMsg("Permiso denegado. Verifica el acceso a cámara/pantalla.");
    } else {
      setErrorMsg(`Error al acceder al dispositivo: ${err.message}`);
    }
  };

  // --- STT Handlers (Speech to Text) ---
  
  const toggleMic = () => {
    if (!sttSupported) return;

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setPrompt(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("STT Error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  // --- Analysis Logic ---

  const captureAndAnalyze = async () => {
    if ((!videoRef.current && !capturedImage) || !apiKey) return;
    
    let base64Image = capturedImage;

    // Si estamos en vivo, capturamos el frame actual
    if (sourceType !== 'none' && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      base64Image = canvas.toDataURL('image/jpeg', 0.8);
      // Opcional: Pausar la vista previa mostrando la captura
      // setCapturedImage(base64Image); 
      // stopMedia(); // Descomentar si se desea detener el stream tras capturar
    }

    if (!base64Image) return;

    setAnalyzing(true);
    setAnalysisResult(null); // Limpiar resultado previo

    const result = await runGeminiTests.analyzeImage(apiKey, 'gemini-2.5-flash', base64Image, prompt);
    
    if (result.success && result.data?.output) {
      setAnalysisResult(result.data.output);
    } else {
      setAnalysisResult(`Error: ${result.message}`);
    }
    setAnalyzing(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Aperture size={24} />
            </div>
            <h2 className="text-2xl font-bold">Live Vision Studio</h2>
          </div>
          <p className="text-teal-100 text-sm max-w-xl">
            Analiza video en tiempo real desde tu cámara o pantalla utilizando Gemini 2.5 Multimodal.
          </p>
        </div>
        {!apiKey && (
           <div className="bg-red-500/20 border border-red-400/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2 backdrop-blur-md">
             <AlertCircle size={16} /> API Key no configurada
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[650px]">
        
        {/* COLUMNA 1: VIDEO FEED (2/3 ancho) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-black rounded-xl overflow-hidden shadow-lg relative flex-1 min-h-[400px] flex items-center justify-center group border border-slate-800">
            
            {/* Estado Inactivo / Placeholder */}
            {sourceType === 'none' && !capturedImage && (
              <div className="text-center p-8 max-w-md animate-in fade-in">
                <div className="flex justify-center gap-4 mb-6">
                   <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                      <Video size={32} />
                   </div>
                   <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                      <Monitor size={32} />
                   </div>
                </div>
                <h3 className="text-slate-300 text-lg font-medium mb-2">Selecciona una Fuente de Video</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Puedes analizar objetos físicos con tu cámara web o analizar interfaces de software compartiendo tu pantalla.
                </p>
                
                <div className="flex gap-4 justify-center">
                  <button onClick={startCamera} className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-all">
                    <Camera size={18} /> Cámara
                  </button>
                  <button onClick={startScreenShare} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all">
                    <Monitor size={18} /> Pantalla
                  </button>
                </div>
                {errorMsg && (
                  <div className="mt-6 text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/50">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
            
            {/* Video Element */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-contain bg-black ${sourceType !== 'none' ? 'block' : 'hidden'}`}
            />
            
            {/* Imagen Congelada (si quisiéramos mostrar snapshot) */}
            {capturedImage && sourceType === 'none' && (
               <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            )}

            {/* Canvas oculto para capturas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay Status */}
            {sourceType !== 'none' && (
              <div className="absolute top-4 left-4 flex gap-2">
                 <span className="bg-red-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5 backdrop-blur-sm animate-pulse">
                   <div className="w-2 h-2 bg-white rounded-full" /> EN VIVO: {sourceType === 'camera' ? 'WEBCAM' : 'SCREEN'}
                 </span>
              </div>
            )}
          </div>
          
          {/* Barra de Control Rápido de Fuente */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
             <div className="flex gap-2">
               <button 
                onClick={startCamera}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sourceType === 'camera' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 <Camera size={16} /> Cámara
               </button>
               <button 
                onClick={startScreenShare}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sourceType === 'screen' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 <Monitor size={16} /> Pantalla
               </button>
             </div>
             
             {sourceType !== 'none' && (
               <button onClick={stopMedia} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                 <StopCircle size={16} /> Detener
               </button>
             )}
          </div>
        </div>

        {/* COLUMNA 2: CONTROLES & RESULTADOS (1/3 ancho) */}
        <div className="lg:col-span-1 flex flex-col gap-4 h-full min-h-0">
          
          {/* 1. Context Input */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
              <MessageSquare size={14} /> Contexto / Pregunta
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none h-24 custom-scrollbar"
                placeholder="¿Qué quieres saber sobre la imagen?"
              />
              <div className="absolute bottom-2 right-2 flex gap-1">
                 {sttSupported && (
                   <button 
                    onClick={toggleMic}
                    className={`p-1.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-teal-600 hover:bg-teal-50'}`}
                    title="Dictar por voz"
                   >
                     {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                   </button>
                 )}
              </div>
            </div>
            
            <button 
              onClick={captureAndAnalyze}
              disabled={analyzing || sourceType === 'none' || !apiKey}
              className="w-full mt-3 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? <RefreshCw className="animate-spin" size={18}/> : <Zap size={18} />}
              {analyzing ? 'Analizando...' : 'Capturar y Analizar'}
            </button>
          </div>

          {/* 2. Results Area */}
          <div className="bg-white p-0 rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                 <ImageIcon size={16} className="text-teal-500" /> Resultado
               </h3>
               {analysisResult && (
                 <button 
                   onClick={() => setAnalysisResult(null)}
                   className="text-xs text-slate-400 hover:text-red-500"
                 >
                   Limpiar
                 </button>
               )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
              {analyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap size={16} className="text-teal-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium animate-pulse text-teal-600">Procesando fotograma...</p>
                </div>
              ) : analysisResult ? (
                <div className="prose prose-sm prose-slate max-w-none">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{analysisResult}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-60">
                  <Keyboard size={32} />
                  <p className="text-xs text-center max-w-[200px]">
                    Configura tu fuente, escribe una pregunta y presiona Analizar.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
