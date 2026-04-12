"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface ExistingCategory {
  categoria: string;
  registros: number;
}

interface ConfirmOverwriteProps {
  anio: number;
  periodo: string;
  existingCategories: ExistingCategory[];
  allCategories: string[];
  onConfirm: (selectedCategories: string[]) => void;
  onCancel: () => void;
}

export function ConfirmOverwrite({
  anio,
  periodo,
  existingCategories,
  allCategories,
  onConfirm,
  onCancel,
}: ConfirmOverwriteProps) {
  const existingMap = new Map(
    existingCategories.map((c) => [c.categoria, c.registros])
  );

  // Categories that already exist start unchecked, new ones start checked
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const cat of allCategories) {
      initial[cat] = !existingMap.has(cat);
    }
    return initial;
  });

  const toggleCategory = (cat: string) => {
    setSelected((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleConfirm = () => {
    const selectedCategories = allCategories.filter((cat) => selected[cat]);
    if (selectedCategories.length === 0) {
      onCancel();
      return;
    }
    onConfirm(selectedCategories);
  };

  const selectAll = () => {
    const updated: Record<string, boolean> = {};
    for (const cat of allCategories) updated[cat] = true;
    setSelected(updated);
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-800 text-lg">
          Datos existentes detectados
        </CardTitle>
        <CardDescription className="text-amber-700">
          Ya existen datos para el periodo{" "}
          <strong>
            {anio} - {periodo}
          </strong>
          . Selecciona qué categorías deseas reemplazar en la base de datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {allCategories.map((cat) => {
            const existingCount = existingMap.get(cat);
            const hasExisting = existingCount !== undefined;

            return (
              <label
                key={cat}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected[cat]
                    ? hasExisting
                      ? "bg-amber-100 border-amber-400"
                      : "bg-green-50 border-green-300"
                    : "bg-white border-gray-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected[cat]}
                  onChange={() => toggleCategory(cat)}
                  className="w-4 h-4 rounded accent-green-700"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{cat}</span>
                  {hasExisting ? (
                    <span className="ml-2 text-sm text-amber-700">
                      ({existingCount} registros existentes - se reemplazarán)
                    </span>
                  ) : (
                    <span className="ml-2 text-sm text-green-600">
                      (nuevo - no hay datos previos)
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleConfirm}
            className="bg-green-700 hover:bg-green-800"
          >
            Confirmar y procesar
          </Button>
          <Button onClick={selectAll} variant="outline">
            Seleccionar todas
          </Button>
          <Button onClick={onCancel} variant="ghost">
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
