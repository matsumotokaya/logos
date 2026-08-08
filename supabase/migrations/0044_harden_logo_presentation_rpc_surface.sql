-- The ensure helper is internal to atomic logo creation. Reading needs no
-- elevated privilege because canonical_slots/Takes already carry RLS.
revoke execute on function public.ensure_logo_presentation_take(text)
  from authenticated;
grant execute on function public.ensure_logo_presentation_take(text)
  to service_role;

alter function public.read_logo_presentation_take(text) security invoker;
