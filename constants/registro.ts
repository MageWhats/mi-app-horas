// constants/registro.ts
// Opciones de las listas del formulario de registro.
import { SelectOption } from '../components/SelectField';

const simples = (valores: string[]): SelectOption[] => valores.map((v) => ({ value: v, label: v }));

export const TIPOS_ID: SelectOption[] = [
  { value: 'CC', label: 'Cédula de Ciudadanía (CC)' },
  { value: 'CE', label: 'Cédula de Extranjería (CE)' },
  { value: 'PPT', label: 'Permiso por Protección Temporal (PPT)' },
];

export const TIPOS_ID_HIJO: SelectOption[] = [
  { value: 'RC', label: 'Registro Civil (RC)' },
  { value: 'TI', label: 'Tarjeta de Identidad (TI)' },
  ...TIPOS_ID,
];

export const GENEROS = simples(['Masculino', 'Femenino', 'Otro', 'Prefiero no decirlo']);

export const ESTADOS_CIVILES = simples(['Soltero/a', 'Casado/a', 'Unión libre', 'Separado/a', 'Divorciado/a', 'Viudo/a']);

/** Estados civiles con pareja actual: muestran la sección del cónyuge. */
export const ESTADOS_CON_CONYUGE = ['Casado/a', 'Unión libre'];

export const NIVELES_ESTUDIO: SelectOption[] = [
  { value: 'Ninguno', label: 'Ninguno' },
  { value: 'Primaria', label: 'Primaria' },
  { value: 'Bachillerato', label: 'Bachillerato' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Tecnólogo', label: 'Tecnólogo' },
  { value: 'Profesional', label: 'Profesional / Universitario' },
  { value: 'Especialización/Postgrado', label: 'Especialización / Postgrado' },
];

export const TIPOS_VIA = simples(['Calle', 'Carrera', 'Avenida', 'Diagonal', 'Transversal', 'Circular', 'Autopista', 'Kilómetro', 'Vereda', 'Manzana']);

/** Tipo de documento esperado para un menor según su edad. */
export const tipoIdPorEdad = (fechaNacimiento: string): string => {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) edad--;
  if (edad < 7) return 'RC';
  if (edad < 18) return 'TI';
  return 'CC';
};

/** Capitales de departamento y principales municipios de Colombia, en orden alfabético. */
export const CIUDADES: string[] = [
  'Aguachica, Cesar', 'Apartadó, Antioquia', 'Arauca, Arauca', 'Armenia, Quindío', 'Barrancabermeja, Santander',
  'Barranquilla, Atlántico', 'Bello, Antioquia', 'Bogotá D.C.', 'Bucaramanga, Santander', 'Buenaventura, Valle del Cauca',
  'Buga, Valle del Cauca', 'Cartagena, Bolívar', 'Cartago, Valle del Cauca', 'Caucasia, Antioquia', 'Cereté, Córdoba',
  'Chía, Cundinamarca', 'Ciénaga, Magdalena', 'Coveñas, Sucre', 'Cúcuta, Norte de Santander', 'Cali, Valle del Cauca',
  'Dosquebradas, Risaralda', 'Duitama, Boyacá', 'Envigado, Antioquia', 'Espinal, Tolima', 'Facatativá, Cundinamarca',
  'Floridablanca, Santander', 'Florencia, Caquetá', 'Fusagasugá, Cundinamarca', 'Girardot, Cundinamarca', 'Girón, Santander',
  'Ibagué, Tolima', 'Inírida, Guainía', 'Ipiales, Nariño', 'Itagüí, Antioquia', 'Jamundí, Valle del Cauca',
  'Leticia, Amazonas', 'Lorica, Córdoba', 'Magangué, Bolívar', 'Maicao, La Guajira', 'Malambo, Atlántico',
  'Manizales, Caldas', 'Medellín, Antioquia', 'Mitú, Vaupés', 'Mocoa, Putumayo', 'Montería, Córdoba',
  'Neiva, Huila', 'Ocaña, Norte de Santander', 'Palmira, Valle del Cauca', 'Pasto, Nariño', 'Pereira, Risaralda',
  'Piedecuesta, Santander', 'Pitalito, Huila', 'Popayán, Cauca', 'Puerto Carreño, Vichada', 'Puerto Colombia, Atlántico',
  'Quibdó, Chocó', 'Riohacha, La Guajira', 'Rionegro, Antioquia', 'Sahagún, Córdoba', 'San Andrés, San Andrés y Providencia',
  'San José del Guaviare, Guaviare', 'Santa Marta, Magdalena', 'Santiago de Tolú, Sucre', 'Sincelejo, Sucre', 'Soacha, Cundinamarca',
  'Sogamoso, Boyacá', 'Soledad, Atlántico', 'Tuluá, Valle del Cauca', 'Tumaco, Nariño', 'Tunja, Boyacá',
  'Turbaco, Bolívar', 'Turbo, Antioquia', 'Uribia, La Guajira', 'Valledupar, Cesar', 'Villa del Rosario, Norte de Santander',
  'Villavicencio, Meta', 'Yopal, Casanare', 'Zipaquirá, Cundinamarca',
].sort((a, b) => a.localeCompare(b, 'es'));
