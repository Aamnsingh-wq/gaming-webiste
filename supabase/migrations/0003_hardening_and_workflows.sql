-- 0003: privileges, security hardening, and transactional workflows.
-- Additive and data-preserving: no tables or rows are dropped. URL checks are
-- added NOT VALID so existing rows are kept while new writes are validated.

-- ---------------------------------------------------------------------------
-- 1. Table privileges. RLS decides *which rows*; these grants decide whether a
--    role may touch the table at all. Without them every Data API call fails
--    with "permission denied" (42501) on projects that do not auto-grant.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  public.games, public.profiles, public.teams, public.team_members, public.tournaments,
  public.tournament_registrations, public.tournament_brackets, public.matches,
  public.match_results, public.leaderboards, public.rewards, public.products, public.game_statistics
to anon, authenticated;

grant select on
  public.connected_game_accounts, public.team_invitations, public.point_transactions,
  public.orders, public.order_items, public.notifications, public.audit_logs
to authenticated;

-- Players may only edit presentation columns of their profile. Role and points
-- stay server controlled even if the trigger in 0001 were ever removed.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, updated_at) on public.profiles to authenticated;

grant insert, update, delete on public.connected_game_accounts to authenticated;
grant update, delete on public.teams to authenticated;
grant insert, update on public.team_invitations to authenticated;
grant insert, update, delete on
  public.tournaments, public.tournament_brackets, public.matches, public.leaderboards,
  public.rewards, public.products, public.orders, public.order_items
to authenticated;
grant update on public.tournament_registrations to authenticated;
grant insert, update on public.match_results to authenticated;
grant insert, update on public.notifications to authenticated;
grant insert on public.audit_logs to authenticated;
-- Team creation and membership changes go through the RPCs below.
revoke insert on public.teams from authenticated;
revoke insert, update, delete on public.team_members from authenticated;
-- The ledger stays write-protected (see 0002).
revoke insert, update, delete on public.point_transactions from anon, authenticated;

-- RLS policies call is_administrator() as the querying role.
grant execute on function public.is_administrator() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Signup trigger: usernames longer than 24 characters and the old fallback
--    (which contained '-') violated the username check and aborted signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
  requested_display text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), '');
  requested_username := left(regexp_replace(requested_username, '[^A-Za-z0-9_]', '', 'g'), 24);
  if length(requested_username) < 3 then
    requested_username := 'player_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  requested_display := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username), 60);
  begin
    insert into public.profiles(id, username, display_name) values (new.id, requested_username, requested_display);
  exception when unique_violation then
    insert into public.profiles(id, username, display_name)
    values (new.id, 'player_' || substr(replace(new.id::text, '-', ''), 1, 16), requested_display);
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. URL hygiene: only http(s) links may be stored (blocks javascript: URLs).
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_avatar_url_http;
alter table public.profiles add constraint profiles_avatar_url_http check (avatar_url is null or avatar_url ~* '^https?://') not valid;
alter table public.teams drop constraint if exists teams_logo_url_http;
alter table public.teams add constraint teams_logo_url_http check (logo_url is null or logo_url ~* '^https?://') not valid;
alter table public.tournaments drop constraint if exists tournaments_banner_url_http;
alter table public.tournaments add constraint tournaments_banner_url_http check (banner_url is null or banner_url ~* '^https?://') not valid;
alter table public.tournaments drop constraint if exists tournaments_accent_hex;
alter table public.tournaments add constraint tournaments_accent_hex check (accent ~ '^#[0-9a-fA-F]{6}$') not valid;
alter table public.connected_game_accounts drop constraint if exists game_accounts_evidence_http;
alter table public.connected_game_accounts add constraint game_accounts_evidence_http check (verification_evidence is null or verification_evidence ~* '^https?://') not valid;
alter table public.match_results drop constraint if exists match_results_evidence_http;
alter table public.match_results add constraint match_results_evidence_http check (evidence_url is null or evidence_url ~* '^https?://') not valid;
alter table public.products drop constraint if exists products_urls_http;
alter table public.products add constraint products_urls_http check (
  (affiliate_url is null or affiliate_url ~* '^https?://') and (image_url is null or image_url ~* '^https?://')
) not valid;

-- ---------------------------------------------------------------------------
-- 4. Game accounts: evidence is private, and only admins may verify.
-- ---------------------------------------------------------------------------
drop policy if exists "Game accounts are visible" on public.connected_game_accounts;

create or replace function public.protect_game_account_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_administrator() then return new; end if;
  if tg_op = 'INSERT' then
    if new.verification_status not in ('unverified', 'pending') then new.verification_status := 'unverified'; end if;
    new.provider_data := '{}'::jsonb;
    new.last_synced_at := null;
    return new;
  end if;
  if new.verification_status in ('verified', 'rejected')
    and new.verification_status is distinct from old.verification_status then
    raise exception 'Verification status is managed by administrators';
  end if;
  if old.verification_status in ('verified', 'rejected')
    and (new.game_username is distinct from old.game_username or new.external_player_id is distinct from old.external_player_id) then
    new.verification_status := 'unverified';
  end if;
  new.provider_data := old.provider_data;
  new.last_synced_at := old.last_synced_at;
  return new;
end;
$$;
drop trigger if exists protect_game_account_verification on public.connected_game_accounts;
create trigger protect_game_account_verification before insert or update on public.connected_game_accounts
for each row execute procedure public.protect_game_account_verification();

-- ---------------------------------------------------------------------------
-- 5. Notifications and match results policies.
-- ---------------------------------------------------------------------------
drop policy if exists "Realtime notifications for owner" on public.notifications; -- duplicate of the read policy
drop policy if exists "Administrators send notifications" on public.notifications;
create policy "Administrators send notifications" on public.notifications for insert with check (public.is_administrator());

drop policy if exists "Players submit match results" on public.match_results;
drop policy if exists "Participants submit match results" on public.match_results;
create policy "Participants submit match results" on public.match_results for insert with check (
  auth.uid() = submitted_by and verified_by is null and exists (
    select 1 from public.matches m
    join public.tournament_registrations r on r.id in (m.participant_a, m.participant_b)
    where m.id = match_id
      and (r.player_id = auth.uid() or exists (
        select 1 from public.team_members tm where tm.team_id = r.team_id and tm.player_id = auth.uid()))
  )
);
drop policy if exists "Match results are visible" on public.match_results;
create policy "Match results are visible" on public.match_results for select using (
  verified_at is not null or auth.uid() = submitted_by or public.is_administrator()
);

-- Approved entrants are public (brackets and participant lists need them).
drop policy if exists "Approved registrations are public" on public.tournament_registrations;
create policy "Approved registrations are public" on public.tournament_registrations for select using (
  status = 'approved' and exists (select 1 from public.tournaments t where t.id = tournament_id and t.status <> 'draft')
);

-- ---------------------------------------------------------------------------
-- 6. Teams: atomic create / invite / respond / leave.
-- ---------------------------------------------------------------------------
create or replace function public.create_team(target_game text, team_name text, team_slug text, team_logo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  game_row public.games%rowtype;
  new_team uuid;
begin
  if caller is null then raise exception 'Sign in required'; end if;
  if exists (select 1 from public.team_members where player_id = caller) then
    raise exception 'You are already on a team. Leave it before creating a new one.';
  end if;
  select * into game_row from public.games where slug = target_game;
  if not found then raise exception 'Game not found'; end if;
  if length(trim(team_name)) < 3 or length(trim(team_name)) > 60 then raise exception 'Team name must be 3-60 characters'; end if;
  if team_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(team_slug) > 48 then raise exception 'Team URL may only use lowercase letters, numbers, and dashes'; end if;
  if team_logo is not null and team_logo !~* '^https?://' then raise exception 'Logo must be an http(s) URL'; end if;
  begin
    insert into public.teams(game_id, name, slug, logo_url, captain_id)
    values (game_row.id, trim(team_name), team_slug, team_logo, caller) returning id into new_team;
  exception when unique_violation then
    raise exception 'That team URL is already taken';
  end;
  insert into public.team_members(team_id, player_id, role) values (new_team, caller, 'captain');
  return new_team;
end;
$$;

create or replace function public.invite_to_team(target_team uuid, target_username text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  team_row public.teams%rowtype;
  invitee uuid;
  roster integer;
  roster_max integer;
  invitation_id uuid;
begin
  if caller is null then raise exception 'Sign in required'; end if;
  select * into team_row from public.teams where id = target_team for update;
  if not found then raise exception 'Team not found'; end if;
  if team_row.captain_id <> caller then raise exception 'Only the team captain can invite players'; end if;
  select id into invitee from public.profiles where username = target_username;
  if invitee is null then select id into invitee from public.profiles where lower(username) = lower(target_username) limit 1; end if;
  if invitee is null then raise exception 'Player not found'; end if;
  if invitee = caller then raise exception 'You are already on this team'; end if;
  if exists (select 1 from public.team_members where player_id = invitee) then raise exception 'That player is already on a team'; end if;
  select count(*) into roster from public.team_members where team_id = target_team;
  select team_max into roster_max from public.games where id = team_row.game_id;
  if roster >= roster_max then raise exception 'Roster is full for this game'; end if;
  insert into public.team_invitations(team_id, invited_player_id, invited_by, status)
  values (target_team, invitee, caller, 'pending')
  on conflict (team_id, invited_player_id) do update
    set status = 'pending', invited_by = excluded.invited_by, created_at = now()
    where public.team_invitations.status <> 'pending'
  returning id into invitation_id;
  if invitation_id is null then raise exception 'That player already has a pending invitation'; end if;
  insert into public.notifications(player_id, kind, title, body)
  values (invitee, 'team_invitation', 'Team invitation', 'You have been invited to join ' || team_row.name || '.');
  return invitation_id;
end;
$$;

create or replace function public.respond_team_invitation(target_invitation uuid, accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  invitation public.team_invitations%rowtype;
  team_row public.teams%rowtype;
  roster integer;
  roster_max integer;
begin
  if caller is null then raise exception 'Sign in required'; end if;
  select * into invitation from public.team_invitations where id = target_invitation for update;
  if not found or invitation.invited_player_id <> caller or invitation.status <> 'pending' then
    raise exception 'Invitation not found or already answered';
  end if;
  if not accept then
    update public.team_invitations set status = 'rejected' where id = target_invitation;
    return 'rejected';
  end if;
  select * into team_row from public.teams where id = invitation.team_id for update;
  if exists (select 1 from public.team_members where player_id = caller) then
    raise exception 'You are already on a team. Leave it before joining another.';
  end if;
  select count(*) into roster from public.team_members where team_id = team_row.id;
  select team_max into roster_max from public.games where id = team_row.game_id;
  if roster >= roster_max then raise exception 'This roster is already full'; end if;
  insert into public.team_members(team_id, player_id, role) values (team_row.id, caller, 'member');
  update public.team_invitations set status = 'accepted' where id = target_invitation;
  -- Other pending invitations are void now that the player has a team.
  update public.team_invitations set status = 'cancelled' where invited_player_id = caller and status = 'pending';
  insert into public.notifications(player_id, kind, title, body)
  select team_row.captain_id, 'team_update', 'New teammate',
         coalesce(p.display_name, p.username) || ' joined ' || team_row.name || '.'
  from public.profiles p where p.id = caller;
  return 'accepted';
end;
$$;

create or replace function public.remove_team_member(target_team uuid, target_player uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  team_row public.teams%rowtype;
  roster integer;
begin
  if caller is null then raise exception 'Sign in required'; end if;
  select * into team_row from public.teams where id = target_team for update;
  if not found then raise exception 'Team not found'; end if;
  if not exists (select 1 from public.team_members where team_id = target_team and player_id = target_player) then
    raise exception 'Player is not on this team';
  end if;
  if target_player = team_row.captain_id then
    if caller <> team_row.captain_id then raise exception 'Only the captain can disband the team'; end if;
    select count(*) into roster from public.team_members where team_id = target_team;
    if roster > 1 then raise exception 'Remove the other members before the captain leaves'; end if;
    if exists (
      select 1 from public.tournament_registrations r join public.tournaments t on t.id = r.tournament_id
      where r.team_id = target_team and r.status in ('pending', 'approved') and t.status in ('live', 'completed')
    ) then raise exception 'Teams with tournament history cannot be disbanded'; end if;
    delete from public.teams where id = target_team;
    return 'disbanded';
  end if;
  if caller <> target_player and caller <> team_row.captain_id then
    raise exception 'Only the captain can remove other players';
  end if;
  delete from public.team_members where team_id = target_team and player_id = target_player;
  insert into public.notifications(player_id, kind, title, body)
  values (case when caller = target_player then team_row.captain_id else target_player end, 'team_update', 'Roster change',
          case when caller = target_player then 'A player left ' || team_row.name || '.' else 'You were removed from ' || team_row.name || '.' end);
  return 'removed';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Registrations: team-size enforcement, withdrawn rows free capacity and can
--    be revived, and players can withdraw before brackets are drawn.
-- ---------------------------------------------------------------------------
create or replace function public.register_tournament(target_tournament uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tournament_row public.tournaments%rowtype;
  existing public.tournament_registrations%rowtype;
  registration_id uuid;
  registered_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament for update;
  if not found or tournament_row.status = 'draft' then raise exception 'Tournament not found'; end if;
  if tournament_row.team_size > 1 then raise exception 'This is a team event. Your team captain must register the team'; end if;
  if tournament_row.status <> 'registration_open'
    or now() < tournament_row.registration_opens_at
    or now() >= tournament_row.registration_closes_at then
    raise exception 'Registration is closed';
  end if;
  select * into existing from public.tournament_registrations where tournament_id = target_tournament and player_id = auth.uid();
  if found and existing.status <> 'withdrawn' then raise exception 'Already registered'; end if;
  select count(*) into registered_count from public.tournament_registrations
    where tournament_id = target_tournament and status in ('pending', 'approved');
  if registered_count >= tournament_row.capacity then raise exception 'Tournament is full'; end if;
  if existing.id is not null then
    update public.tournament_registrations set status = 'pending', reviewed_by = null, reviewed_at = null, created_at = now()
    where id = existing.id returning id into registration_id;
    return registration_id;
  end if;
  insert into public.tournament_registrations(tournament_id, player_id, status)
    values (target_tournament, auth.uid(), 'pending') returning id into registration_id;
  return registration_id;
end;
$$;

create or replace function public.register_team_for_tournament(target_tournament uuid, target_team uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tournament_row public.tournaments%rowtype;
  team_row public.teams%rowtype;
  existing public.tournament_registrations%rowtype;
  registration_id uuid;
  registered_count integer;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament for update;
  if not found or tournament_row.status = 'draft' then raise exception 'Tournament not found'; end if;
  select * into team_row from public.teams where id = target_team;
  if not found then raise exception 'Team not found'; end if;
  if team_row.captain_id <> auth.uid() then raise exception 'Only the team captain can register'; end if;
  if team_row.game_id <> tournament_row.game_id then raise exception 'Team game does not match tournament'; end if;
  if tournament_row.status <> 'registration_open'
    or now() < tournament_row.registration_opens_at
    or now() >= tournament_row.registration_closes_at then
    raise exception 'Registration is closed';
  end if;
  select count(*) into member_count from public.team_members where team_id = target_team;
  if member_count < tournament_row.team_size then raise exception 'Team does not meet the required team size'; end if;
  if member_count > tournament_row.team_size then raise exception 'Team exceeds the tournament team size'; end if;
  select * into existing from public.tournament_registrations where tournament_id = target_tournament and team_id = target_team;
  if found and existing.status <> 'withdrawn' then raise exception 'Already registered'; end if;
  select count(*) into registered_count from public.tournament_registrations
    where tournament_id = target_tournament and status in ('pending', 'approved');
  if registered_count >= tournament_row.capacity then raise exception 'Tournament is full'; end if;
  if existing.id is not null then
    update public.tournament_registrations set status = 'pending', reviewed_by = null, reviewed_at = null, created_at = now()
    where id = existing.id returning id into registration_id;
    return registration_id;
  end if;
  insert into public.tournament_registrations(tournament_id, team_id, status)
    values (target_tournament, target_team, 'pending') returning id into registration_id;
  return registration_id;
end;
$$;

create or replace function public.withdraw_registration(target_registration uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  registration public.tournament_registrations%rowtype;
  tournament_status public.tournament_status;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into registration from public.tournament_registrations where id = target_registration for update;
  if not found then raise exception 'Registration not found'; end if;
  if not (registration.player_id = auth.uid()
    or exists (select 1 from public.teams where id = registration.team_id and captain_id = auth.uid())) then
    raise exception 'Registration not found';
  end if;
  if registration.status not in ('pending', 'approved') then raise exception 'Registration is not active'; end if;
  select status into tournament_status from public.tournaments where id = registration.tournament_id;
  if tournament_status in ('live', 'completed', 'cancelled') then raise exception 'This tournament can no longer be left'; end if;
  if exists (select 1 from public.matches where target_registration in (participant_a, participant_b)) then
    raise exception 'Brackets are drawn. Contact an administrator to withdraw';
  end if;
  update public.tournament_registrations set status = 'withdrawn' where id = target_registration;
  return 'withdrawn';
end;
$$;

-- Public entry counts (RLS hides individual pending registrations).
create or replace function public.tournament_entry_counts(target_tournaments uuid[])
returns table(tournament_id uuid, entries bigint) language sql stable security definer set search_path = '' as $$
  select r.tournament_id, count(*)
  from public.tournament_registrations r
  join public.tournaments t on t.id = r.tournament_id and t.status <> 'draft'
  where r.tournament_id = any(target_tournaments) and r.status in ('pending', 'approved')
  group by r.tournament_id;
$$;

-- ---------------------------------------------------------------------------
-- 8. Brackets: save atomically (replaces an unplayed bracket) and advance
--    winners into the correct slot.
-- ---------------------------------------------------------------------------
create or replace function public.save_bracket(target_tournament uuid, rounds jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tournament_row public.tournaments%rowtype;
  new_bracket uuid;
  next_version integer;
  round_data jsonb;
  match_data jsonb;
  entrant uuid;
begin
  if not public.is_administrator() then raise exception 'Not authorized'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament for update;
  if not found then raise exception 'Tournament not found'; end if;
  if tournament_row.status in ('draft', 'completed', 'cancelled') then
    raise exception 'Publish the tournament before generating a bracket';
  end if;
  if jsonb_typeof(rounds) <> 'array' or jsonb_array_length(rounds) = 0 then raise exception 'Bracket data is empty'; end if;
  if exists (
    select 1 from public.matches where tournament_id = target_tournament and status = 'verified'
      and participant_a is not null and participant_b is not null
  ) then
    raise exception 'Results are already verified; the bracket is locked';
  end if;

  for entrant in
    select distinct slot.value::uuid from jsonb_array_elements(rounds -> 0) as m(item), jsonb_each_text(m.item) as slot(key, value)
    where slot.key in ('playerA', 'playerB') and slot.value is not null
  loop
    if not exists (select 1 from public.tournament_registrations
                   where id = entrant and tournament_id = target_tournament and status = 'approved') then
      raise exception 'Bracket contains an entrant that is not approved for this tournament';
    end if;
  end loop;

  delete from public.matches where tournament_id = target_tournament;
  select coalesce(max(version), 0) + 1 into next_version from public.tournament_brackets where tournament_id = target_tournament;
  insert into public.tournament_brackets(tournament_id, version, bracket_data, generated_by)
  values (target_tournament, next_version, rounds, auth.uid()) returning id into new_bracket;

  for round_data in select value from jsonb_array_elements(rounds) loop
    for match_data in select value from jsonb_array_elements(round_data) loop
      insert into public.matches(tournament_id, bracket_id, round_number, match_number, participant_a, participant_b, winner_id, status)
      values (
        target_tournament, new_bracket,
        (match_data ->> 'round')::integer, (match_data ->> 'match')::integer,
        (match_data ->> 'playerA')::uuid, (match_data ->> 'playerB')::uuid, (match_data ->> 'winner')::uuid,
        case when coalesce((match_data ->> 'bye')::boolean, false) then 'verified'::public.match_status else 'scheduled'::public.match_status end
      );
    end loop;
  end loop;

  update public.matches m set next_match_id = n.id
  from public.matches n
  where m.bracket_id = new_bracket and n.bracket_id = new_bracket
    and n.round_number = m.round_number + 1 and n.match_number = (m.match_number + 1) / 2;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'bracket.generated', 'tournament', target_tournament,
          jsonb_build_object('version', next_version, 'rounds', jsonb_array_length(rounds)));
  return new_bracket;
end;
$$;

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
  next_row public.matches%rowtype;
  winner_registration public.tournament_registrations%rowtype;
begin
  if not public.is_administrator() then raise exception 'Not authorized'; end if;
  select * into match_row from public.matches where id = target_match for update;
  if not found then raise exception 'Match not found'; end if;
  if match_row.status = 'verified' then raise exception 'Match result already verified'; end if;
  if match_row.participant_a is null or match_row.participant_b is null then
    raise exception 'Both participants must be decided before verifying';
  end if;
  if target_winner is distinct from match_row.participant_a
    and target_winner is distinct from match_row.participant_b then
    raise exception 'Winner must be a match participant';
  end if;
  if target_result is null or jsonb_typeof(target_result) <> 'object' then
    raise exception 'Result data must be an object';
  end if;
  if target_evidence_url is not null and target_evidence_url !~* '^https?://' then
    raise exception 'Evidence must be an http(s) URL';
  end if;

  insert into public.match_results(match_id, submitted_by, result_data, evidence_url, verified_by, verified_at)
  values (match_row.id, auth.uid(), target_result, target_evidence_url, auth.uid(), now())
  returning id into result_id;
  update public.matches set winner_id = target_winner, status = 'verified' where id = match_row.id;

  if match_row.next_match_id is not null then
    select * into next_row from public.matches where id = match_row.next_match_id for update;
    -- Odd-numbered matches feed slot A, even-numbered feed slot B.
    if match_row.match_number % 2 = 1 then
      if next_row.participant_a is not null then raise exception 'Next match slot is already filled'; end if;
      update public.matches set participant_a = target_winner where id = next_row.id;
    else
      if next_row.participant_b is not null then raise exception 'Next match slot is already filled'; end if;
      update public.matches set participant_b = target_winner where id = next_row.id;
    end if;
  else
    update public.tournaments set status = 'completed' where id = match_row.tournament_id and status = 'live';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'match.result_verified', 'match', match_row.id,
    jsonb_build_object('winner_registration_id', target_winner, 'result_id', result_id));

  select * into winner_registration from public.tournament_registrations where id = target_winner;
  insert into public.notifications(player_id, kind, title, body)
  select recipient, 'match_result', 'Victory verified',
         case when match_row.next_match_id is null then 'You won the final. Congratulations, champion!'
              else 'Your win was verified. You advance to the next round.' end
  from (
    select winner_registration.player_id as recipient where winner_registration.player_id is not null
    union
    select tm.player_id from public.team_members tm where tm.team_id = winner_registration.team_id
  ) recipients;
  return result_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8b. Reward redemption: replay of a completed request returns null (idempotent)
--     instead of failing stock/balance checks; keys are bound to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_reward(target_reward uuid, transaction_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  reward_row public.rewards%rowtype;
  existing_owner uuid;
  transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if transaction_key is null or length(transaction_key) < 8 then raise exception 'Invalid redemption key'; end if;
  select player_id into existing_owner from public.point_transactions where idempotency_key = transaction_key;
  if found then
    if existing_owner = auth.uid() then return null; end if;
    raise exception 'Invalid redemption key';
  end if;
  select * into reward_row from public.rewards where id = target_reward for update;
  if not found or not reward_row.is_active then raise exception 'Reward not available'; end if;
  if reward_row.inventory is not null and reward_row.inventory <= 0 then raise exception 'Reward is out of stock'; end if;
  if (select points_balance from public.profiles where id = auth.uid()) < reward_row.points_cost then
    raise exception 'Insufficient points';
  end if;
  insert into public.point_transactions(player_id, kind, amount, idempotency_key, reward_id, description, created_by)
  values (auth.uid(), 'redemption', reward_row.points_cost, transaction_key, target_reward, 'Redeemed ' || reward_row.name, auth.uid())
  on conflict (idempotency_key) do nothing returning id into transaction_id;
  if transaction_id is null then return null; end if;
  perform set_config('app.points_transaction', 'on', true);
  update public.profiles set points_balance = points_balance - reward_row.points_cost, updated_at = now()
  where id = auth.uid() and points_balance >= reward_row.points_cost;
  if not found then raise exception 'Insufficient points'; end if;
  if reward_row.inventory is not null then
    update public.rewards set inventory = inventory - 1 where id = target_reward and inventory > 0;
    if not found then raise exception 'Reward is out of stock'; end if;
  end if;
  return transaction_id;
end;
$$;
grant execute on function public.redeem_reward(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Leaderboards computed from verified results and the points ledger.
-- ---------------------------------------------------------------------------
create or replace function public.get_player_leaderboard(result_limit integer default 50)
returns table(player_id uuid, username text, display_name text, avatar_url text,
              points_earned bigint, match_wins bigint, tournaments_played bigint)
language sql stable security definer set search_path = '' as $$
  with entries as (
    select r.id, r.tournament_id, r.player_id from public.tournament_registrations r
    where r.status = 'approved' and r.player_id is not null
    union all
    select r.id, r.tournament_id, tm.player_id from public.tournament_registrations r
    join public.team_members tm on tm.team_id = r.team_id where r.status = 'approved'
  ),
  earned as (
    select pt.player_id, sum(pt.amount)::bigint as total from public.point_transactions pt
    where pt.kind = 'award' group by pt.player_id
  ),
  wins as (
    select e.player_id, count(*)::bigint as total from public.matches m join entries e on e.id = m.winner_id
    where m.status = 'verified' and m.participant_a is not null and m.participant_b is not null
    group by e.player_id
  ),
  played as (select e.player_id, count(distinct e.tournament_id)::bigint as total from entries e group by e.player_id)
  select p.id, p.username, p.display_name, p.avatar_url,
         coalesce(earned.total, 0), coalesce(wins.total, 0), coalesce(played.total, 0)
  from public.profiles p
  left join earned on earned.player_id = p.id
  left join wins on wins.player_id = p.id
  left join played on played.player_id = p.id
  where coalesce(earned.total, 0) > 0 or coalesce(played.total, 0) > 0
  order by 5 desc, 6 desc, 7 desc, p.username
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

create or replace function public.get_team_leaderboard(result_limit integer default 50)
returns table(team_id uuid, name text, slug text, logo_url text, game_slug text,
              members bigint, match_wins bigint, tournaments_played bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.slug, t.logo_url, g.slug,
    (select count(*) from public.team_members tm where tm.team_id = t.id)::bigint,
    (select count(*) from public.matches m join public.tournament_registrations r on r.id = m.winner_id
      where r.team_id = t.id and m.status = 'verified' and m.participant_a is not null and m.participant_b is not null)::bigint as wins,
    (select count(distinct r.tournament_id) from public.tournament_registrations r
      where r.team_id = t.id and r.status = 'approved')::bigint as played
  from public.teams t join public.games g on g.id = t.game_id
  order by wins desc, played desc, t.name
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- 10. Housekeeping: updated_at, indexes, function privileges.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tournaments_touch_updated_at on public.tournaments;
create trigger tournaments_touch_updated_at before update on public.tournaments
for each row execute procedure public.touch_updated_at();

create index if not exists tournament_registrations_tournament_idx on public.tournament_registrations(tournament_id, status);
create index if not exists tournament_registrations_team_idx on public.tournament_registrations(team_id) where team_id is not null;
create index if not exists team_invitations_invitee_idx on public.team_invitations(invited_player_id, status);
create index if not exists matches_next_match_idx on public.matches(next_match_id);
create index if not exists matches_winner_idx on public.matches(winner_id);
create index if not exists game_accounts_status_idx on public.connected_game_accounts(verification_status);
create index if not exists point_transactions_kind_idx on public.point_transactions(kind, player_id);

revoke all on function public.create_team(text, text, text, text) from public, anon;
revoke all on function public.invite_to_team(uuid, text) from public, anon;
revoke all on function public.respond_team_invitation(uuid, boolean) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;
revoke all on function public.withdraw_registration(uuid) from public, anon;
revoke all on function public.save_bracket(uuid, jsonb) from public, anon;
grant execute on function public.create_team(text, text, text, text) to authenticated;
grant execute on function public.invite_to_team(uuid, text) to authenticated;
grant execute on function public.respond_team_invitation(uuid, boolean) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.withdraw_registration(uuid) to authenticated;
grant execute on function public.save_bracket(uuid, jsonb) to authenticated;
grant execute on function public.register_tournament(uuid) to authenticated;
grant execute on function public.register_team_for_tournament(uuid, uuid) to authenticated;
grant execute on function public.verify_tournament_match(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.tournament_entry_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_player_leaderboard(integer) to anon, authenticated;
grant execute on function public.get_team_leaderboard(integer) to anon, authenticated;
