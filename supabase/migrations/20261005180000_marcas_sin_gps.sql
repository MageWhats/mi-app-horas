-- =============================================================================
-- Marcas sin GPS: toda ENTRADA/SALIDA debe llevar ubicación o un motivo que explique su ausencia.
-- =============================================================================

alter table public.marcas
  add column motivo_sin_gps text,
  add column corte_medianoche boolean not null default false;

comment on column public.marcas.motivo_sin_gps is 'Justificación del operario cuando la marca se registró sin ubicación GPS.';
comment on column public.marcas.corte_medianoche is 'Marca generada automáticamente al partir un turno nocturno a las 00:00.';

-- Las marcas de corte creadas antes de esta migración se identificaban por la zona
update public.marcas set corte_medianoche = true where zona = 'Corte de medianoche';

-- NOT VALID: aplica a toda marca nueva sin rechazar las de prueba que ya existan
alter table public.marcas
  add constraint marca_con_gps_o_motivo check (
    tipo not in ('ENTRADA', 'SALIDA')
    -- El corte automático solo es válido exactamente a las 00:00 hora de Colombia
    or (corte_medianoche and (momento at time zone 'America/Bogota')::time = '00:00:00')
    or (latitud is not null and longitud is not null)
    or length(trim(coalesce(motivo_sin_gps, ''))) >= 3
  ) not valid;
