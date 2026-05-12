# Privacidad

> TMark snapshot note: this inherited privacy page is not authoritative until TMark release infrastructure is published. The current app update endpoint points to GitHub Releases, and public stats are disabled by default.

TMark respeta tu privacidad. Aquí está exactamente lo que ocurre — y lo que no ocurre.

## Qué Envía TMark

TMark incluye un **verificador de actualizaciones automáticas** que periódicamente contacta a nuestro servidor para ver si hay una nueva versión disponible. Esta es la **única** solicitud de red que realiza TMark.

Cada verificación envía exactamente estos campos — nada más:

| Dato | Ejemplo | Propósito |
|------|---------|-----------|
| Dirección IP | `203.0.113.42` | Inherente a cualquier solicitud HTTP — no podemos no recibirla |
| SO | `darwin`, `windows`, `linux` | Para entregar el paquete de actualización correcto |
| Arquitectura | `aarch64`, `x86_64` | Para entregar el paquete de actualización correcto |
| Versión de la app | `0.5.10` | Para determinar si hay una actualización disponible |
| Hash de máquina | `a3f8c2...` (64 caracteres hexadecimales) | Contador anónimo de dispositivos — SHA-256 del nombre de host + SO + arquitectura; no reversible |

La URL completa tiene este aspecto:

```text
GET https://github.com/Afeng01/TMark/releases/latest/download/latest.json?target=darwin&arch=aarch64&version=0.5.10
X-Machine-Id: a3f8c2b1d4e5f6078a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1
```

Puedes verificarlo tú mismo — el endpoint está en [`tauri.conf.json`](https://github.com/Afeng01/TMark/blob/main/src-tauri/tauri.conf.json) (busca `"endpoints"`), y el hash está en [`lib.rs`](https://github.com/Afeng01/TMark/blob/main/src-tauri/src/lib.rs) (busca `machine_id_hash`).

## Qué NO Envía TMark

- Tus documentos ni su contenido
- Nombres de archivos o rutas
- Patrones de uso ni análisis de características
- Información personal de ningún tipo
- Informes de errores
- Datos de pulsaciones de teclas o edición
- Identificadores de hardware reversibles o huellas digitales
- El hash de máquina es un resumen SHA-256 unidireccional — no puede revertirse para recuperar tu nombre de host ni ninguna otra entrada

## Cómo Usamos los Datos

Agregamos los registros de verificación de actualizaciones para producir las estadísticas en vivo que se muestran en nuestra [página de inicio](/es/):

| Métrica | Cómo se calcula |
|---------|-----------------|
| **Dispositivos únicos** | Recuento de hashes de máquina distintos por día/semana/mes |
| **IPs únicas** | Recuento de direcciones IP distintas por día/semana/mes |
| **Pings** | Número total de solicitudes de verificación de actualización |
| **Plataformas** | Recuento de pings por combinación de SO + arquitectura |
| **Versiones** | Recuento de pings por versión de la app |

Estos números se publican abiertamente en [`configured stats endpoint`](https://github.com/Afeng01/TMark/releases). Nada está oculto.

**Advertencias importantes:**
- Las IPs únicas subestiman a los usuarios reales — varias personas detrás del mismo router/VPN cuentan como uno
- Los dispositivos únicos proporcionan recuentos más precisos, pero un cambio de nombre de host o una instalación nueva del SO genera un nuevo hash
- Los pings sobreestiman a los usuarios reales — una misma persona puede verificar varias veces al día

## Retención de Datos

- Los registros se almacenan en nuestro servidor en formato estándar de registro de acceso
- Los archivos de registro rotan a 1 MB y solo se conservan los 3 archivos más recientes
- Los registros no se comparten con nadie
- No hay sistema de cuentas — TMark no sabe quién eres
- El hash de máquina no está vinculado a ninguna cuenta, correo electrónico o dirección IP — es únicamente un contador pseudónimo de dispositivos
- No usamos cookies de seguimiento, huellas digitales ni ningún SDK de análisis

## Transparencia de Código Abierto

TMark es completamente de código abierto. Puedes verificar todo lo descrito aquí:

- Configuración del endpoint de actualización: [`src-tauri/tauri.conf.json`](https://github.com/Afeng01/TMark/blob/main/src-tauri/tauri.conf.json)
- Generación del hash de máquina: [`src-tauri/src/lib.rs`](https://github.com/Afeng01/TMark/blob/main/src-tauri/src/lib.rs) — busca `machine_id_hash`
- Agregación de estadísticas del lado del servidor: [`scripts/tmark-stats-json`](https://github.com/Afeng01/TMark/blob/main/scripts/tmark-stats-json) — el script exacto que se ejecuta en nuestro servidor para producir las [estadísticas públicas](https://github.com/Afeng01/TMark/releases)
- No existen otras llamadas de red en el código base — busca `fetch`, `http` o `reqwest` tú mismo

## Deshabilitar las Verificaciones de Actualizaciones

Si prefieres deshabilitar completamente las verificaciones automáticas de actualizaciones, puedes bloquear the configured update endpoint a nivel de red (cortafuegos, `/etc/hosts` o DNS). TMark continuará funcionando normalmente sin ellas — simplemente no recibirás notificaciones de actualización.
