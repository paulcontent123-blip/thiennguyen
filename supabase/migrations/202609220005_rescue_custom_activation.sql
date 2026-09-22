-- Custom rescue activation flow.
-- The public email link contains an application token, so email security
-- scanners cannot consume the one-time Supabase invite token on page load.

alter table public.rescue_invitations
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists activation_token_hash text;

create index if not exists rescue_invitations_user_id_idx
  on public.rescue_invitations (user_id);

create unique index if not exists rescue_invitations_activation_token_hash_key
  on public.rescue_invitations (activation_token_hash)
  where activation_token_hash is not null;

comment on column public.rescue_invitations.user_id is
'Auth/profile user created for this invitation. Kept separately from invited_by, which identifies the Admin who sent it.';

comment on column public.rescue_invitations.activation_token_hash is
'SHA-256 hash of the application activation token. The raw token is sent only in the custom app URL and is never stored.';
