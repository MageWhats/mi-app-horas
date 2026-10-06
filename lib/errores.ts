// lib/errores.ts

/**
 * Mensaje para el usuario a partir de un error de Supabase.
 * Las validaciones de la base de datos (raise exception → código P0001) ya vienen redactadas para el
 * operario y se muestran tal cual; cualquier otro error se reemplaza por `alternativo`.
 */
export const mensajeDeError = (error: unknown, alternativo: string): string => {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === 'P0001' && e.message) return e.message;
  return alternativo;
};
