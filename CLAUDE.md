## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## ECC (project add-on)

Global ECC skills and rules live in `~/.claude` (see `~/.claude/rules/ecc/SOURCE.txt`). This repo adds only the TypeScript agents in `.claude/agents` (sonnet, cheaper than the main model):
- `typescript-reviewer` / `security-reviewer`: run `graphify affected "<X>"` first and hand them only that scope.
- `build-error-resolver`: give it the `tsc`/vite error text, not whole files.
- `verification-loop` in `game/` means `npm run typecheck`, `npm run lint`, `npm test`.
