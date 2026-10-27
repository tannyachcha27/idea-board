-- Only for projects with Supabase's pre-existing administrative event trigger.
-- This does not prevent the event trigger from running automatically.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
