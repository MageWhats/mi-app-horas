-- =============================================================================
-- Quita los campos del antiguo módulo de nómina: la app solo gestiona el ponchado de horas.
-- =============================================================================

alter table public.profiles
  drop column if exists status,
  drop column if exists position;

comment on table public.profiles is 'Datos del operario. Se crea automáticamente al registrarse (trigger on_auth_user_created). Solo lectura para el operario.';
