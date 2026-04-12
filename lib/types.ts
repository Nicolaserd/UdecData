export type Categoria = "Matriculados" | "Admitidos" | "Primiparos" | "Inscritos" | "Graduados";

export interface NormalizedStudentRow {
  categoria: Categoria;
  unidadRegional: string;
  nivel: string;
  nivelAcademico: string;
  programaAcademico: string;
  año: number;
  periodo: string; // "IPA" (semestre 1) or "IIPA" (semestre 2)
}

export interface EstudiantesRow extends NormalizedStudentRow {
  cantidad: number;
}

export interface ProcessingResult {
  data: EstudiantesRow[];
  warnings: string[];
  totalProcessed: number;
  totalAggregated: number;
}
