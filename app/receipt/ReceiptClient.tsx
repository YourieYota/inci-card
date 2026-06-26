'use client';

import React, { useEffect } from 'react';
import { Printer, X, User, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

interface SerializedEmployee {
  id: string;
  uniqueIdentifier: string;
  enrollmentNumber: string | null;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  printedAt: string | null;
  company: {
    id: string;
    name: string;
    createdAt: string;
  };
  dynamicData: any;
}

interface ReceiptClientProps {
  employee: SerializedEmployee;
  template: {
    width: number;
    height: number;
    backgroundUrl: string;
    layoutConfig: any;
  };
}

const getFieldValue = (emp: SerializedEmployee, field?: string) => {
  if (!field) return '';
  if (field === 'Entreprise') return emp.company?.name || '';

  // Intercept and return enrollmentNumber or uniqueIdentifier for specific mappings
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
    const targetKey = field.toLowerCase().trim();
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

  // 5. Combined name splitting fallback
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
            return parts[0];
          } else {
            return parts.slice(1).join(' ') || parts[0];
          }
        }
      }
    }
  }

  return `{${field}}`;
};

const cardStyle = (template: any) => {
  const config = template.layoutConfig as any;
  let bgUrl = '';
  let opacity = 1;
  let borderRadius = config?.borderRadius !== undefined ? config.borderRadius : 8;

  if (config && typeof config === 'object') {
    const recto = config.recto || {};
    bgUrl = recto.backgroundUrl || template.backgroundUrl || '';
    opacity = recto.backgroundOpacity !== undefined ? recto.backgroundOpacity : 1;
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

export default function ReceiptClient({ employee, template }: ReceiptClientProps) {
  // Auto-print on load
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const width = template.width;
  const height = template.height;
  
  const config = template.layoutConfig as any;
  let elements: any[] = [];
  if (config && typeof config === 'object') {
    elements = (config.recto?.elements || config.elements || []) as any[];
  } else {
    elements = (config as unknown as any[]) || [];
  }

  const { bgStyle, borderRadius } = cardStyle(template);
  const mmWidth = width * 0.264583;
  const mmHeight = height * 0.264583;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 py-12 px-4 flex flex-col items-center justify-center font-sans antialiased text-neutral-800 dark:text-neutral-200 select-none">
      
      {/* ACTION BAR (NON-PRINTABLE) */}
      <div className="no-print mb-6 flex justify-between gap-4" style={{ width: `${mmWidth}mm` }}>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Fermer</span>
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimer le Reçu</span>
        </button>
      </div>

      {/* DYNAMIC RECEIPT TICKET (Dimensions and layout loaded from Studio) */}
      <div
        className="receipt-sheet relative overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white select-none shrink-0 shadow-2xl border-dashed"
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
          {/* Background Gradient/Image */}
          <div style={bgStyle} />
          
          {/* Default low-opacity watermark if no background image is set */}
          {!template.backgroundUrl && (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none z-0">
              <img src="/logo-imprimerie.png" className="w-[60%] object-contain select-none" alt="Watermark" />
            </div>
          )}

          {/* Render layout elements */}
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
                          fontSize: `${el.fontSize || 14}${el.fontSizeUnit || 'px'}`,
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
                        {getFieldValue(employee, el.field) || el.content || ''}
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
                        {employee.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={employee.photoUrl}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            alt="Photo"
                          />
                        ) : (
                          <User className="w-8 h-8 text-neutral-400" />
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
                            getFieldValue(employee, el.field) || employee.enrollmentNumber || employee.uniqueIdentifier
                          }
                          size={150}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          viewBox="0 0 256 256"
                        />
                      </div>
                    )}

                    {el.type === 'logo' && (
                      <div
                        className="w-full h-full overflow-hidden flex items-center justify-center bg-neutral-100/30"
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

      {/* PRINT STYLES SHEET */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-sheet {
            box-shadow: none !important;
            border: 1px dashed #9ca3af !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: ${mmWidth}mm !important;
            height: ${mmHeight}mm !important;
            box-sizing: border-box !important;
          }
        }
      ` }} />
    </div>
  );
}
