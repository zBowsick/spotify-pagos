-- Fase 2: comprobantes, vistas de panel y consultas auxiliares.
-- Se ejecuta DESPUÉS de 0001_init.sql.

-- ---------- Comprobantes ----------
create table receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete set null,
  member_id uuid not null references members(id),
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  original_name text,
  uploaded_at timestamptz not null default now()
);
create index on receipts (payment_id);
create index on receipts (member_id);

alter table receipts enable row level security;
create policy receipts_select on receipts for select to authenticated using (
  is_admin() or member_id = current_member_id()
);
-- Los integrantes crean comprobantes solo a su nombre; el admin puede crear para cualquiera.
create policy receipts_insert on receipts for insert to authenticated
  with check (is_admin() or member_id = current_member_id());
create policy receipts_admin_delete on receipts for delete to authenticated using (is_admin());

-- ---------- Vista de estado de cada integrante ----------
create or replace view member_coverage_summary as
select
  m.id as member_id,
  m.name,
  m.role,
  m.start_month,
  coalesce(count(c.period), 0)::int as months_covered,
  count(c.period) as active_periods,
  max(c.period) as covered_through
from members m
left join (
  select cp.member_id, cp.period, cp.payment_id
  from coverage_periods cp
  where cp.revoked_at is null
) c on c.member_id = m.id
group by m.id, m.name, m.role, m.start_month;

-- ---------- Vista de pagos con allocations ----------
create or replace view payment_detail as
select
  p.id, p.payer_id, mp.name as payer_name, p.amount_cop, p.paid_on, p.reference,
  p.status, p.submitted_at, p.reviewed_by, mr.name as reviewer_name, p.reviewed_at,
  p.rejection_reason, p.unassigned_cop, p.receipt_path
from payments p
join members mp on mp.id = p.payer_id
left join members mr on mr.id = p.reviewed_by;

-- ---------- Consulta: panel del administrador ----------
-- Devuelve todo lo que necesita el dashboard de David en una sola consulta.
create or replace function admin_dashboard(as_of timestamptz = now())
returns json
language sql stable security definer set search_path = public as $$
select json_build_object(
  'settings', (select row_to_json(s) from settings s where id = true),
  'members', (
    select json_agg(m order by m.name)
    from (
      select
        mem.id, mem.name, mem.role, mem.start_month,
        coalesce(sum(pa.months), 0)::int as allocated_months,
        count(pay.id) as payments_received,
        coalesce(sum(pay.amount_cop), 0) as received_cop,
        coalesce(sum(pay.amount_cop) filter (where pay.status = 'APROBADO'), 0) as approved_cop,
        count(pay.id) filter (where pay.status = 'PENDIENTE') as pending_payments,
        count(pay.id) filter (where pay.status = 'RECHAZADO') as rejected_payments,
        count(pay.id) filter (where pay.status = 'REVERTIDO') as reversed_payments
      from members mem
      left join payment_allocations pa on pa.beneficiary_id = mem.id
      left join payments pay on pay.payer_id = mem.id
      group by mem.id, mem.name, mem.role, mem.start_month
      order by mem.name
    ) m
  ),
  'payments', (
    select json_agg(p order by p.submitted_at desc)
    from (
      select pd.*, json_agg(json_build_object('beneficiaryId', pa.beneficiary_id, 'months', pa.months)) as allocations
      from payment_detail pd
      left join payment_allocations pa on pa.payment_id = pd.id
      group by pd.*
    ) p
  ),
  'pending_receipts', (
    select count(*) from payments where status = 'PENDIENTE'
  ),
  'coverage', (
    select json_agg(c order by c.member_id, c.period)
    from (
      select member_id, period, payment_id
      from coverage_periods
      where revoked_at is null
      order by member_id, period
    ) c
  )
);
$$;

-- ---------- Consulta: panel de un integrante ----------
create or replace function member_dashboard(p_member_id uuid)
returns json
language sql stable security definer set search_path = public as $$
select json_build_object(
  'member', (select json_build_object('id', id, 'name', name, 'role', role, 'start_month', start_month) from members where id = p_member_id),
  'payments_sent', (
    select coalesce(json_agg(p order by p.submitted_at desc), '[]'::json)
    from (
      select pd.*, json_agg(json_build_object('beneficiaryId', pa.beneficiary_id, 'months', pa.months)) as allocations
      from payment_detail pd
      left join payment_allocations pa on pa.payment_id = pd.id
      where pd.payer_id = p_member_id
      group by pd.*
    ) p
  ),
  'coverage', (
    select json_agg(c order by c.period)
    from (
      select cp.period, cp.payment_id, cp.revoked_at
      from coverage_periods cp
      where cp.member_id = p_member_id
      order by cp.period
    ) c
  ),
  'allocations_received', (
    select coalesce(json_agg(p order by p.submitted_at desc), '[]'::json)
    from (
      select pd.*, json_agg(json_build_object('beneficiaryId', pa.beneficiary_id, 'months', pa.months)) as allocations
      from payment_detail pd
      left join payment_allocations pa on pa.payment_id = pd.id
      where pd.id in (select payment_id from payment_allocations where beneficiary_id = p_member_id)
      group by pd.*
    ) p
  )
);
$$;

revoke all on function admin_dashboard(timestamptz), member_dashboard(uuid) from public;
grant execute on function admin_dashboard(timestamptz), member_dashboard(uuid) to authenticated;

-- Los integrantes solo pueden ver sus propios comprobantes.
alter table receipts enable row level security;
alter table receipts force row level security;