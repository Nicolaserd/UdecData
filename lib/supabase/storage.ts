import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_ANALISIS_BUCKET ?? "informes";

function getClient(): SupabaseClient {
  const url      = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !adminKey) throw new Error("Supabase no configurado (NEXT_PUBLIC_SUPABASE_URL o KEY ausente)");
  return createClient(url, adminKey);
}

function isBucketNotFound(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("bucket not found") || m.includes("bucket") && m.includes("not found");
}

async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  // createBucket es idempotente en la práctica: devuelve error "Bucket already exists"
  // si ya está. Requiere service role key para tener permisos.
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (!error) return;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("already exists") || msg.includes("duplicate")) return; // OK
  // No se pudo crear (probablemente permiso insuficiente)
  throw new Error(
    `El bucket "${BUCKET}" no existe en Supabase Storage y no pudo crearse automáticamente: ${error.message}. ` +
    `Solución: (1) créalo manualmente en Supabase → Storage como bucket público, o ` +
    `(2) agrega SUPABASE_SERVICE_ROLE_KEY a las variables de entorno para permitir la creación automática.`
  );
}

export async function uploadInforme(path: string, body: Buffer, contentType: string): Promise<string> {
  const supabase = getClient();

  // 1) Intenta subir directamente. Si el bucket existe, termina rápido.
  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });

  // 2) Si el bucket no existe, intenta crearlo y reintenta la subida.
  if (error && isBucketNotFound(error.message)) {
    await ensureBucket(supabase);
    const retry = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });
    error = retry.error;
  }

  if (error) {
    if (isBucketNotFound(error.message)) {
      throw new Error(
        `El bucket "${BUCKET}" no existe en Supabase Storage. ` +
        `Créalo manualmente como bucket público en Supabase → Storage, ` +
        `o agrega SUPABASE_SERVICE_ROLE_KEY al entorno para que se cree automáticamente.`
      );
    }
    throw new Error(`Supabase storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
