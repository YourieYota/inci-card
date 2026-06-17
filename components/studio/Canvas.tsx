'use client';

import React from 'react';
import { Rnd } from 'react-rnd';
import { QrCode, User } from 'lucide-react';

export interface StudioElement {
  id: string;
  type: 'text' | 'image' | 'qr';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  field?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  alignment?: 'left' | 'center' | 'right';
  qrValue?: string;
  opacity?: number; // range 0 to 1, default 1
}

interface CanvasProps {
  width: number;
  height: number;
  backgroundUrl: string;
  backgroundOpacity: number; // range 0 to 1
  elements: StudioElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onChangeElement: (element: StudioElement) => void;
  zoom: number; // e.g., 1, 1.5, 2, 2.5
}

export default function Canvas({
  width,
  height,
  backgroundUrl,
  backgroundOpacity = 1,
  elements,
  selectedElementId,
  onSelectElement,
  onChangeElement,
  zoom = 1,
}: CanvasProps) {
  // Deselect when clicking the canvas container
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectElement(null);
    }
  };

  // Dimensions scaled by the zoom factor
  const scaledWidth = width * zoom;
  const scaledHeight = height * zoom;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-auto min-h-[480px] max-h-[75vh] transition-all duration-300">
      <span className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 font-mono">
        Zone de travail ({width}x{height} px @ {Math.round(zoom * 100)}%)
      </span>

      {/* Scaled viewport container */}
      <div
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
        className="relative transition-all duration-200 shadow-2xl rounded-md border border-neutral-300 dark:border-neutral-700 overflow-hidden"
      >
        <div
          onClick={handleCanvasClick}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          className={`absolute inset-0 bg-white dark:bg-neutral-850 ${
            selectedElementId === null
              ? 'ring-2 ring-indigo-500/10'
              : ''
          } select-none`}
        >
          {/* Background image layer with local opacity */}
          {backgroundUrl && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-150"
              style={{
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: backgroundOpacity,
                zIndex: 0,
                ...(backgroundUrl.startsWith('linear-gradient') || backgroundUrl.startsWith('radial-gradient') || backgroundUrl.startsWith('#') || backgroundUrl.startsWith('rgb')
                  ? { background: backgroundUrl }
                  : { backgroundImage: `url(${backgroundUrl})` })
              }}
            />
          )}

          {/* Canvas grid pattern when no background image */}
          {!backgroundUrl && (
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #000 1px, transparent 1px), radial-gradient(circle, #000 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px',
                zIndex: 0,
              }}
            />
          )}

          {/* Elements layer */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {elements.map((el) => {
              const isSelected = el.id === selectedElementId;
              const elementOpacity = el.opacity !== undefined ? el.opacity : 1;

              return (
                <div key={el.id} className="pointer-events-auto">
                  <Rnd
                    size={{ width: el.width, height: el.height }}
                    position={{ x: el.x, y: el.y }}
                    onDragStop={(e, d) => {
                      onChangeElement({
                        ...el,
                        x: Math.round(d.x),
                        y: Math.round(d.y),
                      });
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      onChangeElement({
                        ...el,
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        x: Math.round(position.x),
                        y: Math.round(position.y),
                      });
                    }}
                    bounds="parent"
                    scale={zoom} // Ensures dragging calculations scale correctly
                    onClick={(e: any) => {
                      e.stopPropagation();
                      onSelectElement(el.id);
                    }}
                    className={`group ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 ring-offset-0 dark:ring-indigo-400'
                        : 'hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700'
                    } cursor-move flex items-center justify-center`}
                    style={{
                      zIndex: isSelected ? 50 : 10,
                      opacity: elementOpacity,
                    }}
                  >
                    <div className="w-full h-full relative flex items-center justify-center">
                      {/* Element Type Renderers */}
                      {el.type === 'text' && (
                        <div
                          style={{
                            color: el.color || '#000000',
                            fontSize: `${el.fontSize || 14}px`,
                            fontFamily: el.fontFamily || 'sans-serif',
                            fontWeight: el.fontWeight || 'normal',
                            fontStyle: el.fontStyle || 'normal',
                            textAlign: el.alignment || 'left',
                          }}
                          className="w-full h-full flex items-center justify-center p-1 break-words select-none leading-normal overflow-hidden"
                        >
                          {el.field ? (
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-1 rounded font-medium border border-indigo-200/50 dark:border-indigo-800/50">
                              {`{${el.field}}`}
                            </span>
                          ) : (
                            el.content || 'Texte'
                          )}
                        </div>
                      )}

                      {el.type === 'image' && (
                        <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center p-2 rounded text-neutral-450 dark:text-neutral-500">
                          <User className="w-8 h-8 opacity-75 mb-1" />
                          <span className="text-[10px] font-medium tracking-wide uppercase">Photo Employé</span>
                        </div>
                      )}

                      {el.type === 'qr' && (
                        <div className="w-full h-full bg-white border border-neutral-300 flex flex-col items-center justify-center p-2 rounded text-black">
                          <QrCode className="w-full h-full max-w-[80%] max-h-[80%]" />
                          <span className="text-[8px] font-semibold text-neutral-500 absolute bottom-1">
                            {el.field ? `QR: {${el.field}}` : 'QR Code'}
                          </span>
                        </div>
                      )}

                      {/* Selection Resize Handles visual indicators */}
                      {isSelected && (
                        <>
                          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-indigo-500 border border-white rounded-sm" />
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 border border-white rounded-sm" />
                          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-indigo-500 border border-white rounded-sm" />
                          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-indigo-500 border border-white rounded-sm" />
                        </>
                      )}
                    </div>
                  </Rnd>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
