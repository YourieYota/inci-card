'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface WebcamModalProps {
  employeeName: string;
  onSave: (photoUrl: string) => void;
  onClose: () => void;
}

type ModalState = 'init' | 'liveview' | 'preview' | 'error';

export default function WebcamModal({ employeeName, onSave, onClose }: WebcamModalProps) {
  const [state, setState] = useState<ModalState>('init');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize webcam
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setState('liveview');
      } catch (err: any) {
        console.error("Webcam error:", err);
        setErrorMsg("Impossible d'accéder à la webcam. Veuillez vérifier les permissions du navigateur.");
        setState('error');
      }
    };

    if (state === 'init' || state === 'liveview') {
      startWebcam();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // We want a square capture (e.g. 600x600) from the center of the video
    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    canvas.width = 600;
    canvas.height = 600;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw the central square of the video onto the 600x600 canvas
      ctx.drawImage(video, startX, startY, size, size, 0, 0, 600, 600);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedUrl(dataUrl);
      setState('preview');
    }
  };

  const handleRetake = () => {
    setCapturedUrl(null);
    setState('liveview');
  };

  const handleSave = async () => {
    if (!capturedUrl) return;
    setIsSaving(true);
    try {
      onSave(capturedUrl);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-250 dark:border-neutral-800 overflow-hidden transition-all duration-300">

        {/* HEADER */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Capture Photo (Webcam)
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              {employeeName}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-6">
            
            {/* VIEWPORT COLUMN */}
            <div className="flex-1 space-y-4">
              
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-black flex items-center justify-center shadow-inner">
                {state === 'init' && (
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                )}
                
                {state === 'error' && (
                  <div className="flex flex-col items-center p-6 text-center text-red-500">
                    <AlertCircle className="w-10 h-10 mb-2" />
                    <p className="text-sm">{errorMsg}</p>
                  </div>
                )}

                {state === 'liveview' && (
                  <>
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                      playsInline 
                      muted 
                    />
                    {/* Guide de cadrage ICAO / ISO */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <svg className="w-full h-full text-white/50" viewBox="0 0 400 400" fill="none">
                        <ellipse cx="200" cy="190" rx="75" ry="105" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="100" y1="165" x2="300" y2="165" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="200" y1="50" x2="200" y2="330" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="160" y1="295" x2="240" y2="295" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </>
                )}

                {state === 'preview' && capturedUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={capturedUrl} alt="Preview" className="w-full h-full object-cover" />
                )}

                {/* Hidden canvas for capturing */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {state === 'error' && (
                  <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-650 dark:text-neutral-300 rounded-xl text-xs font-bold transition">
                    Fermer
                  </button>
                )}
                
                {state === 'liveview' && (
                  <>
                    <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-650 dark:text-neutral-300 rounded-xl text-xs font-bold transition">
                      Annuler
                    </button>
                    <button onClick={handleCapture} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                      <Camera className="w-4 h-4" /> Capturer
                    </button>
                  </>
                )}

                {state === 'preview' && (
                  <>
                    <button onClick={handleRetake} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition">
                      <RefreshCw className="w-4 h-4" /> Reprendre
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Valider
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
