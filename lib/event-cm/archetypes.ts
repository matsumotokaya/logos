// What kind of event a brand would plausibly hold.
//
// The product's opinion, written as rules (§17.2). A finance-education media
// company runs an evening talk with two speakers and a Q&A; a restaurant runs
// a tasting; a B2B tool runs a meetup. Nobody told us that — but guessing it
// well is the whole difference between handing someone a finished film and
// handing them an empty form.
//
// Everything here is a PROPOSAL, recorded as `inferred` in the brief's
// provenance and warned about on publish. The one thing archetypes never do is
// invent a person: a plausible date can be corrected, a plausible speaker is a
// lie with a name on it.

export interface EventArchetype {
  id: string;
  /** Human label for the kind of gathering. */
  kind: string;
  /** Words in the brand's industry or description that select this archetype. */
  matches: RegExp;
  /** Title built from the brand's own subject matter, never free invention. */
  titleFor: (subject: string) => string;
  subtitle: string;
  seriesLabel: string;
  /** Two short lines — the template sets them as the value scene's key copy. */
  valueLines: [string, string];
  valueChip: string;
  programs: string[];
  cta: string;
  /** Start time that suits this kind of gathering. 24h, on the hour. */
  startHour: number;
  /** Which of the default asset pool's tones dresses it (lib/assets/defaults). */
  tone: string;
}

/**
 * Ordered: the first match wins, so the specific sits above the general and
 * the catch-all sits last.
 */
export const EVENT_ARCHETYPES: EventArchetype[] = [
  {
    id: "finance-talk",
    kind: "セミナー",
    matches: /金融|投資|資産|保険|証券|銀行|フィンテック|会計|税/,
    titleFor: (subject) => `${subject}を、じっくり考える夜`,
    subtitle: "〜これからの選択を、根っこから〜",
    seriesLabel: "トークシリーズ",
    valueLines: ["数字の向こう側にある、", "判断の根拠を持ち帰る。"],
    valueChip: "少人数で、深く",
    programs: ["専門家による解説", "ゲストとの対談", "参加者との質疑応答"],
    cta: "詳細・お申し込みはこちら",
    startHour: 19,
    tone: "ink",
  },
  {
    id: "learning-session",
    kind: "講座",
    matches: /教育|学習|スクール|研修|大学|アカデミ|キャリア/,
    titleFor: (subject) => `${subject}をはじめる、最初の一歩`,
    subtitle: "〜知識を、使える形にする〜",
    seriesLabel: "公開講座",
    valueLines: ["聞いて終わりにしない。", "その日から動ける形で。"],
    valueChip: "実践までを一度に",
    programs: ["基礎の整理", "事例で学ぶ実践", "個別相談の時間"],
    cta: "詳細・お申し込みはこちら",
    startHour: 19,
    tone: "ink",
  },
  {
    id: "tech-meetup",
    kind: "ミートアップ",
    matches: /SaaS|ソフト|テック|AI|開発|エンジニア|クラウド|データ|IT/i,
    titleFor: (subject) => `${subject}の現場で、いま起きていること`,
    subtitle: "〜つくっている人の話を聞く〜",
    seriesLabel: "ミートアップ",
    valueLines: ["資料には出てこない、", "現場の判断を聞く。"],
    valueChip: "つくり手が話す",
    programs: ["導入事例の紹介", "開発チームによるデモ", "懇親会"],
    cta: "参加登録はこちら",
    startHour: 19,
    tone: "ink",
  },
  {
    id: "tasting",
    kind: "体験会",
    matches: /飲食|レストラン|カフェ|食品|酒|料理|菓子|小売|物販/,
    titleFor: (subject) => `${subject}を、味わってから選ぶ`,
    subtitle: "〜つくり手と囲む時間〜",
    seriesLabel: "体験会",
    valueLines: ["説明ではなく、", "その場で確かめる。"],
    valueChip: "つくり手と一緒に",
    programs: ["つくり手による解説", "テイスティング", "質疑応答"],
    cta: "詳細・お申し込みはこちら",
    startHour: 18,
    tone: "ink",
  },
  {
    id: "public-lecture",
    kind: "講演会",
    matches: /医療|福祉|介護|健康|クリニック|病院|NPO|行政|自治体/,
    titleFor: (subject) => `${subject}のこれからを、みんなで考える`,
    subtitle: "〜専門家と、地域と〜",
    seriesLabel: "公開講演会",
    valueLines: ["ひとりで抱えないために、", "まず知っておくこと。"],
    valueChip: "どなたでも",
    programs: ["専門家による講演", "現場からの報告", "質疑応答"],
    cta: "詳細・お申し込みはこちら",
    startHour: 14,
    tone: "ink",
  },
  {
    id: "general-seminar",
    kind: "セミナー",
    // The catch-all. Matches anything, so it must be last.
    matches: /.*/,
    titleFor: (subject) => `${subject}について、話をします`,
    subtitle: "〜現場の視点から〜",
    seriesLabel: "セミナー",
    valueLines: ["一般論ではなく、", "実際に起きていることを。"],
    valueChip: "現場の話を",
    programs: ["主催者による解説", "ゲストとの対談", "質疑応答"],
    cta: "詳細・お申し込みはこちら",
    startHour: 19,
    tone: "ink",
  },
];

export function archetypeFor(input: {
  industry?: string | null;
  description?: string | null;
}): EventArchetype {
  const haystack = `${input.industry ?? ""} ${input.description ?? ""}`;
  return (
    EVENT_ARCHETYPES.find((archetype) => archetype.matches.test(haystack)) ??
    EVENT_ARCHETYPES[EVENT_ARCHETYPES.length - 1]
  );
}

/**
 * What the event is about, in a few words, taken from the brand's own text.
 *
 * Reusing the brand's industry keeps the title grounded in something the
 * brand actually said about itself. Inventing a subject would put words in
 * their mouth that no later correction traces back to a source.
 */
export function subjectFor(input: {
  industry?: string | null;
  name: string;
}): string {
  const industry = input.industry?.trim();
  if (!industry) return input.name;
  // "金融教育メディア" → "金融教育": the medium is how they publish, not what
  // the evening is about.
  return industry.replace(/(メディア|サービス|事業|会社|カンパニー)$/u, "") || industry;
}
