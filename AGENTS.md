# 読む順序(最初にこれ)

1. **[HANDOFF.md](HANDOFF.md)** — 現在地・次の一手・信じてはいけないもの。**1枚。必ず読む**
2. **[README.md](README.md)** — 正本の**索引**。135KBあるので**通読しない**。HANDOFFか目次から名指しされた節だけ引く
3. それ以外 — **必要になったら引く**

このファイルは `CLAUDE.md` 経由で毎セッション自動で読み込まれる唯一の場所なので、読む順序はここが正本。
**恒久的な規則だけを置く**(下の2節)。現在地・進捗・次にやることは書かない——それは HANDOFF.md の仕事で、性質の違う2つを同居させると古い方が信じられる。

孤立した文書を作らないこと。検査は `npm run docs:check`(規則は README の「ドキュメント(正本マップ)」)。

## ルールとLLMの使い分け(2026-08-24 方針)

**原則はルールベース。** 決定論で出せるものは決定論で出す(測定・配置・尺・改行位置)。安く、速く、同じ入力で同じ結果が出る。

**ただし低コスト低品質ではプロダクトの意味が無い。** 一定のLLM使用で「期待以上のものが自動で出てきた」という驚きを作れるなら、**それはマーケティングコストとして払う価値がある**。だから **LLMは積極的に使ってよい**。採算が厳しくなれば依頼主から止めるので、**まずは採算を気にせず価値の最大化に徹する**。

判断の順序は「ルールで出せるか → 出せるなら出す。出せない、あるいはルールでは驚きが作れないなら LLM を使う」。**コストを理由に品質を落とす判断を、こちらでしない。**

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
