-- =============================================================================
-- Operación
-- - Marcas registradas sin conexión: el celular las guarda y las envía al recuperar la señal. La hora viene
--   del celular, así que se valida que sea coherente y la marca queda señalada (sin_conexion).
-- - Supervisores: lectura de las marcas y jornadas de todos los operarios (solo datos laborales).
-- =============================================================================

-- ─── Marcas sin conexión ─────────────────────────────────────────────────────

alter table public.marcas
  add column sin_conexion boolean not null default false,
  add column id_cliente uuid; -- identificador que genera el celular: evita duplicados al reintentar el envío

comment on column public.marcas.sin_conexion is
  'Registrada sin señal: la hora es la del celular (validada al recibirla). created_at es la hora en que llegó al servidor.';

create unique index marcas_id_cliente_idx on public.marcas (user_id, id_cliente) where id_cliente is not null;

/**
 * Registra una marca que el celular guardó sin conexión. Devuelve 'ENTRADA' o 'SALIDA'.
 * Es idempotente: reenviar la misma marca (mismo p_id_cliente) no la duplica.
 */
create function public.ponchar_sin_conexion(
  p_id_cliente uuid,
  p_momento timestamptz,
  p_tipo text,
  p_latitud double precision default null,
  p_longitud double precision default null,
  p_precision double precision default null,
  p_motivo_sin_gps text default null,
  p_ubicacion_simulada boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_fecha date := (p_momento at time zone 'America/Bogota')::date;
  v_con_gps boolean := p_latitud is not null and p_longitud is not null;
  v_motivo text := case when v_con_gps then null else nullif(trim(p_motivo_sin_gps), '') end;
  v_existente text;
  v_ultimo_tipo text;
  v_ultima_fecha date;
  v_ultimo_momento timestamptz;
  v_esperado text;
  v_medianoche timestamptz;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar una marca.';
  end if;
  if p_id_cliente is null or p_momento is null or p_tipo not in ('ENTRADA', 'SALIDA') then
    raise exception 'La marca sin conexión está incompleta.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- Reintento de una marca que ya llegó: se responde lo mismo sin duplicarla
  select m.tipo into v_existente from public.marcas m where m.user_id = v_uid and m.id_cliente = p_id_cliente;
  if v_existente is not null then
    return v_existente;
  end if;

  if not v_con_gps and coalesce(length(v_motivo), 0) < 3 then
    raise exception 'Sin ubicación GPS es obligatorio indicar el motivo.';
  end if;
  if v_con_gps and (abs(p_latitud) > 90 or abs(p_longitud) > 180) then
    raise exception 'La ubicación recibida no es válida.';
  end if;
  if p_momento > now() + interval '2 minutes' then
    raise exception 'La hora de la marca sin conexión está en el futuro: revisa la hora del celular.';
  end if;
  if p_momento < now() - interval '72 hours' then
    raise exception 'La marca sin conexión tiene más de 72 horas: regístrala como registro manual.';
  end if;

  select m.tipo, m.fecha, m.momento
    into v_ultimo_tipo, v_ultima_fecha, v_ultimo_momento
  from public.marcas m
  where m.user_id = v_uid and m.tipo in ('ENTRADA', 'SALIDA')
  order by m.momento desc, m.created_at desc
  limit 1;

  if v_ultimo_momento is not null and p_momento <= v_ultimo_momento + interval '1 minute' then
    raise exception 'La marca sin conexión es anterior a tu última marca registrada.';
  end if;

  -- Turno abierto solo si la última marca es una ENTRADA del mismo día o del anterior (igual que ponchar)
  v_esperado := case
    when v_ultimo_tipo = 'ENTRADA' and v_ultima_fecha >= v_fecha - 1 then 'SALIDA'
    else 'ENTRADA'
  end;
  if p_tipo <> v_esperado then
    raise exception 'La marca sin conexión (%) no coincide con el estado de tu turno: regístrala como registro manual.', p_tipo;
  end if;

  if p_tipo = 'SALIDA' and v_ultima_fecha < v_fecha then
    v_medianoche := v_fecha::timestamp at time zone 'America/Bogota';
    insert into public.marcas (user_id, fecha, tipo, momento, zona, corte_medianoche) values
      (v_uid, v_ultima_fecha, 'SALIDA', v_medianoche, 'Corte de medianoche', true),
      (v_uid, v_fecha, 'ENTRADA', v_medianoche, 'Corte de medianoche', true);
  end if;

  insert into public.marcas (
    user_id, fecha, tipo, momento, latitud, longitud, precision_m, motivo_sin_gps, ubicacion_simulada, sin_conexion, id_cliente
  ) values (
    v_uid, v_fecha, p_tipo, p_momento, p_latitud, p_longitud, p_precision, v_motivo,
    coalesce(p_ubicacion_simulada, false), true, p_id_cliente
  );
  return p_tipo;
end;
$$;

revoke execute on function public.ponchar_sin_conexion(uuid, timestamptz, text, double precision, double precision, double precision, text, boolean) from public, anon;
grant execute on function public.ponchar_sin_conexion(uuid, timestamptz, text, double precision, double precision, double precision, text, boolean) to authenticated;

-- ─── Supervisores ────────────────────────────────────────────────────────────

create table public.supervisores (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);
comment on table public.supervisores is
  'Usuarios con lectura de las horas de todo el equipo. Se administra desde el SQL Editor (supabase/README.md).';
alter table public.supervisores enable row level security;
revoke all on public.supervisores from anon, authenticated;

-- La auditoría identifica la fila por id, cédula o, en esta tabla, user_id
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nueva jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_vieja jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_fila jsonb := coalesce(v_nueva, v_vieja);
  v_cambios jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('antes', v_vieja -> n.key, 'despues', n.value))
    into v_cambios
    from jsonb_each(v_nueva) n
    where n.key <> 'updated_at' and (v_vieja -> n.key) is distinct from n.value;
    if v_cambios is null then
      return new; -- actualización sin cambios reales
    end if;
  end if;

  insert into public.auditoria (tabla, registro_id, accion, cambios, usuario_id)
  values (
    tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'cedula', v_fila ->> 'user_id', ''),
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    coalesce(v_cambios, v_nueva, v_vieja),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger auditoria_supervisores
  after insert or update or delete on public.supervisores
  for each row execute function public.registrar_auditoria();

create function public.es_supervisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.supervisores where user_id = (select auth.uid()));
$$;

revoke execute on function public.es_supervisor() from public, anon;
grant execute on function public.es_supervisor() to authenticated;

-- Lectura de marcas y jornadas de todo el equipo (se suman a las políticas del propio operario)
create policy "Supervisor lee todas las marcas"
  on public.marcas for select to authenticated
  using ((select public.es_supervisor()));
create policy "Supervisor lee todas las jornadas"
  on public.jornadas for select to authenticated
  using ((select public.es_supervisor()));

/** Operarios del equipo, solo con sus datos laborales (sin dirección, familia ni contacto). */
create function public.operarios_equipo()
returns table (id uuid, cedula text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_supervisor() then
    raise exception 'Solo los supervisores pueden ver el equipo.';
  end if;
  return query select p.id, p.cedula, p.full_name from public.profiles p order by p.full_name;
end;
$$;

revoke execute on function public.operarios_equipo() from public, anon;
grant execute on function public.operarios_equipo() to authenticated;
