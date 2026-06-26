import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface SimplifiedEmployee {
  id: string;
  uniqueIdentifier: string;
  enrollmentNumber: string | null;
  photoUrl: string | null;
  status: string;
  createdAt: string | Date;
  dynamicData: any;
}

/**
 * Resolves the employee's matricule from their dynamicData (case-insensitive)
 * or falls back to enrollmentNumber or uniqueIdentifier.
 */
export const resolveMatricule = (emp: SimplifiedEmployee): string => {
  const data = emp.dynamicData as Record<string, any>;
  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  if (data && typeof data === 'object') {
    const synonyms = ['matricule', 'id', 'uuid', 'code', 'identifiant', 'numéro', 'numero'];
    for (const key of Object.keys(data)) {
      if (synonyms.includes(normalize(key)) && data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== '') {
        return String(data[key]).trim();
      }
    }
  }

  if (emp.enrollmentNumber) {
    return emp.enrollmentNumber.trim();
  }

  return emp.uniqueIdentifier.trim();
};

/**
 * Converts a base64 Data URI to a Blob, or fetches standard URLs.
 */
async function getPhotoBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:image') || url.includes('base64,')) {
    // Extract base64 content
    const matches = url.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = `image/${matches[1] === 'jpg' ? 'jpeg' : matches[1]}`;
      const byteCharacters = atob(matches[2]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mime });
    }
    
    // Fallback split
    const parts = url.split(';base64,');
    if (parts.length === 2) {
      const mime = parts[0].split(':')[1] || 'image/jpeg';
      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mime });
    }
  }

  // Standard fetch for absolute or relative path URLs
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.blob();
}

/**
 * Performs client-side generation of the Laser BioQR ZIP containing
 * the data excel sheet and the photos.zip archive.
 */
export async function exportLaserBioQR(
  companyName: string,
  employees: SimplifiedEmployee[],
  selectedFields: string[],
  onProgress?: (current: number, total: number, statusText: string) => void,
  selectedDocType?: { name: string; slug: string } | null,
  selectedCategory?: { name: string; validityValue: number | null; validityUnit: string | null } | null
) {
  const mainZip = new JSZip();
  const photosZip = new JSZip();
  const zipFileNames = new Set<string>();

  const excelRows: Record<string, any>[] = [];
  const totalEmployees = employees.length;

  // 1. Fetch/compile photos and add them to Photos ZIP
  onProgress?.(0, totalEmployees, "Téléchargement et empaquetage des photos...");

  for (let i = 0; i < totalEmployees; i++) {
    const emp = employees[i];
    const matricule = resolveMatricule(emp);
    let photoFilename = "Non disponible";

    if (emp.photoUrl) {
      try {
        onProgress?.(i, totalEmployees, `Téléchargement de la photo pour ${matricule} (${i + 1}/${totalEmployees})...`);
        const blob = await getPhotoBlob(emp.photoUrl);
        
        // Determine extension from url/data or default to jpg
        let extension = "jpg";
        if (emp.photoUrl.startsWith('data:image')) {
          const matches = emp.photoUrl.match(/^data:image\/([A-Za-z-+\/]+);/);
          if (matches) {
            extension = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
          }
        } else {
          const match = emp.photoUrl.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
          if (match) {
            extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
          }
        }

        let candidateName = `${matricule}.${extension}`;
        let counter = 1;
        while (zipFileNames.has(candidateName)) {
          candidateName = `${matricule}_${counter}.${extension}`;
          counter++;
        }

        zipFileNames.add(candidateName);
        photoFilename = candidateName;

        photosZip.file(photoFilename, blob);
      } catch (err) {
        console.warn(`Failed to process photo for employee ${emp.id}:`, err);
      }
    }

    // 2. Build Excel Row Data
    const data = emp.dynamicData as Record<string, any>;
    const row: Record<string, any> = {};

    // Standard fields if selected
    if (selectedFields.includes("Numéro d'enrôlement")) {
      row["Numéro d'enrôlement"] = emp.enrollmentNumber || "En cours...";
    }
    if (selectedFields.includes("Identifiant unique")) {
      row["Identifiant unique"] = emp.uniqueIdentifier;
    }
    if (selectedFields.includes("Statut")) {
      row["Statut"] = emp.status;
    }

    if (selectedFields.includes("Type de carte") && selectedDocType) {
      row["Type de carte"] = selectedDocType.name;
    }
    if (selectedFields.includes("Catégorie") && selectedCategory) {
      row["Catégorie"] = selectedCategory.name;
    }
    if (selectedCategory && selectedCategory.validityUnit && selectedCategory.validityUnit !== 'NONE') {
      if (selectedFields.includes("Durée de validité")) {
        const valStr = selectedCategory.validityValue || 1;
        const unitStr = selectedCategory.validityUnit === 'YEAR' ? 'an(s)' : selectedCategory.validityUnit === 'MONTH' ? 'mois' : 'jour(s)';
        row["Durée de validité"] = `${valStr} ${unitStr}`;
      }
      if (selectedFields.includes("Date d'expiration")) {
        const val = selectedCategory.validityValue || 1;
        const unit = selectedCategory.validityUnit;
        const expDate = new Date();
        if (unit === 'YEAR') {
          expDate.setFullYear(expDate.getFullYear() + val);
        } else if (unit === 'MONTH') {
          expDate.setMonth(expDate.getMonth() + val);
        } else if (unit === 'DAY') {
          expDate.setDate(expDate.getDate() + val);
        }
        const day = String(expDate.getDate()).padStart(2, '0');
        const month = String(expDate.getMonth() + 1).padStart(2, '0');
        const year = expDate.getFullYear();
        row["Date d'expiration"] = `${day}/${month}/${year}`;
      }
    }

    // Excel fields next
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, val]) => {
        if (selectedFields.includes(key)) {
          // Date formatting if applicable
          const isDateKey = key.toLowerCase().trim().startsWith('date');
          const isDateVal = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
          if ((isDateKey || isDateVal) && val) {
            const dObj = new Date(val);
            if (!isNaN(dObj.getTime())) {
              const day = String(dObj.getUTCDate()).padStart(2, '0');
              const month = String(dObj.getUTCMonth() + 1).padStart(2, '0');
              const year = dObj.getUTCFullYear();
              row[key] = `${day}/${month}/${year}`;
              return;
            }
          }
          row[key] = val;
        }
      });
    }

    // Link filename in the zip
    if (selectedFields.includes("Fichier Photo")) {
      row["Fichier Photo"] = photoFilename;
    }

    excelRows.push(row);
  }

  // 3. Generate Photos ZIP blob and add it to the Main ZIP
  onProgress?.(totalEmployees, totalEmployees, "Génération de l'archive ZIP des photos...");
  const photosZipBlob = await photosZip.generateAsync({ type: 'blob' });
  mainZip.file("photos.zip", photosZipBlob);

  // 4. Generate Excel file and add to Main ZIP
  onProgress?.(totalEmployees, totalEmployees, "Génération du fichier Excel...");
  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  
  // Auto-fit column widths
  const objectMaxWidth: number[] = [];
  excelRows.forEach((row) => {
    Object.keys(row).forEach((key, idx) => {
      const val = row[key] ? String(row[key]) : "";
      const colWidth = Math.max(key.length, val.length);
      objectMaxWidth[idx] = Math.max(objectMaxWidth[idx] || 10, colWidth);
    });
  });
  worksheet["!cols"] = objectMaxWidth.map((w) => ({ wch: w + 2 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employes");
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  mainZip.file("donnees.xlsx", excelBuffer);

  // 5. Generate Main ZIP File and trigger Download
  onProgress?.(totalEmployees, totalEmployees, "Compression du dossier ZIP final...");
  const mainZipBlob = await mainZip.generateAsync({ type: 'blob' });

  const safeCompanyName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().slice(0, 10);
  const downloadName = `export_laser_${safeCompanyName}_${timestamp}.zip`;

  const url = URL.createObjectURL(mainZipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
