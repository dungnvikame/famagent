-- "Cẩm nang theo tuổi" (plan 260929-1508): child_milestones also keeps the guide tips a family marked "Đã thử"
-- (ids tip-<stage>-<n>, status 'done'). Only the id check widens; rows are unchanged. Back up child_milestones first.
alter table public.child_milestones drop constraint if exists child_milestones_milestone_id_check;
alter table public.child_milestones add constraint child_milestones_milestone_id_check
  check (milestone_id ~ '^(m[0-9]{1,2}-[slcm][0-9]{1,2}|who-[a-z-]{2,30}|tip-[0-9]{1,2}-[0-9]{1,2})$');
