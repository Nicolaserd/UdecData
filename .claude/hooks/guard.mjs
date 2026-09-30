// PreToolUse hook (Bash/PowerShell): bloquea comandos que rompen las reglas del proyecto.
// Ver .claude/rules/paquetes.md y .claude/rules/git.md
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const cmd = String(input?.tool_input?.command ?? "");

// Inicio de comando: principio de línea o tras ; & | ( ` o espacio
const S = String.raw`(?:^|[\s;&|(\x60])`;

const RULES = [
  [new RegExp(`${S}npm\\s+(install|i|ci|add|uninstall|remove|rm|update|up|exec|x|init|create)\\b`), "Solo pnpm: usa pnpm install / pnpm add / pnpm remove / pnpm exec."],
  [new RegExp(`${S}npx\\s`), "Solo pnpm: usa pnpm exec (binario local) o pnpm dlx."],
  [new RegExp(`${S}(yarn|bun|bunx)(\\s|$)`), "Solo pnpm: yarn y bun están prohibidos."],
  [/git\s+commit\b[^\n]*--author\b/, "Commits solo con la identidad configurada del dueño del repo: no uses --author."],
  [/co-authored-by/i, "Commits solo del dueño del repo: sin trailers Co-Authored-By."],
  [/generated with \[?claude/i, "Sin firmas de Claude en commits ni PRs."],
  [/git\s+config\s+(--(global|local|system)\s+)?user\.(name|email)\s+\S/, "No cambies la identidad de git (user.name / user.email)."],
  [/git\s+push\b[^\n]*(\s--force(-with-lease)?\b|\s-f\b)/, "Prohibido git push --force."],
  [/git\s+(commit|push)\b[^\n]*--no-verify\b/, "Prohibido saltarse los hooks de git (--no-verify)."],
];

for (const [re, reason] of RULES) {
  if (re.test(cmd)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Bloqueado por regla del proyecto: ${reason}`,
      },
    }));
    process.exit(0);
  }
}
process.exit(0);
