'use client';

import React from 'react';
import { Rnd } from 'react-rnd';
import { QrCode, User, Image as ImageIcon } from 'lucide-react';
import IntaglioImage from './IntaglioImage';

export interface StudioElement {
  id: string;
  type: 'text' | 'image' | 'qr' | 'logo' | 'group';
  parentId?: string;

  // Group properties
  gap?: number; // Used for columnGap and default rowGap
  rowGap?: number;
  padding?: number;
  flexDirection?: 'column' | 'row';
  flexWrap?: 'nowrap' | 'wrap';

  // Child properties
  childFlexMode?: 'fill' | 'flex' | 'fixed';
  forceBreakAfter?: boolean;

  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  field?: string;
  color?: string;
  fontSize?: number;
  fontSizeUnit?: 'px' | 'pt';
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'first-letter';
  alignment?: 'left' | 'center' | 'right';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  qrValue?: string;
  opacity?: number; // range 0 to 1, default 1
  logoUrl?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  blendMode?: string;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  // Intaglio effect parameters
  intaglio?: boolean;
  intaglioResolution?: number;
  intaglioSpacing?: number;
  intaglioLineWidth?: number;
  intaglioWaveAmp?: number;
}

interface CanvasProps {
  width: number;
  height: number;
  backgroundUrl: string;
  backgroundOpacity: number; // range 0 to 1
  elements: StudioElement[];
  selectedElementIds: string[];
  selectedElementId: string | null;
  onSelectElements: (ids: string[], primaryId: string | null) => void;
  onChangeElements: (elements: StudioElement[], shouldPushHistory: boolean) => void;
  zoom: number; // e.g., 1, 1.5, 2, 2.5
  borderRadius?: number; // card border radius (px)
}

export default function Canvas({
  width,
  height,
  backgroundUrl,
  backgroundOpacity = 1,
  elements,
  selectedElementIds = [],
  selectedElementId,
  onSelectElements,
  onChangeElements,
  zoom = 1,
  borderRadius = 8,
}: CanvasProps) {
  const scaledWidth = width * zoom;
  const scaledHeight = height * zoom;

  const dragStartPositions = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  const [activeGuidelines, setActiveGuidelines] = React.useState<{ x?: number; y?: number }>({});

  const handleDragStart = (elementId: string, e: any) => {
    let activeIds = [...selectedElementIds];
    
    // If the dragged element is not already selected, select it (and deselect others unless modifier is held)
    if (!activeIds.includes(elementId)) {
      const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey;
      if (isModifierPressed) {
        activeIds = [...activeIds, elementId];
        onSelectElements(activeIds, elementId);
      } else {
        activeIds = [elementId];
        onSelectElements(activeIds, elementId);
      }
    }

    // Record initial positions
    const positions = new Map<string, { x: number; y: number }>();
    elements.forEach((el) => {
      if (activeIds.includes(el.id) || el.id === elementId) {
        positions.set(el.id, { x: el.x, y: el.y });
      }
    });
    dragStartPositions.current = positions;
  };

  const handleDrag = (draggedId: string, e: any, data: any) => {
    const startPos = dragStartPositions.current.get(draggedId);
    if (!startPos) return;

    const draggedElement = elements.find((el) => el.id === draggedId);
    if (!draggedElement) return;

    const w = draggedElement.width;
    const h = draggedElement.height;

    const rawX = data.x;
    const rawY = data.y;

    let snappedX = rawX;
    let snappedY = rawY;
    let guideX: number | undefined = undefined;
    let guideY: number | undefined = undefined;

    const SNAP_THRESHOLD = 5;

    // Build snapping targets
    const xTargets = [
      { value: 0 },
      { value: width / 2 },
      { value: width },
    ];
    const yTargets = [
      { value: 0 },
      { value: height / 2 },
      { value: height },
    ];

    const activeIds = Array.from(dragStartPositions.current.keys());
    elements.forEach((el) => {
      if (!activeIds.includes(el.id)) {
        xTargets.push({ value: el.x });
        xTargets.push({ value: el.x + el.width / 2 });
        xTargets.push({ value: el.x + el.width });

        yTargets.push({ value: el.y });
        yTargets.push({ value: el.y + el.height / 2 });
        yTargets.push({ value: el.y + el.height });
      }
    });

    // X Axis snap
    let bestDiffX = SNAP_THRESHOLD;
    xTargets.forEach((t) => {
      // Left edge
      let diff = Math.abs(rawX - t.value);
      if (diff < bestDiffX) {
        bestDiffX = diff;
        snappedX = t.value;
        guideX = t.value;
      }
      // Center
      diff = Math.abs(rawX + w / 2 - t.value);
      if (diff < bestDiffX) {
        bestDiffX = diff;
        snappedX = t.value - w / 2;
        guideX = t.value;
      }
      // Right edge
      diff = Math.abs(rawX + w - t.value);
      if (diff < bestDiffX) {
        bestDiffX = diff;
        snappedX = t.value - w;
        guideX = t.value;
      }
    });

    // Y Axis snap
    let bestDiffY = SNAP_THRESHOLD;
    yTargets.forEach((t) => {
      // Top edge
      let diff = Math.abs(rawY - t.value);
      if (diff < bestDiffY) {
        bestDiffY = diff;
        snappedY = t.value;
        guideY = t.value;
      }
      // Center
      diff = Math.abs(rawY + h / 2 - t.value);
      if (diff < bestDiffY) {
        bestDiffY = diff;
        snappedY = t.value - h / 2;
        guideY = t.value;
      }
      // Bottom edge
      diff = Math.abs(rawY + h - t.value);
      if (diff < bestDiffY) {
        bestDiffY = diff;
        snappedY = t.value - h;
        guideY = t.value;
      }
    });

    // Clamp coordinates within canvas boundaries
    snappedX = Math.max(0, Math.min(width - w, snappedX));
    snappedY = Math.max(0, Math.min(height - h, snappedY));

    // Update guidelines coordinates relative to canvas
    setActiveGuidelines({
      x: guideX !== undefined ? Math.round(guideX) : undefined,
      y: guideY !== undefined ? Math.round(guideY) : undefined,
    });

    // Calculate displacement delta
    const dx = snappedX - startPos.x;
    const dy = snappedY - startPos.y;

    // Apply displacement to all selected elements
    const updatedElements = elements.map((el) => {
      const startElPos = dragStartPositions.current.get(el.id);
      if (startElPos) {
        let newX = Math.round(startElPos.x + dx);
        let newY = Math.round(startElPos.y + dy);
        newX = Math.max(0, Math.min(width - el.width, newX));
        newY = Math.max(0, Math.min(height - el.height, newY));
        return {
          ...el,
          x: newX,
          y: newY,
        };
      }
      return el;
    });

    onChangeElements(updatedElements, false);
  };

  const handleDragStop = () => {
    setActiveGuidelines({});
    onChangeElements(elements, true);
    dragStartPositions.current.clear();
  };

  const renderElementContent = (el: StudioElement) => {
    return (
      <>
        {el.type === 'text' && (
          <div
            style={{
              color: el.color || '#000000',
              fontSize: `${el.fontSize || 14}${el.fontSizeUnit || 'px'}`,
              fontFamily: el.fontFamily || 'sans-serif',
              fontWeight: el.fontWeight || 'normal',
              fontStyle: el.fontStyle || 'normal',
              textTransform: el.textTransform === 'first-letter' ? 'none' : (el.textTransform || 'none'),
              textAlign: el.alignment || 'left',
              lineHeight: el.lineHeight !== undefined ? el.lineHeight : 'normal',
              letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}px` : 'normal',
              alignItems: el.verticalAlignment === 'top' ? 'flex-start' : el.verticalAlignment === 'bottom' ? 'flex-end' : 'center',
            }}
            className="w-full h-full flex justify-center p-1 break-normal select-none overflow-hidden"
          >
            {(() => {
              let rawText = el.field ? `{${el.field}}` : (el.content || 'Texte');
              if (el.textTransform === 'first-letter' && typeof rawText === 'string' && rawText.length > 0) {
                if (el.field) {
                  return (
                    <span className="bg-neutral-100/30 dark:bg-neutral-800/20 px-1 rounded font-medium border border-neutral-200/30 dark:border-neutral-700/20">
                      {rawText}
                    </span>
                  );
                }
                return rawText.charAt(0).toUpperCase() + rawText.slice(1).toLowerCase();
              }
              return el.field ? (
                <span className="bg-neutral-100/30 dark:bg-neutral-800/20 px-1 rounded font-medium border border-neutral-200/30 dark:border-neutral-700/20">
                  {rawText}
                </span>
              ) : rawText;
            })()}
          </div>
        )}

        {el.type === 'image' && (
          el.intaglio ? (
            <IntaglioImage
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80"
              spacing={el.intaglioSpacing}
              lineWidth={el.intaglioLineWidth}
              waveAmp={el.intaglioWaveAmp}
              className="w-full h-full object-cover"
              style={{
                borderRadius: `${el.borderRadius || 0}px`,
                borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
                borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
                borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
                filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
              }}
            />
          ) : (
            <div
              style={{
                borderRadius: `${el.borderRadius || 0}px`,
                borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
                borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
                borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
                filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
              }}
              className={`w-full h-full bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center p-2 text-neutral-400 dark:text-neutral-500 overflow-hidden ${
                el.borderWidth === undefined ? 'border border-neutral-300 dark:border-neutral-700' : ''
              }`}
            >
              <User className="w-8 h-8 opacity-75 mb-1" />
              <span className="text-[10px] font-medium tracking-wide uppercase">Photo Employé</span>
            </div>
          )
        )}

        {el.type === 'qr' && (
          <div
            style={{
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
              filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
            }}
            className={`w-full h-full bg-white flex flex-col items-center justify-center p-2 text-black overflow-hidden ${
              el.borderWidth === undefined ? 'border border-neutral-300' : ''
            }`}
          >
            <QrCode className="w-full h-full max-w-[80%] max-h-[80%]" />
            <span className="text-[8px] font-semibold text-neutral-500 absolute bottom-1 max-w-[90%] truncate text-center">
              {el.field ? `QR: {${el.field}}` : el.content ? `QR: ${el.content}` : 'QR Code'}
            </span>
          </div>
        )}

        {el.type === 'logo' && (
          <div
            style={{
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
            }}
            className={`w-full h-full flex items-center justify-center overflow-hidden ${
              !el.logoUrl ? 'bg-neutral-100/50 dark:bg-neutral-800/30 text-neutral-400 dark:text-neutral-500' : ''
            } ${
              el.borderWidth === undefined && !el.logoUrl ? 'border border-neutral-300/50 dark:border-neutral-700/50' : ''
            }`}
          >
            {el.logoUrl ? (
              <img src={el.logoUrl} alt="Logo" className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <div className="flex flex-col items-center justify-center p-2">
                <ImageIcon className="w-8 h-8 opacity-75 mb-1" />
                <span className="text-[10px] font-medium tracking-wide uppercase text-center">Logo Entreprise</span>
              </div>
            )}
          </div>
        )}

        {el.type === 'group' && (
          <div
            style={{
              display: 'flex',
              flexDirection: el.flexDirection || 'column',
              flexWrap: (el.flexWrap === 'wrap' || elements.some(c => c.parentId === el.id && c.forceBreakAfter)) ? 'wrap' : 'nowrap',
              gap: `${el.rowGap !== undefined ? el.rowGap : (el.gap !== undefined ? el.gap : 4)}px ${el.gap !== undefined ? el.gap : 4}px`,
              padding: el.padding !== undefined ? `${el.padding}px` : '4px',
              width: '100%',
              height: '100%',
              overflow: 'visible',
              backgroundColor: el.color || 'transparent',
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
              alignItems: el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'flex-end' : 'flex-start',
              justifyContent: el.verticalAlignment === 'middle' ? 'center' : el.verticalAlignment === 'bottom' ? 'flex-end' : 'flex-start',
            }}
            className={`relative ${
              el.borderWidth === undefined && !el.color ? 'border border-dashed border-indigo-400/50 dark:border-indigo-600/50 bg-indigo-500/5' : ''
            }`}
          >
            {elements
              .filter(child => child.parentId === el.id)
              .map(child => {
                const isChildSelected = selectedElementIds.includes(child.id);
                const isChildPrimary = selectedElementId === child.id;
                
                return (
                  <React.Fragment key={child.id}>
                    <div
                      onClick={(e) => {
                      e.stopPropagation();
                      const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey;
                      let activeIds = [...selectedElementIds];
                      if (isModifierPressed) {
                        if (activeIds.includes(child.id)) {
                          activeIds = activeIds.filter((id) => id !== child.id);
                          const primaryId = activeIds.length > 0 ? activeIds[activeIds.length - 1] : null;
                          onSelectElements(activeIds, primaryId);
                        } else {
                          activeIds = [...activeIds, child.id];
                          onSelectElements(activeIds, child.id);
                        }
                      } else {
                        onSelectElements([child.id], child.id);
                      }
                    }}
                    className={`relative pointer-events-auto transition-all ${
                      isChildSelected
                        ? isChildPrimary
                          ? 'ring-2 ring-indigo-500 ring-offset-0 dark:ring-indigo-400 z-50'
                          : 'ring-2 ring-indigo-400/50 ring-offset-0 dark:ring-indigo-500/50 z-40'
                        : 'hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700 z-10'
                    }`}
                    style={{
                      width: child.childFlexMode === 'fixed' ? `${child.width}px` : (child.childFlexMode === 'fill' ? '100%' : (el.flexDirection === 'row' ? (child.type === 'text' || child.type === 'group' ? 'auto' : `${child.width}px`) : (child.type === 'text' || child.type === 'group' ? '100%' : `${child.width}px`))),
                      height: el.flexDirection === 'row' && el.flexWrap !== 'wrap' ? 'auto' : (child.type === 'text' || child.type === 'group' ? 'auto' : `${child.height}px`),
                      minHeight: child.type === 'text' ? `${child.height}px` : undefined,
                      flex: child.childFlexMode === 'flex' ? '1 1 0%' : (child.childFlexMode === 'fixed' || child.childFlexMode === 'fill' ? 'none' : ((el.flexDirection === 'row' && (child.type === 'text' || child.type === 'group')) ? '1 1 0%' : '0 0 auto')),
                    }}
                  >
                    {renderElementContent(child)}
                  </div>
                    {child.forceBreakAfter && el.flexDirection === 'row' && (
                      <div style={{ flexBasis: '100%', height: 0, margin: 0, padding: 0, marginBottom: `-${el.rowGap !== undefined ? el.rowGap : (el.gap !== undefined ? el.gap : 4)}px` }} />
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        )}
      </>
    );
  };

  return (
    <div
      onClick={() => onSelectElements([], null)}
      className="flex flex-col p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-auto min-h-[480px] h-[calc(100vh-250px)] max-h-[85vh] w-full flex-1 transition-all duration-300"
    >
      <div className="m-auto flex flex-col items-center justify-center p-4 min-w-max min-h-max">
        <span className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 font-mono">
          Zone de travail ({width}x{height} px @ {Math.round(zoom * 100)}%)
        </span>

        {/* Scaled viewport container */}
        <div
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            borderRadius: `${borderRadius * zoom}px`,
          }}
          className="relative transition-all duration-200 shadow-2xl border border-neutral-300 dark:border-neutral-700 overflow-hidden"
        >
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              borderRadius: `${borderRadius}px`,
            }}
            className={`absolute top-0 left-0 bg-white dark:bg-neutral-800 ${
              selectedElementId === null
                ? 'ring-2 ring-indigo-500/10'
                : ''
            } select-none`}
          >
            {/* Guidelines */}
            {activeGuidelines.x !== undefined && (
              <div
                className="absolute top-0 bottom-0 border-l border-dashed border-rose-500 z-[9999] pointer-events-none"
                style={{ left: `${activeGuidelines.x}px` }}
              />
            )}
            {activeGuidelines.y !== undefined && (
              <div
                className="absolute left-0 right-0 border-t border-dashed border-rose-500 z-[9999] pointer-events-none"
                style={{ top: `${activeGuidelines.y}px` }}
              />
            )}

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
            <div className="absolute inset-0 pointer-events-none">
              {elements.filter(el => !el.parentId).map((el) => {

                const isSelected = selectedElementIds.includes(el.id);
                const isPrimary = el.id === selectedElementId;
                const elementOpacity = el.opacity !== undefined ? el.opacity : 1;

                return (
                  <Rnd
                    key={el.id}
                    size={{ width: el.width, height: el.height }}
                    position={{ x: el.x, y: el.y }}
                    onDragStart={(e) => {
                      handleDragStart(el.id, e);
                    }}
                    onDrag={(e, d) => {
                      handleDrag(el.id, e, d);
                    }}
                    onDragStop={() => {
                      handleDragStop();
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      const updated = {
                        ...el,
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        x: Math.round(position.x),
                        y: Math.round(position.y),
                      };
                      onChangeElements(elements.map(item => item.id === el.id ? updated : item), true);
                    }}
                    bounds="parent"
                    scale={zoom} // Ensures dragging calculations scale correctly
                    onClick={(e: any) => {
                      e.stopPropagation();
                      const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey;
                      let activeIds = [...selectedElementIds];
                      if (isModifierPressed) {
                        if (activeIds.includes(el.id)) {
                          activeIds = activeIds.filter((id) => id !== el.id);
                          const primaryId = activeIds.length > 0 ? activeIds[activeIds.length - 1] : null;
                          onSelectElements(activeIds, primaryId);
                        } else {
                          activeIds = [...activeIds, el.id];
                          onSelectElements(activeIds, el.id);
                        }
                      } else {
                        onSelectElements([el.id], el.id);
                      }
                    }}
                    className={`group pointer-events-auto ${
                      isSelected
                        ? isPrimary
                          ? 'ring-2 ring-indigo-500 ring-offset-0 dark:ring-indigo-400'
                          : 'ring-2 ring-indigo-400/50 ring-offset-0 dark:ring-indigo-500/50'
                        : 'hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700'
                    } cursor-move flex items-center justify-center`}
                    style={{
                      zIndex: isSelected ? 50 : 10,
                      opacity: elementOpacity,
                      mixBlendMode: (el as any).blendMode || 'normal',
                    }}
                  >
                    <div
                      className="w-full h-full relative flex items-center justify-center"
                      style={{
                        transform: `rotate(${el.rotation || 0}deg)`,
                        width: '100%',
                        height: '100%',
                      }}
                    >
                                            {/* Element Type Renderers */}
                      {renderElementContent(el)}
</div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
