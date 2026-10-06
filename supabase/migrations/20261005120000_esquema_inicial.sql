-- =============================================================================
-- Control de Horas — esquema inicial
-- Cada operario solo puede leer y modificar sus propios datos (RLS).
-- Las horas totales, nocturnas y extras se calculan en la app a partir de las marcas.
-- =============================================================================

-- ─── Perfiles de operario ────────────────────────────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  cedula            text not null unique check (cedula ~ '^[0-9]{3,15}$'),
  email             text not null,
  tipo_id           text not null default 'CC' check (tipo_id in ('CC', 'CE', 'PPT', 'PAS')),
  nombres           text not null,
  apellidos         text not null,
  full_name         text generated always as (nombres || ' ' || apellidos) stored,
  fecha_nacimiento  date,
  lugar_nacimiento  text,
  lugar_expedicion  text,
  fecha_expedicion  date,
  genero            text,
  estado_civil      text,
  nivel_estudio     text,
  celular           text,
  direccion         text,
  barrio            text,
  urbanizacion      text,
  apto_casa         text,
  conyuge           jsonb,                       -- { tipoId, id, nombres, apellidos, fechaNacimiento } o null
  hijos             jsonb not null default '[]', -- [{ tipoId, id, nombres, apellidos, fechaNacimiento }]
  status            text not null default 'PENDIENTE',
  position          text not null default 'OPERARIO / PENDIENTE',
  created_at        timestamptz not null default now()
);

comment on table public.profiles is 'Datos del operario. Se crea automáticamente al registrarse (trigger on_auth_user_created).';

alter table public.profiles enable row level security;

-- Solo lectura del propio perfil. No hay políticas de insert/update/delete:
-- el perfil lo crea el trigger y los campos de nómina (status, position) no los edita el operario.
create policy "Operario lee su perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Crea el perfil a partir de los metadatos enviados en supabase.auth.signUp().
-- Corre en la misma transacción que el alta del usuario: si falla (p. ej. cédula duplicada),
-- el usuario tampoco se crea.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (
    id, cedula, email, tipo_id, nombres, apellidos,
    fecha_nacimiento, lugar_nacimiento, lugar_expedicion, fecha_expedicion,
    genero, estado_civil, nivel_estudio, celular,
    direccion, barrio, urbanizacion, apto_casa, conyuge, hijos
  ) values (
    new.id,
    meta ->> 'cedula',
    lower(new.email),
    coalesce(meta ->> 'tipo_id', 'CC'),
    meta ->> 'nombres',
    meta ->> 'apellidos',
    nullif(meta ->> 'fecha_nacimiento', '')::date,
    nullif(meta ->> 'lugar_nacimiento', ''),
    nullif(meta ->> 'lugar_expedicion', ''),
    nullif(meta ->> 'fecha_expedicion', '')::date,
    nullif(meta ->> 'genero', ''),
    nullif(meta ->> 'estado_civil', ''),
    nullif(meta ->> 'nivel_estudio', ''),
    nullif(meta ->> 'celular', ''),
    nullif(meta ->> 'direccion', ''),
    nullif(meta ->> 'barrio', ''),
    nullif(meta ->> 'urbanizacion', ''),
    nullif(meta ->> 'apto_casa', ''),
    case when jsonb_typeof(meta -> 'conyuge') = 'object' then meta -> 'conyuge' end,
    coalesce(meta -> 'hijos', '[]'::jsonb)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Funciones públicas para login y registro por cédula ─────────────────────
-- Exponen el mínimo indispensable: el correo asociado a una cédula, o si la cédula ya existe.
-- Ningún otro dato del perfil es accesible sin sesión.

create function public.email_para_login(p_cedula text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select email from public.profiles where cedula = trim(p_cedula);
$$;

create function public.cedula_disponible(p_cedula text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where cedula = trim(p_cedula));
$$;

revoke execute on function public.email_para_login(text) from public;
revoke execute on function public.cedula_disponible(text) from public;
grant execute on function public.email_para_login(text) to anon, authenticated;
grant execute on function public.cedula_disponible(text) to anon, authenticated;

-- ─── Jornadas (detalle de cada día) ──────────────────────────────────────────

create table public.jornadas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha       date not null,
  es_festivo  boolean not null default false,   -- domingo o festivo: aplica recargo dominical
  notas       text,
  updated_at  timestamptz not null default now(),
  unique (user_id, fecha)
);

alter table public.jornadas enable row level security;

create policy "Operario gestiona sus jornadas"
  on public.jornadas for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── Marcas ──────────────────────────────────────────────────────────────────

create table public.marcas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha         date not null,                  -- día al que se imputan las horas (fecha local)
  tipo          text not null check (tipo in ('ENTRADA', 'SALIDA', 'MANUAL', 'MANUAL_JORNADA')),
  momento       timestamptz,                    -- instante real (ENTRADA / SALIDA)
  hora_ingreso  text,                           -- registro manual por horario
  hora_salida   text,
  horas         numeric(5, 2),                  -- jornada directa
  latitud       double precision,
  longitud      double precision,
  precision_m   double precision,
  zona          text,
  created_at    timestamptz not null default now(),

  constraint marca_coherente check (
    (tipo in ('ENTRADA', 'SALIDA') and momento is not null)
    or (tipo = 'MANUAL' and hora_ingreso is not null and hora_salida is not null)
    or (tipo = 'MANUAL_JORNADA' and horas > 0 and horas <= 24)
  )
);

create index marcas_user_fecha_idx on public.marcas (user_id, fecha, created_at);

alter table public.marcas enable row level security;

-- Las marcas no se editan (auditoría): solo se crean, se leen y se eliminan con su día.
create policy "Operario lee sus marcas"
  on public.marcas for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Operario crea sus marcas"
  on public.marcas for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Operario elimina sus marcas"
  on public.marcas for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ─── Operaciones de varios pasos (atómicas) ──────────────────────────────────

-- Registro manual: guarda el detalle del día y la marca en una sola transacción.
create function public.registrar_manual(
  p_fecha date,
  p_es_festivo boolean,
  p_notas text,
  p_hora_ingreso text default null,
  p_hora_salida text default null,
  p_horas numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.jornadas (fecha, es_festivo, notas)
  values (p_fecha, p_es_festivo, p_notas)
  on conflict (user_id, fecha) do update
    set es_festivo = excluded.es_festivo,
        notas = excluded.notas,
        updated_at = now();

  insert into public.marcas (fecha, tipo, hora_ingreso, hora_salida, horas, zona)
  values (
    p_fecha,
    case when p_horas is not null then 'MANUAL_JORNADA' else 'MANUAL' end,
    p_hora_ingreso,
    p_hora_salida,
    p_horas,
    case when p_horas is not null then 'Registro Jornada Faena' else 'Registro Manual' end
  );
end;
$$;

-- Elimina el día completo: detalle y todas sus marcas.
create function public.eliminar_jornada(p_fecha date)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.marcas where user_id = (select auth.uid()) and fecha = p_fecha;
  delete from public.jornadas where user_id = (select auth.uid()) and fecha = p_fecha;
$$;

revoke execute on function public.registrar_manual(date, boolean, text, text, text, numeric) from public, anon;
revoke execute on function public.eliminar_jornada(date) from public, anon;
grant execute on function public.registrar_manual(date, boolean, text, text, text, numeric) to authenticated;
grant execute on function public.eliminar_jornada(date) to authenticated;

-- ─── Tiempo real (sincroniza varios dispositivos del mismo operario) ─────────

alter publication supabase_realtime add table public.jornadas, public.marcas;
