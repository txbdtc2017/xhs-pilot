<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Post-Phase Optimization Workflow

After Phase 1-6 completion, treat any **multi-step optimization request** as a documentation-first task.

Rules:

1. Do **not** jump straight into implementation for multi-step optimizations.
2. First create the next `OPT-xxx` execution document under `docs/optimizations/`.
3. The new document must follow `docs/optimizations/CONVENTIONS.md`.
4. Only start implementation after the `OPT` document is written and the user confirms it.
5. Small single-point fixes can still be implemented directly without creating an `OPT` document.

When executing an optimization document, provide the AI with:

- `docs/CONVENTIONS.md`
- `docs/optimizations/CONVENTIONS.md`
- the target `docs/optimizations/OPT-xxx-*.md`
