import { NormalizedStudentRow, EstudiantesRow } from "../types";

function makeKey(row: { categoria: string; unidadRegional: string; nivel: string; nivelAcademico: string; programaAcademico: string; año: number; periodo: string }): string {
  return [
    row.categoria,
    row.unidadRegional,
    row.nivel,
    row.nivelAcademico,
    row.programaAcademico,
    row.año,
    row.periodo,
  ].join("|");
}

/**
 * Aggregate individual student rows into grouped counts.
 * If historico is provided, merges with existing aggregated data.
 * New data for the same group key replaces the historical count.
 */
export function aggregateStudents(
  rows: NormalizedStudentRow[],
  historico?: EstudiantesRow[]
): EstudiantesRow[] {
  const groups = new Map<string, EstudiantesRow>();

  // First, load historical data
  if (historico) {
    for (const row of historico) {
      groups.set(makeKey(row), { ...row });
    }
  }

  // Aggregate new rows
  const newCounts = new Map<string, { row: NormalizedStudentRow; count: number }>();
  for (const row of rows) {
    const key = makeKey(row);
    const existing = newCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      newCounts.set(key, { row, count: 1 });
    }
  }

  // Merge: new data replaces historical for the same key
  for (const [key, { row, count }] of newCounts) {
    groups.set(key, { ...row, cantidad: count });
  }

  return Array.from(groups.values());
}
