create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  rol text not null default 'lector' check (rol in ('admin', 'editor', 'lector')),
  created_at timestamptz not null default now()
);

create table public.actas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_nacimiento date,
  lugar_nacimiento text,
  padre text,
  madre text,
  padrinos text,
  testigos text,
  fecha_bautizo date,
  fecha_registro date,
  libro text,
  folio text,
  partida text,
  imagen_path text,
  confianza numeric(4, 3) check (confianza between 0 and 1),
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index actas_created_at_idx on public.actas (created_at desc);
create index actas_nombre_idx on public.actas (lower(nombre));
create index actas_creado_por_idx on public.actas (creado_por);

create function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email));
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil();

create function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.perfiles where id = (select auth.uid());
$$;

create function public.tocar_actualizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger actas_actualizacion
before update on public.actas
for each row execute function public.tocar_actualizacion();

revoke execute on function public.crear_perfil() from public, anon, authenticated;
revoke execute on function public.rol_actual() from public, anon;
grant execute on function public.rol_actual() to authenticated;

create or replace function public.reclamar_primer_admin(usuario_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.perfiles admin bootstrap'));
  if exists (select 1 from public.perfiles where rol = 'admin') then
    return false;
  end if;
  update public.perfiles set rol = 'admin' where id = usuario_id;
  return found;
end;
$$;

revoke execute on function public.reclamar_primer_admin(uuid) from public, anon, authenticated;
grant execute on function public.reclamar_primer_admin(uuid) to service_role;

alter table public.perfiles enable row level security;
alter table public.actas enable row level security;

create policy perfiles_propio on public.perfiles
for select to authenticated
using ((select auth.uid()) = id);

create policy actas_lectura on public.actas
for select to authenticated
using ((select public.rol_actual()) in ('admin', 'editor', 'lector'));

create policy actas_alta on public.actas
for insert to authenticated
with check ((select public.rol_actual()) in ('admin', 'editor'));

create policy actas_cambio on public.actas
for update to authenticated
using ((select public.rol_actual()) in ('admin', 'editor'))
with check ((select public.rol_actual()) in ('admin', 'editor'));

create policy actas_baja on public.actas
for delete to authenticated
using ((select public.rol_actual()) = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('actas', 'actas', false, 15728640, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy actas_imagenes_lectura on storage.objects
for select to authenticated
using (bucket_id = 'actas' and (select public.rol_actual()) is not null);

alter table public.actas replica identity full;
alter publication supabase_realtime add table public.actas;
