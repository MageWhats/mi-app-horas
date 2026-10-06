// app/privacidad.tsx
// Política de tratamiento de datos personales (pública: Google Play exige su URL).
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Fuerte, Lista, PaginaLegal, Parrafo, Seccion } from '../components/PaginaLegal';
import { datoEmpresa, POLITICA_FECHA, POLITICA_VERSION, RESPONSABLE } from '../constants/empresa';
import { useTheme } from '../lib/theme';

export default function Privacidad() {
  const { colors: c } = useTheme();
  const r = RESPONSABLE;

  return (
    <PaginaLegal
      titulo="Política de tratamiento de datos personales"
      subtitulo={`Control de Horas · Versión ${POLITICA_VERSION} · Vigente desde el ${POLITICA_FECHA}`}
    >
      <Parrafo>
        Esta política explica cómo se recolectan, usan y protegen los datos personales en la aplicación Control de Horas,
        en cumplimiento de la Ley 1581 de 2012 y del Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
      </Parrafo>

      <Seccion titulo="1. Responsable del tratamiento">
        <Lista items={[
          <><Fuerte>Razón social:</Fuerte> {r.razonSocial}</>,
          <><Fuerte>Nombre comercial:</Fuerte> {r.nombreComercial}</>,
          <><Fuerte>NIT:</Fuerte> {datoEmpresa(r.nit)}</>,
          <><Fuerte>Dirección:</Fuerte> {datoEmpresa(r.direccion)}, {datoEmpresa(r.ciudad)}</>,
          <><Fuerte>Teléfono:</Fuerte> {datoEmpresa(r.telefono)}</>,
          <><Fuerte>Correo para temas de datos personales:</Fuerte> {r.correoDatos}</>,
        ]} />
      </Seccion>

      <Seccion titulo="2. Datos que tratamos">
        <Lista items={[
          <><Fuerte>Identificación y contacto:</Fuerte> tipo y número de documento, nombres y apellidos, fecha y lugar de nacimiento, fecha y lugar de expedición del documento, género, estado civil, nivel de estudios, celular, correo electrónico y dirección.</>,
          <><Fuerte>Datos laborales:</Fuerte> marcas de entrada y salida, horas trabajadas, registros manuales, notas y los motivos que el trabajador indica (por ejemplo, al marcar sin GPS o al anular un registro).</>,
          <><Fuerte>Ubicación:</Fuerte> coordenadas GPS y su precisión, <Fuerte>solo en el momento de marcar</Fuerte> la entrada o la salida. La aplicación no rastrea la ubicación en segundo plano. También se registra si el celular reporta una ubicación simulada.</>,
          <><Fuerte>Datos familiares:</Fuerte> datos del cónyuge o compañero(a) y de los hijos, incluidos menores de edad.</>,
          <><Fuerte>Datos técnicos de seguridad:</Fuerte> dirección IP e intentos de inicio de sesión y de registro.</>,
        ]} />
      </Seccion>

      <Seccion titulo="3. Finalidades">
        <Lista items={[
          'Registrar y controlar la jornada laboral y calcular las horas ordinarias, extras, nocturnas, dominicales y festivas según la ley colombiana.',
          'Verificar el lugar desde el que se registra cada marca.',
          'Gestionar afiliaciones y beneficios del trabajador y su núcleo familiar (seguridad social, caja de compensación).',
          'Proteger la cuenta, prevenir el fraude y llevar un registro de auditoría de los cambios.',
          'Atender consultas y reclamos, y cumplir las obligaciones laborales, tributarias y de seguridad social.',
        ]} />
      </Seccion>

      <Seccion titulo="4. Datos de niñas, niños y adolescentes">
        <Parrafo>
          Los datos de los hijos menores de edad se tratan únicamente para fines de seguridad social y beneficios del
          trabajador, respetando el interés superior de los menores y sus derechos fundamentales. El trabajador los
          entrega como su representante legal y autoriza expresamente su tratamiento.
        </Parrafo>
      </Seccion>

      <Seccion titulo="5. Derechos del titular">
        <Parrafo>Como titular de los datos tienes derecho a:</Parrafo>
        <Lista items={[
          'Conocer, actualizar y rectificar tus datos.',
          'Solicitar prueba de la autorización que otorgaste.',
          'Ser informado sobre el uso que se da a tus datos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio.',
          'Revocar la autorización o solicitar la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos.',
          'Acceder gratuitamente a tus datos.',
        ]} />
      </Seccion>

      <Seccion titulo="6. Cómo ejercer tus derechos">
        <Parrafo>
          Escribe a <Fuerte>{r.correoDatos}</Fuerte> indicando tu nombre, tu número de documento y tu solicitud. Las
          consultas se responden en máximo 10 días hábiles (prorrogables 5 días más) y los reclamos en máximo 15 días
          hábiles (prorrogables 8 días más), según los artículos 14 y 15 de la Ley 1581 de 2012.
        </Parrafo>
        <Parrafo>
          También puedes eliminar tu cuenta desde la aplicación (Perfil → Eliminar mi cuenta).{' '}
          <Link href="/eliminar-cuenta"><Text style={{ color: c.primary, fontWeight: '600' }}>Ver cómo eliminar la cuenta</Text></Link>.
        </Parrafo>
      </Seccion>

      <Seccion titulo="7. Conservación">
        <Parrafo>
          Los datos se conservan mientras exista la relación laboral y, después, durante el tiempo que exijan las normas
          laborales, tributarias y de seguridad social. Si eliminas tu cuenta, se borran tu acceso y tus datos de
          contacto, ubicación de residencia y familia; se conservan tu nombre, tu documento y tus registros de jornada
          por obligación legal.
        </Parrafo>
      </Seccion>

      <Seccion titulo="8. Seguridad">
        <Parrafo>
          Los datos viajan cifrados (HTTPS), cada trabajador solo puede ver su propia información, los cambios quedan en
          un registro de auditoría y se hacen copias de seguridad cifradas.
        </Parrafo>
      </Seccion>

      <Seccion titulo="9. Proveedores y transferencia internacional">
        <Parrafo>
          Para operar la aplicación usamos proveedores tecnológicos que tratan los datos por nuestra cuenta, con
          servidores fuera de Colombia, lo que implica una transmisión internacional de datos que autorizas al aceptar
          esta política:
        </Parrafo>
        <Lista items={[
          'Supabase: base de datos y autenticación.',
          'Vercel: publicación de la versión web.',
          'Cloudflare: verificación anti-bots (CAPTCHA).',
          'Google: envío de correos (códigos de recuperación de contraseña).',
        ]} />
      </Seccion>

      <Seccion titulo="10. Vigencia y cambios">
        <Parrafo>
          Esta política rige desde el {POLITICA_FECHA}. Si cambia, la aplicación te pedirá aceptar la nueva versión.
        </Parrafo>
      </Seccion>
    </PaginaLegal>
  );
}
