-- =============================================================================
-- Integridad del ponchado
-- - La hora de cada marca la pone el servidor (hora de Colombia), no el celular.
-- - Las marcas no se borran: las manuales se anulan con motivo; las de entrada/salida no se anulan.
-- - Los registros manuales tienen límites: últimos 7 días, sin fechas futuras, máximo 24 h por día
--   y sin cruzarse con otras marcas.
-- - Ubicación simulada (Android) queda registrada.
-- - Domingos y festivos los calcula la app con el calendario oficial: se quita el campo manual.
-- - Auditoría: quién creó o cambió qué y cuándo.
-- =============================================================================

-- ─── Funciones y políticas que se reemplazan ─────────────────────────────────

drop function public.eliminar_jornada(date);
drop function public.registrar_manual(date, boolean, text, text, text, numeric);

drop policy "Operario crea sus marcas" on public.marcas;
drop policy "Operario elimina sus marcas" on public.marcas;
-- Las marcas solo se escriben mediante las funciones de este archivo
revoke insert, update, delete, truncate on public.marcas from anon, authenticated;

drop policy "Operario gestiona sus jornadas" on public.jornadas;
create policy "Operario lee sus jornadas"
  on public.jornadas for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Operario crea sus jornadas"
  on public.jornadas for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Operario edita sus jornadas"
  on public.jornadas for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke delete, truncate on public.jornadas from anon, authenticated;

-- ─── Columnas y validaciones ─────────────────────────────────────────────────

alter table public.jornadas drop column es_festivo;
alter table public.jornadas
  add constraint notas_largo check (notas is null or length(notas) <= 500) not valid;

alter table public.marcas
  add column anulada_en timestamptz,
  add column motivo_anulacion text,
  add column ubicacion_simulada boolean not null default false;

comment on column public.marcas.anulada_en is 'Las marcas manuales no se borran: se anulan con motivo y dejan de sumar horas.';
comment on column public.marcas.ubicacion_simulada is 'Android reportó que la ubicación era simulada (app de GPS falso).';

alter table public.marcas
  add constraint anulacion_coherente check (
    (anulada_en is null and motivo_anulacion is null)
    or (anulada_en is not null
        and tipo in ('MANUAL', 'MANUAL_JORNADA')
        and length(trim(motivo_anulacion)) between 5 and 200)
  ),
  add constraint motivo_sin_gps_largo check (motivo_sin_gps is null or length(motivo_sin_gps) <= 200) not valid,
  -- Horas manuales en formato 24 h ("08:00", "17:30"); NOT VALID respeta los registros de prueba anteriores
  add constraint hora_manual_formato check (
    tipo <> 'MANUAL'
    or (hora_ingreso ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and hora_salida ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  ) not valid;

-- ─── Auxiliares internas (no expuestas a la API) ─────────────────────────────

/** Intervalos de tiempo ocupados por las marcas vigentes de un operario entre dos fechas. */
create function public.intervalos_operario(p_uid uuid, p_desde date, p_hasta date)
returns table (fecha date, rango tstzrange)
language sql
stable
set search_path = ''
as $$
  -- Tramos ENTRADA → SALIDA (un turno abierto cuenta hasta ahora)
  select t.fecha, tstzrange(t.momento, coalesce(t.siguiente, now()))
  from (
    select m.fecha, m.tipo, m.momento,
           case when lead(m.tipo) over w = 'SALIDA' then lead(m.momento) over w end as siguiente,
           lead(m.tipo) over w as tipo_siguiente
    from public.marcas m
    where m.user_id = p_uid
      and m.tipo in ('ENTRADA', 'SALIDA')
      and m.fecha between p_desde and p_hasta
    window w as (order by m.momento, m.created_at)
  ) t
  where t.tipo = 'ENTRADA' and (t.siguiente is not null or t.tipo_siguiente is null)

  union all

  -- Registros manuales por horario (si la salida es menor que la entrada, cruzan la medianoche)
  select m.fecha,
         tstzrange(
           (m.fecha + m.hora_ingreso::time) at time zone 'America/Bogota',
           (m.fecha + m.hora_salida::time + case when m.hora_salida::time <= m.hora_ingreso::time then interval '1 day' else interval '0' end)
             at time zone 'America/Bogota'
         )
  from public.marcas m
  where m.user_id = p_uid
    and m.tipo = 'MANUAL'
    and m.anulada_en is null
    and m.fecha between p_desde and p_hasta
    and m.hora_ingreso ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and m.hora_salida ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
$$;

/** Horas vigentes registradas en un día: tramos en tiempo real + manuales por horario + jornadas directas. */
create function public.horas_registradas(p_uid uuid, p_fecha date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select sum(extract(epoch from upper(i.rango) - lower(i.rango)) / 3600)
    from public.intervalos_operario(p_uid, p_fecha, p_fecha) i
    where i.fecha = p_fecha
  ), 0) + coalesce((
    select sum(m.horas)
    from public.marcas m
    where m.user_id = p_uid and m.fecha = p_fecha and m.tipo = 'MANUAL_JORNADA' and m.anulada_en is null
  ), 0);
$$;

revoke execute on function public.intervalos_operario(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.horas_registradas(uuid, date) from public, anon, authenticated;

-- ─── Ponchado en tiempo real ─────────────────────────────────────────────────

/**
 * Registra la siguiente marca del operario con la hora del servidor y devuelve 'ENTRADA' o 'SALIDA'.
 * Si el turno empezó ayer, lo corta a las 00:00 (hora de Colombia) para que cada día lleve sus horas.
 */
create function public.ponchar(
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
  v_ahora timestamptz := now();
  v_hoy date := (v_ahora at time zone 'America/Bogota')::date;
  v_con_gps boolean := p_latitud is not null and p_longitud is not null;
  v_motivo text := case when v_con_gps then null else nullif(trim(p_motivo_sin_gps), '') end;
  v_ultimo_tipo text;
  v_ultima_fecha date;
  v_ultimo_momento timestamptz;
  v_medianoche timestamptz;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar una marca.';
  end if;
  if not v_con_gps and coalesce(length(v_motivo), 0) < 3 then
    raise exception 'Sin ubicación GPS es obligatorio indicar el motivo.';
  end if;
  if v_con_gps and (abs(p_latitud) > 90 or abs(p_longitud) > 180) then
    raise exception 'La ubicación recibida no es válida.';
  end if;

  -- Una marca a la vez por operario: evita duplicados por doble toque o dos dispositivos
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select m.tipo, m.fecha, m.momento
    into v_ultimo_tipo, v_ultima_fecha, v_ultimo_momento
  from public.marcas m
  where m.user_id = v_uid and m.tipo in ('ENTRADA', 'SALIDA') and m.fecha >= v_hoy - 1
  order by m.momento desc, m.created_at desc
  limit 1;

  if v_ultimo_momento is not null and v_ahora - v_ultimo_momento < interval '1 minute' then
    raise exception 'Ya registraste una marca hace menos de un minuto.';
  end if;

  -- Sin turno abierto: entrada
  if v_ultimo_tipo is distinct from 'ENTRADA' then
    insert into public.marcas (user_id, fecha, tipo, momento, latitud, longitud, precision_m, motivo_sin_gps, ubicacion_simulada)
    values (v_uid, v_hoy, 'ENTRADA', v_ahora, p_latitud, p_longitud, p_precision, v_motivo, coalesce(p_ubicacion_simulada, false));
    return 'ENTRADA';
  end if;

  -- Turno abierto desde ayer: se corta a la medianoche
  if v_ultima_fecha < v_hoy then
    v_medianoche := v_hoy::timestamp at time zone 'America/Bogota';
    insert into public.marcas (user_id, fecha, tipo, momento, zona, corte_medianoche) values
      (v_uid, v_ultima_fecha, 'SALIDA', v_medianoche, 'Corte de medianoche', true),
      (v_uid, v_hoy, 'ENTRADA', v_medianoche, 'Corte de medianoche', true);
  end if;

  insert into public.marcas (user_id, fecha, tipo, momento, latitud, longitud, precision_m, motivo_sin_gps, ubicacion_simulada)
  values (v_uid, v_hoy, 'SALIDA', v_ahora, p_latitud, p_longitud, p_precision, v_motivo, coalesce(p_ubicacion_simulada, false));
  return 'SALIDA';
end;
$$;

-- ─── Registro manual con límites ─────────────────────────────────────────────

/**
 * Registra horas manuales de un día: por horario (p_hora_ingreso y p_hora_salida en formato 24 h)
 * o por jornada directa (p_horas). Solo los últimos 7 días, sin cruces y sin superar 24 h en el día.
 */
create function public.registrar_manual(
  p_fecha date,
  p_notas text default null,
  p_hora_ingreso text default null,
  p_hora_salida text default null,
  p_horas numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_por_horario boolean := p_hora_ingreso is not null or p_hora_salida is not null;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_nuevas numeric;
  v_existentes numeric;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar horas.';
  end if;
  if p_fecha is null or p_fecha > v_hoy then
    raise exception 'No puedes registrar horas en una fecha futura.';
  end if;
  if p_fecha < v_hoy - 7 then
    raise exception 'Solo puedes registrar horas manuales de los últimos 7 días.';
  end if;
  if v_por_horario = (p_horas is not null) then
    raise exception 'Indica el horario (entrada y salida) o las horas de la jornada, no ambos.';
  end if;
  if length(coalesce(p_notas, '')) > 500 then
    raise exception 'La observación no puede superar 500 caracteres.';
  end if;

  if v_por_horario then
    if coalesce(p_hora_ingreso, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(p_hora_salida, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Las horas deben tener el formato HH:MM (24 horas).';
    end if;
    if p_hora_ingreso = p_hora_salida then
      raise exception 'La hora de entrada y la de salida no pueden ser iguales.';
    end if;

    v_inicio := (p_fecha + p_hora_ingreso::time) at time zone 'America/Bogota';
    v_fin := (p_fecha + p_hora_salida::time) at time zone 'America/Bogota';
    if v_fin <= v_inicio then
      v_fin := v_fin + interval '1 day'; -- cruza la medianoche
    end if;
    if v_inicio > now() then
      raise exception 'El horario no puede empezar en el futuro.';
    end if;

    if exists (
      select 1 from public.intervalos_operario(v_uid, p_fecha - 1, p_fecha + 1) i
      where i.rango && tstzrange(v_inicio, v_fin)
    ) then
      raise exception 'Ese horario se cruza con otra marca ya registrada.';
    end if;

    v_nuevas := extract(epoch from v_fin - v_inicio) / 3600;
  else
    if p_horas <= 0 or p_horas > 24 then
      raise exception 'Las horas de la jornada deben estar entre 0 y 24.';
    end if;
    v_nuevas := p_horas;
  end if;

  v_existentes := public.horas_registradas(v_uid, p_fecha);
  if v_existentes + v_nuevas > 24 then
    raise exception 'Con este registro el día superaría las 24 horas (ya tiene % h).', round(v_existentes, 1);
  end if;

  insert into public.jornadas (user_id, fecha, notas)
  values (v_uid, p_fecha, nullif(trim(p_notas), ''))
  on conflict (user_id, fecha) do update
    set notas = coalesce(excluded.notas, public.jornadas.notas),
        updated_at = now();

  insert into public.marcas (user_id, fecha, tipo, hora_ingreso, hora_salida, horas, zona)
  values (
    v_uid, p_fecha,
    case when v_por_horario then 'MANUAL' else 'MANUAL_JORNADA' end,
    p_hora_ingreso, p_hora_salida, p_horas,
    case when v_por_horario then 'Registro Manual' else 'Registro Jornada Faena' end
  );
end;
$$;

-- ─── Anulación de registros manuales ─────────────────────────────────────────

create function public.anular_marca(p_marca_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text;
  v_anulada timestamptz;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select m.tipo, m.anulada_en into v_tipo, v_anulada
  from public.marcas m
  where m.id = p_marca_id and m.user_id = v_uid
  for update;

  if v_tipo is null then
    raise exception 'No se encontró la marca.';
  end if;
  if v_tipo not in ('MANUAL', 'MANUAL_JORNADA') then
    raise exception 'Las marcas de entrada y salida no se pueden anular.';
  end if;
  if v_anulada is not null then
    raise exception 'Esta marca ya estaba anulada.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) not between 5 and 200 then
    raise exception 'Escribe el motivo de la anulación (entre 5 y 200 caracteres).';
  end if;

  update public.marcas
  set anulada_en = now(), motivo_anulacion = trim(p_motivo)
  where id = p_marca_id;
end;
$$;

revoke execute on function public.ponchar(double precision, double precision, double precision, text, boolean) from public, anon;
revoke execute on function public.registrar_manual(date, text, text, text, numeric) from public, anon;
revoke execute on function public.anular_marca(uuid, text) from public, anon;
grant execute on function public.ponchar(double precision, double precision, double precision, text, boolean) to authenticated;
grant execute on function public.registrar_manual(date, text, text, text, numeric) to authenticated;
grant execute on function public.anular_marca(uuid, text) to authenticated;

-- ─── Auditoría ───────────────────────────────────────────────────────────────

create table public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('crear', 'modificar', 'eliminar')),
  -- crear/eliminar: la fila completa; modificar: { campo: { "antes": ..., "despues": ... } }
  cambios     jsonb not null,
  usuario_id  uuid,
  fecha       timestamptz not null default now()
);

comment on table public.auditoria is 'Historial de cambios. Solo lo escriben los triggers; se consulta desde el panel de Supabase.';

create index auditoria_fecha_idx on public.auditoria (fecha desc);
create index auditoria_registro_idx on public.auditoria (tabla, registro_id);

-- RLS sin políticas: nadie la lee ni la escribe desde la API
alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;

create function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nueva jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_vieja jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
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
    coalesce(v_nueva, v_vieja) ->> 'id',
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    coalesce(v_cambios, v_nueva, v_vieja),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

create trigger auditoria_marcas
  after insert or update or delete on public.marcas
  for each row execute function public.registrar_auditoria();
create trigger auditoria_jornadas
  after insert or update or delete on public.jornadas
  for each row execute function public.registrar_auditoria();
create trigger auditoria_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.registrar_auditoria();
