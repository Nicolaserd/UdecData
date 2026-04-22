import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      principal, admisiones, bienestar, comunicaciones,
      planta, biblioclic, sedes, universidad,
    ] = await Promise.all([
      prisma.encuestaSatisfaccion.findMany({           orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { sede: "asc" }, { area: "asc" }] }),
      prisma.satisfaccionAdmisionesRegistro.findMany({ orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionBienestar.findMany({          orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionComunicaciones.findMany({     orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionPlantaFisica.findMany({       orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionBiblioclic.findMany({         orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionSede.findMany({               orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
      prisma.satisfaccionUniversidad.findMany({        orderBy: [{ anio: "desc" }, { periodo_academico: "asc" }, { unidad_regional: "asc" }] }),
    ]);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(principal.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Sede": r.sede, "Área": r.area,
      "Nivel": r.nivel_satisfaccion ?? "", "Nivel numérico": r.nivel_numerico ?? "",
      "Comentarios": r.comentarios ?? "", "Año": r.anio, "Periodo": r.periodo_academico,
    }))), "Principal");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(admisiones.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Satisfacción general": r.satisfaccion_general ?? "",
      "Grados y títulos": r.grados_titulos ?? "",
      "Proceso de inscripción": r.proceso_inscripcion ?? "",
      "Solicitud documentos": r.solicitud_documentos ?? "",
      "Respuesta solicitud": r.respuesta_solicitud ?? "",
      "Confianza servidores": r.confianza_servidores ?? "",
      "Tiempo de respuesta": r.tiempo_respuesta ?? "",
      "Información canales": r.info_canales ?? "",
      "Facilidad de acceso": r.facilidad_acceso ?? "",
      "Amabilidad y respeto": r.amabilidad_respeto ?? "",
      "Nivel edificios": r.nivel_edificios ?? "",
      "Nivel plataformas": r.nivel_plataformas ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Admisiones y Registro");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bienestar.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Bienestar Universitario": r.bienestar_universitario ?? "",
      "Respuesta solicitud": r.respuesta_solicitud ?? "",
      "Confianza servidores": r.confianza_servidores ?? "",
      "Tiempo de respuesta": r.tiempo_respuesta ?? "",
      "Información canales": r.info_canales ?? "",
      "Facilidad de acceso": r.facilidad_acceso ?? "",
      "Amabilidad y respeto": r.amabilidad_respeto ?? "",
      "Nivel edificios": r.nivel_edificios ?? "",
      "Nivel plataformas": r.nivel_plataformas ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Bienestar Universitario");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comunicaciones.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Comunicaciones": r.comunicaciones ?? "",
      "Tono comunicación": r.tono_comunicacion ?? "",
      "Canales de uso": r.canales_uso ?? "",
      "Tono redes sociales": r.tono_redes ?? "",
      "Tono emocional": r.tono_emocion ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Comunicaciones");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planta.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Estructura administrativa": r.estructura_administrativa ?? "",
      "Campus verde": r.campus_verde ?? "",
      "Señalización emergencia": r.senalizacion_emergencia ?? "",
      "Estructura áreas comunes": r.estructura_areas_comunes ?? "",
      "Protocolos bioseguridad": r.protocolos_bioseguridad ?? "",
      "Servicio energía": r.servicio_energia ?? "",
      "Red hidrosanitaria": r.red_hidrosanitaria ?? "",
      "Estructura académica": r.estructura_academica ?? "",
      "Seguridad física": r.seguridad_fisica ?? "",
      "Pintura espacios": r.pintura_espacios ?? "",
      "Estructura estacionamiento": r.estructura_estacionamiento ?? "",
      "Contenedores residuos": r.contenedores_residuos ?? "",
      "Zonas verdes": r.zonas_verdes ?? "",
      "Promedio (1-5)": r.promedio ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Planta Física");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(biblioclic.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Tipo de servicio": r.tipo_servicio ?? "",
      "Biblioclic": r.biblioclic ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Biblioclic");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sedes.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Sede satisfacción": r.sede_satisfaccion ?? "",
      "Respuesta solicitud": r.respuesta_solicitud ?? "",
      "Confianza servidores": r.confianza_servidores ?? "",
      "Tiempo de respuesta": r.tiempo_respuesta ?? "",
      "Información canales": r.info_canales ?? "",
      "Facilidad de acceso": r.facilidad_acceso ?? "",
      "Amabilidad y respeto": r.amabilidad_respeto ?? "",
      "Nivel edificios": r.nivel_edificios ?? "",
      "Nivel plataformas": r.nivel_plataformas ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Sede - Seccional - Extensión");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(universidad.map((r) => ({
      "ID respuesta": r.respuesta_id, "Rol": r.rol, "Unidad regional": r.unidad_regional,
      "Año": r.anio, "Periodo": r.periodo_academico,
      "Universidad de Cundinamarca": r.universidad ?? "",
      "Respuesta solicitud": r.respuesta_solicitud ?? "",
      "Confianza servidores": r.confianza_servidores ?? "",
      "Tiempo de respuesta": r.tiempo_respuesta ?? "",
      "Información canales": r.info_canales ?? "",
      "Facilidad de acceso": r.facilidad_acceso ?? "",
      "Amabilidad y respeto": r.amabilidad_respeto ?? "",
      "Nivel edificios": r.nivel_edificios ?? "",
      "Nivel plataformas": r.nivel_plataformas ?? "",
      "Comentarios": r.comentarios ?? "",
    }))), "Universidad de Cundinamarca");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="encuesta_satisfaccion_completo.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
