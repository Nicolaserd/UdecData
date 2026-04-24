import "dotenv/config";
import { callWithFallback } from "../lib/ai/analisis-client";
import { buildChunkPrompt, buildConsolidatePrompt } from "../lib/analisis/prompts";

async function main() {
  console.log("→ Prueba chunk analysis (área: CAD)");
  const chunkRes = await callWithFallback(
    buildChunkPrompt("CAD", [
      "El espacio está muy pequeño",
      "Deberían ampliar las salas",
      "Buen servicio pero mucha fila",
    ]),
    { maxTokens: 500, temperature: 0.3 },
  );
  if (chunkRes.success) {
    console.log(`  ✅ Proveedor: ${chunkRes.success.provider}`);
    console.log(`  Resultado:\n${chunkRes.success.content.slice(0, 400)}\n…`);
  } else {
    console.log(`  ❌ Errores:`, chunkRes.errors);
  }

  console.log("\n→ Prueba consolidation");
  const consolRes = await callWithFallback(
    buildConsolidatePrompt("CAD", [
      "Análisis parcial 1: Los usuarios se quejan del tamaño.",
      "Análisis parcial 2: Usuarios piden más salas y menos filas.",
    ]),
    { maxTokens: 800, temperature: 0.2 },
  );
  if (consolRes.success) {
    console.log(`  ✅ Proveedor: ${consolRes.success.provider}`);
    console.log(`  Consolidado:\n${consolRes.success.content.slice(0, 400)}\n…`);
  } else {
    console.log(`  ❌ Errores:`, consolRes.errors);
  }
}

main();
