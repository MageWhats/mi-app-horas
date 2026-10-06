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
| `jornadas` | Detalle de cada día: festivo/domingo y notas. Único por operario y fecha. |
| `marcas` | ENTRADA / SALIDA en tiempo real, registros MANUAL por horario y MANUAL_JORNADA. No se editan. |

Las horas totales, nocturnas y extras **no se guardan**: la app las calcula a partir de las marcas
con las reglas legales vigentes en cada fecha (`lib/utils.ts`).

## Seguridad

- RLS en todas las tablas: cada operario solo ve y modifica sus propios datos.
- Sin sesión solo se pueden usar `email_para_login(cedula)` y `cedula_disponible(cedula)`.
- Los campos de nómina del perfil (`status`, `position`) no los puede modificar el operario.
