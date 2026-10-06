-- =============================================================================
-- Privacidad (Ley 1581 de 2012) y eliminación de cuenta (requisito de Google Play)
-- - Autorización del tratamiento de datos: versión de la política aceptada y fecha.
-- - Eliminar la cuenta: se borran el acceso (auth.users) y los datos personales del perfil. Los registros de
--   jornada se conservan, con nombre y cédula, por obligación laboral.
-- =============================================================================

-- ─── Consentimiento ──────────────────────────────────────────────────────────

alter table public.profiles
  add column politica_version text check (politica_version is null or length(politica_version) <= 20),
  add column politica_aceptada_en timestamptz,
  add column cuenta_eliminada_en timestamptz,
  add column cedula_retenida text; -- cédula de una cuenta eliminada (deja libre la cédula para registrarse de nuevo)

comment on column public.profiles.politica_version is 'Versión de la política de privacidad que el operario autorizó.';

/** El operario autoriza la versión vigente de la política de privacidad. */
create function public.aceptar_politica(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if coalesce(p_version, '') !~ '^[0-9A-Za-z.-]{1,20}$' then
    raise exception 'Versión de la política no válida.';
  end if;
  update public.profiles
  set politica_version = p_version, politica_aceptada_en = now()
  where id = auth.uid() and cuenta_eliminada_en is null;
end;
$$;

revoke execute on function public.aceptar_politica(text) from public, anon;
grant execute on function public.aceptar_politica(text) to authenticated;

-- El registro guarda la autorización que el operario marcó en el formulario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  v_cedula text := trim(meta ->> 'cedula');
  v_nacimiento date := nullif(meta ->> 'fecha_nacimiento', '')::date;
  v_politica text := nullif(meta ->> 'politica_version', '');
begin
  if not public.cedula_autorizada(v_cedula) then
    raise exception 'El documento % no está autorizado para registrarse.', v_cedula;
  end if;
  if v_nacimiento is not null and v_nacimiento > (now() at time zone 'America/Bogota')::date - interval '14 years' then
    raise exception 'La fecha de nacimiento no es válida.';
  end if;

  insert into public.profiles (
    id, cedula, email, tipo_id, nombres, apellidos,
    fecha_nacimiento, lugar_nacimiento, lugar_expedicion, fecha_expedicion,
    genero, estado_civil, nivel_estudio, celular,
    direccion, barrio, urbanizacion, apto_casa, conyuge, hijos,
    politica_version, politica_aceptada_en
  ) values (
    new.id,
    v_cedula,
    lower(new.email),
    coalesce(meta ->> 'tipo_id', 'CC'),
    trim(meta ->> 'nombres'),
    trim(meta ->> 'apellidos'),
    v_nacimiento,
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
    coalesce(meta -> 'hijos', '[]'::jsonb),
    v_politica,
    case when v_politica is not null then now() end
  );
  return new;
end;
$$;

-- ─── Eliminación de cuenta ───────────────────────────────────────────────────

-- Los registros laborales ya no se borran en cascada con el usuario de Auth
alter table public.marcas drop constraint if exists marcas_user_id_fkey;
alter table public.jornadas drop constraint if exists jornadas_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column cedula drop not null;

/**
 * Al borrar un usuario de Auth (desde la app o desde el panel de Supabase) se eliminan sus datos personales.
 * Se conservan nombre, cédula y registros de jornada por obligación laboral.
 */
create function public.anonimizar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set
    cedula_retenida = coalesce(cedula, cedula_retenida),
    cedula = null,
    email = 'cuenta-eliminada-' || left(id::text, 8) || '@eliminada.invalid',
    celular = null, direccion = null, barrio = null, urbanizacion = null, apto_casa = null,
    fecha_nacimiento = null, lugar_nacimiento = null, lugar_expedicion = null, fecha_expedicion = null,
    genero = null, estado_civil = null, nivel_estudio = null,
    conyuge = null, hijos = '[]'::jsonb,
    cuenta_eliminada_en = now()
  where id = old.id;
  delete from public.intentos_acceso where clave = (select cedula_retenida from public.profiles where id = old.id);
  return old;
end;
$$;

revoke execute on function public.anonimizar_perfil() from public, anon, authenticated;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.anonimizar_perfil();

/** El operario elimina su cuenta. Debe escribir ELIMINAR para confirmar. */
create function public.eliminar_mi_cuenta(p_confirmacion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if coalesce(p_confirmacion, '') <> 'ELIMINAR' then
    raise exception 'Escribe ELIMINAR para confirmar.';
  end if;
  delete from auth.users where id = auth.uid(); -- el trigger on_auth_user_deleted borra los datos personales
end;
$$;

revoke execute on function public.eliminar_mi_cuenta(text) from public, anon;
grant execute on function public.eliminar_mi_cuenta(text) to authenticated;

-- El supervisor sigue viendo las horas de quien eliminó su cuenta (señalado)
drop function public.operarios_equipo();
create function public.operarios_equipo()
returns table (id uuid, cedula text, full_name text, cuenta_eliminada boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_supervisor() then
    raise exception 'Solo los supervisores pueden ver el equipo.';
  end if;
  return query
    select p.id, coalesce(p.cedula, p.cedula_retenida), p.full_name, p.cuenta_eliminada_en is not null
    from public.profiles p
    order by p.cuenta_eliminada_en is not null, p.full_name;
end;
$$;

revoke execute on function public.operarios_equipo() from public, anon;
grant execute on function public.operarios_equipo() to authenticated;
