// PreToolUse hook (Edit/Write/NotebookEdit): pide confirmación al usuario
// antes de modificar cualquier archivo dentro de .claude/ (reglas, hooks, settings).
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? "");
const root = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();

const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");

if (rel === ".claude" || rel.startsWith(".claude/")) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `Cambio en reglas/configuración de Claude (${rel}). Requiere tu aprobación.`,
    },
  }));
}
process.exit(0);
