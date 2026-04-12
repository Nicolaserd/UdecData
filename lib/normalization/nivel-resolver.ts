import {
  NIVEL_ACADEMICO_RULES,
  DEFAULT_NIVEL,
  DEFAULT_NIVEL_ACADEMICO,
} from "./canonical-data";

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function resolveNivel(programName: string): {
  nivel: string;
  nivelAcademico: string;
} {
  const normalized = stripAccents(programName).toUpperCase().trim();

  for (const rule of NIVEL_ACADEMICO_RULES) {
    if (rule.pattern.test(normalized)) {
      return { nivel: rule.nivel, nivelAcademico: rule.nivelAcademico };
    }
  }

  return { nivel: DEFAULT_NIVEL, nivelAcademico: DEFAULT_NIVEL_ACADEMICO };
}
