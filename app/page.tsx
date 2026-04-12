import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const services = [
  {
    title: "Automatizar Reportes para Boletín",
    description:
      "Carga los archivos de Matriculados, Admitidos, Primíparos e Inscritos para generar el consolidado de estudiantes en formato XLSX y guardarlo en la base de datos.",
    href: "/automatizar-reportes",
    available: true,
  },
  {
    title: "Más servicios próximamente",
    description:
      "Nuevas automatizaciones y herramientas de gestión de datos estarán disponibles en futuras versiones.",
    href: "#",
    available: false,
  },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="bg-green-700 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            Universidad de Cundinamarca
          </h1>
          <p className="text-xl text-green-100">
            Plataforma de Automatización de Datos e Informes
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-8">
          Servicios Disponibles
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {services.map((service) => (
            <Card
              key={service.title}
              className={
                service.available
                  ? "hover:shadow-lg transition-shadow"
                  : "opacity-60"
              }
            >
              <CardHeader>
                <CardTitle className="text-lg">{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {service.available ? (
                  <Link href={service.href}>
                    <Button className="w-full bg-green-700 hover:bg-green-800">
                      Ir al servicio
                    </Button>
                  </Link>
                ) : (
                  <Button disabled className="w-full">
                    Próximamente
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
