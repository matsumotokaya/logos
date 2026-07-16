<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Supabase MCP safety

- This machine has multiple Supabase accounts and projects. Never assume that a tool named only `supabase` is connected to this repository's database.
- The only expected Supabase project for this repository is project ref `xhbdfzceyfrxsmaixkne` at `https://xhbdfzceyfrxsmaixkne.supabase.co`.
- Before reading schema or data, and always before proposing or applying SQL, call the active Supabase MCP's project-URL check and verify that it exactly matches the expected URL above.
- If the URL differs, or the expected tables appear to be missing, stop. Treat that as a wrong-account or wrong-MCP connection first; do not infer that this project's database is empty or absent.
- Tell the user that the current session is connected to the wrong Supabase MCP and must be restarted or reconnected. Do not work around the mismatch by creating a substitute local database, Docker database, schema, or migration target.
- The project-scoped MCP server is named `supabase_logos`. A differently named Supabase server belongs to another project unless its project URL has been explicitly verified.
- The project-scoped `supabase_logos` server is write-capable. Before every remote write, verify the exact project URL again, review the migration or SQL, and obtain explicit user authorization for that write. Write capability never substitutes for confirmation.
