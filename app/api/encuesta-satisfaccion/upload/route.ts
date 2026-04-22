import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  AREAS, COL_ID, COL_ROL, COL_SEDE,
  normalizeRowKeys, isYes, getNivel, getComentarios,
  getByPrefix, normKey,
} from "@/lib/parsers/encuesta-satisfaccion";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file    = formData.get("file") as File | null;
    const anio    = Number(formData.get("anio") ?? 0);
    const periodo = String(formData.get("periodo_academico") ?? "").trim().toUpperCase();

    if (!file)   return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (!anio)   return NextResponse.json({ error: "Falta año" }, { status: 400 });
    if (periodo !== "IPA" && periodo !== "IIPA")
      return NextResponse.json({ error: "Periodo académico debe ser IPA o IIPA" }, { status: 400 });

    const buffer  = Buffer.from(await file.arrayBuffer());
    const wb      = XLSX.read(buffer, { type: "buffer" });
    const ws      = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    if (rawRows.length === 0)
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });

    const principal:     Prisma.EncuestaSatisfaccionCreateManyInput[]          = [];
    const admisiones:    Prisma.SatisfaccionAdmisionesRegistroCreateManyInput[] = [];
    const bienestar:     Prisma.SatisfaccionBienestarCreateManyInput[]          = [];
    const comunicaciones:Prisma.SatisfaccionComunicacionesCreateManyInput[]     = [];
    const planta:        Prisma.SatisfaccionPlantaFisicaCreateManyInput[]       = [];
    const biblioclic:    Prisma.SatisfaccionBiblioclicCreateManyInput[]         = [];
    const sedes:         Prisma.SatisfaccionSedeCreateManyInput[]               = [];
    const universidad:   Prisma.SatisfaccionUniversidadCreateManyInput[]        = [];

    for (const rawRow of rawRows) {
      const row = normalizeRowKeys(rawRow);

      const idRaw = getByPrefix(row, COL_ID);
      if (idRaw == null) continue;
      const respuesta_id = Number(idRaw);
      if (!respuesta_id) continue;

      const sede = (getByPrefix(row, COL_SEDE) != null ? String(getByPrefix(row, COL_SEDE)).trim() : null) ?? "Sin sede";
      const rol  = (getByPrefix(row, COL_ROL)  != null ? String(getByPrefix(row, COL_ROL)).trim()  : null) ?? "Sin rol";

      const base = { respuesta_id, rol, unidad_regional: sede, anio, periodo_academico: periodo };

      for (const a of AREAS) {
        if (a.triggerCol && !isYes(getByPrefix(row, a.triggerCol))) continue;

        const { text: nivelText, num: nivelNum } = getNivel(row, a);
        const comentarios = getComentarios(row, a);
        if (nivelText == null && comentarios == null) continue;

        principal.push({
          respuesta_id,
          rol,
          sede,
          area: a.area,
          nivel_satisfaccion: nivelText,
          nivel_numerico:     nivelNum,
          comentarios,
          anio,
          periodo_academico: periodo,
        });

        const g = (col: string) => {
          const v = getByPrefix(row, col);
          return v != null && v !== "" ? String(v).trim() : null;
        };

        switch (a.exception) {
          case "admisiones":
            admisiones.push({
              ...base,
              satisfaccion_general:  g("Satisfacción general con la oficina"),
              grados_titulos:        g("Grados y títulos académicos"),
              proceso_inscripcion:   g("Proceso de inscripción, selección y admisión"),
              solicitud_documentos:  g("Solicitud de documentos"),
              respuesta_solicitud:   g("¿Qué tan satisfecho se encuentra con la respuesta proporcionada por la dependencia a su solicitud?"),
              confianza_servidores:  g("¿Qué tan satisfecho se encuentra con la confianza generada por los servidores que lo han atendido?"),
              tiempo_respuesta:      g("¿Qué tan satisfecho se encuentra con el tiempo de respuesta que tomó la dependencia o área que le atendió?"),
              info_canales:          g("¿Qué tan satisfecho se encuentra con la información disponible en diversos canales"),
              facilidad_acceso:      g("¿Qué tan satisfecho se encuentra con la facilidad para acceder a los servicios que presta la oficina"),
              amabilidad_respeto:    g("¿Qué tan satisfecho se encuentra con la amabilidad y el respeto brindado por el servidor"),
              nivel_edificios:       g("¿Cuál es el nivel de satisfacción con los edificios y las instalaciones donde actualmente la dependencia"),
              nivel_plataformas:     g("¿Cuál es el nivel de satisfacción con las plataformas con las que cuenta actualmente la dependencia"),
              comentarios:           g("¿Qué aspectos considera que debe mejorar esta dependencia?3"),
            });
            break;
          case "bienestar":
            bienestar.push({
              ...base,
              bienestar_universitario: g("Bienestar Universitario"),
              respuesta_solicitud:     g("¿Qué tan satisfecho se encuentra con la respuesta proporcionada por la dependencia a su solicitud?2"),
              confianza_servidores:    g("¿Qué tan satisfecho se encuentra con la confianza generada por los servidores que lo han atendido?2"),
              tiempo_respuesta:        g("¿Qué tan satisfecho se encuentra con el tiempo de respuesta que tomó la dependencia o área que le atendió?2"),
              info_canales:            g("¿Qué tan satisfecho se encuentra con la información disponible en diversos canales como página web, correo institucional y teléfono, entre otros?2"),
              facilidad_acceso:        g("¿Qué tan satisfecho se encuentra con la facilidad para acceder a los servicios que presta la oficina y a la respuesta dada por la dependencia ante su trámite o solicitud?2"),
              amabilidad_respeto:      g("¿Qué tan satisfecho se encuentra con la amabilidad y el respeto brindado por el servidor que lo atendió en los servicios y/o trámites realizados con esta dependencia?2"),
              nivel_edificios:         g("¿Cuál es el nivel de satisfacción con los edificios y las instalaciones donde actualmente la dependencia presta los servicios y/o trámites que se requieren?2"),
              nivel_plataformas:       g("¿Cuál es el nivel de satisfacción con las plataformas con las que cuenta actualmente la dependencia para la prestación de los servicios y/o trámites que se requieren?2"),
              comentarios:             g("¿Qué aspectos considera que debe mejorar esta dependencia?5"),
            });
            break;
          case "comunicaciones":
            comunicaciones.push({
              ...base,
              comunicaciones:    g("Comunicaciones"),
              tono_comunicacion: g("Considera que el tono de la comunicación"),
              canales_uso:       g("¿De los siguientes canales, cuál usa para enterarse"),
              tono_redes:        g("¿Consideras que el tono en el que están redactados los mensajes por redes sociales"),
              tono_emocion:      g("El tono emitido en los mensajes y contenidos de la oficina de comunicaciones te hacen sentir"),
              comentarios:       g("¿Qué aspectos considera que debe mejorar la universidad en cuanto a sus comunicaciones?"),
            });
            break;
          case "planta_fisica":
            planta.push({
              ...base,
              estructura_administrativa:  g("Estructura física del área administrativa"),
              campus_verde:               g("Proceso gradual de transformación a campus verde"),
              senalizacion_emergencia:    g("Señalización de emergencia en la Universidad"),
              estructura_areas_comunes:   g("Estructura física en las áreas comunes"),
              protocolos_bioseguridad:    g("Implementación de los protocolos de bioseguridad"),
              servicio_energia:           g("Servicio de energía eléctrica"),
              red_hidrosanitaria:         g("Red hidrosanitaria"),
              estructura_academica:       g("Estructura física del área académica"),
              seguridad_fisica:           g("Seguridad física"),
              pintura_espacios:           g("Pintura de los espacios físicos"),
              estructura_estacionamiento: g("Estructura física en las zonas de estacionamiento"),
              contenedores_residuos:      g("Disponibilidad de contenedores o dispositivos para almacenamiento temporal de residuos"),
              zonas_verdes:               g("Zonas verdes"),
              promedio:                   nivelNum,
              comentarios:                g("¿Qué mejoras cree que se deben hacer a la planta física"),
            });
            break;
          case "biblioclic":
            biblioclic.push({
              ...base,
              tipo_servicio: g("¿Qué tipo de servicio solicitó?"),
              biblioclic:    g("Biblioclic"),
              comentarios:   g("¿Qué aspectos considera que se deben mejorar el servicio Biblioclic?"),
            });
            break;
          case "sede":
            sedes.push({
              ...base,
              sede_satisfaccion:    g("Sede/seccional/extensión"),
              respuesta_solicitud:  g("¿Qué tan satisfecho se encuentra con la respuesta proporcionada por los servidores de la sede"),
              confianza_servidores: g("¿Qué tan satisfecho se encuentra con la confianza generada por los servidores de la sede"),
              tiempo_respuesta:     g("¿Qué tan satisfecho se encuentra con el tiempo de respuesta que tomaron los funcionarios en la sede"),
              info_canales:         g("¿Qué tan satisfecho se encuentra con la información disponible en diversos canales como página web, correo institucional y teléfono, entre otros?3"),
              facilidad_acceso:     g("¿Qué tan satisfecho se encuentra con la facilidad para acceder a los servicios que presta la sede"),
              amabilidad_respeto:   g("¿Qué tan satisfecho se encuentra con la amabilidad y el respeto brindado por los servidores de la sede"),
              nivel_edificios:      g("¿Cuál es el nivel de satisfacción con los edificios y las instalaciones de la sede"),
              nivel_plataformas:    g("¿Cuál es el nivel de satisfacción con las plataformas con las que cuenta actualmente la sede"),
              comentarios:          g("¿Qué aspectos considera que debe mejorar en general la sede/seccional/extensión"),
            });
            break;
          case "universidad":
            universidad.push({
              ...base,
              universidad:          g("Universidad de Cundinamarca"),
              respuesta_solicitud:  g("¿Qué tan satisfecho se encuentra con la respuesta proporcionada por los servidores de la universidad"),
              confianza_servidores: g("¿Qué tan satisfecho se encuentra con la confianza generada por los servidores de la universidad"),
              tiempo_respuesta:     g("¿Qué tan satisfecho se encuentra con el tiempo de respuesta que tomó la universidad"),
              info_canales:         g("¿Qué tan satisfecho se encuentra con la información disponible en diversos canales como página web, correo institucional y teléfono, entre otros?4"),
              facilidad_acceso:     g("¿Qué tan satisfecho se encuentra con la facilidad para acceder a los servicios que presta la universidad"),
              amabilidad_respeto:   g("¿Qué tan satisfecho se encuentra con la amabilidad y el respeto brindado por los servidores de la universidad"),
              nivel_edificios:      g("¿Cuál es el nivel de satisfacción con los edificios y las instalaciones donde actualmente la universidad"),
              nivel_plataformas:    g("¿Cuál es el nivel de satisfacción con las plataformas con las que cuenta actualmente la universidad"),
              comentarios:          g("¿Qué aspectos considera que debe mejorar en general la UCundinamarca?"),
            });
            break;
        }
      }
    }

    if (principal.length === 0)
      return NextResponse.json({ error: "No se encontraron registros válidos en el archivo" }, { status: 400 });

    const where = { anio, periodo_academico: periodo };
    const [delP, delA, delB, delC, delPF, delBib, delS, delU] = await prisma.$transaction([
      prisma.encuestaSatisfaccion.deleteMany({ where }),
      prisma.satisfaccionAdmisionesRegistro.deleteMany({ where }),
      prisma.satisfaccionBienestar.deleteMany({ where }),
      prisma.satisfaccionComunicaciones.deleteMany({ where }),
      prisma.satisfaccionPlantaFisica.deleteMany({ where }),
      prisma.satisfaccionBiblioclic.deleteMany({ where }),
      prisma.satisfaccionSede.deleteMany({ where }),
      prisma.satisfaccionUniversidad.deleteMany({ where }),
    ]);

    const chunk = 500;
    const ins = async <T>(rows: T[], fn: (c: T[]) => Promise<unknown>) => {
      for (let i = 0; i < rows.length; i += chunk) await fn(rows.slice(i, i + chunk));
    };

    await ins(principal,      (c) => prisma.encuestaSatisfaccion.createMany({ data: c }));
    if (admisiones.length)     await ins(admisiones,     (c) => prisma.satisfaccionAdmisionesRegistro.createMany({ data: c }));
    if (bienestar.length)      await ins(bienestar,      (c) => prisma.satisfaccionBienestar.createMany({ data: c }));
    if (comunicaciones.length) await ins(comunicaciones, (c) => prisma.satisfaccionComunicaciones.createMany({ data: c }));
    if (planta.length)         await ins(planta,         (c) => prisma.satisfaccionPlantaFisica.createMany({ data: c }));
    if (biblioclic.length)     await ins(biblioclic,     (c) => prisma.satisfaccionBiblioclic.createMany({ data: c }));
    if (sedes.length)          await ins(sedes,          (c) => prisma.satisfaccionSede.createMany({ data: c }));
    if (universidad.length)    await ins(universidad,    (c) => prisma.satisfaccionUniversidad.createMany({ data: c }));

    return NextResponse.json({
      message: `Se cargaron ${principal.length} registros para ${periodo} ${anio}.`,
      inserted: principal.length,
      detalles: {
        admisiones: admisiones.length, bienestar: bienestar.length,
        comunicaciones: comunicaciones.length, planta_fisica: planta.length,
        biblioclic: biblioclic.length, sedes: sedes.length, universidad: universidad.length,
      },
      deleted: { principal: delP.count, admisiones: delA.count, bienestar: delB.count,
        comunicaciones: delC.count, planta_fisica: delPF.count, biblioclic: delBib.count,
        sedes: delS.count, universidad: delU.count },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
