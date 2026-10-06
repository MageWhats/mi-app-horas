// constants/empresa.ts
// Responsable del tratamiento de datos personales (Ley 1581 de 2012). Lo usan la política de privacidad,
// la autorización del registro y la página de eliminación de cuenta.
// Los campos en null aparecen como "por completar".

export const RESPONSABLE = {
  razonSocial: 'Johan Carreño de la Hoz',
  nombreComercial: 'Net&Sec Suministros',
  nit: '1007744231-4' as string | null,
  direccion: 'Carrera 16A # 4-23, barrio 20 de Julio' as string | null,
  ciudad: 'Santa Marta, Magdalena' as string | null,
  telefono: '300 225 5990' as string | null,
  correoDatos: 'netsecsuministros@gmail.com',
};

/** Versión de la política de privacidad. Al cambiarla, la app pide de nuevo la autorización a todos. */
export const POLITICA_VERSION = '2026-10';
export const POLITICA_FECHA = '10 de octubre de 2026';

export const datoEmpresa = (valor: string | null) => valor ?? '[por completar]';
