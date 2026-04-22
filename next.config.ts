import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/encuesta-satisfaccion/wordclouds": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
