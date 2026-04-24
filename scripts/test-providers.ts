import "dotenv/config";

async function testProvider(
  name: string,
  endpoint: string,
  model: string,
  apiKey: string | undefined,
) {
  console.log(`\n═══ ${name} ═══`);
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Model:    ${model}`);
  console.log(`  Key:      ${apiKey ? apiKey.slice(0, 8) + "…" + apiKey.slice(-4) : "❌ AUSENTE"}`);

  if (!apiKey) { console.log("  → NO se puede probar sin API key"); return; }

  const body = {
    model,
    messages: [{ role: "user", content: "Responde solo con la palabra OK" }],
    temperature: 0.1,
    ...(name === "Cerebras" ? { max_completion_tokens: 20 } : { max_tokens: 20 }),
  };

  const t0 = Date.now();
  try {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify(body),
    });
    const elapsed = Date.now() - t0;
    console.log(`  HTTP ${res.status} (${elapsed}ms)`);

    const raw = await res.text();
    if (!res.ok) {
      console.log(`  ❌ Error body: ${raw.slice(0, 500)}`);
      const ra = res.headers.get("retry-after");
      if (ra) console.log(`  retry-after: ${ra}`);
      return;
    }
    const parsed  = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content;
    console.log(`  ✅ Respuesta: ${JSON.stringify(content)}`);
    console.log(`  Tokens — in: ${parsed?.usage?.prompt_tokens}, out: ${parsed?.usage?.completion_tokens}`);
  } catch (err) {
    console.log(`  ❌ Exception: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  const CEREBRAS_CANDIDATES = [
    "llama3.1-8b",
    "llama-3.3-70b",
    "qwen-3-235b",
    "qwen-3-235b-a22b-instruct-2507",
    "qwen-3-235b-a22b-thinking-2507",
    "qwen-3-coder-480b",
    "gpt-oss-120b",
    "llama-4-scout-17b-16e-instruct",
    "llama-4-maverick-17b-128e-instruct",
  ];
  for (const m of CEREBRAS_CANDIDATES) {
    await testProvider("Cerebras", "https://api.cerebras.ai/v1/chat/completions", m, process.env.CEREBRAS_API_KEY);
  }
  await testProvider("Groq", "https://api.groq.com/openai/v1/chat/completions",
    process.env.GROQ_ANALISIS_MODEL ?? "llama-3.3-70b-versatile", process.env.GROQ_API_KEY);
}

main();
