-- CreateTable
CREATE TABLE "satisfaccion_analisis_chunk" (
    "id" SERIAL NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "contenido" JSONB NOT NULL,
    "total_comentarios" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "proveedor_usado" TEXT,
    "intentos" JSONB NOT NULL DEFAULT '{}',
    "resultado" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satisfaccion_analisis_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_analisis_consolidado" (
    "id" SERIAL NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "parrafo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "proveedor_usado" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satisfaccion_analisis_consolidado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_analisis_informe" (
    "id" SERIAL NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "url" TEXT,
    "filename" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "total_areas" INTEGER,
    "total_chunks" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satisfaccion_analisis_informe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "satisfaccion_analisis_chunk_año_periodo_academico_area_idx" ON "satisfaccion_analisis_chunk"("año", "periodo_academico", "area");

-- CreateIndex
CREATE INDEX "satisfaccion_analisis_chunk_estado_idx" ON "satisfaccion_analisis_chunk"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaccion_analisis_chunk_año_periodo_academico_area_ord_key" ON "satisfaccion_analisis_chunk"("año", "periodo_academico", "area", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaccion_analisis_consolidado_año_periodo_academico_ar_key" ON "satisfaccion_analisis_consolidado"("año", "periodo_academico", "area");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaccion_analisis_informe_año_periodo_academico_key" ON "satisfaccion_analisis_informe"("año", "periodo_academico");
