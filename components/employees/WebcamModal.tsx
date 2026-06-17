'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Video } from 'lucide-react';

interface WebcamModalProps {
  employeeName: string;
  onSave: (photoBase64: string) => void;
  onClose: () => void;
}

export default function WebcamModal({ employeeName, onSave, onClose }: WebcamModalProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Enumerate video input devices (webcams, DSLRs via Canon EOS Utility)
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permissions first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((device) => device.kind === 'videoinput');
        
        setDevices(videoDevices);

        if (videoDevices.length > 0) {
          // Check if Canon DSLR is available and pre-select it
          const canonDevice = videoDevices.find((d) => d.label.toLowerCase().includes('canon') || d.label.toLowerCase().includes('eos'));
          setSelectedDeviceId(canonDevice ? canonDevice.deviceId : videoDevices[0].deviceId);
        }
      } catch (err: any) {
        setError('Impossible d\'accéder aux périphériques caméra. Vérifiez vos permissions.');
      }
    };

    getDevices();
  }, []);

  // Initialize camera stream when selectedDeviceId changes
  useEffect(() => {
    if (!selectedDeviceId) return;

    // Stop previous stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const startCamera = async () => {
      try {
        setError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            // Setting a perfect square aspect ratio for badges
            width: { ideal: 480 },
            height: { ideal: 480 },
          },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error(err);
        setError('Erreur lors du démarrage de la caméra sélectionnée.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedDeviceId]);

  // Capture Frame
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Capture a square photo from the video stream
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 400;
        canvas.height = 400;

        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;

        context.drawImage(
          video,
          startX,
          startY,
          size,
          size, // Source dimensions
          0,
          0,
          400,
          400 // Destination dimensions
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImage(dataUrl);

        // Turn off stream temporarily
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    // Restart camera
    const restart = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 480 }, height: { ideal: 480 } },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        setError('Impossible de redémarrer la caméra.');
      }
    };
    restart();
  };

  const handleSave = () => {
    if (capturedImage) {
      onSave(capturedImage);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <div>
            <h3 className="text-base font-bold text-neutral-850 dark:text-white">Prendre une photo</h3>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Employé : {employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WORKSPACE */}
        <div className="p-6 flex flex-col items-center justify-center gap-6">
          {error && (
            <div className="w-full p-4 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* DEVICE SELECTOR (ONLY IF LIVE STREAM AND MULTIPLE DEVICES) */}
          {!capturedImage && devices.length > 1 && (
            <div className="w-full">
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Video className="w-3.5 h-3.5" />
                <span>Choix de la caméra</span>
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/25"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Caméra ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* STREAM VIEWPORT */}
          <div className="relative w-72 h-72 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-inner flex items-center justify-center">
            {capturedImage ? (
              // PREVIEW PHOTO
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={capturedImage} alt="Captured preview" className="w-full h-full object-cover" />
            ) : (
              // LIVE VIDEO FEED
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]" // mirror effect
              />
            )}

            {/* GUIDELINE OVERLAY */}
            <div className="absolute inset-0 border-[3px] border-dashed border-white/20 rounded-full m-8 pointer-events-none flex items-center justify-center">
              <div className="w-3 h-3 bg-white/20 rounded-full" />
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
          {capturedImage ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-850 rounded-xl text-neutral-600 dark:text-neutral-450 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reprendre</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Valider la photo</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-850 rounded-xl text-neutral-500 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCapture}
                disabled={!stream}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-750 disabled:bg-neutral-250 text-white rounded-xl transition shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Prendre la photo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
