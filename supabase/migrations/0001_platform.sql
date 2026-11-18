create extension if not exists pgcrypto;

create type public.player_role as enum ('player', 'administrator');
create type public.tournament_status as enum ('draft', 'registration_open', 'upcoming', 'live', 'completed', 'cancelled');
create type public.registration_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.match_status as enum ('scheduled', 'awaiting_result', 'under_review', 'verified', 'disputed');
create type public.point_transaction_kind as enum ('award', 'redemption', 'adjustment', 'refund');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  integration_key text not null unique,
  team_min integer not null default 1 check (team_min > 0),
  team_max integer not null default 1 check (team_max >= team_min),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  bio text,
  role public.player_role not null default 'player',
  points_balance bigint not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connected_game_accounts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id),
  game_username text not null,
  external_player_id text not null,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verification_evidence text,
  provider_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, game_id, external_player_id)
);

create table public.game_statistics (
  id uuid primary key default gen_random_uuid(),
  game_account_id uuid not null references public.connected_game_accounts(id) on delete cascade,
  stat_key text not null,
  stat_value jsonb not null,
  recorded_at timestamptz not null default now(),
  unique (game_account_id, stat_key, recorded_at)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  name text not null,
  slug text not null unique,
  logo_url text,
  captain_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('captain', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, player_id),
  unique (player_id)
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_player_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (team_id, invited_player_id)
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  slug text not null unique,
  name text not null,
  description text not null default '',
  banner_url text,
  format text not null check (format in ('single_elimination', 'double_elimination', 'round_robin', 'points')),
  status public.tournament_status not null default 'draft',
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  starts_at timestamptz not null,
  capacity integer not null check (capacity >= 2),
  team_size integer not null default 1 check (team_size > 0),
  entry_requirements jsonb not null default '{}'::jsonb,
  scoring_config jsonb not null default '{}'::jsonb,
  prize_label text not null default 'Community points',
  reward_config jsonb not null default '{}'::jsonb,
  accent text not null default '#c7ff4a',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_opens_at < registration_closes_at),
  check (registration_closes_at <= starts_at)
);

create table public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  status public.registration_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((player_id is null) <> (team_id is null))
);
create unique index tournament_player_registration_unique on public.tournament_registrations(tournament_id, player_id) where player_id is not null;
create unique index tournament_team_registration_unique on public.tournament_registrations(tournament_id, team_id) where team_id is not null;

create table public.tournament_brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  version integer not null default 1,
  bracket_data jsonb not null,
  generated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (tournament_id, version)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  bracket_id uuid references public.tournament_brackets(id) on delete set null,
  round_number integer not null check (round_number > 0),
  match_number integer not null check (match_number > 0),
  participant_a uuid references public.tournament_registrations(id),
  participant_b uuid references public.tournament_registrations(id),
  winner_id uuid references public.tournament_registrations(id),
  next_match_id uuid references public.matches(id),
  scheduled_at timestamptz,
  status public.match_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (tournament_id, round_number, match_number)
);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  result_data jsonb not null,
  evidence_url text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  position integer not null check (position > 0),
  score numeric not null default 0,
  published_at timestamptz not null default now(),
  check ((player_id is null) <> (team_id is null)),
  unique (tournament_id, position)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  points_cost bigint not null check (points_cost > 0),
  inventory integer check (inventory is null or inventory >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id),
  kind public.point_transaction_kind not null,
  amount bigint not null check (amount > 0),
  idempotency_key text not null unique,
  tournament_id uuid references public.tournaments(id),
  reward_id uuid references public.rewards(id),
  description text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  category text not null,
  purchase_type text not null check (purchase_type in ('affiliate', 'integrated')),
  affiliate_url text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  provider_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (purchase_type <> 'affiliate' or affiliate_url is not null)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  total_cents integer not null check (total_cents >= 0),
  provider_key text,
  provider_order_id text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tournaments_public_feed_idx on public.tournaments(status, starts_at);
create index tournament_registrations_player_idx on public.tournament_registrations(player_id, created_at desc);
create index matches_tournament_round_idx on public.matches(tournament_id, round_number, match_number);
create index point_transactions_player_idx on public.point_transactions(player_id, created_at desc);
create index notifications_inbox_idx on public.notifications(player_id, created_at desc) where read_at is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  requested_username := regexp_replace(requested_username, '[^A-Za-z0-9_]', '', 'g');
  if length(requested_username) < 3 then requested_username := 'player_' || substr(new.id::text, 1, 8); end if;
  insert into public.profiles(id, username, display_name)
  values (new.id, requested_username, new.raw_user_meta_data ->> 'display_name');
  return new;
exception when unique_violation then
  insert into public.profiles(id, username, display_name)
  values (new.id, 'player_' || substr(new.id::text, 1, 12), new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_administrator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'administrator');
$$;

create or replace function public.prevent_profile_privilege_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.points_balance is distinct from old.points_balance
    and coalesce(current_setting('app.points_transaction', true), 'off') <> 'on' then
    raise exception 'Points balance is managed by the transaction ledger';
  end if;
  if auth.uid() = old.id and not public.is_administrator()
    and new.role is distinct from old.role then
    raise exception 'Role is managed by the platform';
  end if;
  return new;
end;
$$;
create trigger protect_profile_privileges before update on public.profiles
for each row execute procedure public.prevent_profile_privilege_changes();

create or replace function public.register_tournament(target_tournament uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tournament_row public.tournaments%rowtype;
  registration_id uuid;
  registered_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament for update;
  if not found then raise exception 'Tournament not found'; end if;
  if tournament_row.status <> 'registration_open'
    or now() < tournament_row.registration_opens_at
    or now() >= tournament_row.registration_closes_at then
    raise exception 'Registration is closed';
  end if;
  select count(*) into registered_count from public.tournament_registrations
    where tournament_id = target_tournament and status <> 'rejected';
  if registered_count >= tournament_row.capacity then raise exception 'Tournament is full'; end if;
  insert into public.tournament_registrations(tournament_id, player_id, status)
    values (target_tournament, auth.uid(), 'pending')
    on conflict do nothing returning id into registration_id;
  if registration_id is null then raise exception 'Already registered'; end if;
  return registration_id;
end;
$$;
revoke all on function public.register_tournament(uuid) from public, anon;
grant execute on function public.register_tournament(uuid) to authenticated;

create or replace function public.apply_point_transaction(
  target_player uuid,
  transaction_kind public.point_transaction_kind,
  transaction_amount bigint,
  transaction_key text,
  transaction_description text,
  related_tournament uuid default null,
  related_reward uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  transaction_id uuid;
  balance_delta bigint;
begin
  if transaction_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if not public.is_administrator() then raise exception 'Not authorized'; end if;
  balance_delta := case when transaction_kind in ('award', 'refund') then transaction_amount else -transaction_amount end;
  insert into public.point_transactions(player_id, kind, amount, idempotency_key, description, tournament_id, reward_id, created_by)
  values (target_player, transaction_kind, transaction_amount, transaction_key, transaction_description, related_tournament, related_reward, auth.uid())
  on conflict (idempotency_key) do nothing returning id into transaction_id;
  if transaction_id is null then return null; end if;
  perform set_config('app.points_transaction', 'on', true);
  update public.profiles set points_balance = points_balance + balance_delta, updated_at = now()
  where id = target_player and points_balance + balance_delta >= 0;
  if not found then raise exception 'Insufficient points or player not found'; end if;
  return transaction_id;
end;
$$;
revoke all on function public.apply_point_transaction(uuid, public.point_transaction_kind, bigint, text, text, uuid, uuid) from public, anon;
grant execute on function public.apply_point_transaction(uuid, public.point_transaction_kind, bigint, text, text, uuid, uuid) to authenticated;

create or replace function public.verify_tournament_match(
  target_match uuid,
  target_winner uuid,
  target_result jsonb,
  target_evidence_url text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  match_row public.matches%rowtype;
  result_id uuid;
  winner_player uuid;
  next_match public.matches%rowtype;
begin
  if not public.is_administrator() then raise exception 'Not authorized'; end if;
  select * into match_row from public.matches where id = target_match for update;
  if not found then raise exception 'Match not found'; end if;
  if match_row.status = 'verified' then raise exception 'Match result already verified'; end if;
  if target_winner is distinct from match_row.participant_a
    and target_winner is distinct from match_row.participant_b then
    raise exception 'Winner must be a match participant';
  end if;
  if target_result is null or jsonb_typeof(target_result) <> 'object' then
    raise exception 'Result data must be an object';
  end if;

  insert into public.match_results(match_id, submitted_by, result_data, evidence_url, verified_by, verified_at)
  values (match_row.id, auth.uid(), target_result, target_evidence_url, auth.uid(), now())
  returning id into result_id;
  update public.matches set winner_id = target_winner, status = 'verified' where id = match_row.id;

  if match_row.next_match_id is not null then
    select * into next_match from public.matches where id = match_row.next_match_id for update;
    if next_match.participant_a is null then
      update public.matches set participant_a = target_winner where id = next_match.id;
    elsif next_match.participant_b is null then
      update public.matches set participant_b = target_winner where id = next_match.id;
    else
      raise exception 'Next match already has both participants';
    end if;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'match.result_verified', 'match', match_row.id,
    jsonb_build_object('winner_registration_id', target_winner, 'result_id', result_id));

  select player_id into winner_player
  from public.tournament_registrations
  where id = target_winner;
  if winner_player is not null then
    insert into public.notifications(player_id, kind, title, body)
    values (winner_player, 'match_result', 'Match result verified', 'Your verified tournament result is ready.');
  end if;
  return result_id;
end;
$$;
revoke all on function public.verify_tournament_match(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.verify_tournament_match(uuid, uuid, jsonb, text) to authenticated;

alter table public.games enable row level security;
alter table public.profiles enable row level security;
alter table public.connected_game_accounts enable row level security;
alter table public.game_statistics enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_brackets enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;
alter table public.leaderboards enable row level security;
alter table public.rewards enable row level security;
alter table public.point_transactions enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "Games are visible" on public.games for select using (true);
create policy "Profiles are public" on public.profiles for select using (true);
create policy "Players update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Game accounts are visible" on public.connected_game_accounts for select using (true);
create policy "Players manage own game accounts" on public.connected_game_accounts for all using (auth.uid() = player_id or public.is_administrator()) with check (auth.uid() = player_id or public.is_administrator());
create policy "Game statistics are visible" on public.game_statistics for select using (true);
create policy "Teams are visible" on public.teams for select using (true);
create policy "Captains manage teams" on public.teams for all using (auth.uid() = captain_id or public.is_administrator()) with check (auth.uid() = captain_id or public.is_administrator());
create policy "Team membership is visible" on public.team_members for select using (true);
create policy "Team membership is managed by captains" on public.team_members for all using (public.is_administrator() or exists (select 1 from public.teams where id = team_id and captain_id = auth.uid())) with check (public.is_administrator() or exists (select 1 from public.teams where id = team_id and captain_id = auth.uid()));
create policy "Participants read invitations" on public.team_invitations for select using (auth.uid() = invited_player_id or auth.uid() = invited_by or public.is_administrator());
create policy "Captains create invitations" on public.team_invitations for insert with check (auth.uid() = invited_by and exists (select 1 from public.teams where id = team_id and captain_id = auth.uid()));
create policy "Players respond to invitations" on public.team_invitations for update using (auth.uid() = invited_player_id) with check (auth.uid() = invited_player_id and status in ('accepted', 'rejected'));
create policy "Published tournaments are visible" on public.tournaments for select using (status <> 'draft' or public.is_administrator());
create policy "Administrators manage tournaments" on public.tournaments for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Registration visible to owner and admins" on public.tournament_registrations for select using (auth.uid() = player_id or public.is_administrator() or exists (select 1 from public.team_members where team_id = tournament_registrations.team_id and player_id = auth.uid()));
create policy "Admins review registrations" on public.tournament_registrations for update using (public.is_administrator()) with check (public.is_administrator());
create policy "Brackets are visible" on public.tournament_brackets for select using (true);
create policy "Administrators manage brackets" on public.tournament_brackets for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Matches are visible" on public.matches for select using (true);
create policy "Administrators manage matches" on public.matches for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Match results are visible" on public.match_results for select using (true);
create policy "Players submit match results" on public.match_results for insert with check (auth.uid() = submitted_by);
create policy "Admins verify match results" on public.match_results for update using (public.is_administrator()) with check (public.is_administrator());
create policy "Leaderboards are visible" on public.leaderboards for select using (true);
create policy "Administrators manage leaderboards" on public.leaderboards for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Active rewards are visible" on public.rewards for select using (is_active or public.is_administrator());
create policy "Administrators manage rewards" on public.rewards for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Players read own point ledger" on public.point_transactions for select using (auth.uid() = player_id or public.is_administrator());
create policy "Active products are visible" on public.products for select using (is_active or public.is_administrator());
create policy "Administrators manage products" on public.products for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Players read own orders" on public.orders for select using (auth.uid() = player_id or public.is_administrator());
create policy "Administrators manage orders" on public.orders for all using (public.is_administrator()) with check (public.is_administrator());
create policy "Players read own order items" on public.order_items for select using (exists (select 1 from public.orders where id = order_id and (player_id = auth.uid() or public.is_administrator())));
create policy "Players read own notifications" on public.notifications for select using (auth.uid() = player_id);
create policy "Players mark own notifications read" on public.notifications for update using (auth.uid() = player_id) with check (auth.uid() = player_id);
create policy "Administrators read audit log" on public.audit_logs for select using (public.is_administrator());
create policy "Administrators write audit log" on public.audit_logs for insert with check (public.is_administrator());

insert into public.games(slug, name, integration_key, team_min, team_max) values
  ('bgmi', 'BGMI', 'bgmi', 1, 4),
  ('brawl-stars', 'Brawl Stars', 'brawl-stars', 1, 3),
  ('minecraft', 'Minecraft', 'minecraft', 1, 8),
  ('free-fire', 'Free Fire', 'free-fire', 1, 4),
  ('valorant', 'VALORANT', 'valorant', 1, 5)
on conflict (slug) do nothing;

create policy "Realtime notifications for owner" on public.notifications for select using (auth.uid() = player_id);