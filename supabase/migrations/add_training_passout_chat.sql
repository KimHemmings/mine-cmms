-- Training can read the pass-out pings Production sends into shift chat.
-- Workshop supervisors still see the whole desk. Everyone else still sees their own messages.

drop policy if exists shift_chat_select on public.shift_chat;
create policy shift_chat_select on public.shift_chat
  for select to authenticated
  using (
    (
      public.app_user_department() = 'workshop'
      and public.app_user_access_level() = 3
    )
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (
      public.app_user_department() = 'training'
      and public.app_user_access_level() >= 2
      and message like '@Training%'
    )
  );
