-- EL CAIMAN CAR WASH
-- Directorio privado de clientes para Administración.
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No modifica reservas, pagos, comisiones, lavadores ni Edge Functions.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text not null check (char_length(trim(phone)) between 7 and 30),
  email text,
  address text not null check (char_length(trim(address)) between 2 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  license_plate text not null check (char_length(trim(license_plate)) between 1 and 30),
  vehicle_type text not null check (vehicle_type in ('sedan', 'suv', '4x4', 'pickup', 'busito')),
  created_at timestamptz not null default now()
);

create index if not exists customers_full_name_idx on public.customers (lower(full_name));
create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customer_vehicles_customer_id_idx on public.customer_vehicles (customer_id);
create index if not exists customer_vehicles_plate_idx on public.customer_vehicles (upper(license_plate));

alter table public.customers enable row level security;
alter table public.customer_vehicles enable row level security;

revoke all on public.customers from anon;
revoke all on public.customer_vehicles from anon;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_vehicles to authenticated;

drop policy if exists "Active admins manage customer directory" on public.customers;
create policy "Active admins manage customer directory"
on public.customers
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  )
);

drop policy if exists "Active admins manage customer vehicles" on public.customer_vehicles;
create policy "Active admins manage customer vehicles"
on public.customer_vehicles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  )
  and exists (
    select 1 from public.customers c
    where c.id = customer_vehicles.customer_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  )
  and exists (
    select 1 from public.customers c
    where c.id = customer_vehicles.customer_id
  )
);

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_customers_updated_at();
