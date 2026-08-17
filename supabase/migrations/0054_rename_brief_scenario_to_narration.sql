-- ============================================================================
-- 0054 - the words a film says are its NARRATION
--
-- The second half of the rename 0051 started, and the last one this key needs.
--
-- 0051 moved `script` → `scenario` because the name was pointing at the
-- derivative rather than the source. It fixed the direction but not the word:
-- 「シナリオ」 reads as a plan for a film, and what this actually holds is the
-- sentence each picture SAYS — read aloud by the voice, cut into the subtitle
-- cards, and long enough to decide how many seconds the picture runs. A user
-- typing into the storyboard is typing the words that will be spoken and shown,
-- and calling that a scenario made every screen that mentioned it unreadable:
-- 「シナリオが書き直されていません」 named something the user did not believe
-- they had written.
--
-- The vocabulary is now three words that never trade places:
--
--   ナレーション  the words. Always present, cannot be switched off.  ← this key
--   ボイス        the words spoken. Optional.                          brief.voice
--   字幕          the words shown. Derived, never stored.              captions.ts
--
-- `lib/narration/` (the TTS module) moved to `lib/voice/` in the same change,
-- so `narration` means exactly one thing in this codebase.
--
-- NOT renamed: `brief.narrator` (which preset reads it). It is shared with
-- product-cm, which still speaks the old vocabulary (`cm_script`), and moving it
-- alone would drag half of that template into a naming scheme it does not
-- otherwise use. It goes when product-cm is converted.
--
-- Both copies, in one statement. `brief` is the workbench and `baked_brief` is
-- the film the player shows (migration 0050); renaming only the first would make
-- every existing video announce an empty narration and fall back to scene
-- budgets, which is the exact "the film followed an unrelated edit" bug 0050
-- existed to end.
--
-- One-way, with no dual-reading code on either side — same judgement as 0051,
-- and still honest at three rows and zero customers. A reader that accepts both
-- spellings keeps the old name alive in the type system forever.
-- ============================================================================

update public.takes
   set brief = (brief - 'scenario')
               || jsonb_build_object('narration', brief -> 'scenario')
 where template_id = 'event-cm'
   and brief ? 'scenario';

update public.takes
   set baked_brief = (baked_brief - 'scenario')
                     || jsonb_build_object('narration', baked_brief -> 'scenario')
 where template_id = 'event-cm'
   and baked_brief ? 'scenario';
