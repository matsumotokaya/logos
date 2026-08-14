-- The words each panel speaks are the scenario, not the script.
--
-- The name was backwards (docs/event-cm-refactor-plan.md §9.1). What the code
-- calls `script` is the main sentence of each panel — it is what the subtitles
-- show, what the shape of the film is derived from, and what the reading aloud
-- is made FROM. A "script" is the thing an actor is handed; this is the story.
-- The voice track is the derivative, and calling the story after its derivative
-- is what let three surfaces argue about which one was the source of truth.
--
-- The data flow already ran this way — captions are cut from `scene.text`, never
-- from the recording — so this migration only fixes the name.
--
-- Both copies, in one statement. `brief` is the workbench and `baked_brief` is
-- the film the player shows (migration 0050); renaming only the first would make
-- every existing video announce an empty scenario and fall back to scene
-- budgets, which is the exact "the film followed an unrelated edit" bug 0050
-- existed to end.
--
-- One-way, with no dual-reading code on either side. Zero customers and three
-- rows is the only time that is honest: a reader that accepts both spellings
-- keeps the old name alive in the type system forever, which is what this whole
-- refactor is trying to remove.

update public.takes
   set brief = (brief - 'script')
               || jsonb_build_object('scenario', brief -> 'script')
 where template_id = 'event-cm'
   and brief ? 'script';

update public.takes
   set baked_brief = (baked_brief - 'script')
                     || jsonb_build_object('scenario', baked_brief -> 'script')
 where template_id = 'event-cm'
   and baked_brief ? 'script';
