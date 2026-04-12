import * as XLSX from "xlsx";

/**
 * Detect file format and return CSV text.
 * - If CSV: return text as-is
 * - If Excel (.xlsx, .xls): read with SheetJS and convert first sheet to CSV
 */
export function fileToCSV(fileName: string, content: string | ArrayBuffer): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || ext === "txt") {
    // Already text
    return typeof content === "string" ? content : new TextDecoder("utf-8").decode(content);
  }

  // Excel format
  const buffer = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Convert to CSV with semicolon delimiter to match existing parsers
  return XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
}

/**
 * Read a File object and return CSV text regardless of format.
 */
export async function readFileAsCSV(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || ext === "txt") {
    return await file.text();
  }

  // Excel: read as ArrayBuffer
  const buffer = await file.arrayBuffer();
  return fileToCSV(file.name, buffer);
}

/**
 * Read a File as ArrayBuffer (for cases that still need raw buffer).
 */
export async function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}
