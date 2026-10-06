-- =============================================================================
-- Diagnóstico del CAPTCHA
-- - Cada verificación fallida guarda la respuesta de Cloudflare (error-codes, hostname) o la excepción, para
--   saber por qué se rechazó un token sin adivinar.
-- - Ya no se envía la IP del cliente a Cloudflare: la que ve la base de datos puede ser la de un proxy y un
--   desajuste hace fallar tokens válidos. Es un dato opcional de siteverify.
-- =============================================================================

create table public.captcha_fallos (
  id        bigint generated always as identity primary key,
  fecha     timestamptz not null default now(),
  ip        text,
  respuesta text -- JSON de siteverify o texto de la excepción
);
comment on table public.captcha_fallos is
  'Verificaciones de Turnstile rechazadas, con la respuesta de Cloudflare. Se limpia sola (7 días).';
alter table public.captcha_fallos enable row level security;
revoke all on public.captcha_fallos from anon, authenticated;

create or replace function public.verificar_captcha(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto text;
  v_respuesta text;
  v_ok boolean;
begin
  select decrypted_secret into v_secreto
  from vault.decrypted_secrets where name = 'turnstile_secret' limit 1;

  if coalesce(v_secreto, '') = '' then
    return true;
  end if;
  if coalesce(p_token, '') = '' or length(p_token) > 2048 then
    insert into public.captcha_fallos (ip, respuesta) values (public.ip_cliente(), 'token vacío o demasiado largo');
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
      jsonb_build_object('secret', trim(v_secreto), 'response', p_token)::text,
      'application/json'
    ) r;
    v_ok := coalesce((v_respuesta::jsonb ->> 'success')::boolean, false);
  exception when others then
    v_ok := false;
    v_respuesta := 'excepción: ' || sqlerrm;
  end;

  if not v_ok then
    insert into public.captcha_fallos (ip, respuesta) values (public.ip_cliente(), left(v_respuesta, 2000));
    delete from public.captcha_fallos where fecha < now() - interval '7 days';
  end if;
  return v_ok;
end;
$$;

revoke execute on function public.verificar_captcha(text) from public, anon, authenticated;
