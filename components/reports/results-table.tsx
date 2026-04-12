"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ResultsTableProps {
  data: Record<string, string | number>[];
}

export function ResultsTable({ data }: ResultsTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) return null;

  const columns = Object.keys(data[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700">
        Vista previa ({data.length} filas)
      </h3>
      <div className="border rounded-lg overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col} className="whitespace-nowrap">
                    {row[col]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
