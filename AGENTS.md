<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Universal Agent Operational Backbone (Ponytail & Karpathy Rules)

Every agent operating in this repository must strictly adhere to these directives:

## 1. The Ponytail 7-Rung Ladder
Before writing any code, stop at the first rung that satisfies the requirement:
1. **YAGNI**: Does this need to exist at all? (If no, reject or skip).
2. **Reuse**: Is it already in this codebase? (Do not rewrite existing helpers).
3. **Standard Library**: Does the language standard library do it?
4. **Native Platform**: Does the browser / runtime have a native API for it?
5. **Installed Dependency**: Does an existing `package.json` package handle it?
6. **One Line**: Can it be written in a single clean expression?
7. **Strict Minimum**: Only write the absolute minimal code required to solve the immediate problem.

## 2. Karpathy Surgical Discipline
- **Touch Only What You Must**: Never refactor adjacent files or change formatting styles of code you were not asked to touch.
- **Don't Assume**: Inspect file paths and APIs before writing code; never invent non-existent imports.
- **Verify Goal**: Run `bun run build` and `bun test` after every change. A task is incomplete until the build is green.

## 3. Storage & Safety Guardrails
- **Strict D:\ Drive**: All writes, builds, temporary files, and caches stay on `D:\`. Never write to `C:\`.
- **Zero-Threat**: No unverified binaries or external scrapers.
- **Zero Emojis**: Keep all commits, responses, and docs professional.

