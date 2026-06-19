'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Check, AlertCircle, Cpu, Loader2, RefreshCw, Video, VideoOff, CheckSquare, Square } from 'lucide-react';

const PHOTO_SERVER_URL = process.env.NEXT_PUBLIC_PHOTO_SERVER_URL || 'http://localhost:4000';

interface WebcamModalProps {
  employeeName: string;
  onSave: (photoUrl: string) => void;
  onClose: () => void;
}

type ModalState = 'init' | 'liveview' | 'capturing' | 'preview' | 'error';

interface ConformityAnalysis {
  brightness: number;
  sharpness: number;
  backgroundUniformity: number;
  shadowBalance: number;
  brightnessOk: boolean;
  sharpnessOk: boolean;
  backgroundOk: boolean;
  shadowOk: boolean;
}

export default function WebcamModal({ employeeName, onSave, onClose }: WebcamModalProps) {
  const [state, setState] = useState<ModalState>('init');
  const [cameraModel, setCameraModel] = useState('Canon EOS (EDSDK)');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [liveViewAvailable, setLiveViewAvailable] = useState(false);

  // Conformity checks state
  const [analysis, setAnalysis] = useState<ConformityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [checklist, setChecklist] = useState({
    centered: false,
    framing: false,
    margins: false,
  });

  // Timestamp pour forcer le refresh de l'img tag (évite le cache navigateur)
  const [frameTs, setFrameTs] = useState(Date.now());
  const liveViewInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // ─── Vérification du pont au montage ──────────────────────────────────────
  useEffect(() => {
    const checkAndStart = async () => {
      try {
        const res = await fetch(`${PHOTO_SERVER_URL}/api/status`);
        const data = await res.json();
        setCameraModel(data.model || 'Canon EOS');
        setLiveViewAvailable(!!data.liveViewAvailable);

        if (data.liveViewAvailable) {
          await startLiveView();
        } else {
          setState('liveview'); // mode dégradé : juste montrer le bouton capturer
        }
      } catch {
        setErrorMsg('Pont Canon inaccessible. Démarrez node server.js sur le port 4000.');
        setState('error');
      }
    };

    checkAndStart();

    return () => {
      stopLiveViewPolling();
      // Arrêter le live view côté serveur au démontage du composant
      fetch(`${PHOTO_SERVER_URL}/api/liveview/stop`, { method: 'POST' }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Démarrer le live view ────────────────────────────────────────────────
  const startLiveView = useCallback(async () => {
    setState('init');
    try {
      const res = await fetch(`${PHOTO_SERVER_URL}/api/liveview/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setState('liveview');
        startLiveViewPolling();
      } else {
        setErrorMsg(data.error || 'Impossible de démarrer le live view.');
        setState('error');
      }
    } catch {
      // Pas de live view → mode simplifié
      setState('liveview');
    }
  }, []);

  // ─── Polling : rafraîchit l'image du live view toutes les 150ms ───────────
  const startLiveViewPolling = useCallback(() => {
    stopLiveViewPolling();
    liveViewInterval.current = setInterval(() => {
      setFrameTs(Date.now());
    }, 150);
  }, []);

  const stopLiveViewPolling = useCallback(() => {
    if (liveViewInterval.current) {
      clearInterval(liveViewInterval.current);
      liveViewInterval.current = null;
    }
  }, []);

  // ─── Analyse d'image par Canvas ──────────────────────────────────────────
  const analyzeCapturedImage = (url: string) => {
    setIsAnalyzing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsAnalyzing(false);
          return;
        }

        ctx.drawImage(img, 0, 0, 150, 150);
        const imgData = ctx.getImageData(0, 0, 150, 150);
        const data = imgData.data;

        let totalLuminance = 0;
        let leftLuminance = 0;
        let rightLuminance = 0;
        const totalPixels = 150 * 150;

        // 1. Luminosité moyenne & Symétrie des ombres
        for (let y = 0; y < 150; y++) {
          for (let x = 0; x < 150; x++) {
            const idx = (y * 150 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;

            if (x < 75) {
              leftLuminance += lum;
            } else {
              rightLuminance += lum;
            }
          }
        }

        const avgBrightness = totalLuminance / totalPixels;
        const leftAvg = leftLuminance / (totalPixels / 2);
        const rightAvg = rightLuminance / (totalPixels / 2);
        const shadowDiff = Math.abs(leftAvg - rightAvg);

        // 2. Netteté (Variation des gradients)
        let totalGradient = 0;
        for (let y = 1; y < 149; y++) {
          for (let x = 1; x < 149; x++) {
            const idx = (y * 150 + x) * 4;
            const currentLum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

            const rightIdx = (y * 150 + (x + 1)) * 4;
            const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];

            const bottomIdx = ((y + 1) * 150 + x) * 4;
            const bottomLum = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];

            totalGradient += Math.abs(currentLum - rightLum) + Math.abs(currentLum - bottomLum);
          }
        }
        const avgGradient = totalGradient / (148 * 148 * 2);

        // 3. Uniformité du fond (Échantillonnage de la bordure extérieure de 15px)
        const borderLuminances: number[] = [];
        for (let y = 0; y < 150; y++) {
          for (let x = 0; x < 150; x++) {
            if (x < 15 || x > 135 || y < 15 || y > 135) {
              const idx = (y * 150 + x) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              borderLuminances.push(lum);
            }
          }
        }
        const borderMean = borderLuminances.reduce((a, b) => a + b, 0) / borderLuminances.length;
        const borderVariance = borderLuminances.reduce((a, b) => a + Math.pow(b - borderMean, 2), 0) / borderLuminances.length;
        const borderStdDev = Math.sqrt(borderVariance);

        // Conversion en pourcentages/notes
        const brightnessScore = Math.max(0, Math.min(100, Math.round((1 - Math.abs(avgBrightness - 145) / 145) * 100)));
        const sharpnessScore = Math.max(0, Math.min(100, Math.round(Math.min(1, avgGradient / 25) * 100)));
        const backgroundScore = Math.max(0, Math.min(100, Math.round((1 - borderStdDev / 70) * 100)));
        const shadowScore = Math.max(0, Math.min(100, Math.round((1 - shadowDiff / 60) * 100)));

        setAnalysis({
          brightness: brightnessScore,
          sharpness: sharpnessScore,
          backgroundUniformity: backgroundScore,
          shadowBalance: shadowScore,
          brightnessOk: avgBrightness >= 110 && avgBrightness <= 210,
          sharpnessOk: sharpnessScore >= 45,
          backgroundOk: backgroundScore >= 65,
          shadowOk: shadowDiff <= 25,
        });

        // Pré-cocher des options plausibles
        setChecklist({
          centered: avgBrightness > 60 && shadowDiff < 35,
          framing: true,
          margins: true,
        });
      } catch (e) {
        console.error("Erreur durant l'analyse d'image :", e);
      } finally {
        setIsAnalyzing(false);
      }
    };
    img.onerror = () => {
      setIsAnalyzing(false);
    };
    img.src = url;
  };

  // ─── Capture ──────────────────────────────────────────────────────────────
  const handleCapture = async () => {
    setState('capturing');
    setErrorMsg(null);
    setAnalysis(null);

    // Arrêter le polling live view (le serveur s'en charge aussi)
    stopLiveViewPolling();

    try {
      const res = await fetch(`${PHOTO_SERVER_URL}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === 'AF_FAILED') {
          setErrorMsg(
            `⚠️ Mise au point impossible.\n` +
            `→ Vérifiez le commutateur AF/MF du lens (doit être sur AF)\n` +
            `→ Pointez vers un sujet contrasté\n` +
            `→ Ou passez en mise au point manuelle`
          );
          setState('error');
          return;
        }
        if (data.errorCode === 'NO_CAMERA') {
          setErrorMsg(`❌ Canon non détecté. Vérifiez le câble USB.`);
          setState('error');
          return;
        }
        throw new Error(data.error || 'Erreur de capture.');
      }

      if (data.success && data.imageUrl && !data.isMock) {
        setCapturedUrl(data.imageUrl);
        setState('preview');
        analyzeCapturedImage(data.imageUrl);
        return;
      }

      if (data.isMock) {
        setErrorMsg(`Aucune caméra EDSDK — vérifiez USB et fermez EOS Utility.`);
        setState('error');
        return;
      }

      throw new Error('Réponse inattendue du pont.');

    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur inconnue.');
      setState('error');
    }
  };

  // ─── Reprendre (retake) ───────────────────────────────────────────────────
  const handleRetake = async () => {
    setCapturedUrl(null);
    setAnalysis(null);
    if (liveViewAvailable) {
      await startLiveView();
    } else {
      setState('liveview');
    }
  };

  // ─── Valider ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!capturedUrl) return;
    setIsSaving(true);
    try {
      onSave(capturedUrl);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Réessayer après erreur ───────────────────────────────────────────────
  const handleRetry = async () => {
    setErrorMsg(null);
    if (liveViewAvailable) {
      await startLiveView();
    } else {
      setState('liveview');
    }
  };

  // Toggle checklist elements
  const toggleChecklist = (key: 'centered' | 'framing' | 'margins') => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isGlobalCompliant = 
    analysis &&
    analysis.brightnessOk &&
    analysis.sharpnessOk &&
    analysis.backgroundOk &&
    analysis.shadowOk &&
    checklist.centered &&
    checklist.framing &&
    checklist.margins;

  // ─── Rendu de la zone centrale ────────────────────────────────────────────
  const renderViewport = () => {
    // ÉTAT : Aperçu capturé
    if (state === 'preview' && capturedUrl) {
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={capturedUrl}
          alt="Photo capturée"
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
          style={{ opacity: 0, transition: 'opacity 0.4s' }}
        />
      );
    }

    // ÉTAT : Live View actif — l'img est rafraîchie via setFrameTs
    if (state === 'liveview' && liveViewAvailable) {
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={`${PHOTO_SERVER_URL}/api/liveview/frame?t=${frameTs}`}
            alt="Live view Canon"
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            onError={() => {/* frame pas encore dispo, ignore */}}
          />
          
          {/* Guide de cadrage ICAO / ISO */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <svg className="w-full h-full text-white/50" viewBox="0 0 400 400" fill="none">
              {/* Ovale visage principal */}
              <ellipse cx="200" cy="190" rx="75" ry="105" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
              {/* Ligne des yeux */}
              <line x1="100" y1="165" x2="300" y2="165" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
              {/* Ligne médiane verticale */}
              <line x1="200" y1="50" x2="200" y2="330" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
              {/* Limite menton */}
              <line x1="160" y1="295" x2="240" y2="295" stroke="currentColor" strokeWidth="1.5" />
              {/* Légende rapide */}
              <text x="200" y="35" textAnchor="middle" fill="currentColor" className="text-[10px] font-bold tracking-wider">
                CADRAGE PHOTO D&apos;IDENTITÉ (ICAO)
              </text>
            </svg>
          </div>

          {/* Indicateur live */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
        </>
      );
    }

    // ÉTAT : Capture en cours
    if (state === 'capturing') {
      return (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
              <Camera className="w-8 h-8 text-indigo-500" />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-800 dark:text-white">Déclenchement…</p>
            <p className="text-xs text-neutral-500 mt-1">L&apos;obturateur Canon s&apos;active</p>
          </div>
        </div>
      );
    }

    // ÉTAT : Erreur
    if (state === 'error') {
      return (
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="w-10 h-10 text-red-400 shrink-0" />
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 whitespace-pre-line leading-relaxed">
            {errorMsg}
          </p>
        </div>
      );
    }

    // ÉTAT : Initialisation / live view sans EXE disponible
    return (
      <div className="flex flex-col items-center gap-4 text-center px-6">
        {state === 'init' ? (
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border-2 border-dashed border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
            <Camera className="w-10 h-10 text-indigo-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
            {state === 'init' ? 'Connexion à la caméra…' : 'Prêt à capturer'}
          </p>
          {state !== 'init' && (
            <p className="text-xs text-neutral-400 dark:text-neutral-550 mt-1">
              Cliquez &quot;Capturer&quot; pour déclencher l&apos;obturateur Canon
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─── Boutons ──────────────────────────────────────────────────────────────
  const renderButtons = () => {
    if (state === 'preview') {
      return (
        <>
          <button onClick={handleRetake}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition">
            <RefreshCw className="w-4 h-4" /> Reprendre
          </button>
          <button onClick={handleSave} disabled={isSaving || isAnalyzing}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm transition ${
              isGlobalCompliant
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
            }`}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isGlobalCompliant ? 'Valider (Conforme)' : 'Valider quand même'}
          </button>
        </>
      );
    }

    if (state === 'error') {
      return (
        <>
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-650 dark:text-neutral-300 rounded-xl text-xs font-bold transition">
            Annuler
          </button>
          <button onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition">
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </>
      );
    }

    const isReady = state === 'liveview' || state === 'capturing';
    return (
      <>
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-650 dark:text-neutral-300 rounded-xl text-xs font-bold transition">
          Annuler
        </button>
        <button onClick={handleCapture} disabled={!isReady || state === 'capturing'}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition">
          {state === 'capturing'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Capture…</>
            : <><Camera className="w-4 h-4" /> Capturer</>}
        </button>
      </>
    );
  };

  const showSidebar = state === 'preview';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-250 dark:border-neutral-800 overflow-hidden transition-all duration-300 ${
        showSidebar ? 'max-w-3xl' : 'max-w-md'
      }`}>

        {/* HEADER */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Capture Photo d&apos;Identité Canon
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              {employeeName} · {cameraModel}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* VIEWPORT COLUMN */}
            <div className="flex-1 space-y-4">
              {/* STATUS badge live view */}
              {state === 'liveview' && liveViewAvailable && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <Video className="w-3.5 h-3.5 shrink-0" />
                  Gabarit actif — Centrez le visage dans l&apos;ovale
                </div>
              )}
              {state === 'liveview' && !liveViewAvailable && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  <VideoOff className="w-3.5 h-3.5 shrink-0" />
                  Visez manuellement à l&apos;aide du viseur puis capturez
                </div>
              )}

              {/* VIEWPORT AREA */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-black flex items-center justify-center shadow-inner">
                {renderViewport()}
              </div>

              {/* Action buttons (only in single column layout or left aligned) */}
              {!showSidebar && (
                <div className="flex gap-3">
                  {renderButtons()}
                </div>
              )}
            </div>

            {/* SIDEBAR ANALYSIS COLUMN */}
            {showSidebar && (
              <div className="w-full md:w-80 flex flex-col justify-between border-t md:border-t-0 md:border-l border-neutral-100 dark:border-neutral-800 pt-6 md:pt-0 md:pl-6 space-y-5 animate-in slide-in-from-right-3 duration-300">
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">
                      Conformité Norme ICAO
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      isGlobalCompliant
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                    }`}>
                      {isGlobalCompliant ? 'Conforme' : 'Non Conforme'}
                    </span>
                  </div>

                  {/* 1. AUTOMATED TESTS */}
                  <div className="space-y-3 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-150 dark:border-neutral-800">
                    <h4 className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider mb-1">
                      Analyses d&apos;image automatiques
                    </h4>

                    {isAnalyzing ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Calcul des critères en cours...</span>
                      </div>
                    ) : analysis ? (
                      <div className="space-y-2.5">
                        {/* Éclairage */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-neutral-600 dark:text-neutral-350">Éclairage suffisant</span>
                            <span className={analysis.brightnessOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
                              {analysis.brightness}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${analysis.brightnessOk ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${analysis.brightness}%` }} />
                          </div>
                        </div>

                        {/* Netteté */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-neutral-600 dark:text-neutral-350">Netteté / Contraste</span>
                            <span className={analysis.sharpnessOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
                              {analysis.sharpness}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${analysis.sharpnessOk ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${analysis.sharpness}%` }} />
                          </div>
                        </div>

                        {/* Fond uni */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-neutral-600 dark:text-neutral-350">Fond neutre & uni</span>
                            <span className={analysis.backgroundOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
                              {analysis.backgroundUniformity}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${analysis.backgroundOk ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${analysis.backgroundUniformity}%` }} />
                          </div>
                        </div>

                        {/* Absence ombres */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-neutral-600 dark:text-neutral-350">Lumière équilibrée (sans ombres)</span>
                            <span className={analysis.shadowOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
                              {analysis.shadowBalance}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${analysis.shadowOk ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${analysis.shadowBalance}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-400">Aucune photo à analyser</div>
                    )}
                  </div>

                  {/* 2. MANUAL CHECKLIST */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                      Contrôles opérateur requis
                    </h4>

                    <div className="space-y-2">
                      <button 
                        type="button"
                        onClick={() => toggleChecklist('centered')}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-neutral-150 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition"
                      >
                        {checklist.centered ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                        )}
                        <span>Visage centré, droit et yeux horizontaux</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => toggleChecklist('framing')}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-neutral-150 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition"
                      >
                        {checklist.framing ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                        )}
                        <span>Cadrage adapté aux dimensions du badge</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => toggleChecklist('margins')}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-neutral-150 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition"
                      >
                        {checklist.margins ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                        )}
                        <span>Espace suffisant autour du visage (marges)</span>
                      </button>
                    </div>
                  </div>

                  {/* Warn if non compliant */}
                  {analysis && !isGlobalCompliant && (
                    <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/55 dark:border-amber-900/30 rounded-xl text-[10px] text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <div>
                        Certains critères ICAO ne sont pas pleinement validés. Vous pouvez forcer la validation ou reprendre la photo.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  {renderButtons()}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
