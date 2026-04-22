-- CreateTable
CREATE TABLE "encuesta_satisfaccion_universidad_cundinamarca" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "sede" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "nivel_satisfaccion" TEXT,
    "nivel_numerico" DOUBLE PRECISION,
    "comentarios" TEXT,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encuesta_satisfaccion_universidad_cundinamarca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_admisiones_registro" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "satisfaccion_general" TEXT,
    "grados_titulos" TEXT,
    "proceso_inscripcion" TEXT,
    "solicitud_documentos" TEXT,
    "respuesta_solicitud" TEXT,
    "confianza_servidores" TEXT,
    "tiempo_respuesta" TEXT,
    "info_canales" TEXT,
    "facilidad_acceso" TEXT,
    "amabilidad_respeto" TEXT,
    "nivel_edificios" TEXT,
    "nivel_plataformas" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_admisiones_registro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_bienestar_universitario" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "bienestar_universitario" TEXT,
    "respuesta_solicitud" TEXT,
    "confianza_servidores" TEXT,
    "tiempo_respuesta" TEXT,
    "info_canales" TEXT,
    "facilidad_acceso" TEXT,
    "amabilidad_respeto" TEXT,
    "nivel_edificios" TEXT,
    "nivel_plataformas" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_bienestar_universitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_comunicaciones" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "comunicaciones" TEXT,
    "tono_comunicacion" TEXT,
    "canales_uso" TEXT,
    "tono_redes" TEXT,
    "tono_emocion" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_comunicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_planta_fisica" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "estructura_administrativa" TEXT,
    "campus_verde" TEXT,
    "senalizacion_emergencia" TEXT,
    "estructura_areas_comunes" TEXT,
    "protocolos_bioseguridad" TEXT,
    "servicio_energia" TEXT,
    "red_hidrosanitaria" TEXT,
    "estructura_academica" TEXT,
    "seguridad_fisica" TEXT,
    "pintura_espacios" TEXT,
    "estructura_estacionamiento" TEXT,
    "contenedores_residuos" TEXT,
    "zonas_verdes" TEXT,
    "promedio" DOUBLE PRECISION,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_planta_fisica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_biblioclic" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "tipo_servicio" TEXT,
    "biblioclic" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_biblioclic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_sede_seccional" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "sede_satisfaccion" TEXT,
    "respuesta_solicitud" TEXT,
    "confianza_servidores" TEXT,
    "tiempo_respuesta" TEXT,
    "info_canales" TEXT,
    "facilidad_acceso" TEXT,
    "amabilidad_respeto" TEXT,
    "nivel_edificios" TEXT,
    "nivel_plataformas" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_sede_seccional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaccion_universidad_cundinamarca" (
    "id" SERIAL NOT NULL,
    "respuesta_id" INTEGER NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo_academico" TEXT NOT NULL,
    "universidad" TEXT,
    "respuesta_solicitud" TEXT,
    "confianza_servidores" TEXT,
    "tiempo_respuesta" TEXT,
    "info_canales" TEXT,
    "facilidad_acceso" TEXT,
    "amabilidad_respeto" TEXT,
    "nivel_edificios" TEXT,
    "nivel_plataformas" TEXT,
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaccion_universidad_cundinamarca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "encuesta_satisfaccion_universidad_cundinamarca_año_periodo_idx" ON "encuesta_satisfaccion_universidad_cundinamarca"("año", "periodo_academico");

-- CreateIndex
CREATE INDEX "encuesta_satisfaccion_universidad_cundinamarca_sede_idx" ON "encuesta_satisfaccion_universidad_cundinamarca"("sede");

-- CreateIndex
CREATE INDEX "encuesta_satisfaccion_universidad_cundinamarca_area_idx" ON "encuesta_satisfaccion_universidad_cundinamarca"("area");
