-- The storyboard is a workbench; the player shows a result.
--
-- Until now both drew `takes.brief`, so saving one line of scenario changed the
-- length and the subtitles of the film playing two inches above the edit. That
-- is not "nothing has happened yet" — it is the film following the keyboard.
-- (docs/event-cm-refactor-plan.md §9.5, decision B.)
--
-- So the row gains a second copy. `brief` stays exactly what it was: the value
-- every write path already writes. `baked_brief` is the copy a RUN fixed, and
-- it is what the player, the MP4 renderer and the public URL read. Nothing that
-- writes a brief has to learn anything; only the readers split.
--
-- `baked_brief is null` means one thing and says it plainly: this video has
-- never been run. The screen answers with guidance rather than a warning
-- ("実行すると音声が付いて尺が確定します"), because a video that plays from its
-- own draft is the product's opening move, not a defect (§9.9, option 1).

alter table public.takes
  add column if not exists baked_brief jsonb,
  add column if not exists baked_at    timestamptz;

comment on column public.takes.baked_brief is
  'The brief a run fixed. Read by the player, the MP4 renderer and the public URL. Null = never run.';
comment on column public.takes.baked_at is
  'When baked_brief was fixed. Compared against a render''s timestamp to say an MP4 is older than the film.';

-- Existing videos keep today's behaviour.
--
-- Every event-cm take on this project is currently played straight from
-- `brief`, so what its owner sees now IS its result. Backfilling the copy is
-- what makes this migration invisible: without it, every existing video would
-- announce itself as never run and lose its film until somebody pressed a
-- button. `updated_at` rather than `now()` because the fixing happened when the
-- brief last changed, and a truthful timestamp is what lets "the MP4 is older
-- than the film" mean something on day one.
update public.takes
   set baked_brief = brief,
       baked_at    = updated_at
 where template_id = 'event-cm'
   and baked_brief is null;
