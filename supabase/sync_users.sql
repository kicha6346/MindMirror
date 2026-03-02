-- If you have already created an account but it didn't show up in `public.users`
-- (because the DB was reset), run this script to sync them over cleanly!

insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;
