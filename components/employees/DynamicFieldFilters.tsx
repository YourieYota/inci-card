'use client';

import React, { useMemo } from 'react';
import { Employee } from '@prisma/client';
import { Plus, SlidersHorizontal, X } from 'lucide-react';

export interface DynamicFieldFilter {
  id: string;
  field: string;
  value: string;
}

// Case- and accent-insensitive comparison key
const normalizeValue = (val: unknown) =>
  String(val ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const getDynamicData = (emp: Employee): Record<string, any> | null => {
  const data = emp.dynamicData;
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, any>) : null;
};

// Excel headers can differ in case/spacing between imports: read the value whatever the key's spelling
const readField = (data: Record<string, any>, field: string) => {
  const target = field.trim().toLowerCase();
  const key = Object.keys(data).find((k) => k.trim().toLowerCase() === target);
  return key !== undefined ? data[key] : undefined;
};

/**
 * Distinct values per dynamic field, with how many employees carry each one.
 * Keys starting with "_" are internal settings (photo framing...), not imported columns.
 */
export function useDynamicFieldValues(employees: Employee[]) {
  return useMemo(() => {
    const fields = new Map<string, { label: string; values: Map<string, { label: string; count: number }> }>();
    for (const emp of employees) {
      const data = getDynamicData(emp);
      if (!data) continue;
      for (const [key, raw] of Object.entries(data)) {
        if (!key.trim() || key.startsWith('_')) continue;
        const fieldKey = key.trim().toLowerCase();
        let field = fields.get(fieldKey);
        if (!field) {
          field = { label: key.trim(), values: new Map() };
          fields.set(fieldKey, field);
        }
        const label = String(raw ?? '').trim();
        if (!label) continue;
        const norm = normalizeValue(label);
        const existing = field.values.get(norm);
        if (existing) existing.count++;
        else field.values.set(norm, { label, count: 1 });
      }
    }
    return new Map(
      Array.from(fields.values())
        .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
        .map((f) => [
          f.label,
          Array.from(f.values.entries())
            .map(([norm, v]) => ({ norm, ...v }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true })),
        ])
    );
  }, [employees]);
}

export type DynamicFieldValues = ReturnType<typeof useDynamicFieldValues>;

/**
 * A value picked from the suggestions matches exactly ("Promotion 6" must not match "Promotion 61");
 * free text matches as "contains". Filters without a field or value are ignored; all others must match.
 */
export function matchesDynamicFilters(emp: Employee, filters: DynamicFieldFilter[], fieldValues: DynamicFieldValues) {
  const active = filters.filter((f) => f.field && f.value.trim());
  if (active.length === 0) return true;
  const data = getDynamicData(emp);
  if (!data) return false;
  return active.every((f) => {
    const wanted = normalizeValue(f.value);
    const actual = normalizeValue(readField(data, f.field));
    const isKnownValue = fieldValues.get(f.field)?.some((v) => v.norm === wanted);
    return isKnownValue ? actual === wanted : actual.includes(wanted);
  });
}

interface DynamicFieldFiltersProps {
  filters: DynamicFieldFilter[];
  onChange: (filters: DynamicFieldFilter[]) => void;
  fieldValues: DynamicFieldValues;
}

export default function DynamicFieldFilters({ filters, onChange, fieldValues }: DynamicFieldFiltersProps) {
  const fieldNames = Array.from(fieldValues.keys());

  const updateFilter = (id: string, patch: Partial<DynamicFieldFilter>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFilter = () => {
    // Default to the first field not filtered yet
    const used = new Set(filters.map((f) => f.field));
    const field = fieldNames.find((name) => !used.has(name)) || '';
    onChange([...filters, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, field, value: '' }]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtres
      </span>

      {filters.map((f) => {
        const values = fieldValues.get(f.field) || [];
        const listId = `dyn-filter-values-${f.id}`;
        return (
          <div
            key={f.id}
            className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800/60 rounded-xl"
          >
            <select
              value={f.field}
              onChange={(e) => updateFilter(f.id, { field: e.target.value, value: '' })}
              className="max-w-[160px] px-2 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-slate-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              title="Champ à filtrer"
            >
              {!f.field && <option value="">Choisir un champ</option>}
              {fieldNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="text"
              list={listId}
              value={f.value}
              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
              placeholder={f.field ? 'Valeur...' : 'Choisissez un champ'}
              disabled={!f.field}
              autoFocus={!f.value}
              className="w-40 px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
            />
            <datalist id={listId}>
              {values.map((v) => (
                <option key={v.norm} value={v.label}>{`${v.count} employé${v.count > 1 ? 's' : ''}`}</option>
              ))}
            </datalist>
            <button
              onClick={() => onChange(filters.filter((x) => x.id !== f.id))}
              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
              title="Retirer ce filtre"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <button
        onClick={addFilter}
        className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl text-xs font-bold transition"
      >
        <Plus className="w-3.5 h-3.5" />
        Filtre
      </button>

      {filters.length > 1 && (
        <button
          onClick={() => onChange([])}
          className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition"
        >
          Tout effacer
        </button>
      )}
    </div>
  );
}
