const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a stored date as JJ/MM/AAAA, or returns null if it is not a date.
 * The Excel import already stores dates as "JJ/MM/AAAA": these strings must be read
 * day-first, because `new Date("05/12/1990")` reads them month-first (12 May → 05/12 becomes 12/05).
 */
export function formatDateFr(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw === 'string') {
    const s = raw.trim();
    const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (dmy) {
      let year = dmy[3];
      if (year.length === 2) year = (parseInt(year, 10) > 30 ? '19' : '20') + year;
      return `${pad(parseInt(dmy[1], 10))}/${pad(parseInt(dmy[2], 10))}/${year}`;
    }
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
    if (iso && !s.includes('T')) {
      return `${pad(parseInt(iso[3], 10))}/${pad(parseInt(iso[2], 10))}/${iso[1]}`;
    }
    if (!iso) return null; // free text that only happens to start with digits: leave it alone
  }

  const d = raw instanceof Date ? raw : new Date(raw as string | number);
  if (isNaN(d.getTime())) return null;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
