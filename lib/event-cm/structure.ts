import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ExtractedSource } from "./extract";
import { sanitizeFacts, type SanitizeReport } from "./sanitize";

// Stage ③: turning what was read into the event's facts.
//
// The model's whole job is reading — pulling a date out of a flyer, telling a
// speaker's name from a caption. It is explicitly NOT asked to invent: a field
// it cannot find in the material is returned null, and the seeded proposal
// keeps standing there. That is what makes the origin badge meaningful; a
// model that filled gaps would turn every "資料から読んだ" into a guess wearing
// the wrong label.
//
// PDFs and images arrive here whole, because the extraction stage has no
// parser for them (extract.ts). They are attached as file/image parts, so the
// model reads the flyer itself rather than a lossy transcription of it.

const MODEL = "gpt-5.6-terra";
const LLM_TIMEOUT_MS = 180_000;

const openai = (): OpenAI => new OpenAI({ timeout: LLM_TIMEOUT_MS, maxRetries: 2 });

const SYSTEM = `あなたはイベント告知資料の読み取り担当です。渡された資料から、イベントの事実だけを抜き出します。

## 絶対の制約

1. **資料に書かれていないことは絶対に埋めない。** 見つからなかった項目は必ず null にする。推測・補完・一般論での穴埋けを一切しない。
2. **書かれていることは書かれたとおりに。** 表記（日付の書式、社名の表記ゆれ、肩書き）を勝手に整えない。
3. 複数の資料に矛盾がある場合は、より具体的で新しそうな方を採り、その旨を note に書く。

## 掲載する値と、資料の足場を区別する

企画書やフライヤーには、**告知に載せる値ではないもの**が値と同じ見た目で並んでいます。以下はすべて null にしてください。

- **見出し・ラベル**: 「本企画が目指す価値」「開催概要」「ターゲット」など、枠の名前であって中身ではないもの。その下に書かれている実際の内容の方を採る
- **未記入のプレースホルダ**: 「XXXX円」「〇〇会場」「未定」「TBD」。資料がまだ決めていないので、書かれていないのと同じ
- **社内向けのメモ**: 想定集客数、動員目標、「オーナー約40名・社員約10名」のような内訳。企画の話であって、参加者に伝える情報ではない
- **人数の表記を人物にしない**: 「Miss SAKE 2名」は登壇者ではなく人数。氏名が分かる人物だけを guests に入れる
- **装飾記号**: 「＼」「／」「■」「※」などフライヤーの装飾は値に含めない

## 各項目

- title: イベント名。サブタイトルは含めない
- subtitle: 副題・キャッチコピー
- seriesLabel: シリーズ名・第N回・主催者が付けた枠の名前
- presenter: 主催・共催。複数なら資料の表記のまま繋げる
- valueLines: 参加する価値を表す短い行（2〜3行）。資料の言葉を使う
- valueChip: 価値を一言で表すラベル
- programs: プログラム・当日の内容。書かれている順に
- guests: 登壇者。name と role をそのまま。**人名は絶対に捏造しない**
- date: 開催日。資料の表記のまま（例「2026.10.2」「10月2日」）
- weekday: 曜日（例「FRI」「金」）
- time: 開始時刻（例「17:00 START」「17時開演」）
- venue: 会場
- fee: 参加費
- cta: 申し込み方法・行動喚起
- footnote: 注記（年齢制限・定員など）`;

const FactsSchema = z.object({
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  seriesLabel: z.string().nullable(),
  presenter: z.string().nullable(),
  valueLines: z.array(z.string()).nullable(),
  valueChip: z.string().nullable(),
  programs: z.array(z.string()).nullable(),
  guests: z.array(z.object({ name: z.string(), role: z.string() })).nullable(),
  date: z.string().nullable(),
  weekday: z.string().nullable(),
  time: z.string().nullable(),
  venue: z.string().nullable(),
  fee: z.string().nullable(),
  cta: z.string().nullable(),
  footnote: z.string().nullable(),
  note: z.string().nullable().describe("矛盾や判断に迷った点。無ければ null"),
});

export type EventFacts = z.infer<typeof FactsSchema>;

export function structuringAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface StructuredResult {
  facts: EventFacts;
  /** Which materials were actually looked at. */
  readLabels: string[];
  /** What the deterministic pass threw away, and why. */
  dropped: SanitizeReport["dropped"];
  usage: { inputTokens: number; outputTokens: number } | null;
}

export async function structureEventFacts(
  sources: ExtractedSource[],
): Promise<StructuredResult> {
  const usable = sources.filter(
    (source) => source.mode === "text" || source.mode === "passthrough",
  );
  if (usable.length === 0) {
    throw new Error("読み取れる素材がありません。資料かテキストを追加してください");
  }

  const content: ContentPart[] = [];
  for (const source of usable) {
    if (source.mode === "text" && source.text) {
      content.push({ type: "text", text: `【${source.label}】\n${source.text}` });
      continue;
    }
    if (!source.data) continue;
    if (source.mediaType === "application/pdf") {
      content.push({
        type: "file",
        file: {
          filename: source.label.endsWith(".pdf") ? source.label : `${source.label}.pdf`,
          file_data: `data:application/pdf;base64,${source.data}`,
        },
      });
    } else {
      content.push({
        type: "image_url",
        image_url: { url: `data:${source.mediaType};base64,${source.data}` },
      });
    }
  }
  content.push({
    type: "text",
    text: "この資料から読み取れるイベントの事実だけを抜き出してください。書かれていない項目は null にしてください。",
  });

  const response = await openai().chat.completions.parse({
    model: MODEL,
    max_completion_tokens: 6000,
    reasoning_effort: "medium",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: content as never },
    ],
    response_format: zodResponseFormat(FactsSchema, "event_facts"),
  });

  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) throw new Error("資料から事実を読み取れませんでした");

  // The prompt asks for this too, but a model told not to copy a heading will
  // still copy one sometimes. What can be recognised by rule is enforced by
  // rule (§17.2), and what it removes is reported rather than removed quietly.
  const { facts, report } = sanitizeFacts(parsed);

  return {
    facts,
    readLabels: usable.map((source) => source.label),
    dropped: report.dropped,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : null,
  };
}
