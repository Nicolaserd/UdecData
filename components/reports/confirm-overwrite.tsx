"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
    existingCategories.map((category) => [category.categoria, category.registros])
  );

  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const category of allCategories) {
      initial[category] = !existingMap.has(category);
    }
    return initial;
  });

  const toggleCategory = (category: string) => {
    setSelected((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleConfirm = () => {
    const selectedCategories = allCategories.filter(
      (category) => selected[category]
    );

    if (selectedCategories.length === 0) {
      onCancel();
      return;
    }

    onConfirm(selectedCategories);
  };

  const selectAll = () => {
    const updated: Record<string, boolean> = {};
    for (const category of allCategories) {
      updated[category] = true;
    }
    setSelected(updated);
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-lg text-amber-800">
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
          {allCategories.map((category) => {
            const existingCount = existingMap.get(category);
            const hasExisting = existingCount !== undefined;

            return (
              <label
                key={category}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selected[category]
                    ? hasExisting
                      ? "border-amber-400 bg-amber-100"
                      : "border-green-300 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected[category]}
                  onChange={() => toggleCategory(category)}
                  className="h-4 w-4 rounded accent-green-700"
                />

                <div className="flex-1">
                  <span className="font-medium text-gray-800">{category}</span>
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
