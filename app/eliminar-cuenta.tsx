// app/eliminar-cuenta.tsx
// Página pública sobre la eliminación de la cuenta (Google Play exige un enlace web).
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Fuerte, Lista, PaginaLegal, Parrafo, Seccion } from '../components/PaginaLegal';
import { RESPONSABLE } from '../constants/empresa';
import { useTheme } from '../lib/theme';

export default function EliminarCuenta() {
  const { colors: c } = useTheme();
  return (
    <PaginaLegal titulo="Eliminar tu cuenta" subtitulo={`Control de Horas · ${RESPONSABLE.nombreComercial}`}>
      <Seccion titulo="Desde la aplicación">
        <Lista items={[
          <>Inicia sesión y ve a <Fuerte>Perfil → Eliminar mi cuenta</Fuerte>.</>,
          <>Escribe <Fuerte>ELIMINAR</Fuerte> para confirmar. La eliminación es inmediata.</>,
        ]} />
        <Parrafo>
          <Link href="/login"><Text style={{ color: c.primary, fontWeight: '600' }}>Ir a iniciar sesión</Text></Link>
        </Parrafo>
      </Seccion>

      <Seccion titulo="Sin acceso a la aplicación">
        <Parrafo>
          Escribe a <Fuerte>{RESPONSABLE.correoDatos}</Fuerte> desde el correo con el que te registraste, indicando tu
          nombre y tu número de documento. Responderemos en máximo 15 días hábiles.
        </Parrafo>
      </Seccion>

      <Seccion titulo="Qué se elimina">
        <Lista items={[
          'Tu acceso: correo y contraseña.',
          'Tus datos de contacto y residencia: celular y dirección.',
          'Fecha y lugar de nacimiento, datos de expedición del documento, género, estado civil y nivel de estudios.',
          'Los datos de tu cónyuge y de tus hijos.',
        ]} />
      </Seccion>

      <Seccion titulo="Qué se conserva y por qué">
        <Parrafo>
          Por obligación laboral, la empresa debe conservar tu <Fuerte>nombre, tu número de documento y tus registros de
          jornada</Fuerte> (marcas, horas, ubicación de cada marca y notas), junto con el registro de auditoría, durante
          el tiempo que exigen las normas laborales, tributarias y de seguridad social. Después se eliminan.
        </Parrafo>
        <Parrafo>
          Si vuelves a trabajar con la empresa, puedes registrarte de nuevo con el mismo documento.
        </Parrafo>
      </Seccion>
    </PaginaLegal>
  );
}
