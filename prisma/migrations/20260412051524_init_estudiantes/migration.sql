-- CreateTable
CREATE TABLE "estudiantes" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidad_regional" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "nivel_academico" TEXT NOT NULL,
    "programa_academico" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "año" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_categoria_unidad_regional_nivel_nivel_academico_key" ON "estudiantes"("categoria", "unidad_regional", "nivel", "nivel_academico", "programa_academico", "año", "periodo");
