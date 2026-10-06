-- =============================================================================
-- Seguridad del acceso
-- - CAPTCHA (Cloudflare Turnstile) verificado desde la base de datos al buscar la cédula. Es opcional: se
--   activa guardando la Secret Key en el Vault con el nombre 'turnstile_secret' (supabase/README.md).
-- - Límite de intentos por IP y por cédula en el login y el registro.
-- - Registro restringido: si public.cedulas_autorizadas tiene filas, solo esas cédulas pueden registrarse.
-- - Validaciones de largo y formato en el perfil.
-- =============================================================================

create extension if not exists http with schema extensions;

-- ─── Límite de intentos ──────────────────────────────────────────────────────

create table public.intentos_acceso (
  id     bigint generated always as identity primary key,
  accion text not null,
  clave  text not null, -- IP o cédula
  fecha  timestamptz not null default now()
);
create index intentos_acceso_idx on public.intentos_acceso (accion, clave, fecha desc);
alter table public.intentos_acceso enable row level security;
revoke all on public.intentos_acceso from anon, authenticated;

/** IP del cliente según las cabeceras que entrega la API de Supabase (mejor esfuerzo). */
create function public.ip_cliente()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    'desconocida'
  );
$$;

/** Registra un intento y devuelve false si ya se superó el máximo dentro de la ventana. */
create function public.registrar_intento(p_accion text, p_clave text, p_maximo int, p_ventana interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.intentos_acceso
      where accion = p_accion and clave = p_clave and fecha > now() - p_ventana) >= p_maximo then
    return false;
  end if;
  insert into public.intentos_acceso (accion, clave) values (p_accion, p_clave);
  -- Limpieza ocasional de intentos viejos
  if random() < 0.02 then
    delete from public.intentos_acceso where fecha < now() - interval '1 day';
  end if;
  return true;
end;
$$;

-- ─── CAPTCHA ─────────────────────────────────────────────────────────────────

create function public.captcha_configurado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where name = 'turnstile_secret' and coalesce(decrypted_secret, '') <> ''
  );
$$;

/**
 * Verifica un token de Turnstile con Cloudflare. Sin la Secret Key en el Vault, el CAPTCHA está desactivado
 * y siempre devuelve true. Si Cloudflare no responde, niega el acceso.
 */
create function public.verificar_captcha(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto text;
  v_respuesta text;
begin
  select decrypted_secret into v_secreto
  from vault.decrypted_secrets where name = 'turnstile_secret' limit 1;

  if coalesce(v_secreto, '') = '' then
    return true;
  end if;
  if coalesce(p_token, '') = '' or length(p_token) > 2048 then
    return false;
  end if;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
  exception when others then
    null; -- versión de la extensión sin esta opción: se usa el tiempo por defecto
  end;

  begin
    select r.content into v_respuesta
    from extensions.http_post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      jsonb_build_object('secret', v_secreto, 'response', p_token, 'remoteip', public.ip_cliente())::text,
      'application/json'
    ) r;
    return coalesce((v_respuesta::jsonb ->> 'success')::boolean, false);
  exception when others then
    return false;
  end;
end;
$$;

-- ─── Registro restringido ────────────────────────────────────────────────────

create table public.cedulas_autorizadas (
  cedula    text primary key check (cedula ~ '^[0-9]{3,15}$'),
  nombre    text check (nombre is null or length(nombre) <= 120),
  creada_en timestamptz not null default now()
);
comment on table public.cedulas_autorizadas is
  'Si tiene filas, solo estas cédulas pueden registrarse. Vacía = registro abierto. Se administra desde el SQL Editor.';
alter table public.cedulas_autorizadas enable row level security;
revoke all on public.cedulas_autorizadas from anon, authenticated;

create function public.cedula_autorizada(p_cedula text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.cedulas_autorizadas)
      or exists (select 1 from public.cedulas_autorizadas where cedula = p_cedula);
$$;

-- ─── Funciones públicas del login y el registro ──────────────────────────────

/**
 * Correo de acceso de una cédula. Devuelve { estado, email? } con estado:
 * 'ok' | 'no_encontrado' | 'captcha' (verificación fallida) | 'limite' (demasiados intentos).
 */
create function public.buscar_acceso(p_cedula text, p_captcha text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := trim(coalesce(p_cedula, ''));
  v_email text;
begin
  if v_cedula !~ '^[0-9]{3,15}$' then
    return jsonb_build_object('estado', 'no_encontrado');
  end if;
  if not public.registrar_intento('acceso_ip', public.ip_cliente(), 30, interval '10 minutes')
     or not public.registrar_intento('acceso_cedula', v_cedula, 10, interval '10 minutes') then
    return jsonb_build_object('estado', 'limite');
  end if;
  if not public.verificar_captcha(p_captcha) then
    return jsonb_build_object('estado', 'captcha');
  end if;

  select email into v_email from public.profiles where cedula = v_cedula;
  if v_email is null then
    return jsonb_build_object('estado', 'no_encontrado');
  end if;
  return jsonb_build_object('estado', 'ok', 'email', v_email);
end;
$$;

/**
 * Si una cédula puede registrarse:
 * 'disponible' | 'registrada' | 'no_autorizada' | 'invalida' | 'captcha' | 'limite'.
 */
create function public.estado_registro(p_cedula text, p_captcha text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := trim(coalesce(p_cedula, ''));
begin
  if v_cedula !~ '^[0-9]{3,15}$' then
    return 'invalida';
  end if;
  if not public.registrar_intento('registro_ip', public.ip_cliente(), 20, interval '10 minutes') then
    return 'limite';
  end if;
  if not public.verificar_captcha(p_captcha) then
    return 'captcha';
  end if;
  if exists (select 1 from public.profiles where cedula = v_cedula) then
    return 'registrada';
  end if;
  if not public.cedula_autorizada(v_cedula) then
    return 'no_autorizada';
  end if;
  return 'disponible';
end;
$$;

-- Versiones anteriores: siguen funcionando para la app ya desplegada (con límite de intentos) y se apagan
-- solas al activar el CAPTCHA, para que no sirvan de atajo.
create or replace function public.email_para_login(p_cedula text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.captcha_configurado()
     or not public.registrar_intento('acceso_ip', public.ip_cliente(), 30, interval '10 minutes')
     or not public.registrar_intento('acceso_cedula', trim(coalesce(p_cedula, '')), 10, interval '10 minutes') then
    return null;
  end if;
  return (select email from public.profiles where cedula = trim(p_cedula));
end;
$$;

create or replace function public.cedula_disponible(p_cedula text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.captcha_configurado() then
    raise exception 'Actualiza la app para registrarte.';
  end if;
  if not public.registrar_intento('registro_ip', public.ip_cliente(), 20, interval '10 minutes') then
    raise exception 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  end if;
  return not exists (select 1 from public.profiles where cedula = trim(p_cedula))
     and public.cedula_autorizada(trim(p_cedula));
end;
$$;

revoke execute on function public.ip_cliente() from public, anon, authenticated;
revoke execute on function public.registrar_intento(text, text, int, interval) from public, anon, authenticated;
revoke execute on function public.captcha_configurado() from public, anon, authenticated;
revoke execute on function public.verificar_captcha(text) from public, anon, authenticated;
revoke execute on function public.cedula_autorizada(text) from public, anon, authenticated;
revoke execute on function public.buscar_acceso(text, text) from public;
revoke execute on function public.estado_registro(text, text) from public;
grant execute on function public.buscar_acceso(text, text) to anon, authenticated;
grant execute on function public.estado_registro(text, text) to anon, authenticated;

-- ─── Validaciones del perfil ─────────────────────────────────────────────────
-- NOT VALID: aplican a todo registro nuevo o modificado sin rechazar los perfiles de prueba existentes.

alter table public.profiles
  add constraint nombres_validos check (
    length(trim(nombres)) between 1 and 80 and length(trim(apellidos)) between 1 and 80
  ) not valid,
  add constraint email_valido check (
    length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) not valid,
  add constraint celular_valido check (celular is null or celular ~ '^3[0-9]{9}$') not valid,
  add constraint textos_cortos check (
    coalesce(length(direccion), 0) <= 150 and coalesce(length(barrio), 0) <= 80
    and coalesce(length(urbanizacion), 0) <= 80 and coalesce(length(apto_casa), 0) <= 80
    and coalesce(length(lugar_nacimiento), 0) <= 100 and coalesce(length(lugar_expedicion), 0) <= 100
  ) not valid,
  add constraint listas_validas check (
    (genero is null or genero in ('Masculino', 'Femenino', 'Otro', 'Prefiero no decirlo', 'No Binario'))
    and (estado_civil is null or estado_civil in ('Soltero/a', 'Casado/a', 'Unión libre', 'Unión Libre', 'Separado/a', 'Divorciado/a', 'Viudo/a'))
    and (nivel_estudio is null or nivel_estudio in ('Ninguno', 'Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización/Postgrado'))
  ) not valid,
  add constraint fechas_validas check (
    (fecha_nacimiento is null or fecha_nacimiento >= date '1900-01-01')
    and (fecha_expedicion is null or fecha_nacimiento is null or fecha_expedicion > fecha_nacimiento)
  ) not valid,
  add constraint familia_valida check (
    jsonb_typeof(hijos) = 'array' and jsonb_array_length(hijos) <= 20 and length(hijos::text) <= 10000
    and (conyuge is null or (jsonb_typeof(conyuge) = 'object' and length(conyuge::text) <= 2000))
  ) not valid;

-- El registro valida además la edad mínima y la lista de cédulas autorizadas
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
    direccion, barrio, urbanizacion, apto_casa, conyuge, hijos
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
    coalesce(meta -> 'hijos', '[]'::jsonb)
  );
  return new;
end;
$$;

-- ─── Auditoría de la lista de autorizados ────────────────────────────────────

-- El identificador del registro puede ser `id` o, en la lista de autorizados, `cedula`
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
    coalesce(v_fila ->> 'id', v_fila ->> 'cedula', ''),
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    coalesce(v_cambios, v_nueva, v_vieja),
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger auditoria_cedulas_autorizadas
  after insert or update or delete on public.cedulas_autorizadas
  for each row execute function public.registrar_auditoria();
