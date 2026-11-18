-- Team tournament registration: the caller must captain a team for a tournament-compatible game.
create or replace function public.register_team_for_tournament(target_tournament uuid, target_team uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tournament_row public.tournaments%rowtype;
  team_row public.teams%rowtype;
  registration_id uuid;
  registered_count integer;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament for update;
  if not found then raise exception 'Tournament not found'; end if;
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
  select count(*) into registered_count from public.tournament_registrations
    where tournament_id = target_tournament and status <> 'rejected';
  if registered_count >= tournament_row.capacity then raise exception 'Tournament is full'; end if;
  insert into public.tournament_registrations(tournament_id, team_id, status)
    values (target_tournament, target_team, 'pending')
    on conflict do nothing returning id into registration_id;
  if registration_id is null then raise exception 'Already registered'; end if;
  return registration_id;
end;
$$;
revoke all on function public.register_team_for_tournament(uuid, uuid) from public, anon;
grant execute on function public.register_team_for_tournament(uuid, uuid) to authenticated;

-- Atomically redeem a reward once. Point debits and inventory updates share a transaction.
create or replace function public.redeem_reward(target_reward uuid, transaction_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  reward_row public.rewards%rowtype;
  transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into reward_row from public.rewards where id = target_reward for update;
  if not found or not reward_row.is_active then raise exception 'Reward not available'; end if;
  if reward_row.inventory is not null and reward_row.inventory <= 0 then raise exception 'Reward is out of stock'; end if;
  if (select points_balance from public.profiles where id = auth.uid()) < reward_row.points_cost then
    raise exception 'Insufficient points';
  end if;

  insert into public.point_transactions(player_id, kind, amount, idempotency_key, reward_id, description)
  values (auth.uid(), 'redemption', reward_row.points_cost, transaction_key, target_reward, 'Redeemed ' || reward_row.name)
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
revoke all on function public.redeem_reward(uuid, text) from public, anon;
grant execute on function public.redeem_reward(uuid, text) to authenticated;

-- Protect point transactions from direct insert/update/delete; only SQL functions may write the ledger.
revoke insert, update, delete on public.point_transactions from authenticated;
revoke insert, update, delete on public.point_transactions from anon;
