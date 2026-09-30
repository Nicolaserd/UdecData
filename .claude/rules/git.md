# Reglas de git (commits y push)

Repo: `github.com/Nicolaserd/UdecData` · dueño: **Nicolaserd**.

- Autor = identidad ya configurada (`git config user.name` / `user.email`). Si falta, detenerse y pedirla; nunca inventarla ni cambiarla (`git config user.* <valor>`, `--author`).
- Sin `Co-Authored-By`, sin "Generated with Claude", sin enlaces a claude.com, en commits ni PRs.
- Solo commitear/pushear cuando el usuario lo pida. Mensajes en español, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Nunca commitear `.env*`. Nunca `push --force` ni `--no-verify`. Push solo a `origin`.
- Refuerzo: `.claude/settings.json` (atribución vacía) + hook `.claude/hooks/guard.mjs`.
