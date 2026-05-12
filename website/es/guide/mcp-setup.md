# Integración con IA (MCP)

TMark incluye un servidor MCP (Model Context Protocol) integrado que permite a los asistentes de IA como Claude interactuar directamente con tu editor.

## ¿Qué es MCP?

El [Model Context Protocol](https://modelcontextprotocol.io/) es un estándar abierto que permite a los asistentes de IA interactuar con herramientas y aplicaciones externas. El servidor MCP de TMark expone sus capacidades de editor como herramientas que los asistentes de IA pueden usar para:

- Leer y escribir contenido de documentos
- Aplicar formato y crear estructuras
- Navegar y gestionar documentos
- Insertar contenido especial (matemáticas, diagramas, wiki links)

## Configuración Rápida

TMark facilita la conexión con asistentes de IA con instalación en un clic.

### 1. Habilitar el Servidor MCP

Abre **Configuración → Integraciones** y activa el Servidor MCP:

<div class="screenshot-container">
  <img src="/screenshots/mcp-settings-server.png" alt="TMark MCP Server Settings" />
</div>

- **Habilitar Servidor MCP** — Activa para permitir conexiones de IA
- **Iniciar al abrir** — Se inicia automáticamente cuando se abre TMark
- **Auto-aprobar ediciones** — Aplica cambios de IA sin vista previa (ver más abajo)

### 2. Instalar Configuración

Haz clic en **Instalar** para tu asistente de IA:

<div class="screenshot-container">
  <img src="/screenshots/mcp-settings-install.png" alt="TMark MCP Install Configuration" />
</div>

Asistentes de IA compatibles:
- **Claude Desktop** — La aplicación de escritorio de Anthropic
- **Claude Code** — CLI para desarrolladores
- **Codex CLI** — Asistente de programación de OpenAI
- **Gemini CLI** — Asistente de IA de Google

::: info Otros Clientes Compatibles con MCP
Otros clientes compatibles con MCP como Cursor, Windsurf y herramientas similares también pueden conectarse al servidor MCP de TMark. Configúralos manualmente apuntando a la ruta del binario del servidor MCP (ver [Configuración Manual](#configuracion-manual) más abajo).
:::

#### Iconos de Estado

Cada proveedor muestra un indicador de estado:

| Icono | Estado | Significado |
|-------|--------|-------------|
| ✓ Verde | Válido | La configuración es correcta y funciona |
| ⚠ Ámbar | Ruta no coincide | TMark fue movido — haz clic en **Reparar** |
| ✗ Rojo | Binario no encontrado | Binario MCP no encontrado — reinstala TMark |
| ○ Gris | No configurado | No instalado — haz clic en **Instalar** |

::: tip ¿Moviste TMark?
Si mueves TMark.app a una ubicación diferente, el estado mostrará el ámbar "Ruta no coincide". Simplemente haz clic en el botón **Reparar** para actualizar la configuración con la nueva ruta.
:::

### 3. Reinicia tu Asistente de IA

Después de instalar o reparar, **reinicia tu asistente de IA** completamente (ciérralo y vuelve a abrirlo) para cargar la nueva configuración. TMark mostrará un recordatorio después de cada cambio de configuración.

### 4. Pruébalo

En tu asistente de IA, prueba comandos como:
- *"¿Qué hay en mi documento de TMark?"*
- *"Escribe un resumen sobre computación cuántica en TMark"*
- *"Añade una tabla de contenidos a mi documento"*

## Véalo en Acción

Hazle una pregunta a Claude y pídele que escriba la respuesta directamente en tu documento de TMark:

<div class="screenshot-container">
  <img src="/screenshots/mcp-claude.png" alt="Claude Desktop using TMark MCP" />
  <p class="screenshot-caption">Claude Desktop llama a <code>document</code> → <code>set_content</code> para escribir en TMark</p>
</div>

<div class="screenshot-container">
  <img src="/screenshots/mcp-result.png" alt="Content rendered in TMark" />
  <p class="screenshot-caption">El contenido aparece instantáneamente en TMark, completamente formateado</p>
</div>

<!-- Styles in style.css -->

## Configuración Manual

Si prefieres configurar manualmente, aquí están las ubicaciones de los archivos de configuración:

### Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) o `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "tmark": {
      "command": "/Applications/TMark.app/Contents/MacOS/tmark-mcp-server"
    }
  }
}
```

### Claude Code

Edita `~/.claude.json` o el `.mcp.json` del proyecto:

```json
{
  "mcpServers": {
    "tmark": {
      "command": "/Applications/TMark.app/Contents/MacOS/tmark-mcp-server"
    }
  }
}
```

### Codex CLI

Edita `~/.codex/config.toml`:

```toml
[mcp_servers.tmark]
command = "/Applications/TMark.app/Contents/MacOS/tmark-mcp-server"
```

### Gemini CLI

Edita `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "tmark": {
      "command": "/Applications/TMark.app/Contents/MacOS/tmark-mcp-server"
    }
  }
}
```

::: tip Encontrar la Ruta del Binario
En macOS, el binario del servidor MCP está dentro de TMark.app:
- `TMark.app/Contents/MacOS/tmark-mcp-server`

En Windows:
- `C:\Program Files\TMark\tmark-mcp-server.exe`

En Linux:
- `/usr/bin/tmark-mcp-server` (o donde lo hayas instalado)

El puerto se detecta automáticamente — no se necesitan `args`.
:::

### Opciones de línea de comandos (avanzado)

El binario del servidor MCP admite un pequeño conjunto de opciones para diagnósticos y configuraciones heredadas:

| Opción | Qué hace |
|---|---|
| `--version` (o `-v`) | Muestra la versión (debe coincidir con la de TMark en ejecución) y sale. |
| `--health-check` | Ejecuta una autoprueba contra el puente de TMark en ejecución y sale. Úsalo para verificar tu instalación antes de conectar un asistente de IA. |
| `--port <número>` | Anulación manual del puerto. Omite el protocolo de autodescubrimiento y se conecta en el puerto indicado. Solo es útil para configuraciones heredadas en las que el puerto del puente está fijado externamente; se prefiere la ruta de autodescubrimiento. |

Ejemplo:

```bash
tmark-mcp-server --health-check
tmark-mcp-server --version
tmark-mcp-server --port 9223   # heredado / manual
```

## Cómo Funciona

```text
AI Assistant <--stdio--> MCP Server <--WebSocket--> TMark Editor
```

1. **TMark inicia un puente WebSocket** en un puerto disponible al arrancarse
2. **El servidor MCP** lee el puerto y el token de autenticación del directorio de datos de la aplicación TMark
3. **El servidor MCP** se conecta y autentica a través del puente WebSocket
4. **El asistente de IA** se comunica con el servidor MCP a través de stdio
5. **Los comandos se retransmiten** al editor de TMark a través del puente

## Capacidades Disponibles

Cuando está conectado, tu asistente de IA puede:

| Categoría | Capacidades |
|-----------|-------------|
| **Documento** | Leer/escribir contenido, buscar, reemplazar |
| **Selección** | Obtener/establecer selección, reemplazar texto seleccionado |
| **Formato** | Negrita, cursiva, código, enlaces y más |
| **Bloques** | Encabezados, párrafos, bloques de código, citas |
| **Listas** | Listas con viñetas, ordenadas y de tareas |
| **Tablas** | Insertar, modificar filas/columnas |
| **Especial** | Ecuaciones matemáticas, diagramas Mermaid, wiki links |
| **Espacio de trabajo** | Abrir/guardar documentos, gestionar ventanas |

Consulta la [Referencia de Herramientas MCP](/es/guide/mcp-tools) para documentación completa.

## Verificar el Estado de MCP

TMark proporciona múltiples formas de verificar el estado del servidor MCP:

### Indicador en la Barra de Estado

La barra de estado muestra un indicador **MCP** en el lado derecho:

| Color | Estado |
|-------|--------|
| Verde | Conectado y en ejecución |
| Gris | Desconectado o detenido |
| Pulsante (animado) | Iniciándose |

El inicio generalmente se completa en 1-2 segundos.

Haz clic en el indicador para abrir el cuadro de diálogo de estado detallado.

### Cuadro de Diálogo de Estado

Accede a través de **Ayuda → Estado del Servidor MCP** o haz clic en el indicador de la barra de estado.

El cuadro de diálogo muestra:
- Estado de la conexión (Saludable / Error / Detenido)
- Estado de ejecución del puente y puerto
- Versión del servidor
- Herramientas disponibles (12) y recursos (4)
- Hora del último chequeo de estado
- Lista completa de herramientas disponibles con botón de copia

### Panel de Configuración

En **Configuración → Integraciones**, cuando el servidor está en ejecución verás:
- Número de versión
- Recuento de herramientas y recursos
- Botón **Probar Conexión** — ejecuta un chequeo de estado
- Botón **Ver Detalles** — abre el cuadro de diálogo de estado

## Solución de Problemas

### "Conexión rechazada" o "Sin editor activo"

- Asegúrate de que TMark esté en ejecución y tenga un documento abierto
- Verifica que el Servidor MCP esté habilitado en Configuración → Integraciones
- Comprueba que el puente MCP muestre el estado "En ejecución"
- Reinicia TMark si la conexión fue interrumpida

### Ruta no coincide después de mover TMark

Si moviste TMark.app a una ubicación diferente (por ejemplo, de Descargas a Aplicaciones), la configuración apuntará a la ruta anterior:

1. Abre **Configuración → Integraciones**
2. Busca el icono de advertencia ámbar ⚠ junto a los proveedores afectados
3. Haz clic en **Reparar** para actualizar la ruta
4. Reinicia tu asistente de IA

### Las herramientas no aparecen en el asistente de IA

- Reinicia tu asistente de IA después de instalar la configuración
- Verifica que la configuración fue instalada (busca la marca de verificación verde en Configuración)
- Revisa los registros de tu asistente de IA para detectar errores de conexión MCP

### Los comandos fallan con "Sin editor activo"

- Asegúrate de que una pestaña de documento esté activa en TMark
- Haz clic en el área del editor para enfocarlo
- Algunos comandos requieren que primero haya texto seleccionado

## Sistema de Sugerencias y Auto-Aprobación

Por defecto, cuando los asistentes de IA modifican tu documento (insertar, reemplazar o eliminar contenido), TMark crea **sugerencias** que requieren tu aprobación:

- **Insertar** — El nuevo texto aparece como vista previa de texto fantasma
- **Reemplazar** — El texto original tiene tachado, el nuevo texto como texto fantasma
- **Eliminar** — El texto a eliminar aparece con tachado

Presiona **Enter** para aceptar o **Escape** para rechazar. Esto preserva tu historial de deshacer/rehacer y te da control total.

### Modo Auto-Aprobación

::: warning Usar con Precaución
Habilitar **Auto-aprobar ediciones** omite la vista previa de sugerencias y aplica los cambios de IA inmediatamente. Solo activa esto si confías en tu asistente de IA y quieres una edición más rápida.
:::

Cuando la auto-aprobación está habilitada:
- Los cambios se aplican directamente sin vista previa
- Deshacer (Mod+Z) sigue funcionando para revertir cambios
- Los mensajes de respuesta incluyen "(auto-aprobado)" para mayor transparencia

Esta configuración es útil para:
- Flujos de trabajo de escritura asistida por IA de manera rápida
- Asistentes de IA confiables con tareas bien definidas
- Operaciones en lote donde revisar cada cambio es poco práctico

## Notas de Seguridad

- El servidor MCP solo acepta conexiones locales (localhost)
- No se envían datos a servidores externos
- Todo el procesamiento ocurre en tu máquina
- El puente WebSocket solo es accesible localmente
- La auto-aprobación está desactivada de forma predeterminada para evitar cambios no deseados

## Próximos Pasos

- Explora todas las [Herramientas MCP](/es/guide/mcp-tools) disponibles
- Aprende sobre los [atajos de teclado](/es/guide/shortcuts)
- Descubre otras [características](/es/guide/features)
