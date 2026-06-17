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
}

interface CanvasProps {
  width: number;
  height: number;
  backgroundUrl: string;
  elements: StudioElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onChangeElement: (element: StudioElement) => void;
}

export default function Canvas({
  width,
  height,
  backgroundUrl,
  elements,
  selectedElementId,
  onSelectElement,
  onChangeElement,
}: CanvasProps) {
  // Deselect when clicking the canvas container
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectElement(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-auto min-h-[450px] transition-all duration-300">
      <span className="text-xs text-neutral-400 dark:text-neutral-500 mb-2 font-mono">
        Zone de travail ({width}x{height} px)
      </span>
      <div
        onClick={handleCanvasClick}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className={`relative bg-white dark:bg-neutral-850 shadow-2xl border ${
          selectedElementId === null
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/10'
            : 'border-neutral-300 dark:border-neutral-700'
        } transition-all duration-200 rounded-md overflow-hidden select-none`}
      >
        {/* Canvas grid pattern when no background image */}
        {!backgroundUrl && (
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              backgroundImage:
                'radial-gradient(circle, #000 1px, transparent 1px), radial-gradient(circle, #000 1px, transparent 1px)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 8px 8px',
            }}
          />
        )}

        {elements.map((el) => {
          const isSelected = el.id === selectedElementId;

          return (
            <Rnd
              key={el.id}
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
              onClick={(e: any) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
              className={`group ${
                isSelected
                  ? 'ring-2 ring-indigo-500 ring-offset-0 dark:ring-indigo-400'
                  : 'hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700'
              } cursor-move flex items-center justify-center`}
              style={{ zIndex: isSelected ? 50 : 10 }}
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
                  <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center p-2 rounded text-neutral-400 dark:text-neutral-500">
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

                {/* Selection Resize Handles visual indicators (little squares on corners for selected item) */}
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
          );
        })}
      </div>
    </div>
  );
}
