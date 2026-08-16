// The handoff document that ships inside the zip.
//
// Whoever opens the export is starting cold: they have a folder, no history, and
// a video they want to keep working on. What they need first is not a feature
// list — it is where the words are, where the design is, and which of the two
// they should be editing for the change they have in mind. The scene vocabulary
// goes in because it is the map between what they see and what they edit.
//
// It is written for a person and for an agent at once. An agent reading this
// needs the same things a person does, plus the rules that are not visible in
// the code: that the scenario decides the length, that a fact absent from the
// brief is absent from the picture by design, and that the storyboard's
// arithmetic lives in one function.

import { EVENT_CM_SCENES, EVENT_CM_SCENE_LABELS } from "@/remotion/event-cm/types";

export interface ReadmeInput {
  title: string;
  compositionId: string;
  /** When the exported film was fixed, or null if it was never run. */
  bakedAt: string | null;
  /** Labels of default assets left out of the zip. */
  excluded: string[];
  /** Repo-relative paths of the copied sources, for the file map. */
  sourceFiles: string[];
}

const sceneTable = (): string =>
  EVENT_CM_SCENES.map((scene) => {
    const optional = scene.optional ? "登壇者が居なければ消える" : "必ず出る";
    const voice = scene.narrated ? "読み上げあり" : "無音";
    return `| \`${scene.role}\` | ${EVENT_CM_SCENE_LABELS[scene.role]} | ${voice} | ${optional} |`;
  }).join("\n");

export function projectReadme(input: ReadmeInput): string {
  const kitFiles = input.sourceFiles.filter((f) => f.startsWith("remotion/kit/"));
  const excluded =
    input.excluded.length > 0
      ? `## 同梱していない素材

次の既定素材は再配布できないため、このZIPに入っていません。ブリーフからも参照を外してあるので、そのままでも動きます（音が鳴らないだけです）。差し替えるときは \`public/\` に置いて \`props.json\` の \`bgm\` にそのパスを書いてください。

${input.excluded.map((label) => `- ${label}`).join("\n")}
`
      : `## 同梱していない素材

今回は除外された素材はありません。使われている既定BGMは商用利用可のものです。

**Remotion本体は入っていません。** 再配布できないため \`package.json\` の依存として書いてあります。\`npm install\` すると、あなたのライセンスで入ります。
`;

  return `# ${input.title}

Remotionのプロジェクトです。この動画を作った続きを、自分の手元で進められます。

${input.bakedAt ? `書き出し元の映像が確定した日時: ${input.bakedAt}` : "この動画はまだ一度も実行されていない状態で書き出されました。"}

## 動かす

\`\`\`bash
npm install
npm run studio    # ブラウザでプレビュー・シーンごとに確認
npm run render    # out/video.mp4 へ書き出し
\`\`\`

初回の \`render\` はHeadless Chromeを自動でダウンロードします。

## どこに何があるか

| 場所 | 中身 |
| --- | --- |
| \`props.json\` | **この動画の内容**。文言・日程・登壇者・プログラム・素材の参照が全部ここ |
| \`src/remotion/event-cm/\` | このテンプレートの本体。シーンの並び・尺・字幕 |
| \`src/remotion/kit/\` | 部品の語彙(${kitFiles.length}ファイル)。配置・テーマ・書体・モーション |
| \`public/assets/\` | この動画に固定された素材。**中身で分けてあります**(\`person/\` \`mark/\` \`scenery/\` \`audio/\` など)。ファイル名には測った寸法が入り、マークには地の有無と明度が入ります(例: \`leopalace21_plate_light_800w.jpg\` = 地のある明るいマーク。暗い地に白抜きしてはいけない) |
| \`src/Root.tsx\` | コンポジションの登録。\`props.json\` を読み込んでいる |

**文言や日付を直したいだけなら \`props.json\` だけ**を触ってください。デザインを変えたいときが \`src/\` です。

## シーンの構成

固定の並びで、ロゴで始まりロゴで終わります。\`program\`(アジェンダ)だけはプログラムの数だけ増えます。

| ロール | 呼び名 | 音声 | 出現 |
| --- | --- | --- | --- |
${sceneTable()}

## 知っておくと早いこと

- **尺はシナリオが決めます。** \`props.json\` の \`scenario.scenes[].text\` を長くすると、そのシーンが伸びて動画全体が伸びます。固定尺ではありません
- **無いものは描かれません。** \`schedule.venue\` を \`null\` にすると会場の行が消えます。空欄やダミー枠は出ません——これは設計であって不具合ではないので、埋まっていない項目を無理に埋める必要はありません
- **字幕はシナリオから作られます**(\`src/remotion/event-cm/captions.ts\`)。音声が無くても出ます。1枚28字で割れます
- **「このブリーフがどんな映像になるか」の導出は \`src/remotion/event-cm/film.ts\` の \`eventCmFilm()\` 1箇所**です。尺・部品・字幕・非表示の反映は全部ここを通ります。表示を変えたいときにまず読む場所で、ここを迂回して別の場所で尺を計算すると噛み合わなくなります
- 読み上げ音声は \`public/assets/audio/\` に入っています。差し替えるときは \`props.json\` の \`voice\` が指すパスを変えてください。声を消すと、尺はシナリオの文字数からの推定に戻ります

## AIエージェントへ

このプロジェクトを引き継いで作業する場合、次の3点を守ってください。

1. **事実を捏造しない。** \`props.json\` に無い日時・会場・料金・人名を補完しない。未定のものは \`null\` のままにする(そのように描かれる設計です)
2. **尺を固定値で書かない。** 動画の長さは \`eventCmFilm()\` が返す \`totalMs\` から導きます。\`durationInFrames\` を定数にすると、シナリオを直したときに映像が切れます
3. **アートディレクションを勝手に足さない。** 墨黒×金×明朝で、金は「誰かが決めた」という意味を持ちます。枠や飾りを金で足すと、意味のある色が意味を失います

デザイン変更を頼まれたときは、まず \`src/remotion/kit/theme.ts\`(色・書体・型スケール・モーション)と \`src/remotion/kit/layout.ts\`(配置)を読んでください。シーン側に直接スタイルを書くとテーマを差し替えられなくなります。

${excluded}
## ライセンスについて

写真・ロゴ・音声などの素材の権利は、それを用意した人のものです。このZIPは制作の続きをするためのものなので、素材を再配布する権利までは含みません。
`;
}
