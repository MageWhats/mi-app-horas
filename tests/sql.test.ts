/// <reference types="node" />
// Reglas de la base de datos: aplica todas las migraciones en un PostgreSQL embebido (PGlite).
// No toca Supabase: auth, Vault y la extensión http se simulan.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRACIONES = join(__dirname, '..', 'supabase', 'migrations');

/** Lo que Supabase ya trae y PGlite no: esquema auth, roles, Vault y la extensión http. */
const ENTORNO_SUPABASE = `
  create role anon nologin; create role authenticated nologin;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create schema vault;
  create table vault.secretos (name text, decrypted_secret text);
  create view vault.decrypted_secrets as select * from vault.secretos;

  -- Cloudflare simulado: el token 'TOKEN-VALIDO' es válido; 'CLOUDFLARE-CAIDO' simula un error de red
  create schema extensions;
  create function extensions.http_set_curlopt(text, text) returns boolean language sql as $$ select true $$;
  create function extensions.http_post(url text, body text, ct text) returns table (status int, content text)
  language plpgsql as $$
  begin
    if body::jsonb ->> 'response' = 'CLOUDFLARE-CAIDO' then raise exception 'timeout'; end if;
    return query select 200, jsonb_build_object('success', body::jsonb ->> 'response' = 'TOKEN-VALIDO')::text;
  end $$;
`;

let db: PGlite;
let ana: string;
let beto: string;
let hoy: string;

const valor = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
  Object.values((await db.query<Record<string, T>>(sql, params)).rows[0])[0];

const como = (uid: string) => db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
const comoAnonimo = (ip: string) => db.exec(`set role anon; select set_config('request.headers', '{"cf-connecting-ip":"${ip}"}', false);`);
const comoAdmin = () => db.exec('reset role');
const fecha = (dias: number) => valor<string>(`select ($1::date + $2::int)::text`, [hoy, dias]);

const registrar = async (cedula: string, extra: Record<string, unknown> = {}, email = `${cedula}@x.com`) =>
  valor<string>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ cedula, nombres: 'Nombre', apellidos: 'Apellido', ...extra })]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(ENTORNO_SUPABASE);
  for (const archivo of readdirSync(MIGRACIONES).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRACIONES, archivo), 'utf8')
      .replace(/create extension if not exists http with schema extensions;/, ''); // simulada arriba
    await db.exec(sql);
  }
  ana = await registrar('1001', { celular: '3001234567' }, 'Ana@X.com');
  beto = await registrar('2002');
  hoy = await valor<string>(`select (now() at time zone 'America/Bogota')::date::text`);
});

describe('registro y perfiles', () => {
  it('el trigger crea el perfil con el correo en minúsculas', async () => {
    await comoAdmin();
    expect(await valor('select email from public.profiles where cedula = $1', ['1001'])).toBe('ana@x.com');
  });

  it('una cédula duplicada revierte el alta del usuario', async () => {
    await expect(registrar('1001', {}, 'otro@x.com')).rejects.toThrow(/duplicate key/);
    expect(await valor<number>(`select count(*)::int from auth.users where email = 'otro@x.com'`)).toBe(0);
  });

  it('valida formatos y largos del perfil', async () => {
    await expect(registrar('7001', { celular: '12345' })).rejects.toThrow(/celular_valido/);
    await expect(registrar('7002', { nombres: 'x'.repeat(200) })).rejects.toThrow(/nombres_validos/);
    await expect(registrar('7003', {}, 'no-es-correo')).rejects.toThrow(/email_valido/);
    await expect(registrar('7004', { estado_civil: '<script>' })).rejects.toThrow(/listas_validas/);
    await expect(registrar('7005', { fecha_nacimiento: '2020-01-01' })).rejects.toThrow(/fecha de nacimiento/);
  });

  it('cada operario solo ve su perfil y no puede modificarlo', async () => {
    await como(ana);
    expect(await valor<number>('select count(*)::int from public.profiles')).toBe(1);
    const filas = (await db.query(`update public.profiles set nombres = 'Hack' returning id`)).rows;
    expect(filas).toHaveLength(0);
  });
});

describe('ponchado', () => {
  it('la app no puede insertar ni borrar marcas directamente', async () => {
    await como(ana);
    await expect(db.query(`insert into public.marcas (fecha, tipo, momento) values ($1, 'ENTRADA', now() - interval '3 hours')`, [hoy]))
      .rejects.toThrow(/permission denied/);
    await expect(db.query('delete from public.marcas')).rejects.toThrow(/permission denied/);
  });

  it('ponchar usa la hora del servidor y bloquea el doble toque', async () => {
    await como(ana);
    expect(await valor('select public.ponchar(10.4, -75.5, 12)')).toBe('ENTRADA');
    expect(await valor<boolean>(`select abs(extract(epoch from momento - now())) < 5 from public.marcas order by created_at desc limit 1`)).toBe(true);
    await expect(db.query('select public.ponchar(10.4, -75.5, 12)')).rejects.toThrow(/menos de un minuto/);
    await expect(db.query('select public.ponchar(null, null, null, null)')).rejects.toThrow(/motivo/);
  });

  it('corta en la medianoche un turno abierto desde ayer', async () => {
    await comoAdmin();
    await db.query('delete from public.marcas where user_id = $1', [beto]);
    await db.query(`insert into public.marcas (user_id, fecha, tipo, momento, latitud, longitud)
      values ($1, $2::date - 1, 'ENTRADA', (($2::date - 1) + time '22:00') at time zone 'America/Bogota', 1, 1)`, [beto, hoy]);
    await como(beto);
    expect(await valor(`select public.ponchar(null, null, null, 'Sin señal en el muelle', true)`)).toBe('SALIDA');
    const marcas = (await db.query<{ corte_medianoche: boolean; h: string }>(
      `select corte_medianoche, to_char(momento at time zone 'America/Bogota', 'HH24:MI') h from public.marcas order by momento, created_at`)).rows;
    expect(marcas.map((m) => m.corte_medianoche)).toEqual([false, true, true, false]);
    expect(marcas[1].h).toBe('00:00');
  });
});

describe('registros manuales', () => {
  it('aplica los límites de fecha, formato, cruces y 24 h', async () => {
    await como(beto);
    const ayer = await fecha(-1);
    await expect(db.query(`select public.registrar_manual($1, null, null, null, 8)`, [await fecha(1)])).rejects.toThrow(/fecha futura/);
    await expect(db.query(`select public.registrar_manual($1, null, null, null, 8)`, [await fecha(-10)])).rejects.toThrow(/últimos 7 días/);
    await expect(db.query(`select public.registrar_manual($1, null, '08:00 a. m.', '12:00')`, [ayer])).rejects.toThrow(/HH:MM/);
    await expect(db.query(`select public.registrar_manual($1, null, '21:00', '23:00')`, [ayer])).rejects.toThrow(/se cruza/);
    await db.query(`select public.registrar_manual($1, 'Bodega', '06:00', '10:00')`, [ayer]);
    await db.query(`select public.registrar_manual($1, null, null, null, 12)`, [ayer]);
    await expect(db.query(`select public.registrar_manual($1, null, null, null, 7)`, [ayer])).rejects.toThrow(/superaría las 24 horas/);
  });

  it('las anulaciones requieren motivo, no borran y solo aplican a manuales', async () => {
    await como(beto);
    const jornada = await valor<string>(`select id from public.marcas where tipo = 'MANUAL_JORNADA' limit 1`);
    const entrada = await valor<string>(`select id from public.marcas where tipo = 'ENTRADA' limit 1`);
    await expect(db.query(`select public.anular_marca($1, 'Error')`, [entrada])).rejects.toThrow(/no se pueden anular/);
    await expect(db.query(`select public.anular_marca($1, 'no')`, [jornada])).rejects.toThrow(/motivo/);
    await db.query(`select public.anular_marca($1, 'Registré el día equivocado')`, [jornada]);
    expect(await valor<number>('select count(*)::int from public.marcas where anulada_en is not null')).toBe(1);
  });

  it('un operario no puede anular ni ver marcas de otro', async () => {
    await como(beto);
    const deBeto = await valor<string>(`select id from public.marcas where tipo = 'MANUAL' limit 1`);
    await como(ana);
    await expect(db.query(`select public.anular_marca($1, 'Intento ajeno')`, [deBeto])).rejects.toThrow(/No se encontró/);
    expect(await valor<number>('select count(*)::int from public.marcas where user_id <> auth.uid()')).toBe(0);
  });
});

describe('auditoría', () => {
  it('registra quién hizo cada cambio y no es accesible desde la API', async () => {
    await como(ana);
    await expect(db.query('select * from public.auditoria')).rejects.toThrow(/permission denied/);
    await comoAdmin();
    const anulacion = await valor<{ motivo_anulacion: { despues: string } }>(
      `select cambios from public.auditoria where tabla = 'marcas' and accion = 'modificar' limit 1`);
    expect(anulacion.motivo_anulacion.despues).toBe('Registré el día equivocado');
    expect(await valor<number>('select count(*)::int from public.auditoria where usuario_id = $1', [beto])).toBeGreaterThan(0);
  });
});

describe('acceso: CAPTCHA, límites y registro restringido', () => {
  it('sin CAPTCHA configurado, buscar_acceso funciona con límite por cédula', async () => {
    await comoAdmin();
    await db.query('delete from public.intentos_acceso');
    const estados: string[] = [];
    for (let i = 0; i < 11; i++) {
      await comoAnonimo(`2.2.2.${i}`);
      estados.push((await valor<{ estado: string }>(`select public.buscar_acceso('1001')`)).estado);
    }
    expect(estados.slice(0, 10).every((e) => e === 'ok')).toBe(true);
    expect(estados[10]).toBe('limite');
  });

  it('con CAPTCHA configurado exige un token válido y apaga las funciones anteriores', async () => {
    await comoAdmin();
    await db.query('delete from public.intentos_acceso');
    await db.query(`insert into vault.secretos values ('turnstile_secret', 'SECRETO')`);
    await comoAnonimo('4.4.4.4');
    expect(await valor(`select public.buscar_acceso('1001')`)).toEqual({ estado: 'captcha' });
    expect(await valor(`select public.buscar_acceso('1001', 'TOKEN-FALSO')`)).toEqual({ estado: 'captcha' });
    expect(await valor(`select public.buscar_acceso('1001', 'CLOUDFLARE-CAIDO')`)).toEqual({ estado: 'captcha' });
    expect(await valor(`select public.buscar_acceso('1001', 'TOKEN-VALIDO')`)).toEqual({ estado: 'ok', email: 'ana@x.com' });
    expect(await valor(`select public.email_para_login('1001')`)).toBeNull();
    await comoAdmin();
    await db.query('delete from vault.secretos');
  });

  it('la API anónima no accede a las tablas ni funciones internas', async () => {
    await comoAnonimo('5.5.5.5');
    await expect(db.query('select * from public.intentos_acceso')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from public.cedulas_autorizadas')).rejects.toThrow(/permission denied/);
    await expect(db.query(`select public.verificar_captcha('x')`)).rejects.toThrow(/permission denied/);
  });

  it('con cédulas autorizadas, solo esas pueden registrarse', async () => {
    await comoAdmin();
    await db.query(`insert into public.cedulas_autorizadas (cedula) values ('3003')`);
    await comoAnonimo('6.6.6.6');
    expect(await valor(`select public.estado_registro('9009')`)).toBe('no_autorizada');
    expect(await valor(`select public.estado_registro('3003')`)).toBe('disponible');
    expect(await valor(`select public.estado_registro('1001')`)).toBe('registrada');
    await comoAdmin();
    await expect(registrar('9009')).rejects.toThrow(/no está autorizado/);
    await registrar('3003');
    await db.query('delete from public.cedulas_autorizadas');
  });
});
