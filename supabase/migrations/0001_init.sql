-- Spotify compartido: esquema, reglas contables y seguridad (RLS).
-- NO EJECUTADA: no había Postgres en el entorno de construcción. Pruébala en un proyecto Supabase nuevo.

create table members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null unique,
  role text not null check (role in ('admin','member')),
  start_month date check (start_month is null or extract(day from start_month) = 1),
  created_at timestamptz not null default now()
);
-- Un solo administrador en todo el sistema
create unique index one_admin on members (role) where role = 'admin';

create table settings (
  id boolean primary key default true check (id),
  monthly_price_cop integer check (monthly_price_cop > 0),   -- configurable; sin valor inventado
  currency text not null default 'COP' check (currency = 'COP'),
  timezone text not null default 'America/Bogota',
  period_mode text not null default 'calendar' check (period_mode in ('calendar','anchored')),
  period_anchor_date date
);
insert into settings default values;

create table payments (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references members(id),
  amount_cop integer not null check (amount_cop > 0),
  paid_on date not null,
  reference text,
  receipt_path text,
  notes text,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE','APROBADO','RECHAZADO','REVERTIDO')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references members(id),
  reviewed_at timestamptz,
  rejection_reason text,
  unassigned_cop integer not null default 0 check (unassigned_cop >= 0),
  check (status <> 'RECHAZADO' or nullif(trim(rejection_reason), '') is not null)
);
create index on payments (payer_id);
create index on payments (status);
create index on payments (lower(reference)) where reference is not null;  -- detección de duplicados

create table payment_allocations (
  payment_id uuid not null references payments(id) on delete cascade,
  beneficiary_id uuid not null references members(id),
  months smallint not null check (months >= 1),
  primary key (payment_id, beneficiary_id)
);

create table coverage_periods (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  payment_id uuid not null references payments(id),
  period date not null check (extract(day from period) = 1),
  revoked_at timestamptz,
  revoked_by uuid references members(id)
);
-- Nunca dos coberturas activas para el mismo integrante y mes (ni con solicitudes simultáneas)
create unique index one_active_period on coverage_periods (member_id, period) where revoked_at is null;
create index on coverage_periods (payment_id);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references members(id),
  action text not null,
  payment_id uuid references payments(id),
  detail jsonb
);
create function audit_immutable() returns trigger language plpgsql as
$$ begin raise exception 'audit_log es inmodificable'; end $$;
create trigger audit_no_change before update or delete on audit_log
  for each row execute function audit_immutable();

-- ---------- Ayudantes de identidad ----------
create function current_member_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from members where auth_user_id = auth.uid() $$;
create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where auth_user_id = auth.uid() and role = 'admin') $$;

create or replace function claim_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  update members set auth_user_id = v_user_id where id = p_member_id and auth_user_id is null;
  if not found then
    raise exception 'Miembro no disponible o ya reclamado';
  end if;
end $$;

grant execute on function claim_member(uuid) to authenticated;

-- ---------- Operaciones del administrador (transaccionales e idempotentes) ----------
create function approve_payment(p_payment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p payments; a payment_allocations; m members;
  price integer; assigned integer; per date; i int;
begin
  if not is_admin() then raise exception 'Solo el administrador puede aprobar'; end if;
  select * into p from payments where id = p_payment_id for update;   -- bloquea: serializa solicitudes simultáneas
  if not found then raise exception 'Pago no encontrado'; end if;
  if p.status = 'APROBADO' then return; end if;                        -- idempotente
  if p.status <> 'PENDIENTE' then raise exception 'Un pago % no puede aprobarse', p.status; end if;
  select monthly_price_cop into price from settings;
  if price is null then raise exception 'Falta configurar el precio mensual'; end if;
  select coalesce(sum(months), 0) * price into assigned from payment_allocations where payment_id = p.id;
  if assigned > p.amount_cop then raise exception 'Las asignaciones superan el importe'; end if;
  for a in select * from payment_allocations where payment_id = p.id loop
    select * into m from members where id = a.beneficiary_id;
    if m.start_month is null then raise exception '% no tiene fecha inicial de cobertura', m.name; end if;
    per := m.start_month;
    for i in 1..a.months loop
      while exists (select 1 from coverage_periods where member_id = m.id and period = per and revoked_at is null) loop
        per := (per + interval '1 month')::date;                        -- salta meses ya cubiertos: deuda más antigua primero
      end loop;
      insert into coverage_periods (member_id, payment_id, period) values (m.id, p.id, per);
      per := (per + interval '1 month')::date;
    end loop;
  end loop;
  update payments set status = 'APROBADO', reviewed_by = current_member_id(), reviewed_at = now(),
         unassigned_cop = p.amount_cop - assigned where id = p.id;
  insert into audit_log (actor_id, action, payment_id) values (current_member_id(), 'APROBADO', p.id);
end $$;

create function reject_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo el administrador puede rechazar'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indica el motivo del rechazo'; end if;
  update payments set status = 'RECHAZADO', rejection_reason = trim(p_reason),
         reviewed_by = current_member_id(), reviewed_at = now()
   where id = p_payment_id and status = 'PENDIENTE';
  if not found then raise exception 'Solo se rechazan pagos pendientes'; end if;
  insert into audit_log (actor_id, action, payment_id, detail)
    values (current_member_id(), 'RECHAZADO', p_payment_id, to_jsonb(trim(p_reason)));
end $$;

create function reverse_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo el administrador puede revertir'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indica el motivo de la reversión'; end if;
  update payments set status = 'REVERTIDO' where id = p_payment_id and status = 'APROBADO';
  if not found then raise exception 'Solo se revierten pagos aprobados'; end if;
  update coverage_periods set revoked_at = now(), revoked_by = current_member_id()
   where payment_id = p_payment_id and revoked_at is null;            -- se marca, nunca se borra
  insert into audit_log (actor_id, action, payment_id, detail)
    values (current_member_id(), 'REVERTIDO', p_payment_id, to_jsonb(trim(p_reason)));
end $$;

revoke all on function approve_payment(uuid), reject_payment(uuid, text), reverse_payment(uuid, text) from public;
grant execute on function approve_payment(uuid), reject_payment(uuid, text), reverse_payment(uuid, text) to authenticated;

-- ---------- Row Level Security ----------
alter table members enable row level security;
alter table settings enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;
alter table coverage_periods enable row level security;
alter table audit_log enable row level security;

create policy members_read on members for select to authenticated using (is_admin() or id = current_member_id());
create policy members_read_unclaimed on members for select to anon using (auth_user_id is null);
create policy members_admin_write on members for all to authenticated using (is_admin()) with check (is_admin());

grant select on members to anon;
create policy settings_read on settings for select to authenticated using (true);
create policy settings_admin_write on settings for update to authenticated using (is_admin()) with check (is_admin());

create policy payments_read on payments for select to authenticated using (
  is_admin() or payer_id = current_member_id()
  or exists (select 1 from payment_allocations x where x.payment_id = id and x.beneficiary_id = current_member_id()));
-- Los integrantes solo crean pagos PENDIENTE a su nombre; aprobar/rechazar/revertir va por funciones
create policy payments_member_insert on payments for insert to authenticated
  with check (payer_id = current_member_id() and status = 'PENDIENTE' and reviewed_by is null);

create policy alloc_read on payment_allocations for select to authenticated using (
  is_admin() or beneficiary_id = current_member_id()
  or exists (select 1 from payments p where p.id = payment_id and p.payer_id = current_member_id()));
create policy alloc_member_insert on payment_allocations for insert to authenticated with check (
  exists (select 1 from payments p where p.id = payment_id and p.payer_id = current_member_id() and p.status = 'PENDIENTE'));

create policy coverage_read on coverage_periods for select to authenticated using (is_admin() or member_id = current_member_id());
create policy audit_admin_read on audit_log for select to authenticated using (is_admin());

-- Sin UPDATE/DELETE directo sobre tablas contables (solo vía funciones)
revoke update, delete on payments, payment_allocations, coverage_periods, audit_log from authenticated, anon;

-- ---------- Almacenamiento privado de comprobantes ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']);

-- Ruta obligatoria: <member_id>/<archivo>
create policy receipts_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = current_member_id()::text);
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (is_admin() or (storage.foldername(name))[1] = current_member_id()::text));

-- ---------- Integrantes preconfigurados (sin correos ni contraseñas) ----------
insert into members (name, role) values
  ('David','admin'), ('Catalina','member'), ('Camila','member'),
  ('Estevan','member'), ('Angélica','member'), ('Mariana','member');
