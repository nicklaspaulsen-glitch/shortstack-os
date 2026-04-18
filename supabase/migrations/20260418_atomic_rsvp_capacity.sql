-- Atomic RSVP insert/update with capacity check.
-- Prevents race where two concurrent RSVPs both see capacity available
-- and both insert, pushing the event over max_attendees.
create or replace function rsvp_to_event(
  p_event_id uuid,
  p_user_id uuid,
  p_rsvp_status text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_event record;
  v_existing record;
  v_going_count int;
  v_was_going bool;
begin
  if p_rsvp_status not in ('going','maybe','not_going') then
    return jsonb_build_object('success', false, 'error', 'invalid rsvp_status');
  end if;

  select id, max_attendees into v_event
    from community_events
    where id = p_event_id
    for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'event_not_found');
  end if;

  select id, rsvp_status into v_existing
    from community_event_rsvps
    where event_id = p_event_id and user_id = p_user_id;

  if found and v_existing.rsvp_status = p_rsvp_status then
    delete from community_event_rsvps where id = v_existing.id;
    update community_events
      set attendees_count = (
        select count(*) from community_event_rsvps
        where event_id = p_event_id and rsvp_status = 'going'
      )
      where id = p_event_id;
    return jsonb_build_object('success', true, 'rsvp_status', null);
  end if;

  v_was_going := coalesce(v_existing.rsvp_status = 'going', false);

  if p_rsvp_status = 'going' and v_event.max_attendees is not null then
    select count(*) into v_going_count
      from community_event_rsvps
      where event_id = p_event_id and rsvp_status = 'going';
    if not v_was_going and v_going_count >= v_event.max_attendees then
      return jsonb_build_object('success', false, 'error', 'at_capacity');
    end if;
  end if;

  if v_existing.id is not null then
    update community_event_rsvps set rsvp_status = p_rsvp_status where id = v_existing.id;
  else
    insert into community_event_rsvps (event_id, user_id, rsvp_status)
      values (p_event_id, p_user_id, p_rsvp_status);
  end if;

  update community_events
    set attendees_count = (
      select count(*) from community_event_rsvps
      where event_id = p_event_id and rsvp_status = 'going'
    )
    where id = p_event_id;

  return jsonb_build_object('success', true, 'rsvp_status', p_rsvp_status);
end;
$$;

grant execute on function rsvp_to_event(uuid, uuid, text) to authenticated;
