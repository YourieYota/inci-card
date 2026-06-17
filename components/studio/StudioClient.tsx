'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Company, CardType } from '@prisma/client';
import { Save, Plus, ArrowLeft, Loader2, CheckCircle, AlertCircle, RefreshCw, ZoomIn } from 'lucide-react';
import Link from 'next/link';
import Canvas, { StudioElement } from './Canvas';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
import { getTemplate, saveTemplate, createCompany, getCompanyFields } from '@/app/actions/templates';

const getDefaultElements = (width: number, height: number, type?: CardType): StudioElement[] => {
  const isPortrait = height > width;
  const time = Date.now();

  if (type === 'RECU') {
    return [
      {
        id: `logo_${time}_1`,
        type: 'logo',
        logoUrl: '/logo-imprimerie.png',
        x: Math.round((width - 60) / 2),
        y: 15,
        width: 60,
        height: 60,
        opacity: 1,
      },
      {
        id: `text_${time}_title`,
        type: 'text',
        content: 'Imprimerie Nationale',
        x: 20,
        y: 80,
        width: width - 40,
        height: 25,
        fontSize: 14,
        fontWeight: 'bold',
        alignment: 'center',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_subtitle`,
        type: 'text',
        content: 'Enrôlement Biométrique',
        x: 20,
        y: 105,
        width: width - 40,
        height: 20,
        fontSize: 10,
        alignment: 'center',
        color: '#4b5563',
        opacity: 1,
      },
      {
        id: `text_${time}_recu_num`,
        type: 'text',
        field: 'Reçu N°',
        x: 25,
        y: 122,
        width: 150,
        height: 15,
        fontSize: 9,
        color: '#6b7280',
        alignment: 'left',
        opacity: 1,
      },
      {
        id: `text_${time}_date_enr`,
        type: 'text',
        field: 'Date d\'enrôlement',
        x: 180,
        y: 122,
        width: 173,
        height: 15,
        fontSize: 9,
        color: '#6b7280',
        alignment: 'right',
        opacity: 1,
      },
      {
        id: `image_${time}_photo`,
        type: 'image',
        x: 25,
        y: 140,
        width: 90,
        height: 110,
        opacity: 1,
      },
      {
        id: `text_${time}_ent`,
        type: 'text',
        field: 'Entreprise',
        x: 130,
        y: 140,
        width: 220,
        height: 20,
        fontSize: 11,
        fontWeight: 'bold',
        alignment: 'left',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_nom`,
        type: 'text',
        field: 'Nom',
        x: 130,
        y: 165,
        width: 220,
        height: 20,
        fontSize: 11,
        fontWeight: 'bold',
        alignment: 'left',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_prenom`,
        type: 'text',
        field: 'Prenom',
        x: 130,
        y: 190,
        width: 220,
        height: 20,
        fontSize: 11,
        fontWeight: 'bold',
        alignment: 'left',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_role`,
        type: 'text',
        field: 'Role',
        x: 130,
        y: 215,
        width: 220,
        height: 20,
        fontSize: 11,
        alignment: 'left',
        color: '#4b5563',
        opacity: 1,
      },
      {
        id: `text_${time}_mat`,
        type: 'text',
        field: 'Matricule',
        x: 130,
        y: 240,
        width: 220,
        height: 20,
        fontSize: 11,
        alignment: 'left',
        color: '#4b5563',
        opacity: 1,
      },
      {
        id: `qr_${time}_qr`,
        type: 'qr',
        field: 'Matricule',
        x: Math.round((width - 90) / 2),
        y: 280,
        width: 90,
        height: 90,
        opacity: 1,
      },
      {
        id: `text_${time}_ctrl`,
        type: 'text',
        content: 'Code de contrôle enrôlement',
        x: 20,
        y: 380,
        width: width - 40,
        height: 15,
        fontSize: 8,
        alignment: 'center',
        color: '#6b7280',
        opacity: 1,
      },
      {
        id: `text_${time}_op`,
        type: 'text',
        content: "Signature de l'Opérateur",
        x: 25,
        y: 415,
        width: 140,
        height: 15,
        fontSize: 9,
        fontWeight: 'bold',
        alignment: 'center',
        color: '#6b7280',
        opacity: 1,
      },
      {
        id: `text_${time}_emp`,
        type: 'text',
        content: "Signature de l'Employé",
        x: 210,
        y: 415,
        width: 140,
        height: 15,
        fontSize: 9,
        fontWeight: 'bold',
        alignment: 'center',
        color: '#6b7280',
        opacity: 1,
      },
      {
        id: `text_${time}_line1`,
        type: 'text',
        content: '---------------------------------',
        x: 25,
        y: 470,
        width: 140,
        height: 15,
        fontSize: 9,
        alignment: 'center',
        color: '#9ca3af',
        opacity: 1,
      },
      {
        id: `text_${time}_line2`,
        type: 'text',
        content: '---------------------------------',
        x: 210,
        y: 470,
        width: 140,
        height: 15,
        fontSize: 9,
        alignment: 'center',
        color: '#9ca3af',
        opacity: 1,
      },
      {
        id: `text_${time}_footer`,
        type: 'text',
        content: "Ce document atteste de la conformité de l'enrôlement.",
        x: 20,
        y: 500,
        width: width - 40,
        height: 15,
        fontSize: 8,
        alignment: 'center',
        color: '#9ca3af',
        opacity: 1,
      },
    ];
  }

  if (isPortrait) {
    const imgW = Math.round(width * 0.4);
    const imgH = Math.round(imgW * 1.25);
    const imgX = Math.round((width - imgW) / 2);
    const imgY = Math.round(height * 0.1);

    const qrW = Math.round(Math.min(width * 0.25, height * 0.15));
    const qrX = Math.round((width - qrW) / 2);
    const qrY = height - qrW - Math.round(height * 0.08);

    return [
      {
        id: `image_${time}_1`,
        type: 'image',
        x: imgX,
        y: imgY,
        width: imgW,
        height: imgH,
        opacity: 1,
      },
      {
        id: `text_${time}_2`,
        type: 'text',
        field: 'Prenom',
        x: 10,
        y: imgY + imgH + Math.round(height * 0.05),
        width: width - 20,
        height: Math.round(height * 0.08),
        fontSize: Math.round(width * 0.045),
        fontWeight: 'bold',
        alignment: 'center',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_3`,
        type: 'text',
        field: 'Nom',
        x: 10,
        y: imgY + imgH + Math.round(height * 0.05) + Math.round(height * 0.09),
        width: width - 20,
        height: Math.round(height * 0.08),
        fontSize: Math.round(width * 0.045),
        fontWeight: 'bold',
        alignment: 'center',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_4`,
        type: 'text',
        field: 'Role',
        x: 10,
        y: imgY + imgH + Math.round(height * 0.05) + Math.round(height * 0.18),
        width: width - 20,
        height: Math.round(height * 0.06),
        fontSize: Math.round(width * 0.035),
        alignment: 'center',
        color: '#4b5563',
        opacity: 1,
      },
      {
        id: `qr_${time}_5`,
        type: 'qr',
        field: 'Matricule',
        x: qrX,
        y: qrY,
        width: qrW,
        height: qrW,
        opacity: 1,
      },
    ];
  } else {
    // Landscape
    const imgW = Math.round(width * 0.25);
    const imgH = Math.round(imgW * 1.25);
    const imgX = Math.round(width * 0.06);
    const imgY = Math.round((height - imgH) / 2);

    const qrW = Math.round(height * 0.22);
    const qrX = width - qrW - Math.round(width * 0.06);
    const qrY = height - qrW - Math.round(height * 0.08);

    return [
      {
        id: `image_${time}_1`,
        type: 'image',
        x: imgX,
        y: imgY,
        width: imgW,
        height: imgH,
        opacity: 1,
      },
      {
        id: `text_${time}_2`,
        type: 'text',
        field: 'Prenom',
        x: imgX + imgW + Math.round(width * 0.06),
        y: Math.round(height * 0.18),
        width: width - (imgX + imgW + Math.round(width * 0.06)) - 20,
        height: Math.round(height * 0.14),
        fontSize: Math.round(height * 0.075),
        fontWeight: 'bold',
        alignment: 'left',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_3`,
        type: 'text',
        field: 'Nom',
        x: imgX + imgW + Math.round(width * 0.06),
        y: Math.round(height * 0.18) + Math.round(height * 0.15),
        width: width - (imgX + imgW + Math.round(width * 0.06)) - 20,
        height: Math.round(height * 0.14),
        fontSize: Math.round(height * 0.075),
        fontWeight: 'bold',
        alignment: 'left',
        color: '#111827',
        opacity: 1,
      },
      {
        id: `text_${time}_4`,
        type: 'text',
        field: 'Role',
        x: imgX + imgW + Math.round(width * 0.06),
        y: Math.round(height * 0.18) + Math.round(height * 0.3),
        width: width - (imgX + imgW + Math.round(width * 0.06)) - 20,
        height: Math.round(height * 0.1),
        fontSize: Math.round(height * 0.055),
        alignment: 'left',
        color: '#4b5563',
        opacity: 1,
      },
      {
        id: `qr_${time}_5`,
        type: 'qr',
        field: 'Matricule',
        x: qrX,
        y: qrY,
        width: qrW,
        height: qrW,
        opacity: 1,
      },
    ];
  }
};

interface StudioClientProps {
  initialCompanies: Company[];
}

export default function StudioClient({ initialCompanies }: StudioClientProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('BADGE');
  const [dynamicFields, setDynamicFields] = useState<string[]>(['Nom', 'Prenom', 'Role', 'Matricule', 'Entreprise']);

  // Canvas State
  const [canvasWidth, setCanvasWidth] = useState<number>(324);
  const [canvasHeight, setCanvasHeight] = useState<number>(204);
  const [canvasBackground, setCanvasBackground] = useState<string>('');
  const [canvasBackgroundOpacity, setCanvasBackgroundOpacity] = useState<number>(1);
  const [canvasBorderRadius, setCanvasBorderRadius] = useState<number>(8);
  const [elements, setElements] = useState<StudioElement[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Recto / Verso States
  const [currentSide, setCurrentSide] = useState<'recto' | 'verso'>('recto');
  const [rectoElements, setRectoElements] = useState<StudioElement[]>([]);
  const [versoElements, setVersoElements] = useState<StudioElement[]>([]);
  const [rectoBackground, setRectoBackground] = useState<string>('');
  const [versoBackground, setVersoBackground] = useState<string>('');
  const [rectoBackgroundOpacity, setRectoBackgroundOpacity] = useState<number>(1);
  const [versoBackgroundOpacity, setVersoBackgroundOpacity] = useState<number>(1);

  // Zoom State
  const [zoom, setZoom] = useState<number>(1); // Default 150% for larger workspace

  // Clipboard & History State
  const [copiedElements, setCopiedElements] = useState<StudioElement[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Undo / Redo Stack Management
  const pushHistoryState = (
    activeElements: StudioElement[],
    newBgOpacity = canvasBackgroundOpacity,
    newWidth = canvasWidth,
    newHeight = canvasHeight,
    newBg = canvasBackground,
    newRadius = canvasBorderRadius,
    side = currentSide
  ) => {
    const newRecto = side === 'recto' ? activeElements : rectoElements;
    const newVerso = side === 'verso' ? activeElements : versoElements;

    const newState = {
      recto: {
        elements: JSON.parse(JSON.stringify(newRecto)),
        backgroundUrl: side === 'recto' ? newBg : rectoBackground,
        backgroundOpacity: side === 'recto' ? newBgOpacity : rectoBackgroundOpacity,
      },
      verso: {
        elements: JSON.parse(JSON.stringify(newVerso)),
        backgroundUrl: side === 'verso' ? newBg : versoBackground,
        backgroundOpacity: side === 'verso' ? newBgOpacity : versoBackgroundOpacity,
      },
      canvasWidth: newWidth,
      canvasHeight: newHeight,
      canvasBorderRadius: newRadius,
      currentSide: side,
    };

    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      
      setRectoElements(prevState.recto?.elements || []);
      setRectoBackground(prevState.recto?.backgroundUrl || '');
      setRectoBackgroundOpacity(prevState.recto?.backgroundOpacity !== undefined ? prevState.recto.backgroundOpacity : 1);
      
      setVersoElements(prevState.verso?.elements || []);
      setVersoBackground(prevState.verso?.backgroundUrl || '');
      setVersoBackgroundOpacity(prevState.verso?.backgroundOpacity !== undefined ? prevState.verso.backgroundOpacity : 1);
      
      setCanvasWidth(prevState.canvasWidth);
      setCanvasHeight(prevState.canvasHeight);
      setCanvasBorderRadius(prevState.canvasBorderRadius !== undefined ? prevState.canvasBorderRadius : 8);
      setCurrentSide(prevState.currentSide || 'recto');

      const side = prevState.currentSide || 'recto';
      if (side === 'recto') {
        setElements(prevState.recto?.elements || []);
        setCanvasBackground(prevState.recto?.backgroundUrl || '');
        setCanvasBackgroundOpacity(prevState.recto?.backgroundOpacity !== undefined ? prevState.recto.backgroundOpacity : 1);
      } else {
        setElements(prevState.verso?.elements || []);
        setCanvasBackground(prevState.verso?.backgroundUrl || '');
        setCanvasBackgroundOpacity(prevState.verso?.backgroundOpacity !== undefined ? prevState.verso.backgroundOpacity : 1);
      }

      setHistoryIndex(historyIndex - 1);
      setSelectedElementIds([]);
      setSelectedElementId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      
      setRectoElements(nextState.recto?.elements || []);
      setRectoBackground(nextState.recto?.backgroundUrl || '');
      setRectoBackgroundOpacity(nextState.recto?.backgroundOpacity !== undefined ? nextState.recto.backgroundOpacity : 1);
      
      setVersoElements(nextState.verso?.elements || []);
      setVersoBackground(nextState.verso?.backgroundUrl || '');
      setVersoBackgroundOpacity(nextState.verso?.backgroundOpacity !== undefined ? nextState.verso.backgroundOpacity : 1);
      
      setCanvasWidth(nextState.canvasWidth);
      setCanvasHeight(nextState.canvasHeight);
      setCanvasBorderRadius(nextState.canvasBorderRadius !== undefined ? nextState.canvasBorderRadius : 8);
      setCurrentSide(nextState.currentSide || 'recto');

      const side = nextState.currentSide || 'recto';
      if (side === 'recto') {
        setElements(nextState.recto?.elements || []);
        setCanvasBackground(nextState.recto?.backgroundUrl || '');
        setCanvasBackgroundOpacity(nextState.recto?.backgroundOpacity !== undefined ? nextState.recto.backgroundOpacity : 1);
      } else {
        setElements(nextState.verso?.elements || []);
        setCanvasBackground(nextState.verso?.backgroundUrl || '');
        setCanvasBackgroundOpacity(nextState.verso?.backgroundOpacity !== undefined ? nextState.verso.backgroundOpacity : 1);
      }

      setHistoryIndex(historyIndex + 1);
      setSelectedElementIds([]);
      setSelectedElementId(null);
    }
  };

  const handleSwitchSide = (targetSide: 'recto' | 'verso') => {
    if (targetSide === currentSide) return;
    
    // Save current active states to currentSide state variables
    let finalRectoElements = rectoElements;
    let finalVersoElements = versoElements;
    let finalRectoBg = rectoBackground;
    let finalVersoBg = versoBackground;
    let finalRectoOpacity = rectoBackgroundOpacity;
    let finalVersoOpacity = versoBackgroundOpacity;
    
    if (currentSide === 'recto') {
      finalRectoElements = elements;
      finalRectoBg = canvasBackground;
      finalRectoOpacity = canvasBackgroundOpacity;
      setRectoElements(elements);
      setRectoBackground(canvasBackground);
      setRectoBackgroundOpacity(canvasBackgroundOpacity);
    } else {
      finalVersoElements = elements;
      finalVersoBg = canvasBackground;
      finalVersoOpacity = canvasBackgroundOpacity;
      setVersoElements(elements);
      setVersoBackground(canvasBackground);
      setVersoBackgroundOpacity(canvasBackgroundOpacity);
    }
    
    // Load targetSide state variables to active states
    if (targetSide === 'recto') {
      setElements(finalRectoElements);
      setCanvasBackground(finalRectoBg);
      setCanvasBackgroundOpacity(finalRectoOpacity);
    } else {
      setElements(finalVersoElements);
      setCanvasBackground(finalVersoBg);
      setCanvasBackgroundOpacity(finalVersoOpacity);
    }
    
    setCurrentSide(targetSide);
    setSelectedElementIds([]);
    setSelectedElementId(null);
    
    // Push side-switch to history so it is captured
    const newRecto = targetSide === 'recto' ? finalRectoElements : rectoElements;
    const newVerso = targetSide === 'verso' ? finalVersoElements : versoElements;

    const newState = {
      recto: {
        elements: JSON.parse(JSON.stringify(newRecto)),
        backgroundUrl: targetSide === 'recto' ? finalRectoBg : rectoBackground,
        backgroundOpacity: targetSide === 'recto' ? finalRectoOpacity : rectoBackgroundOpacity,
      },
      verso: {
        elements: JSON.parse(JSON.stringify(newVerso)),
        backgroundUrl: targetSide === 'verso' ? finalVersoBg : versoBackground,
        backgroundOpacity: targetSide === 'verso' ? finalVersoOpacity : versoBackgroundOpacity,
      },
      canvasWidth,
      canvasHeight,
      canvasBorderRadius,
      currentSide: targetSide,
    };

    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  // Enforce global deselect on clicking escape or outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // If clicked outside editor container, deselect
      const studioWorkspace = document.getElementById('studio-workspace');
      if (studioWorkspace && !studioWorkspace.contains(e.target as Node)) {
        setSelectedElementIds([]);
        setSelectedElementId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bypass if focus is in input forms
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          active.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl + Z: Undo
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl + Y: Redo
      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl + C: Copy all selected elements
      if (isCtrl && e.key.toLowerCase() === 'c') {
        const elsToCopy = elements.filter((item) => selectedElementIds.includes(item.id));
        if (elsToCopy.length > 0) {
          e.preventDefault();
          setCopiedElements(elsToCopy);
        }
        return;
      }

      // Ctrl + X: Cut all selected elements
      if (isCtrl && e.key.toLowerCase() === 'x') {
        const elsToCopy = elements.filter((item) => selectedElementIds.includes(item.id));
        if (elsToCopy.length > 0) {
          e.preventDefault();
          setCopiedElements(elsToCopy);
          const newElements = elements.filter((item) => !selectedElementIds.includes(item.id));
          setElements(newElements);
          setSelectedElementIds([]);
          setSelectedElementId(null);
          if (currentSide === 'recto') setRectoElements(newElements);
          else setVersoElements(newElements);
          pushHistoryState(newElements);
        }
        return;
      }

      // Ctrl + V: Paste elements
      if (isCtrl && e.key.toLowerCase() === 'v') {
        if (copiedElements.length > 0) {
          e.preventDefault();
          const time = Date.now();
          const pasted: StudioElement[] = [];
          const newIds: string[] = [];
          
          copiedElements.forEach((el, index) => {
            const newId = `${el.type}_${time}_${index}`;
            pasted.push({
              ...el,
              id: newId,
              x: Math.min(canvasWidth - el.width, el.x + 10),
              y: Math.min(canvasHeight - el.height, el.y + 10),
            });
            newIds.push(newId);
          });
          
          const newElements = [...elements, ...pasted];
          setElements(newElements);
          setSelectedElementIds(newIds);
          setSelectedElementId(newIds[newIds.length - 1] || null);
          if (currentSide === 'recto') setRectoElements(newElements);
          else setVersoElements(newElements);
          pushHistoryState(newElements);
        }
        return;
      }

      // Ctrl + A: Select all elements
      if (isCtrl && e.key.toLowerCase() === 'a') {
        if (elements.length > 0) {
          e.preventDefault();
          const allIds = elements.map((item) => item.id);
          setSelectedElementIds(allIds);
          setSelectedElementId(allIds[allIds.length - 1] || null);
        }
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedElementIds([]);
        setSelectedElementId(null);
        return;
      }

      // Delete / Backspace: delete all selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          const newElements = elements.filter((item) => !selectedElementIds.includes(item.id));
          setElements(newElements);
          setSelectedElementIds([]);
          setSelectedElementId(null);
          if (currentSide === 'recto') setRectoElements(newElements);
          else setVersoElements(newElements);
          pushHistoryState(newElements);
        }
        return;
      }

      // Nudge all selected elements (Arrows / Arrows + Shift)
      if (selectedElementIds.length > 0) {
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
          e.preventDefault();
          const nudgeAmount = e.shiftKey ? 10 : 1;
          
          const updatedElements = elements.map((item) => {
            if (selectedElementIds.includes(item.id)) {
              let newX = item.x;
              let newY = item.y;
              if (e.key === 'ArrowLeft') newX = Math.max(0, item.x - nudgeAmount);
              if (e.key === 'ArrowRight') newX = Math.min(canvasWidth - item.width, item.x + nudgeAmount);
              if (e.key === 'ArrowUp') newY = Math.max(0, item.y - nudgeAmount);
              if (e.key === 'ArrowDown') newY = Math.min(canvasHeight - item.height, item.y + nudgeAmount);
              return { ...item, x: newX, y: newY };
            }
            return item;
          });

          setElements(updatedElements);
          if (currentSide === 'recto') setRectoElements(updatedElements);
          else setVersoElements(updatedElements);
          // Push state to history
          pushHistoryState(updatedElements);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    elements,
    selectedElementIds,
    selectedElementId,
    copiedElements,
    historyIndex,
    history,
    canvasBackgroundOpacity,
    canvasWidth,
    canvasHeight,
    canvasBackground,
    canvasBorderRadius,
    currentSide,
    rectoElements,
    versoElements,
    rectoBackground,
    versoBackground,
    rectoBackgroundOpacity,
    versoBackgroundOpacity,
  ]);

  // Load Template when company or type changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setElements([]);
      setCanvasWidth(324);
      setCanvasHeight(204);
      setCanvasBackground('');
      setCanvasBackgroundOpacity(1);
      setHistory([]);
      setHistoryIndex(-1);
      setDynamicFields(['Nom', 'Prenom', 'Role', 'Matricule', 'Entreprise']);
      return;
    }

    const loadTemplateData = async () => {
      setIsLoading(true);
      try {
        const fields = await getCompanyFields(selectedCompanyId);
        setDynamicFields(fields);

        const template = await getTemplate(selectedCompanyId, cardType);
        if (template) {
          setCanvasWidth(template.width);
          setCanvasHeight(template.height);
          
          // Parse layoutConfig
          const config = template.layoutConfig as any;
          let loadedRectoElements: StudioElement[] = [];
          let loadedVersoElements: StudioElement[] = [];
          let loadedRectoBg = '';
          let loadedVersoBg = '';
          let loadedRectoOpacity = 1;
          let loadedVersoOpacity = 1;
          let loadedRadius = 8;

          if (config && typeof config === 'object') {
            if ('recto' in config || 'verso' in config) {
              const recto = config.recto || {};
              const verso = config.verso || {};
              loadedRectoElements = recto.elements || [];
              loadedRectoBg = recto.backgroundUrl || '';
              loadedRectoOpacity = recto.backgroundOpacity !== undefined ? recto.backgroundOpacity : 1;
              
              loadedVersoElements = verso.elements || [];
              loadedVersoBg = verso.backgroundUrl || '';
              loadedVersoOpacity = verso.backgroundOpacity !== undefined ? verso.backgroundOpacity : 1;
              
              loadedRadius = config.borderRadius !== undefined ? config.borderRadius : 8;
            } else if ('elements' in config) {
              loadedRectoElements = config.elements || [];
              loadedRectoOpacity = config.backgroundOpacity !== undefined ? config.backgroundOpacity : 1;
              loadedRectoBg = template.backgroundUrl || '';
              loadedRadius = config.borderRadius !== undefined ? config.borderRadius : 8;
            } else {
              loadedRectoElements = (config as unknown as StudioElement[]) || [];
              loadedRectoBg = template.backgroundUrl || '';
            }
          }

          setRectoElements(loadedRectoElements);
          setVersoElements(loadedVersoElements);
          setRectoBackground(loadedRectoBg);
          setVersoBackground(loadedVersoBg);
          setRectoBackgroundOpacity(loadedRectoOpacity);
          setVersoBackgroundOpacity(loadedVersoOpacity);
          setCanvasBorderRadius(loadedRadius);
          setCurrentSide('recto');

          setElements(loadedRectoElements);
          setCanvasBackground(loadedRectoBg);
          setCanvasBackgroundOpacity(loadedRectoOpacity);
          
          // Initialize history stack
          const initialState = {
            recto: {
              elements: JSON.parse(JSON.stringify(loadedRectoElements)),
              backgroundUrl: loadedRectoBg,
              backgroundOpacity: loadedRectoOpacity,
            },
            verso: {
              elements: JSON.parse(JSON.stringify(loadedVersoElements)),
              backgroundUrl: loadedVersoBg,
              backgroundOpacity: loadedVersoOpacity,
            },
            canvasWidth: template.width,
            canvasHeight: template.height,
            canvasBorderRadius: loadedRadius,
            currentSide: 'recto',
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        } else {
          // Reset to default template with pre-positioned elements for this company
          let defaultW = 324;
          let defaultH = 204;
          if (cardType === 'CARTE_PRO') {
            defaultW = 700;
            defaultH = 450;
          } else if (cardType === 'RECU') {
            defaultW = 378;
            defaultH = 530;
          }
          const defaultEls = getDefaultElements(defaultW, defaultH, cardType);
          
          setRectoElements(defaultEls);
          setVersoElements([]);
          setRectoBackground('');
          setVersoBackground('');
          setRectoBackgroundOpacity(1);
          setVersoBackgroundOpacity(1);
          
          setElements(defaultEls);
          setCanvasWidth(defaultW);
          setCanvasHeight(defaultH);
          setCanvasBackground('');
          setCanvasBackgroundOpacity(1);
          setCanvasBorderRadius(8);
          setCurrentSide('recto');
          
          const initialState = {
            recto: {
              elements: JSON.parse(JSON.stringify(defaultEls)),
              backgroundUrl: '',
              backgroundOpacity: 1,
            },
            verso: {
              elements: [],
              backgroundUrl: '',
              backgroundOpacity: 1,
            },
            canvasWidth: defaultW,
            canvasHeight: defaultH,
            canvasBorderRadius: 8,
            currentSide: 'recto',
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Erreur lors du chargement.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplateData();
  }, [selectedCompanyId, cardType]);

  // Element Actions
  const handleAddElement = (type: 'text' | 'image' | 'qr' | 'logo', customProps?: Partial<StudioElement>) => {
    const id = `${type}_${Date.now()}`;
    const newElement: StudioElement = {
      id,
      type,
      x: 20,
      y: 20,
      width: type === 'text' ? 120 : type === 'image' ? 80 : type === 'logo' ? 80 : 60,
      height: type === 'text' ? 30 : type === 'image' ? 90 : type === 'logo' ? 80 : 60,
      opacity: 1,
      borderRadius: 0,
      ...customProps,
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElementIds([id]);
    setSelectedElementId(id);
    if (currentSide === 'recto') setRectoElements(newElements);
    else setVersoElements(newElements);
    pushHistoryState(newElements);
  };

  const handleUpdateElement = (updatedElement: StudioElement) => {
    const newElements = elements.map((el) => (el.id === updatedElement.id ? updatedElement : el));
    setElements(newElements);
    if (currentSide === 'recto') setRectoElements(newElements);
    else setVersoElements(newElements);
    // Push history on completed edits (like from PropertiesPanel slider/input)
    pushHistoryState(newElements);
  };

  // Specific callback for when dragging/resizing updates
  const handleUpdateElements = (newElements: StudioElement[], shouldPushHistory: boolean) => {
    setElements(newElements);
    if (currentSide === 'recto') setRectoElements(newElements);
    else setVersoElements(newElements);
    if (shouldPushHistory) {
      pushHistoryState(newElements);
    }
  };

  const handleDeleteElement = (id: string) => {
    const idsToDelete = selectedElementIds.includes(id) ? selectedElementIds : [id];
    const newElements = elements.filter((el) => !idsToDelete.includes(el.id));
    setElements(newElements);
    setSelectedElementIds([]);
    setSelectedElementId(null);
    if (currentSide === 'recto') setRectoElements(newElements);
    else setVersoElements(newElements);
    pushHistoryState(newElements);
  };

  const handleUpdateCanvas = (width: number, height: number, background: string, opacity: number, borderRadius: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
    setCanvasBackground(background);
    setCanvasBackgroundOpacity(opacity);
    setCanvasBorderRadius(borderRadius);
    
    if (currentSide === 'recto') {
      setRectoBackground(background);
      setRectoBackgroundOpacity(opacity);
    } else {
      setVersoBackground(background);
      setVersoBackgroundOpacity(opacity);
    }
    
    pushHistoryState(elements, opacity, width, height, background, borderRadius);
  };

  const handleApplyDefaultLayout = () => {
    const defaultEls = getDefaultElements(canvasWidth, canvasHeight, cardType);
    setElements(defaultEls);
    setSelectedElementIds([]);
    setSelectedElementId(null);
    if (currentSide === 'recto') setRectoElements(defaultEls);
    else setVersoElements(defaultEls);
    pushHistoryState(defaultEls);
  };

  const handleClearCanvas = () => {
    setElements([]);
    setSelectedElementIds([]);
    setSelectedElementId(null);
    if (currentSide === 'recto') setRectoElements([]);
    else setVersoElements([]);
    pushHistoryState([]);
  };

  // Save Template Action
  const handleSave = async () => {
    if (!selectedCompanyId) {
      setNotification({ type: 'error', message: 'Veuillez sélectionner une entreprise.' });
      return;
    }

    setIsSaving(true);
    try {
      const finalRectoElements = currentSide === 'recto' ? elements : rectoElements;
      const finalVersoElements = currentSide === 'verso' ? elements : versoElements;
      const finalRectoBg = currentSide === 'recto' ? canvasBackground : rectoBackground;
      const finalVersoBg = currentSide === 'verso' ? canvasBackground : versoBackground;
      const finalRectoOpacity = currentSide === 'recto' ? canvasBackgroundOpacity : rectoBackgroundOpacity;
      const finalVersoOpacity = currentSide === 'verso' ? canvasBackgroundOpacity : versoBackgroundOpacity;

      await saveTemplate({
        companyId: selectedCompanyId,
        type: cardType,
        width: canvasWidth,
        height: canvasHeight,
        backgroundUrl: finalRectoBg || undefined,
        layoutConfig: {
          recto: {
            elements: finalRectoElements,
            backgroundUrl: finalRectoBg,
            backgroundOpacity: finalRectoOpacity,
          },
          verso: {
            elements: finalVersoElements,
            backgroundUrl: finalVersoBg,
            backgroundOpacity: finalVersoOpacity,
          },
          borderRadius: canvasBorderRadius,
        } as any,
      });
      setNotification({ type: 'success', message: 'Le modèle a été sauvegardé avec succès.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Create Company Action
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const newCompany = await createCompany(newCompanyName.trim());
      setCompanies((prev) => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompanyId(newCompany.id);
      setNewCompanyName('');
      setShowCreateCompanyModal(false);
      setNotification({ type: 'success', message: `Entreprise "${newCompany.name}" créée !` });
    } catch (err: any) {
      alert(err.message || "Impossible d'ajouter cette entreprise.");
    }
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  return (
    <div className="flex flex-col gap-6 min-h-screen" id="studio-workspace">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-850 py-4 px-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Studio de Création</h1>
            <p className="text-xs text-neutral-450 dark:text-neutral-500">
              Concevez des modèles de badges et cartes d&apos;impression
            </p>
          </div>
        </div>

        {/* NOTIFICATION FLOATER */}
        {notification && (
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-md animate-in fade-in slide-in-from-top-4 duration-300 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-255 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* CONFIG BAR CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Company Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-3.5 py-2.5 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/25 min-w-[200px]"
            >
              <option value="">Sélectionnez l&apos;entreprise</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="p-2.5 bg-indigo-55 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition"
              title="Ajouter une entreprise"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Card Type Selector */}
          <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
            <button
              onClick={() => setCardType('BADGE')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'BADGE'
                  ? 'bg-white dark:bg-neutral-850 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Badge
            </button>
            <button
              onClick={() => setCardType('CARTE_PRO')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'CARTE_PRO'
                  ? 'bg-white dark:bg-neutral-850 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Carte Pro
            </button>
            <button
              onClick={() => setCardType('RECU')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                cardType === 'RECU'
                  ? 'bg-white dark:bg-neutral-850 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Reçu d&apos;Enrôlement
            </button>
          </div>

          {/* Recto / Verso Selector */}
          {selectedCompanyId && (
            <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5 shadow-inner">
              <button
                onClick={() => handleSwitchSide('recto')}
                className={`px-4.5 py-2 rounded-lg text-xs font-bold transition ${
                  currentSide === 'recto'
                    ? 'bg-white dark:bg-neutral-850 text-indigo-650 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Recto (Face)
              </button>
              <button
                onClick={() => handleSwitchSide('verso')}
                className={`px-4.5 py-2 rounded-lg text-xs font-bold transition ${
                  currentSide === 'verso'
                    ? 'bg-white dark:bg-neutral-850 text-indigo-650 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Verso (Dos)
              </button>
            </div>
          )}

          {/* Zoom Controller */}
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-neutral-400 mr-1" />
            <select
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="bg-transparent border-none p-0 text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer focus:ring-0"
            >
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="2.5">250%</option>
            </select>
          </div>

          {/* Undo / Redo buttons */}
          {selectedCompanyId && (
            <div className="flex border border-neutral-250 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
                title="Annuler (Ctrl+Z)"
              >
                Annuler
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
                title="Rétablir (Ctrl+Y)"
              >
                Rétablir
              </button>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedCompanyId}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-650 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Sauvegarder</span>
          </button>
        </div>
      </div>

      {/* STUDIO WORKSPACE */}
      {!selectedCompanyId ? (
        // STATE: NO COMPANY SELECTED
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center min-h-[450px]">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Save className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-850 dark:text-white mb-2">Configurez votre modèle</h2>
          <p className="text-sm text-neutral-450 dark:text-neutral-500 max-w-sm mb-6">
            Sélectionnez une entreprise cliente dans la barre supérieure pour charger son modèle ou commencez à en créer un nouveau.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm font-medium"
            >
              <option value="">Choisir une entreprise...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
            >
              Créer une entreprise
            </button>
          </div>
        </div>
      ) : isLoading ? (
        // STATE: LOADING
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm min-h-[450px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-neutral-450 dark:text-neutral-505">Chargement de la configuration...</p>
        </div>
      ) : (
        // STATE: ACTIVE EDITOR
        <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
          <div className="w-full xl:w-72 shrink-0">
            <Toolbar
              onAddElement={handleAddElement}
              onApplyDefaultLayout={handleApplyDefaultLayout}
              onClearCanvas={handleClearCanvas}
              suggestedFields={dynamicFields}
            />
          </div>

          {/* Central Workspace Canvas */}
          <div className="flex-1 min-w-0 w-full">
            <Canvas
              width={canvasWidth}
              height={canvasHeight}
              backgroundUrl={canvasBackground}
              backgroundOpacity={canvasBackgroundOpacity}
              elements={elements}
              selectedElementIds={selectedElementIds}
              selectedElementId={selectedElementId}
              onSelectElements={(ids, primaryId) => {
                setSelectedElementIds(ids);
                setSelectedElementId(primaryId);
              }}
              onChangeElements={handleUpdateElements}
              zoom={zoom}
              borderRadius={canvasBorderRadius}
            />
          </div>

          {/* Right Properties Panel */}
          <div className="w-full xl:w-80 shrink-0">
            <PropertiesPanel
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              canvasBackground={canvasBackground}
              canvasBackgroundOpacity={canvasBackgroundOpacity}
              canvasBorderRadius={canvasBorderRadius}
              onUpdateCanvas={handleUpdateCanvas}
              selectedElement={selectedElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              suggestedFields={dynamicFields}
            />
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-850 dark:text-white mb-2">Ajouter une entreprise</h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
              Créez une fiche pour une nouvelle entreprise cliente pour laquelle vous imprimerez des cartes.
            </p>

            <form onSubmit={handleCreateCompany} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCompanyModal(false);
                    setNewCompanyName('');
                  }}
                  className="px-4 py-2 text-xs font-bold border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-55 dark:hover:bg-neutral-800 rounded-xl text-neutral-600 dark:text-neutral-450 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
