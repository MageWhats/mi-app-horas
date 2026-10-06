# Base de datos (Supabase)

## Puesta en marcha

1. **Crear el proyecto** en [supabase.com](https://supabase.com) → *New project*.
   Región recomendada: **South America (São Paulo)**, la más cercana a Colombia. Guarda la contraseña de la base de datos.
2. **Crear el esquema**: *SQL Editor* → ejecuta, **en orden**, cada archivo de `migrations/` (el nombre empieza por la
   fecha). Con la CLI: `npx supabase link --project-ref <ref>` y `npx supabase db push`.
3. **Confirmación de correo**: *Authentication → Sign In / Providers → Email → Confirm email*.
   - Desactivado: el operario puede iniciar sesión justo después de registrarse.
   - Activado: debe confirmar desde su correo antes de entrar (requiere SMTP propio para enviar a cualquier correo).
4. **Variables de entorno**: copia `.env.example` como `.env` y complétalo. **Nunca** uses la `service_role` key en la app.
5. Agrega las mismas variables en **Vercel** (web) y en **EAS** (`npx eas env:create`) para los builds de Android/iOS.
6. Arranca limpiando la caché: `npx expo start -c`.

## Modelo

| Tabla | Contenido |
|---|---|
| `profiles` | Un operario por usuario de `auth.users`. Lo crea el trigger `on_auth_user_created` con los metadatos del registro. |
| `jornadas` | Notas de cada día. Único por operario y fecha. |
| `marcas` | ENTRADA / SALIDA en tiempo real, registros MANUAL por horario y MANUAL_JORNADA. Nunca se borran. |
| `auditoria` | Quién creó o cambió qué y cuándo (marcas, jornadas, perfiles, cédulas autorizadas). Solo la escriben triggers. |
| `cedulas_autorizadas` | Lista opcional de cédulas que pueden registrarse (ver *Registro restringido*). |
| `intentos_acceso` | Intentos de login y registro, para limitar abusos. Se limpia sola. |
| `supervisores` | Usuarios que ven las horas de todo el equipo (ver *Supervisores*). |

Las horas totales, nocturnas y extras **no se guardan**: la app las calcula a partir de las marcas vigentes
con las reglas legales de cada fecha (`lib/utils.ts`). Domingos y festivos salen del calendario oficial de
Colombia (Ley Emiliani), no los marca el operario.

## Funciones que usa la app

| Función | Qué hace |
|---|---|
| `ponchar(...)` | Registra ENTRADA o SALIDA con la **hora del servidor** (Colombia). Corta en la medianoche los turnos que empezaron el día anterior, evita marcas dobles (1 minuto) y exige motivo si no hay GPS. |
| `registrar_manual(...)` | Horas manuales: solo de los últimos 7 días, nunca futuras, sin cruzarse con otras marcas y sin superar 24 h en el día. |
| `anular_marca(id, motivo)` | Anula un registro manual: queda guardado y tachado, y deja de sumar. Las marcas de entrada y salida no se anulan. |
| `ponchar_sin_conexion(...)` | Registra una marca que el celular guardó sin señal (ver *Marcas sin conexión*). |
| `es_supervisor()` / `operarios_equipo()` | Rol de supervisor y lista del equipo con solo nombre y cédula. |
| `buscar_acceso(cedula, captcha)` | Correo de acceso de una cédula, con CAPTCHA y límite de intentos (30 por IP y 10 por cédula cada 10 min). |
| `estado_registro(cedula, captcha)` | Si una cédula puede registrarse (disponible, registrada o no autorizada), con CAPTCHA y límite de intentos. |

## Seguridad

| Medida | Cómo |
|---|---|
| Claves fuera del código | `.env` (ignorado por Git) y variables de Vercel/EAS. La app solo usa la clave pública `anon`. La Secret Key de Turnstile vive en el Vault de Supabase. |
| Autorización en el servidor | RLS en todas las tablas: cada operario solo ve sus datos. Las marcas solo se escriben con las funciones anteriores. |
| Datos que no se pueden manipular | Hora del servidor, marcas que no se borran, anulaciones con motivo, auditoría. |
| Validación de entradas | En los formularios **y** en la base de datos (largos y formatos del perfil, notas y motivos; listas cerradas). |
| Intentos de acceso y bots | Límite de intentos en la búsqueda por cédula y el registro + CAPTCHA opcional (Cloudflare Turnstile) + límites de Supabase Auth. |
| Registro | Abierto o restringido a una lista de cédulas autorizadas. |
| Cabeceras HTTP | `vercel.json`: CSP estricta, anti-iframe, `nosniff`, HSTS, permisos (solo ubicación). |
| Dependencias | Dependabot semanal y `npm audit` en cada push (`.github/workflows/ci.yml`). |
| Pruebas | Cálculos legales y reglas SQL (`npm test`) en cada push, sobre un PostgreSQL embebido. |
| Copias de seguridad | Cada noche, cifradas con AES-256 (`.github/workflows/respaldo.yml`). |

`auditoria` no es accesible desde la API. Se consulta en el SQL Editor:

```sql
select * from public.auditoria order by fecha desc limit 100;
```

### Ajustes en el panel de Supabase

- **Authentication → Rate Limits:** revisa los límites de inicio de sesión y registro.
- **Authentication → Providers → Email:** sube la longitud mínima de contraseña a **8** (la app pide 6 como mínimo; Supabase aplica la mayor).
- **Advisors → Security Advisor:** revísalo después de cada migración.
- **Logs:** consultas a la base de datos, a la API y a Auth (inicios de sesión y fallos).

## CAPTCHA (Cloudflare Turnstile, gratis)

Respeta el orden: si se activa en Supabase antes de que la app envíe la verificación, **nadie podrá entrar**.

1. En [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile → Add widget**: dominios `tu-app.vercel.app` y
   `localhost`, modo *Managed*. Copia la **Site Key** y la **Secret Key**.
2. En **Vercel** y en **EAS** agrega `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (Site Key) y `EXPO_PUBLIC_SITE_URL`
   (por ejemplo `https://tu-app.vercel.app`), y despliega de nuevo. La Site Key es pública.
3. Abre la app: la verificación de Cloudflare debe aparecer en el login y en el registro, y el login debe funcionar.
4. Guarda la **Secret Key** en el Vault de Supabase (SQL Editor). Desde ese momento la búsqueda por cédula exige un
   token válido y las funciones antiguas (`email_para_login`, `cedula_disponible`) quedan desactivadas:
   ```sql
   select vault.create_secret('LA-SECRET-KEY', 'turnstile_secret', 'Cloudflare Turnstile');
   ```
5. En Supabase → **Authentication → Attack Protection** → activa *CAPTCHA protection*, elige **Turnstile** y pega la
   misma **Secret Key**. Así el inicio de sesión y el registro también exigen la verificación.

Para desactivarlo: apaga *CAPTCHA protection* en el paso 5 y borra el secreto:
`delete from vault.secrets where name = 'turnstile_secret';`. Si Cloudflare no responde, el acceso se niega.

Si la app dice *No se pudo verificar que no eres un robot*, la respuesta de Cloudflare queda guardada (7 días):
`select * from public.captcha_fallos order by fecha desc limit 10;` — `invalid-input-response` = token de otro
widget (la Site Key de la app y la Secret Key no son del mismo widget); `timeout-or-duplicate` = token vencido o ya
usado; `invalid-input-secret` = Secret Key mal copiada en el Vault.

La app de Android/iOS muestra la verificación en un WebView que abre `EXPO_PUBLIC_SITE_URL/turnstile.html`, así que
necesita un **build nuevo** con esas variables.

## Recuperar la contraseña (código por correo)

La pantalla *¿Olvidaste tu contraseña?* envía un **código de 6 dígitos** al correo (no un enlace: así funciona igual en
el celular y en la web). Necesita, una sola vez:

1. **SMTP propio**: el correo incluido en Supabase solo envía a los miembros del equipo del proyecto. En
   *Authentication → Emails → SMTP Settings* configura uno (por ejemplo Gmail con contraseña de aplicación, o Resend).
2. **Plantilla con el código**: *Authentication → Emails → Templates → Reset Password*. Reemplaza el contenido por:
   ```html
   <h2>Recupera tu contraseña</h2>
   <p>Tu código para crear una nueva contraseña en Control de Horas es:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Si no lo pediste, ignora este correo.</p>
   ```
3. **Longitud del código**: *Authentication → Providers → Email → Email OTP Length* en **6**.

## Supervisores

Un supervisor ve, en la pestaña **Equipo**, el estado de cada operario, sus horas del mes, las marcas por revisar
(sin GPS, GPS simulado, sin conexión, anuladas) y puede exportar el Excel del equipo. **Solo datos laborales**:
nombre, cédula, marcas y horas; no ve dirección, contacto ni familia. No puede modificar nada.

```sql
-- Nombrar supervisor (por su cédula)
insert into public.supervisores (user_id) select id from public.profiles where cedula = '1007744230';
-- Ver los supervisores
select p.cedula, p.full_name from public.supervisores s join public.profiles p on p.id = s.user_id;
-- Quitar el rol
delete from public.supervisores where user_id = (select id from public.profiles where cedula = '1007744230');
```

El cambio aplica la próxima vez que el supervisor abra la app.

## Marcas sin conexión

Si no hay señal al ponchar, la marca (con su GPS) se guarda en el celular y se envía sola al volver la conexión.
Como la hora la pone el celular, la base de datos solo la acepta si es coherente: no está en el futuro, no tiene más de
72 horas y es posterior a la última marca del operario. Queda **señalada "sin conexión"** en la app, en la auditoría y
en el Excel (`created_at` guarda la hora en que llegó al servidor). Si el servidor la rechaza, el operario ve el
motivo en Inicio y debe hacer un registro manual.

## Registro restringido

Mientras `cedulas_autorizadas` esté vacía, cualquiera puede registrarse. Si tiene al menos una cédula, **solo esas**
pueden crear cuenta (la base de datos rechaza las demás, aunque se salten la app):

```sql
-- Autorizar
insert into public.cedulas_autorizadas (cedula, nombre) values ('1007744230', 'Juan Pérez'), ('1023456789', 'Ana Gómez');
-- Ver la lista
select * from public.cedulas_autorizadas order by creada_en desc;
-- Quitar una
delete from public.cedulas_autorizadas where cedula = '1007744230';
```

Quitar una cédula de la lista no borra la cuenta que ya exista; solo impide registrarse a quien no la tenga.

## Copias de seguridad

Cada noche a las 2:00 a. m. (Colombia) la tarea `.github/workflows/respaldo.yml` exporta la base de datos (roles,
estructura y datos, incluidos los usuarios), verifica que esté completa, la cifra con AES-256 y la guarda **30 días**
en GitHub → Actions → *Respaldo de la base de datos* → cada ejecución → *Artifacts*. Si falla, GitHub envía un correo.

### Configuración (una sola vez)

En GitHub → Settings → Secrets and variables → **Actions** → *New repository secret*, crea:

1. **`SUPABASE_DB_URL`**: en Supabase pulsa **Connect** → **Session pooler** → copia la URI y reemplaza
   `[YOUR-PASSWORD]` por la contraseña de la base de datos:
   `postgresql://postgres.<id>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`.
   Si no la recuerdas: Database → Settings → *Reset database password* (usa solo letras y números).
   Se usa el *Session pooler* porque GitHub no tiene IPv6.
2. **`BACKUP_PASSPHRASE`**: una contraseña larga (16 caracteres o más) para cifrar las copias.
   **Guárdala en un gestor de contraseñas: sin ella las copias no se pueden abrir.**

Luego, en Actions → *Respaldo de la base de datos* → **Run workflow**, para hacer la primera copia y comprobar que
todo funciona.

### Restaurar

Hazlo sobre un **proyecto nuevo de Supabase** (o uno de prueba), nunca directamente sobre producción sin una copia
reciente.

1. Descarga el artefacto de la fecha que necesitas y descomprime el zip.
2. Descifra y extrae (en Git Bash, que ya trae `gpg`):
   ```bash
   gpg -d horas-respaldo-AAAA-MM-DD_HHMM.tar.gz.gpg > respaldo.tar.gz   # pide la BACKUP_PASSPHRASE
   tar -xzf respaldo.tar.gz                                             # crea la carpeta respaldo/
   ```
3. Restaura con `psql` usando la URI del proyecto destino:
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file respaldo/roles.sql \
     --file respaldo/esquema.sql \
     --command 'SET session_replication_role = replica' \
     --file respaldo/datos.sql \
     --dbname "postgresql://postgres.<id>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres"
   ```

## Pruebas

```bash
npm test        # cálculos legales (tests/utils.test.ts) y reglas SQL de todas las migraciones (tests/sql.test.ts)
npm run typecheck
```

Las pruebas SQL corren en un PostgreSQL embebido (PGlite): no tocan Supabase.
