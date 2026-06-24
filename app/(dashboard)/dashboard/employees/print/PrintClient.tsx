'use client';

import React, { useState } from 'react';
import { Employee, CardTemplate, CardType } from '@prisma/client';
import { Printer, Check, ArrowLeft, Loader2, LayoutGrid, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { bulkUpdateEmployeeStatus } from '@/app/actions/employees';
import { StudioElement } from '@/components/studio/Canvas';
import QRCode from 'react-qr-code';

interface PrintClientProps {
  employees: (Employee & { company: { name: string } })[];
  templates: CardTemplate[];
  companyName: string;
}

type PrintLayoutMode = 'side-by-side' | 'duplex' | 'recto-only' | 'verso-only';

const getDefaultElements = (width: number, height: number): StudioElement[] => {
  const isPortrait = height > width;
  const time = Date.now();

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

const getFieldValue = (emp: Employee & { company?: { name: string } }, field?: string) => {
  if (!field) return '';
  if (field === 'Entreprise') return emp.company?.name || '';

  // Intercept and return enrollmentNumber for identifier fields
  const targetKey = field.toLowerCase().trim();
  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedTarget = normalize(field);

  if (normalizedTarget === 'n° d\'enrolement' || normalizedTarget === 'numéro d\'enrôlement' || normalizedTarget === 'enrollmentnumber') {
    return emp.enrollmentNumber || 'En cours...';
  }
  if (normalizedTarget === 'identifiant unique' || normalizedTarget === 'uniqueidentifier') {
    return emp.uniqueIdentifier;
  }
  if (normalizedTarget === 'recu n°' || normalizedTarget === 'recu numero' || normalizedTarget === 'numero de recu' || normalizedTarget === 'numéro de reçu') {
    return emp.id.slice(0, 8).toUpperCase();
  }
  if (normalizedTarget === 'date d\'enrolement' || normalizedTarget === 'date d\'enrôlement' || normalizedTarget === 'date') {
    const d = new Date(emp.createdAt);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  const data = emp.dynamicData as Record<string, any>;
  if (data) {
    let rawVal: any = undefined;
    if (data[field] !== undefined) {
      rawVal = data[field];
    } else {
      for (const key of Object.keys(data)) {
        if (key.toLowerCase().trim() === targetKey && data[key] !== undefined) {
          rawVal = data[key];
          break;
        }
        if (normalize(key) === normalizedTarget && data[key] !== undefined) {
          rawVal = data[key];
          break;
        }
      }
    }

    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const isDateField = normalizedTarget.startsWith('date') ||
        (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawVal));

      if (isDateField) {
        const dateObj = new Date(rawVal);
        if (!isNaN(dateObj.getTime())) {
          const day = String(dateObj.getUTCDate()).padStart(2, '0');
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const year = dateObj.getUTCFullYear();
          return `${day}/${month}/${year}`;
        }
      }
      return String(rawVal);
    }

    // 3. Synonym mapping fallback (common Excel column alternatives)
    const synonyms: Record<string, string[]> = {
      nom: ['lastname', 'nom de famille', 'name', 'nom'],
      prenom: ['firstname', 'prénom', 'prenoms', 'prénoms', 'prenom'],
      role: ['fonction', 'poste', 'job', 'role', 'rôle', 'title', 'roles'],
      matricule: ['id', 'uuid', 'code', 'identifiant', 'matricule', 'numéro', 'numero'],
    };

    const cleanField = normalizedTarget;
    if (synonyms[cleanField]) {
      for (const alt of synonyms[cleanField]) {
        const normalizedAlt = normalize(alt);
        for (const key of Object.keys(data)) {
          if (normalize(key) === normalizedAlt && data[key] !== undefined && data[key] !== null && data[key] !== '') {
            return String(data[key]);
          }
        }
      }
    }
  }

  // 4. Fallback for general identifier fields to use enrollmentNumber
  const isIdentifierField = [
    'matricule', 'id', 'uuid', 'code', 'identifiant', 'numéro', 'numero'
  ].includes(normalizedTarget);

  if (isIdentifierField && emp.enrollmentNumber) {
    return emp.enrollmentNumber;
  }

  // 5. Combined name splitting fallback (e.g. when Excel has combined "Noms et prénoms" but template expects separate "Nom" / "Prenom")
  if (data && (normalizedTarget === 'nom' || normalizedTarget === 'prenom')) {
    const combinedKeys = [
      'noms et prenoms', 'noms et prenom', 'nom et prenom',
      'noms & prenoms', 'nom & prenom', 'nom complet', 'fullname', 'nom prenom',
      'nom_prenom', 'noms et prénoms', 'noms et prénom', 'nom et prénom'
    ];
    
    for (const key of Object.keys(data)) {
      const normalizedKey = normalize(key);
      if (combinedKeys.includes(normalizedKey) && data[key] !== undefined) {
        const fullName = String(data[key]).trim();
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
          if (normalizedTarget === 'nom') {
            return parts[0]; // First word is family name
          } else {
            return parts.slice(1).join(' ') || parts[0]; // Rest is first names
          }
        }
      }
    }
  }

  return `{${field}}`;
};

const cardStyle = (template: CardTemplate, side: 'recto' | 'verso') => {
  const config = template.layoutConfig as any;
  let bgUrl = '';
  let opacity = 1;
  let borderRadius = config?.borderRadius !== undefined ? config.borderRadius : 8;

  if (config && typeof config === 'object') {
    if (side === 'recto') {
      const recto = config.recto || {};
      bgUrl = recto.backgroundUrl || template.backgroundUrl || '';
      opacity = recto.backgroundOpacity !== undefined ? recto.backgroundOpacity : 1;
    } else {
      const verso = config.verso || {};
      bgUrl = verso.backgroundUrl || '';
      opacity = verso.backgroundOpacity !== undefined ? verso.backgroundOpacity : 1;
    }
  } else {
    if (side === 'recto') {
      bgUrl = template.backgroundUrl || '';
    }
  }

  const bgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: opacity,
    pointerEvents: 'none',
    zIndex: 0,
  };

  if (bgUrl) {
    if (bgUrl.startsWith('linear-gradient') || bgUrl.startsWith('radial-gradient') || bgUrl.startsWith('#') || bgUrl.startsWith('rgb')) {
      bgStyle.background = bgUrl;
    } else {
      bgStyle.backgroundImage = `url(${bgUrl})`;
      bgStyle.backgroundSize = 'cover';
      bgStyle.backgroundPosition = 'center';
    }
  }

  return { bgStyle, borderRadius };
};

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

interface CardRenderProps {
  emp: Employee & { company?: { name: string } };
  template: CardTemplate;
  side: 'recto' | 'verso';
}

function CardRender({ emp, template, side }: CardRenderProps) {
  const width = template.width;
  const height = template.height;
  
  const config = template.layoutConfig as any;
  let elements: any[] = [];
  if (config && typeof config === 'object') {
    if (side === 'recto') {
      elements = (config.recto?.elements || config.elements || []) as any[];
    } else {
      elements = (config.verso?.elements || []) as any[];
    }
  } else {
    elements = (config as unknown as any[]) || [];
  }

  const { bgStyle, borderRadius } = cardStyle(template, side);
  const mmWidth = width * 0.264583;
  const mmHeight = height * 0.264583;

  return (
    <div
      className="relative overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white select-none shrink-0"
      style={{
        width: `${mmWidth}mm`,
        height: `${mmHeight}mm`,
        borderRadius: `${borderRadius * 0.264583}mm`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <div style={bgStyle} />
        <div className="absolute inset-0 z-10 pointer-events-none">
          {elements.map((el) => {
            const opacity = el.opacity !== undefined ? el.opacity : 1;
            return (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  zIndex: 10,
                  opacity,
                }}
              >
                <div className="w-full h-full relative flex items-center justify-center">
                  {el.type === 'text' && (
                    <div
                      style={{
                        width: '105%',
                        height: '100%',
                        color: el.color || '#000000',
                        fontSize: `${el.fontSize || 14}px`,
                        fontFamily: el.fontFamily || 'sans-serif',
                        fontWeight: el.fontWeight || 'normal',
                        fontStyle: el.fontStyle || 'normal',
                        textAlign: el.alignment || 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'flex-end' : 'flex-start',
                        overflow: 'hidden',
                        whiteSpace: 'normal',
                        wordBreak: 'break-all',
                        lineHeight: 'normal',
                      }}
                    >
                      {getFieldValue(emp, el.field) || el.content || ''}
                    </div>
                  )}

                  {el.type === 'image' && (
                    <div
                      className="w-full h-full overflow-hidden flex items-center justify-center bg-neutral-100"
                      style={{
                        borderRadius: `${el.borderRadius || 0}px`,
                        borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
                        borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
                        borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
                      }}
                    >
                      {emp.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={emp.photoUrl}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          alt="Photo"
                        />
                      ) : (
                        <span className="text-[8px] font-bold text-neutral-400">Pas de photo</span>
                      )}
                    </div>
                  )}

                  {el.type === 'qr' && (
                    <div
                      className="w-full h-full overflow-hidden bg-white flex items-center justify-center"
                      style={{
                        borderRadius: `${el.borderRadius || 0}px`,
                        borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
                        borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
                        borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
                        padding: '5%',
                      }}
                    >
                      <QRCode
                        value={
                          getFieldValue(emp, el.field) || emp.enrollmentNumber || emp.uniqueIdentifier
                        }
                        size={150}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox="0 0 256 256"
                      />
                    </div>
                  )}

                  {el.type === 'logo' && (
                    <div
                      className="w-full h-full overflow-hidden flex items-center justify-center bg-neutral-100/30 dark:bg-neutral-800/30"
                      style={{
                        borderRadius: `${el.borderRadius || 0}px`,
                        borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
                        borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
                        borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
                      }}
                    >
                      {el.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={el.logoUrl}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                          alt="Logo"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PrintClient({ employees, templates, companyName }: PrintClientProps) {
  // Initialize to the type of the first template if available, fallback to BADGE
  const [selectedTemplateType, setSelectedTemplateType] = useState<CardType>(
    templates.length > 0 ? templates[0].type : 'BADGE'
  );
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>('side-by-side');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Helper to load appropriate template or build fallback with suitable type & dimensions
  const getTemplateForType = (type: CardType) => {
    const found = templates.find((t) => t.type === type);
    if (found) return found;

    const w = type === 'CARTE_PRO' ? 700 : 324;
    const h = type === 'CARTE_PRO' ? 450 : 204;

    return {
      id: `fallback-${type}`,
      companyId: employees[0].companyId,
      type,
      width: w,
      height: h,
      backgroundUrl: '',
      layoutConfig: getDefaultElements(w, h) as any,
    } as CardTemplate;
  };

  const template = getTemplateForType(selectedTemplateType);

  // Physical layout dimensions and A4 scaling math (210mm x 297mm)
  const mmWidth = template.width * 0.264583;
  const mmHeight = template.height * 0.264583;

  const padding = 10; // 10mm print page padding
  const printableWidth = 210 - (2 * padding); // 190mm
  const printableHeight = 297 - (2 * padding); // 277mm
  const gap = 6; // gap in mm between cards

  // Side-by-side (recto + verso) calculations
  const sideBySideHorizontal = (2 * mmWidth + gap) <= printableWidth;
  const sideBySideRowCount = Math.max(1, Math.floor(printableHeight / (mmHeight + gap)));
  const sideBySideChunkSize = sideBySideHorizontal
    ? sideBySideRowCount
    : Math.max(1, Math.floor(printableHeight / (2 * mmHeight + gap)));

  // Grid layout calculations (recto-only, verso-only, duplex)
  const gridColsCount = (2 * mmWidth + gap) <= printableWidth ? 2 : 1;
  const gridRowCount = Math.max(1, Math.floor(printableHeight / (mmHeight + gap)));
  const gridChunkSize = gridColsCount * gridRowCount;

  const handlePrint = () => {
    window.print();
  };

  const handleValidatePrint = async () => {
    setIsSaving(true);
    try {
      const ids = employees.map((emp) => emp.id);
      await bulkUpdateEmployeeStatus(ids, 'IMPRIME');
      window.close();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour des statuts.');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate pages content based on layout selection
  const renderPrintPages = () => {
    if (layoutMode === 'side-by-side') {
      const chunks = chunkArray(employees, sideBySideChunkSize);
      return chunks.map((chunk, pageIdx) => (
        <div key={`page-${pageIdx}`} className="print-page print-page-preview flex flex-col gap-6 items-center justify-start py-6">
          {chunk.map((emp) => (
            <div 
              key={emp.id} 
              className={`flex items-center justify-center ${
                sideBySideHorizontal ? 'flex-row gap-6' : 'flex-col gap-3'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1 no-print">RECTO</span>
                <CardRender emp={emp} template={template} side="recto" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1 no-print">VERSO</span>
                <CardRender emp={emp} template={template} side="verso" />
              </div>
            </div>
          ))}
        </div>
      ));
    }

    if (layoutMode === 'recto-only') {
      const chunks = chunkArray(employees, gridChunkSize);
      return chunks.map((chunk, pageIdx) => (
        <div 
          key={`page-${pageIdx}`} 
          className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
            gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {chunk.map((emp) => (
            <CardRender key={emp.id} emp={emp} template={template} side="recto" />
          ))}
        </div>
      ));
    }

    if (layoutMode === 'verso-only') {
      const chunks = chunkArray(employees, gridChunkSize);
      return chunks.map((chunk, pageIdx) => (
        <div 
          key={`page-${pageIdx}`} 
          className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
            gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {chunk.map((emp) => (
            <CardRender key={emp.id} emp={emp} template={template} side="verso" />
          ))}
        </div>
      ));
    }

    if (layoutMode === 'duplex') {
      const chunks = chunkArray(employees, gridChunkSize);
      return chunks.flatMap((chunk, chunkIdx) => {
        const rectoPage = (
          <div 
            key={`chunk-${chunkIdx}-recto`} 
            className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
              gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {chunk.map((emp) => (
              <CardRender key={`${emp.id}-recto`} emp={emp} template={template} side="recto" />
            ))}
          </div>
        );

        const versoPage = (
          <div 
            key={`chunk-${chunkIdx}-verso`} 
            className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
              gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {chunk.map((emp) => (
              <CardRender key={`${emp.id}-verso`} emp={emp} template={template} side="verso" />
            ))}
          </div>
        );

        return [rectoPage, versoPage];
      });
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 pb-12">
      {/* ON-SCREEN CONTROL BAR */}
      <div className="no-print sticky top-0 z-50 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-neutral-800 dark:text-white">Impression de Badges - {companyName}</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Préparez le fichier de sortie pour {employees.length} employé{employees.length > 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Template Selection if multiple exist */}
          {templates.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Gabarit:</span>
              <select
                value={selectedTemplateType}
                onChange={(e) => setSelectedTemplateType(e.target.value as CardType)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold"
              >
                <option value="BADGE">Badge standard</option>
                <option value="CARTE_PRO">Carte Pro</option>
              </select>
            </div>
          )}

          {/* Layout Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Mise en page:</span>
            <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
              <button
                onClick={() => setLayoutMode('side-by-side')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  layoutMode === 'side-by-side' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
                title="Pliage Recto/Verso côte à côte"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Pliage ( Recto+Verso )</span>
              </button>
              <button
                onClick={() => setLayoutMode('duplex')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  layoutMode === 'duplex' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
                title="Duplex pages recto puis pages verso"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Duplex ( Pages séparées )</span>
              </button>
              <button
                onClick={() => setLayoutMode('recto-only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  layoutMode === 'recto-only' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Recto seul
              </button>
              <button
                onClick={() => setLayoutMode('verso-only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  layoutMode === 'verso-only' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Verso seul
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleValidatePrint}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Valider &amp; Fermer</span>
            </button>
          </div>
        </div>
      </div>

      {/* WARNING IF NO CUSTOM TEMPLATES */}
      {templates.length === 0 && (
        <div className="no-print mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
          <div>
            <span className="font-bold">Attention :</span> Aucun modèle de badge personnalisé n&apos;a été configuré pour cette entreprise dans le Studio. Les impressions utiliseront le modèle par défaut standard.
          </div>
        </div>
      )}

      {/* PRINT STYLES SHEET */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ON SCREEN PREVIEW STYLES */
        .print-page-preview {
          background: white;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          width: 210mm;
          height: 297mm;
          padding: 10mm !important;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
          position: relative;
        }
        
        .dark .print-page-preview {
          background: #15151a !important;
          border-color: #272730 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            padding: 10mm !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Hide scrollbars during print */
          * {
            scrollbar-width: none !important;
          }
          ::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        }
      ` }} />

      {/* PRINT PAGES CONTAINER */}
      <div className="flex flex-col gap-4 mt-6 overflow-x-auto pb-6 print-container">
        {renderPrintPages()}
      </div>
    </div>
  );
}
