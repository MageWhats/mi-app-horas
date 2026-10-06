# Publicar en Google Play

Identificador de la app: **`com.netsecsuministros.horas`** (no se puede cambiar después de la primera publicación).

## 1. Antes de empezar

- [ ] Completar los datos de la empresa en `constants/empresa.ts` (NIT, dirección, ciudad, teléfono) y desplegar.
      La política de privacidad debe verse completa en `https://<tu-app>.vercel.app/privacidad`.
- [ ] Cuenta de desarrollador de Google Play (pago único) en [play.google.com/console](https://play.google.com/console).
- [ ] Variables de entorno de **producción** en EAS (`npx eas env:list --environment production`):
      `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL` y, si el CAPTCHA está
      activo, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Una **cuenta de prueba** para los revisores de Google (si el registro está restringido, agrega su cédula a
      `cedulas_autorizadas`). Ten a mano la cédula y la contraseña.

## 2. Build de producción

```bash
npx eas build --platform android --profile production   # genera un .aab firmado (EAS guarda la llave)
```

La **primera** versión se sube a mano: Play Console → la app → *Pruebas → Prueba interna* (o *Producción*) →
*Crear versión* → sube el `.aab`. Las siguientes se pueden enviar con `npx eas submit --platform android`.

Recomendado: publicar primero en **Prueba interna** con los operarios, y luego promover la misma versión a Producción.

## 3. Ficha de la tienda

- **Nombre:** Control de Horas · Net&Sec
- **Descripción corta (80 caracteres máx.):**
  `Registra tu jornada con GPS: entrada, salida, horas extras, nocturnas y festivos.`
- **Descripción completa:**

  > Control de Horas es la app de Net&Sec Suministros para registrar la jornada laboral de forma simple y confiable.
  >
  > • Marca tu entrada y salida con un toque. La hora la pone el servidor y la ubicación GPS se toma solo al marcar.
  > • Funciona sin señal: la marca se guarda en el celular y se envía sola al volver la conexión.
  > • Calcula tus horas ordinarias, extras, nocturnas y dominicales/festivas según la ley colombiana, con el
  >   calendario de festivos incluido.
  > • Resumen mensual, avisos de límite semanal y recordatorio si olvidas marcar la salida.
  > • Exporta tu reporte a Excel.
  > • Tema claro y oscuro.
  >
  > Para uso de los trabajadores de Net&Sec Suministros.

- **Categoría:** Productividad (o Empresa).
- **Correo de contacto:** netsecsuministros@gmail.com
- **Política de privacidad:** `https://<tu-app>.vercel.app/privacidad`
- **Capturas:** al menos 2 del celular (Inicio, Resumen, Perfil). Ícono de 512×512: `public/brand/icon-512.png`.

## 4. Contenido de la app (Play Console → Política → Contenido de la app)

| Sección | Respuesta |
|---|---|
| Acceso a la app | Algunas funciones requieren acceso → da la cédula y la contraseña de la cuenta de prueba e indica: "Inicie sesión con el número de documento". |
| Anuncios | No contiene anuncios. |
| Clasificación de contenido | Cuestionario: categoría *Utilidad / Productividad*; sin violencia, sexo, lenguaje, drogas ni apuestas. |
| Público objetivo | Mayores de 18 años. La app **no** está dirigida a niños. |
| Apps gubernamentales / financieras / salud | No aplica. |
| Eliminación de cuenta | Sí, desde la app (Perfil → Eliminar mi cuenta) y en la web: `https://<tu-app>.vercel.app/eliminar-cuenta`. |

## 5. Seguridad de los datos (Data safety)

Respuestas generales:

- ¿Recopila o comparte datos? **Sí recopila.** No comparte (los proveedores que procesan datos por cuenta de la
  empresa —Supabase, Vercel, Cloudflare, Google— no cuentan como "compartir" según Google).
- ¿Los datos se cifran en tránsito? **Sí.**
- ¿Los usuarios pueden solicitar que se borren sus datos? **Sí** (con la URL de eliminación de cuenta).

| Tipo de dato (categoría de Google) | ¿Se recopila? | ¿Opcional? | Finalidad |
|---|---|---|---|
| Ubicación → **Ubicación precisa** | Sí | Sí (sin permiso se marca indicando el motivo) | Funcionalidad de la app; Prevención de fraude y seguridad |
| Información personal → **Nombre** | Sí | No | Funcionalidad; Administración de la cuenta |
| Información personal → **Dirección de correo** | Sí | No | Administración de la cuenta |
| Información personal → **IDs de usuario** (número de documento) | Sí | No | Administración de la cuenta |
| Información personal → **Dirección** | Sí | Sí | Funcionalidad de la app |
| Información personal → **Número de teléfono** | Sí | No | Funcionalidad de la app |
| Información personal → **Otra información** (fecha de nacimiento, género, estado civil, estudios, datos del cónyuge y de los hijos) | Sí | Parcialmente | Funcionalidad de la app |
| Actividad en la app → **Otro contenido generado por el usuario** (notas y motivos) | Sí | Sí | Funcionalidad de la app |

No se recopila: información financiera, salud, mensajes, fotos, audio, contactos, calendario, historial web ni
identificadores de publicidad. La dirección IP solo se guarda temporalmente (máximo un día) para limitar intentos de
acceso; no se usa para ubicar al usuario.

## 6. Permisos

La app solo pide: **ubicación mientras se usa** (al marcar) y **notificaciones** (recordatorio de salida).
La ubicación en segundo plano y el micrófono están bloqueados en `app.json`, así que no requiere la declaración
especial de ubicación en segundo plano.

## 7. Cada actualización

1. Sube la versión en `app.json` (`expo.version`, por ejemplo `1.1.0`); el `versionCode` lo incrementa EAS solo.
2. `npx eas build --platform android --profile production` y `npx eas submit --platform android`.
3. Si cambias qué datos se recogen o para qué, actualiza la política, sube `POLITICA_VERSION` en
   `constants/empresa.ts` (la app pedirá aceptarla de nuevo) y el formulario de Seguridad de los datos.
