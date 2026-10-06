# Base de datos (Supabase)

## Puesta en marcha

1. **Crear el proyecto** en [supabase.com](https://supabase.com) → *New project*.
   Región recomendada: **South America (São Paulo)**, la más cercana a Colombia. Guarda la contraseña de la base de datos.
2. **Crear el esquema**: *SQL Editor* → pega el contenido de `migrations/20261005120000_esquema_inicial.sql` → *Run*.
   (Con la CLI: `npx supabase link --project-ref <ref>` y `npx supabase db push`).
3. **Confirmación de correo**: *Authentication → Sign In / Providers → Email → Confirm email*.
   - Desactivado: el operario puede iniciar sesión justo después de registrarse.
   - Activado: debe confirmar desde su correo antes de entrar.
   La app soporta ambos casos.
4. **Variables de entorno**: *Project Settings → API*. Copia `.env.example` como `.env` y completa:
   - `EXPO_PUBLIC_SUPABASE_URL` → Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` → anon / publishable key
   **Nunca** uses la `service_role` key en la app.
5. Agrega las mismas variables en **Vercel** (web) y en **EAS** (`npx eas env:create`) para los builds de Android/iOS.
6. Arranca limpiando la caché: `npx expo start -c`.

## Modelo

| Tabla | Contenido |
|---|---|
| `profiles` | Un operario por usuario de `auth.users`. Lo crea el trigger `on_auth_user_created` con los metadatos del registro. |
| `jornadas` | Notas de cada día. Único por operario y fecha. |
| `marcas` | ENTRADA / SALIDA en tiempo real, registros MANUAL por horario y MANUAL_JORNADA. Nunca se borran. |
| `auditoria` | Quién creó o cambió qué y cuándo (marcas, jornadas, perfiles). Solo la escriben triggers. |

Las horas totales, nocturnas y extras **no se guardan**: la app las calcula a partir de las marcas vigentes
con las reglas legales de cada fecha (`lib/utils.ts`). Domingos y festivos salen del calendario oficial de
Colombia (Ley Emiliani), no los marca el operario.

## Funciones que usa la app

| Función | Qué hace |
|---|---|
| `ponchar(...)` | Registra ENTRADA o SALIDA con la **hora del servidor** (Colombia). Corta en la medianoche los turnos que empezaron el día anterior, evita marcas dobles (1 minuto) y exige motivo si no hay GPS. |
| `registrar_manual(...)` | Horas manuales: solo de los últimos 7 días, nunca futuras, sin cruzarse con otras marcas y sin superar 24 h en el día. |
| `anular_marca(id, motivo)` | Anula un registro manual: queda guardado y tachado, y deja de sumar. Las marcas de entrada y salida no se anulan. |
| `email_para_login(cedula)` / `cedula_disponible(cedula)` | Login y registro por cédula sin exponer otros datos. |

## Seguridad

- RLS en todas las tablas: cada operario solo ve sus propios datos.
- Las marcas solo se escriben mediante las funciones anteriores: la app no puede insertarlas, editarlas ni borrarlas directamente.
- Sin sesión solo se pueden usar `email_para_login(cedula)` y `cedula_disponible(cedula)`.
- El operario no puede modificar su perfil desde la app (solo lectura).
- `auditoria` no es accesible desde la API: se consulta en el SQL Editor, por ejemplo
  `select * from public.auditoria order by fecha desc limit 100;`
