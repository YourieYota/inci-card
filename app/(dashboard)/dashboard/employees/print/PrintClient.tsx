'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Employee, CardTemplate } from '@prisma/client';
import { Printer, Check, ArrowLeft, Loader2, LayoutGrid, Layers, RefreshCw, AlertCircle, Lock, Ban, RotateCcw, Trash2, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { confirmPrint, validatePrintEligibility, deleteEmployeesByIds, assignCardNumbersForCategory } from '@/app/actions/employees';
import { StudioElement } from '@/components/studio/Canvas';
import QRCode from 'react-qr-code';
import IntaglioImage from '@/components/studio/IntaglioImage';
import BlendedImage from '@/components/studio/BlendedImage';

import { safeGetItem, safeSetItem, cleanEmployeesForCache } from '@/lib/storage';
import { resizeImageClientSide } from '@/lib/imageUtils';

interface PrintClientProps {
  employees: (Employee & { company: { name: string } })[];
  templates: CardTemplate[];
  companyName: string;
  documentTypes: any[];
  categories: any[];
  physicalTypes: any[];
  dbError?: boolean;
  employeeIds?: string[];
  initialType?: string;
  initialCategoryId?: string;
}

type PrintLayoutMode = 'side-by-side' | 'duplex' | 'recto-only' | 'verso-only';

const getDefaultElements = (width: number, height: number, type?: string): StudioElement[] => {
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
        width: width - 205,
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
        width: width - 150,
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
        width: width - 150,
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
        width: width - 150,
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
        width: width - 150,
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
        width: width - 150,
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
        width: Math.round((width - 98) / 2),
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
        x: Math.round(width / 2) + 20,
        y: 415,
        width: Math.round((width - 98) / 2),
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
        width: Math.round((width - 98) / 2),
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
        x: Math.round(width / 2) + 20,
        y: 470,
        width: Math.round((width - 98) / 2),
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

const getFieldValue = (
  emp: Employee & { company?: { name: string } },
  field?: string,
  selectedCategoryName?: string,
  selectedPhysicalTypeName?: string,
  catValidityValue?: number,
  catValidityUnit?: string,
  categoryCardCode?: string
) => {
  if (!field) return '';
  if (field === 'Entreprise') return emp.company?.name || '';

  // Intercept and return enrollmentNumber for identifier fields
  const targetKey = field.toLowerCase().trim();
  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizedTarget = normalize(field);

  if (normalizedTarget === 'categorie' || normalizedTarget === 'category' || normalizedTarget === 'catégorie') {
    return selectedCategoryName || '';
  }

  if (normalizedTarget === 'type de support' || normalizedTarget === 'type support' || normalizedTarget === 'support') {
    return selectedPhysicalTypeName || '';
  }

  if (normalizedTarget === 'n° carte' || normalizedTarget === 'numero carte' || normalizedTarget === 'numéro carte' || normalizedTarget === 'cardnumber' || normalizedTarget === 'numero de carte' || normalizedTarget === 'numéro de carte') {
    return emp.cardNumber || (categoryCardCode ? `${categoryCardCode}XXXX` : 'En attente...');
  }

  if (normalizedTarget === 'n° d\'enrolement' || normalizedTarget === 'numéro d\'enrôlement' || normalizedTarget === 'enrollmentnumber') {
    return emp.enrollmentNumber || 'En cours...';
  }

  if (normalizedTarget === 'date d\'emission' || normalizedTarget === 'date d\'émission' || normalizedTarget === 'date emission' || normalizedTarget === 'date émission') {
    if (emp.printedAt) {
      const d = new Date(emp.printedAt);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }

  if (normalizedTarget === 'date d\'expiration' || normalizedTarget === 'date expiration' || normalizedTarget === 'expiration' || normalizedTarget === 'date de validite' || normalizedTarget === 'date de validité') {
    if (catValidityUnit === 'NONE' || catValidityUnit === null || catValidityValue === null || catValidityValue === undefined) {
      return 'Permanente';
    }
    const emissionDate = emp.printedAt ? new Date(emp.printedAt) : new Date();
    const expirationDate = new Date(emissionDate);
    const vValue = catValidityValue || 1;
    const vUnit = catValidityUnit || 'YEAR';
    if (vUnit === 'YEAR') {
      expirationDate.setFullYear(expirationDate.getFullYear() + vValue);
    } else if (vUnit === 'MONTH') {
      expirationDate.setMonth(expirationDate.getMonth() + vValue);
    } else if (vUnit === 'DAY') {
      expirationDate.setDate(expirationDate.getDate() + vValue);
    }
    const day = String(expirationDate.getUTCDate()).padStart(2, '0');
    const month = String(expirationDate.getUTCMonth() + 1).padStart(2, '0');
    const year = expirationDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  if (normalizedTarget === 'validite' || normalizedTarget === 'validité' || normalizedTarget === 'durée de validité' || normalizedTarget === 'duree de validite') {
    if (catValidityUnit === 'NONE' || catValidityUnit === null || catValidityValue === null || catValidityValue === undefined) {
      return 'Permanente';
    }
    const unitStr = catValidityUnit === 'YEAR' ? 'An(s)' : catValidityUnit === 'MONTH' ? 'Mois' : 'Jour(s)';
    return `${catValidityValue} ${unitStr}`;
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

  return '';
};

const resolvePlaceholders = (
  text: string | undefined | null,
  emp: Employee & { company?: { name: string } },
  selectedCategoryName?: string,
  selectedPhysicalTypeName?: string,
  catValidityValue?: number,
  catValidityUnit?: string,
  categoryCardCode?: string
): string => {
  if (!text) return '';
  return text.replace(/\{([^}]+)\}/g, (match, fieldName) => {
    const value = getFieldValue(
      emp,
      fieldName,
      selectedCategoryName,
      selectedPhysicalTypeName,
      catValidityValue,
      catValidityUnit,
      categoryCardCode
    );
    if (value && value.startsWith('{') && value.endsWith('}')) {
      return '';
    }
    return value !== undefined && value !== null ? value : '';
  });
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
  selectedCategoryName?: string;
  selectedPhysicalTypeName?: string;
  validityValue?: number;
  validityUnit?: string;
  categoryCardCode?: string;
}

function CardRender({ emp, template, side, selectedCategoryName, selectedPhysicalTypeName, validityValue, validityUnit, categoryCardCode }: CardRenderProps) {
    const renderElementContent = (el: any) => {
    return (
      <>
        {el.type === 'text' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              color: el.color || '#000000',
              fontSize: `${el.fontSize || 14}${el.fontSizeUnit || 'px'}`,
              fontFamily: el.fontFamily || 'sans-serif',
              fontWeight: el.fontWeight || 'normal',
              fontStyle: el.fontStyle || 'normal',
              textTransform: el.textTransform === 'first-letter' ? 'none' : (el.textTransform || 'none'),
              textAlign: el.alignment || 'left',
              display: 'flex',
              alignItems: el.verticalAlignment === 'top' ? 'flex-start' : el.verticalAlignment === 'bottom' ? 'flex-end' : 'center',
              justifyContent: el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'flex-end' : 'flex-start',
              overflow: 'hidden',
              whiteSpace: 'normal',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              lineHeight: el.lineHeight !== undefined ? el.lineHeight : 'normal',
              letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}px` : 'normal',
            }}
          >
            {(() => {
              let rawText = el.field
                ? (getFieldValue(emp, el.field, selectedCategoryName, selectedPhysicalTypeName, validityValue, validityUnit, categoryCardCode) || '')
                : resolvePlaceholders(el.content, emp, selectedCategoryName, selectedPhysicalTypeName, validityValue, validityUnit, categoryCardCode);
              
              if (el.textTransform === 'first-letter' && typeof rawText === 'string' && rawText.length > 0) {
                return rawText.charAt(0).toUpperCase() + rawText.slice(1).toLowerCase();
              }
              return rawText;
            })()}
          </div>
        )}

        {el.type === 'image' && (
          <div
            className={`w-full h-full overflow-hidden flex items-center justify-center ${!emp.photoUrl ? 'bg-white' : ''}`}
            style={{
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
              filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
            }}
          >
            {emp.photoUrl ? (
              el.intaglio ? (
                <IntaglioImage
                  src={emp.photoUrl}
                  spacing={el.intaglioSpacing}
                  lineWidth={el.intaglioLineWidth}
                  waveAmp={el.intaglioWaveAmp}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BlendedImage
                  src={emp.photoUrl}
                  blendMode={el.blendMode}
                  className="print-employee-photo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: ((emp.dynamicData as any)?._photoFit === 'contain') ? 'contain' : 'cover',
                  }}
                  alt="Photo"
                />
              )
            ) : (
              <span className="text-[8px] font-bold text-neutral-400">Pas de photo</span>
            )}
          </div>
        )}

        {el.type === 'qr' && (
          <div
            className="w-full h-full overflow-hidden flex items-center justify-center"
            style={{
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
              padding: '5%',
              filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
            }}
          >
            {el.qrSource === 'external' && (emp as any).externalQrUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={(emp as any).externalQrUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                alt="QR externe"
              />
            ) : (
              <QRCode
                value={
                  el.field
                    ? (getFieldValue(emp, el.field, selectedCategoryName, selectedPhysicalTypeName, validityValue, validityUnit, categoryCardCode) || '')
                    : (el.content ? resolvePlaceholders(el.content, emp, selectedCategoryName, selectedPhysicalTypeName, validityValue, validityUnit, categoryCardCode) : (emp.enrollmentNumber || emp.uniqueIdentifier))
                }
                size={150}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox="0 0 256 256"
              />
            )}
          </div>
        )}

        {el.type === 'logo' && (
          <div
            className="w-full h-full overflow-hidden flex items-center justify-center"
            style={{
              borderRadius: `${el.borderRadius || 0}px`,
              borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : undefined,
              borderColor: el.borderWidth !== undefined && el.borderWidth > 0 ? el.borderColor || '#000000' : undefined,
              borderStyle: el.borderWidth !== undefined && el.borderWidth > 0 ? 'solid' : undefined,
            }}
          >
            {el.logoUrl ? (
              <BlendedImage
                src={el.logoUrl}
                blendMode={el.blendMode}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%)`,
                }}
                alt="Logo"
              />
            ) : null}
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
            className="relative"
          >
            {elements
              .filter(child => child.parentId === el.id)
              .map(child => (
                <React.Fragment key={child.id}>
                  <div
                    style={{
                      position: 'relative',
                      width: child.childFlexMode === 'fixed' ? `${child.width}px` : (child.childFlexMode === 'fill' ? '100%' : (child.childFlexMode === 'auto' ? 'auto' : (el.flexDirection === 'row' ? (child.type === 'text' || child.type === 'group' ? 'auto' : `${child.width}px`) : (child.type === 'text' || child.type === 'group' ? '100%' : `${child.width}px`)))),
                      height: el.flexDirection === 'row' && el.flexWrap !== 'wrap' ? 'auto' : (child.type === 'text' || child.type === 'group' ? 'auto' : `${child.height}px`),
                      minHeight: (child.type === 'text' && child.childFlexMode !== 'auto') ? `${child.height}px` : undefined,
                      flex: child.childFlexMode === 'flex' ? '1 1 0%' : (child.childFlexMode === 'auto' ? '0 0 auto' : (child.childFlexMode === 'fixed' || child.childFlexMode === 'fill' ? 'none' : ((el.flexDirection === 'row' && (child.type === 'text' || child.type === 'group')) ? '1 1 0%' : '0 0 auto'))),
                      transform: `translate(${(child as any).offsetX || 0}px, ${(child as any).offsetY || 0}px)`,
                      opacity: child.opacity !== undefined ? child.opacity : 1,
                      mixBlendMode: (child as any).blendMode || 'normal',
                    }}
                  >
                    {renderElementContent(child)}
                  </div>
                  {child.forceBreakAfter && el.flexDirection === 'row' && (
                    <div style={{ flexBasis: '100%', height: 0, margin: 0, padding: 0, marginBottom: `-${el.rowGap !== undefined ? el.rowGap : (el.gap !== undefined ? el.gap : 4)}px` }} />
                  )}
                </React.Fragment>
              ))}
          </div>
        )}
      </>
    );
  };

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

  return (
    <div
      className="relative overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white select-none shrink-0"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${borderRadius}px`,
        boxSizing: 'border-box',
      }}
    >
      <div style={bgStyle} />
      {elements.filter(el => !el.parentId).map((el) => {
          const opacity = el.opacity !== undefined ? el.opacity : 1;
          return (
            <div
              key={el.id}
              className="absolute pointer-events-none"
              style={{
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                zIndex: (el as any).zIndex !== undefined ? (el as any).zIndex : undefined,
                opacity,
                mixBlendMode: (el as any).blendMode || 'normal',
              }}
            >
              <div
                className="w-full h-full relative flex items-center justify-center pointer-events-none"
                style={{
                  transform: `rotate(${(el as any).rotation || 0}deg)`,
                  width: '100%',
                  height: '100%',
                }}
              >
                {renderElementContent(el)}
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default function PrintClient({ employees, templates, companyName, documentTypes, categories, physicalTypes, dbError, employeeIds, initialType, initialCategoryId }: PrintClientProps) {
  const [localEmployees, setLocalEmployees] = useState<typeof employees>(employees);
  const [localTemplates, setLocalTemplates] = useState<typeof templates>(templates);
  const router = useRouter();
  const [localCompanyName, setLocalCompanyName] = useState<string>(companyName);

  useEffect(() => {
    if (!dbError) {
      setLocalEmployees(prev => {
        return employees.map(emp => {
          const existing = prev.find(p => p.id === emp.id);
          return {
            ...emp,
            cardNumber: emp.cardNumber || existing?.cardNumber || null
          };
        });
      });
      setLocalTemplates(templates);
      setLocalCompanyName(companyName);
      return;
    }

    try {
      const ids = employeeIds || [];
      const cachedEmployees: any[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('inci-cache:employees:')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            cachedEmployees.push(...list);
          }
        }
      }

      const matched = cachedEmployees.filter((emp) => ids.includes(emp.id));
      
      if (matched.length > 0) {
        const firstCoId = matched[0].companyId;
        
        let resolvedCoName = 'Entreprise (Hors-ligne)';
        const cachedCompaniesRaw = safeGetItem('inci-cache:companies');
        if (cachedCompaniesRaw) {
          const companiesList: any[] = JSON.parse(cachedCompaniesRaw);
          const co = companiesList.find((c) => c.id === firstCoId);
          if (co) {
            resolvedCoName = co.name;
            setLocalCompanyName(co.name);
          }
        }

        const loadedTemplates: CardTemplate[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`inci-cache:template:${firstCoId}:`)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              loadedTemplates.push(JSON.parse(raw));
            }
          }
        }

        const finalEmployees = matched.map((emp) => ({
          ...emp,
          company: { name: resolvedCoName }
        }));

        setLocalEmployees(finalEmployees);
        setLocalTemplates(loadedTemplates);
      }
    } catch (e) {
      console.warn("Failed to load print data from offline cache:", e);
    }
  }, [employees, templates, companyName, dbError, employeeIds]);

  // Always initialize selected template type to initialType or 'BADGE' as standard printable format
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>(initialType || 'BADGE');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || '');
  const [selectedPhysicalTypeId, setSelectedPhysicalTypeId] = useState<string>('');

  const [assignedFlag, setAssignedFlag] = useState<string>('');

  // Auto-select first category if selectedCategoryId is empty or not in the filtered categories
  useEffect(() => {
    const filtered = categories.filter((c: any) => !c.documentTypeSlug || c.documentTypeSlug === selectedTemplateType);
    if (filtered.length > 0) {
      const isValid = filtered.some(c => c.id === selectedCategoryId);
      if (!isValid) {
        setSelectedCategoryId(filtered[0].id);
      }
    } else {
      setSelectedCategoryId('');
    }
  }, [selectedTemplateType, categories, selectedCategoryId]);

  useEffect(() => {
    const key = `${selectedCategoryId}_${selectedTemplateType}_${localEmployees.map(e => e.id).join(',')}`;
    if (assignedFlag === key) return;
    
    if (localEmployees.length > 0) {
      const employeesToAssign = localEmployees.filter(e => !e.cardNumber || e.cardNumber.startsWith('BADGE'));
      console.log("[assignCardNumbers] Check to assign:", employeesToAssign.length, "employees");
      if (employeesToAssign.length > 0) {
        const categoryMap: Record<string, string[]> = {};
        employeesToAssign.forEach(emp => {
          const empCatId = (emp.dynamicData as any)?.categorie_id || (emp.dynamicData as any)?.category_id || selectedCategoryId || '';
          if (empCatId) {
            if (!categoryMap[empCatId]) {
              categoryMap[empCatId] = [];
            }
            categoryMap[empCatId].push(emp.id);
          }
        });

        console.log("[assignCardNumbers] categoryMap:", categoryMap);

        const promises = Object.entries(categoryMap).map(([catId, ids]) => 
          assignCardNumbersForCategory(ids, catId, selectedTemplateType)
        );

        if (promises.length > 0) {
          setAssignedFlag(key);
          Promise.all(promises).then((results) => {
            console.log("[assignCardNumbers] Results:", results);
            const allUpdated: Record<string, string> = {};
            results.forEach(res => {
              if (res) {
                Object.assign(allUpdated, res);
              }
            });

            if (Object.keys(allUpdated).length > 0) {
              setLocalEmployees(prev => prev.map(emp => {
                if (allUpdated[emp.id]) {
                  return { ...emp, cardNumber: allUpdated[emp.id] };
                }
                return emp;
              }));
            }
            router.refresh();
          }).catch(err => {
            console.error("Failed to auto assign card numbers:", err);
          });
        }
      }
    }
  }, [localEmployees, selectedCategoryId, selectedTemplateType, assignedFlag]);

  const [printFormat, setPrintFormat] = useState<'A4' | 'CARD'>('A4');
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>('side-by-side');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Eligibility state
  const [eligibleEmployees, setEligibleEmployees] = useState<typeof employees>(employees);
  const [ineligibleEmployees, setIneligibleEmployees] = useState<{ employee: any; reasons: string[] }[]>([]);
  const [eligibilityChecked, setEligibilityChecked] = useState<boolean>(false);

  // Check eligibility on mount and when template type changes
  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const ids = localEmployees.map((e) => e.id);
        const result = await validatePrintEligibility(ids, selectedTemplateType);
        setEligibleEmployees(localEmployees.filter((e) =>
          result.eligible.some((el: any) => el.id === e.id)
        ));
        setIneligibleEmployees(result.ineligible);
      } catch (err) {
        // If validation fails, show all employees but log warning
        console.warn('Eligibility check failed, showing all employees:', err);
        setEligibleEmployees(localEmployees);
      }
      setEligibilityChecked(true);
    };
    checkEligibility();
  }, [localEmployees, selectedTemplateType]);

  // Compute validity for expiration date based on selected category
  const selectedCategory = categories.find((c: any) => c.id === selectedCategoryId);
  const validityValue = selectedCategory ? (selectedCategory.validityValue !== undefined ? selectedCategory.validityValue : 1) : 1;
  const validityUnit = selectedCategory ? (selectedCategory.validityUnit !== undefined ? selectedCategory.validityUnit : 'YEAR') : 'YEAR';

  // Helper to load appropriate template or build fallback with suitable type & dimensions
  const getTemplateForType = (type: string, categoryId?: string) => {
    if (categoryId) {
      const foundWithCategory = localTemplates.find((t) => t.type === type && t.categoryId === categoryId);
      if (foundWithCategory) return foundWithCategory;
    }

    const foundGeneric = localTemplates.find((t) => t.type === type && !t.categoryId);
    if (foundGeneric) return foundGeneric;

    let w = 324;
    let h = 204;
    
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat?.format) {
        w = Math.round(cat.format.width / 0.264583);
        h = Math.round(cat.format.height / 0.264583);
      }
    } else {
      if (type === 'CARTE_PRO') {
        w = 700;
        h = 450;
      } else if (type === 'RECU') {
        w = 378;
        h = 530;
      }
    }

    return {
      id: `fallback-${type}-${categoryId || 'generic'}`,
      companyId: localEmployees[0]?.companyId || 'fallback-co',
      type,
      categoryId: categoryId || null,
      width: w,
      height: h,
      backgroundUrl: '',
      layoutConfig: getDefaultElements(w, h, type) as any,
    } as CardTemplate;
  };

  const template = getTemplateForType(selectedTemplateType, selectedCategoryId);

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
  const isProcessingBgRef = useRef(false);

  const processAutoRemoveBg = async () => {
    if (isProcessingBgRef.current) return;
    isProcessingBgRef.current = true;

    try {
      let rawConfig = (template?.layoutConfig as unknown as any) || [];
      if (typeof rawConfig === 'string') {
        try {
          rawConfig = JSON.parse(rawConfig);
        } catch(e) {
          rawConfig = [];
        }
      }

      let allElements: any[] = [];
      if (Array.isArray(rawConfig)) {
        allElements = rawConfig;
      } else if (rawConfig && typeof rawConfig === 'object') {
        allElements = [
          ...(rawConfig.recto?.elements || []),
          ...(rawConfig.verso?.elements || []),
          ...(rawConfig.elements || []),
        ];
      }

      const hasAutoRemoveBg = allElements.some((el: any) => !!el.autoRemoveBackground);
      
      if (hasAutoRemoveBg) {
        const photos = Array.from(document.querySelectorAll('.print-employee-photo')) as HTMLImageElement[];
        for (let i = 0; i < photos.length; i++) {
          const img = photos[i];
          if (img.src && img.dataset.bgRemoved !== "true" && img.dataset.bgProcessing !== "true") {
            img.dataset.bgProcessing = "true";
            try {
              console.log(`[PrintClient] Sequential auto-remove bg for photo ${i + 1}/${photos.length}...`);
              const optimizedSrc = await resizeImageClientSide(img.src, 800);
              let transparentSrc: string | null = null;

              // Primary: Client-Side WebAssembly AI (0 MB server RAM, 0% failure rate)
              try {
                const { removeBackground } = await import('@imgly/background-removal');
                const blob = await removeBackground(optimizedSrc);
                const reader = new FileReader();
                transparentSrc = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                console.log(`[PrintClient] Photo ${i + 1}/${photos.length} bg removed via Client-Side WebAssembly AI!`);
              } catch (clientAiErr) {
                console.warn(`[PrintClient] Client-side AI failed, falling back to server API...`, clientAiErr);
                const res = await fetch('/api/remove-bg', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageData: optimizedSrc }),
                });
                if (res.ok) {
                  const data = await res.json();
                  transparentSrc = data.result;
                }
              }

              if (transparentSrc) {
                img.src = transparentSrc;
                img.dataset.bgRemoved = "true";
                console.log(`[PrintClient] Photo ${i + 1}/${photos.length} background applied successfully.`);
              }
            } catch(err) {
              console.error("AI bg removal failed for img", i, err);
            } finally {
              delete img.dataset.bgProcessing;
            }
          }
        }
      }
    } finally {
      isProcessingBgRef.current = false;
    }
  };

  useEffect(() => {
    const timer1 = setTimeout(() => {
      processAutoRemoveBg();
    }, 800);
    const timer2 = setTimeout(() => {
      processAutoRemoveBg();
    }, 2500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [selectedTemplateType, selectedCategoryId, employees]);

  const handlePrint = async () => {
    await processAutoRemoveBg();
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      // Dynamically load scripts if not present
      if (!(window as any).htmlToImage) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/html-to-image.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load html-to-image.js from public folder"));
          document.head.appendChild(script);
        });
      }
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/jspdf.umd.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load jspdf.umd.min.js from public folder"));
          document.head.appendChild(script);
        });
      }

      const htmlToImageFn = (window as any).htmlToImage;
      const jsPDFFn = (window as any).jspdf.jsPDF;

      await processAutoRemoveBg();

      const isA4 = printFormat === 'A4';
      const pdf = new jsPDFFn({
        orientation: isA4 ? 'portrait' : (mmWidth > mmHeight ? 'landscape' : 'portrait'),
        unit: 'mm',
        format: isA4 ? 'a4' : [mmWidth, mmHeight]
      });

      const elements = document.querySelectorAll(isA4 ? '.print-page-preview' : '.print-page-card-preview');
      
      if (elements.length === 0) {
        alert("Aucune carte à télécharger.");
        return;
      }

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        
        console.log(`Generating image for element ${i}, dimensions: ${width}x${height}`);
        
        // Use html-to-image to get the data url directly
        const imgData = await htmlToImageFn.toPng(el, {
          pixelRatio: 3, // High resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          width: width,
          height: height,
          canvasWidth: width * 3,
          canvasHeight: height * 3,
          style: {
            transform: 'none',
            margin: '0',
            position: 'relative',
            left: '0',
            top: '0',
            overflow: 'visible'
          }
        });
        
        console.log(`Image data length for element ${i}: ${imgData.length}`);
        
        if (i > 0) {
          pdf.addPage(isA4 ? 'a4' : [mmWidth, mmHeight], isA4 ? 'portrait' : (mmWidth > mmHeight ? 'landscape' : 'portrait'));
        }
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        console.log(`Adding to PDF page ${i}, pdf dimensions: ${pdfWidth}x${pdfHeight}`);
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`Badges_${localCompanyName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    } catch (error: any) {
      console.error("Erreur génération PDF détails:", error);
      if (error && error.message) console.error(error.message);
      if (error && error.stack) console.error(error.stack);
      alert("Une erreur est survenue lors de la génération du PDF: " + (error?.message || 'Erreur inconnue'));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleValidatePrint = async () => {
    setIsSaving(true);
    try {
      const ids = eligibleEmployees.map((emp) => emp.id);
      if (ids.length === 0) {
        alert('Aucun employé éligible à l\'impression.');
        return;
      }

      if (dbError) {
        // Offline print validation!
        // 1. Queue mutation
        const tempEmployeeKeys = eligibleEmployees.map((emp) => ({
          companyId: emp.companyId,
          uniqueIdentifier: emp.uniqueIdentifier,
        }));
        
        const { addOfflineMutation } = await import('@/lib/offlineQueue');
        const { cleanEmployeesForCache } = await import('@/lib/storage');
        addOfflineMutation(
          'CONFIRM_PRINT',
          {
            ids,
            templateType: selectedTemplateType,
            categoryId: selectedCategoryId || undefined,
            physicalTypeId: selectedPhysicalTypeId || undefined,
            tempEmployeeKeys,
          },
          `Valider l'impression de ${ids.length} badge(s) (Hors-ligne)`
        );

        // 2. Update local storage employees statuses to IMPRIME
        const firstCoId = eligibleEmployees[0].companyId;
        const cachedRaw = safeGetItem(`inci-cache:employees:${firstCoId}`);
        if (cachedRaw) {
          const cachedList = JSON.parse(cachedRaw);
          const updatedList = cachedList.map((emp: any) => {
            if (ids.includes(emp.id)) {
              return {
                ...emp,
                status: 'IMPRIME',
                printedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                printCount: (emp.printCount || 0) + 1,
                cardNumber: emp.cardNumber || `TEMP-CARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              };
            }
            return emp;
          });
          safeSetItem(`inci-cache:employees:${firstCoId}`, JSON.stringify(cleanEmployeesForCache(updatedList)));
        }

        alert(`Validation d'impression effectuée localement pour ${ids.length} badge(s) ! Ils seront synchronisés au retour en ligne.`);
        window.close();
        return;
      }

      const result = await confirmPrint(
        ids,
        selectedTemplateType,
        selectedCategoryId || undefined,
        selectedPhysicalTypeId || undefined
      );
      const printedCount = result.printed?.length || 0;
      const skippedCount = result.skipped?.length || 0;
      let message = `${printedCount} badge(s) imprimé(s) et verrouillé(s) avec succès.`;
      if (skippedCount > 0) {
        message += `\n${skippedCount} employé(s) non éligible(s) ignoré(s).`;
      }
      alert(message);
      window.close();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la confirmation d\'impression.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDeleteEmployees = async () => {
    if (eligibleEmployees.length === 0) return;

    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement ces ${eligibleEmployees.length} employé(s) ? Cette action est irréversible.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const ids = eligibleEmployees.map((e) => e.id);
      const firstCoId = eligibleEmployees[0].companyId;
      const nowStr = new Date().toISOString();
      
      if (dbError) {
        const { addOfflineMutation } = await import('@/lib/offlineQueue');
        const { cleanEmployeesForCache } = await import('@/lib/storage');

        // 1. Queue offline delete mutation for each employee
        for (const emp of eligibleEmployees) {
          addOfflineMutation(
            'DELETE_EMPLOYEE',
            { employeeId: emp.id },
            `Supprimer l'employé ${emp.uniqueIdentifier} (Hors-ligne)`
          );
        }

        // 2. Archive to localStorage trash offline
        try {
          const trashRaw = localStorage.getItem(`inci-trash:${firstCoId}`);
          let trashList = trashRaw ? JSON.parse(trashRaw) : [];
          const newTrashItems = eligibleEmployees.map(emp => ({
            ...emp,
            deletedAt: nowStr
          }));
          trashList = [...newTrashItems, ...trashList];
          localStorage.setItem(`inci-trash:${firstCoId}`, JSON.stringify(trashList));
        } catch (e) {
          console.warn("Failed to write offline delete to localStorage trash:", e);
        }

        // 3. Filter out deleted employees from localStorage
        const cachedRaw = safeGetItem(`inci-cache:employees:${firstCoId}`);
        if (cachedRaw) {
          const cachedList = JSON.parse(cachedRaw);
          const filteredList = cachedList.filter((emp: any) => !ids.includes(emp.id));
          safeSetItem(`inci-cache:employees:${firstCoId}`, JSON.stringify(cleanEmployeesForCache(filteredList)));
        }

        alert(`Suppression effectuée localement pour ${ids.length} employé(s) ! Elle sera synchronisée au retour en ligne.`);
        window.close();
        return;
      }

      // Online mode
      const result = await deleteEmployeesByIds(ids);

      // Archive to localStorage trash online
      if (result.deletedEmployees && result.deletedEmployees.length > 0) {
        try {
          const trashRaw = localStorage.getItem(`inci-trash:${firstCoId}`);
          let trashList = trashRaw ? JSON.parse(trashRaw) : [];
          const newTrashItems = result.deletedEmployees.map(emp => ({
            ...emp,
            deletedAt: nowStr
          }));
          trashList = [...newTrashItems, ...trashList];
          localStorage.setItem(`inci-trash:${firstCoId}`, JSON.stringify(trashList));
        } catch (e) {
          console.warn("Failed to write online delete to localStorage trash:", e);
        }
      }

      alert(`${result.count} employé(s) supprimé(s) avec succès.`);
      window.close();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression groupée.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate pages content based on layout selection
  const renderPrintPages = () => {
    const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name;
    const selectedPhysicalTypeName = physicalTypes.find((p) => p.id === selectedPhysicalTypeId)?.name;

    if (printFormat === 'CARD') {
      if (layoutMode === 'recto-only') {
        return eligibleEmployees.map((emp, idx) => (
          <div key={`card-recto-${idx}`} className="print-page-card print-page-card-preview">
            <CardRender 
              emp={emp} 
              template={template} 
              side="recto" 
              selectedCategoryName={selectedCategoryName} 
              selectedPhysicalTypeName={selectedPhysicalTypeName} 
              validityValue={validityValue} 
              validityUnit={validityUnit} 
              categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
            />
          </div>
        ));
      }
      if (layoutMode === 'verso-only') {
        return eligibleEmployees.map((emp, idx) => (
          <div key={`card-verso-${idx}`} className="print-page-card print-page-card-preview">
            <CardRender 
              emp={emp} 
              template={template} 
              side="verso" 
              selectedCategoryName={selectedCategoryName} 
              selectedPhysicalTypeName={selectedPhysicalTypeName} 
              validityValue={validityValue} 
              validityUnit={validityUnit} 
              categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
            />
          </div>
        ));
      }
      // duplex
      return eligibleEmployees.flatMap((emp, idx) => [
        <div key={`card-recto-${idx}`} className="print-page-card print-page-card-preview">
          <CardRender 
            emp={emp} 
            template={template} 
            side="recto" 
            selectedCategoryName={selectedCategoryName} 
            selectedPhysicalTypeName={selectedPhysicalTypeName} 
            validityValue={validityValue} 
            validityUnit={validityUnit} 
            categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
          />
        </div>,
        <div key={`card-verso-${idx}`} className="print-page-card print-page-card-preview">
          <CardRender 
            emp={emp} 
            template={template} 
            side="verso" 
            selectedCategoryName={selectedCategoryName} 
            selectedPhysicalTypeName={selectedPhysicalTypeName} 
            validityValue={validityValue} 
            validityUnit={validityUnit} 
            categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
          />
        </div>
      ]);
    }

    if (layoutMode === 'side-by-side') {
      const chunks = chunkArray(eligibleEmployees, sideBySideChunkSize);
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
                <CardRender 
                  emp={emp} 
                  template={template} 
                  side="recto" 
                  selectedCategoryName={selectedCategoryName}
                  selectedPhysicalTypeName={selectedPhysicalTypeName}
                  validityValue={validityValue}
                  validityUnit={validityUnit}
                  categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1 no-print">VERSO</span>
                <CardRender 
                  emp={emp} 
                  template={template} 
                  side="verso" 
                  selectedCategoryName={selectedCategoryName}
                  selectedPhysicalTypeName={selectedPhysicalTypeName}
                  validityValue={validityValue}
                  validityUnit={validityUnit}
                  categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
                />
              </div>
            </div>
          ))}
        </div>
      ));
    }

    if (layoutMode === 'recto-only') {
      const chunks = chunkArray(eligibleEmployees, gridChunkSize);
      return chunks.map((chunk, pageIdx) => (
        <div 
          key={`page-${pageIdx}`} 
          className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
            gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {chunk.map((emp) => (
            <CardRender 
              key={emp.id} 
              emp={emp} 
              template={template} 
              side="recto" 
              selectedCategoryName={selectedCategoryName}
              selectedPhysicalTypeName={selectedPhysicalTypeName}
              validityValue={validityValue}
              validityUnit={validityUnit}
              categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
            />
          ))}
        </div>
      ));
    }

    if (layoutMode === 'verso-only') {
      const chunks = chunkArray(eligibleEmployees, gridChunkSize);
      return chunks.map((chunk, pageIdx) => (
        <div 
          key={`page-${pageIdx}`} 
          className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
            gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {chunk.map((emp) => (
            <CardRender 
              key={emp.id} 
              emp={emp} 
              template={template} 
              side="verso" 
              selectedCategoryName={selectedCategoryName}
              selectedPhysicalTypeName={selectedPhysicalTypeName}
              validityValue={validityValue}
              validityUnit={validityUnit}
              categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
            />
          ))}
        </div>
      ));
    }

    if (layoutMode === 'duplex') {
      const chunks = chunkArray(eligibleEmployees, gridChunkSize);
      return chunks.flatMap((chunk, chunkIdx) => {
        const rectoPage = (
          <div 
            key={`chunk-${chunkIdx}-recto`} 
            className={`print-page print-page-preview grid gap-x-6 gap-y-6 justify-items-center align-items-center py-6 ${
              gridColsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {chunk.map((emp) => (
              <CardRender 
                key={`${emp.id}-recto`} 
                emp={emp} 
                template={template} 
                side="recto" 
                selectedCategoryName={selectedCategoryName}
                selectedPhysicalTypeName={selectedPhysicalTypeName}
                validityValue={validityValue}
                validityUnit={validityUnit}
                categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
              />
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
              <CardRender 
                key={`${emp.id}-verso`} 
                emp={emp} 
                template={template} 
                side="verso" 
                selectedCategoryName={selectedCategoryName}
                selectedPhysicalTypeName={selectedPhysicalTypeName}
                validityValue={validityValue}
                validityUnit={validityUnit}
                categoryCardCode={categories.find((c: any) => c.id === selectedCategoryId || c.id === (emp.dynamicData as any)?.categorie_id || c.id === (emp.dynamicData as any)?.category_id)?.cardCode}
              />
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
            <h1 className="text-base font-bold text-neutral-800 dark:text-white">Impression de Badges - {localCompanyName}</h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              {eligibleEmployees.length === localEmployees.length
                ? `Préparez le fichier de sortie pour ${localEmployees.length} employé${localEmployees.length > 1 ? 's' : ''}.`
                : `${eligibleEmployees.length} éligible(s) sur ${localEmployees.length} employé(s) sélectionné(s).`
              }
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Template Selection */}
          {documentTypes && documentTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Gabarit:</span>
              <select
                value={selectedTemplateType}
                onChange={(e) => {
                  setSelectedTemplateType(e.target.value);
                  setSelectedCategoryId('');
                }}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
              >
                {documentTypes.map((dt) => {
                  const hasTemplate = localTemplates.some((t) => t.type === dt.slug);
                  return (
                    <option key={dt.id} value={dt.slug}>
                      {dt.name}{hasTemplate ? ' (Modèle conçu)' : ' (Par défaut)'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Category Selection */}
          {categories && categories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Catégorie:</span>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
              >
                {categories
                  .filter((c: any) => !c.documentTypeSlug || c.documentTypeSlug === selectedTemplateType)
                  .map((c: any) => {
                    const hasSpecificTemplate = localTemplates.some((t) => t.type === selectedTemplateType && t.categoryId === c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name}{hasSpecificTemplate ? ' (Modèle conçu)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
          )}

          {/* Physical Support Selection */}
          {physicalTypes && physicalTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Support:</span>
              <select
                value={selectedPhysicalTypeId}
                onChange={(e) => setSelectedPhysicalTypeId(e.target.value)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
              >
                <option value="">Standard / Aucun</option>
                {physicalTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.cardCode ? `(${p.cardCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Print Format */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Format:</span>
            <select
              value={printFormat}
              onChange={(e) => {
                const val = e.target.value as 'A4' | 'CARD';
                setPrintFormat(val);
                if (val === 'CARD' && layoutMode === 'side-by-side') {
                  setLayoutMode('duplex');
                }
              }}
              className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
            >
              <option value="A4">Planche A4</option>
              <option value="CARD">Imprimante à badges (Ex: CR80)</option>
            </select>
          </div>

          {/* Layout Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Mise en page:</span>
            <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 p-0.5">
              {printFormat === 'A4' && (
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
              )}
              <button
                onClick={() => setLayoutMode('duplex')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  layoutMode === 'duplex' ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
                title="Duplex pages recto puis pages verso"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{printFormat === 'A4' ? 'Duplex ( Pages séparées )' : 'Recto/Verso'}</span>
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
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || eligibleEmployees.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isDownloadingPdf ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>
            <button
              onClick={handleValidatePrint}
              disabled={isSaving || eligibleEmployees.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Valider &amp; Verrouiller ({eligibleEmployees.length})</span>
            </button>
            <button
              onClick={handleBulkDeleteEmployees}
              disabled={isDeleting || eligibleEmployees.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Supprimer ({eligibleEmployees.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* OFFLINE WARNING BANNER */}
      {dbError && (
        <div className="no-print mx-6 mt-4 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-orange-800 dark:text-orange-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
          <div>
            <span className="font-bold">Mode Hors-ligne :</span> Vous êtes actuellement déconnecté de la base de données. Les fiches de membres et les gabarits de badges sont chargés depuis le cache local de votre navigateur. La validation de l'impression sera enregistrée localement et synchronisée automatiquement dès le retour en ligne.
          </div>
        </div>
      )}

      {/* WARNING IF NO CUSTOM TEMPLATES */}
      {localTemplates.length === 0 && (
        <div className="no-print mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
          <div>
            <span className="font-bold">Attention :</span> Aucun modèle de badge personnalisé n&apos;a été configuré pour cette entreprise dans le Studio. Les impressions utiliseront le modèle par défaut standard.
          </div>
        </div>
      )}

      {/* INELIGIBLE EMPLOYEES ALERT */}
      {eligibilityChecked && ineligibleEmployees.length > 0 && (
        <div className="no-print mx-6 mt-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-400 rounded-xl text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-bold">{ineligibleEmployees.length} employé(s) non éligible(s) à l&apos;impression :</span>
          </div>
          <ul className="space-y-1 ml-6">
            {ineligibleEmployees.map((item) => {
              const data = item.employee.dynamicData as Record<string, any>;
              const name = data ? `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() : item.employee.uniqueIdentifier;
              return (
                <li key={item.employee.id} className="flex items-start gap-2">
                  <span className="font-semibold">{name || item.employee.uniqueIdentifier}</span>
                  <span className="text-rose-500">—</span>
                  <span>{item.reasons.join(', ')}</span>
                  {item.employee.isLocked && <Lock className="w-3 h-3 text-rose-400 inline" />}
                  {item.employee.isBlocked && <Ban className="w-3 h-3 text-rose-400 inline" />}
                </li>
              );
            })}
          </ul>
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

        .print-page-card-preview {
          display: block;
          background: white;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          width: ${mmWidth}mm;
          height: ${mmHeight}mm;
          margin-left: auto;
          margin-right: auto;
          margin-bottom: 16px;
          box-sizing: content-box;
          overflow: hidden;
          position: relative;
        }
        
        .dark .print-page-preview, .dark .print-page-card-preview {
          background: #15151a !important;
          border-color: #272730 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        
        @media print {
          @page {
            size: ${printFormat === 'CARD' ? `${mmWidth}mm ${mmHeight}mm` : 'A4'};
            margin: 0;
          }
          /* Hide all screen components by default */
          body * {
            visibility: hidden;
          }
          /* Make only the print pages container and its children visible */
          .print-container,
          .print-container * {
            visibility: visible;
          }
          /* Absolute position print container at top left */
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printFormat === 'CARD' ? `${mmWidth}mm` : '210mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
          }
          /* Hide layout components completely from document flow */
          div.h-screen > div.w-64,
          div.h-14,
          header,
          nav,
          aside,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
          .print-page-card {
            display: block !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: ${mmWidth}mm !important;
            height: ${mmHeight}mm !important;
            box-sizing: content-box !important;
            overflow: hidden !important;
          }
          html, body {
            width: ${printFormat === 'CARD' ? `${mmWidth}mm` : '210mm'} !important;
            height: ${printFormat === 'CARD' ? `${mmHeight}mm` : '297mm'} !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
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
