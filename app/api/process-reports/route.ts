import { NextRequest, NextResponse } from "next/server";
import { parseMatriculados } from "@/lib/parsers/parse-matriculados";
import { parseAdmitidos } from "@/lib/parsers/parse-admitidos";
import { parsePrimiparos } from "@/lib/parsers/parse-primiparos";
import { parseInscritos } from "@/lib/parsers/parse-inscritos";
import { parseGraduados } from "@/lib/parsers/parse-graduados";
import { parseEstudiantesHistorico } from "@/lib/parsers/parse-estudiantes-historico";
import { aggregateStudents } from "@/lib/aggregation/aggregate-students";
import { generateEstudiantesXlsx } from "@/lib/export/generate-xlsx";
import { saveEstudiantes } from "@/lib/supabase/save-estudiantes";
import { readFileAsCSV } from "@/lib/parsers/read-file";
import { NormalizedStudentRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const matriculadosFile = formData.get("matriculados") as File | null;
    const admitidosFile = formData.get("admitidos") as File | null;
    const primiparosFile = formData.get("primiparos") as File | null;
    const inscritosFile = formData.get("inscritos") as File | null;
    const graduadosFile = formData.get("graduados") as File | null;
    const estudiantesFile = formData.get("estudiantes") as File | null;

    if (
      !matriculadosFile &&
      !admitidosFile &&
      !primiparosFile &&
      !inscritosFile &&
      !graduadosFile
    ) {
      return NextResponse.json(
        { error: "Se requiere al menos un archivo de reporte" },
        { status: 400 }
      );
    }

    const allRows: NormalizedStudentRow[] = [];
    const allWarnings: string[] = [];

    // Solo procesar los archivos que fueron enviados
    if (matriculadosFile) {
      const text = await readFileAsCSV(matriculadosFile);
      const result = parseMatriculados(text);
      allRows.push(...result.rows);
      allWarnings.push(...result.warnings);
    }

    if (admitidosFile) {
      const text = await readFileAsCSV(admitidosFile);
      const result = parseAdmitidos(text);
      allRows.push(...result.rows);
      allWarnings.push(...result.warnings);
    }

    if (primiparosFile) {
      const text = await readFileAsCSV(primiparosFile);
      const result = parsePrimiparos(text);
      allRows.push(...result.rows);
      allWarnings.push(...result.warnings);
    }

    if (inscritosFile) {
      const text = await readFileAsCSV(inscritosFile);
      const result = parseInscritos(text);
      allRows.push(...result.rows);
      allWarnings.push(...result.warnings);
    }

    if (graduadosFile) {
      const text = await readFileAsCSV(graduadosFile);
      const result = parseGraduados(text);
      allRows.push(...result.rows);
      allWarnings.push(...result.warnings);
    }

    // Parse historical data if provided
    let historico;
    if (estudiantesFile) {
      const estudiantesBuffer = await estudiantesFile.arrayBuffer();
      const parsed = parseEstudiantesHistorico(estudiantesBuffer);
      historico = parsed.rows;
      allWarnings.push(...parsed.warnings);
    }

    // Aggregate new data, merging with historical if available
    const aggregated = aggregateStudents(allRows, historico);

    // Get allowed categories from form data
    const allowedCategoriesRaw = formData.get("allowedCategories") as string | null;
    const allowedCategories = allowedCategoriesRaw
      ? new Set<string>(JSON.parse(allowedCategoriesRaw))
      : undefined;

    // Save to Supabase
    const saveResult = await saveEstudiantes(aggregated, allowedCategories);
    if (!saveResult.success) {
      allWarnings.push(`Supabase: ${saveResult.error}`);
    }

    // Generate XLSX
    const xlsxBuffer = generateEstudiantesXlsx(aggregated);

    const response = new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ESTUDIANTES.xlsx"',
        "X-Total-Processed": String(allRows.length),
        "X-Total-Aggregated": String(aggregated.length),
        "X-Warnings": JSON.stringify(allWarnings),
        "X-Supabase-Saved": String(saveResult.success),
        "X-Supabase-Saved-Count": String(saveResult.saved),
        "X-Supabase-Skipped-Count": String(saveResult.skipped),
      },
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error procesando archivos: ${message}` },
      { status: 500 }
    );
  }
}
