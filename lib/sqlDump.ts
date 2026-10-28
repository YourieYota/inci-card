// Génération d'instructions SQL INSERT à partir de lignes Prisma (export SQL et kit terrain)

export const toSqlValue = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
};

export const generateTableInserts = (tableName: string, rows: any[]): string => {
  if (!rows || rows.length === 0) return `-- No records for table "${tableName}"\n\n`;
  const lines: string[] = [`-- ============================================================`, `-- Table: "${tableName}" (${rows.length} rows)`, `-- ============================================================`];

  const colSet = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
  const cols = Array.from(colSet);
  const colList = cols.map(c => `"${c}"`).join(', ');

  rows.forEach(row => {
    const values = cols.map(c => toSqlValue(row[c])).join(', ');
    lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
  });

  return lines.join('\n') + '\n\n';
};
