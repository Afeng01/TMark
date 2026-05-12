# Descargar TMark

<script setup>
import DownloadButton from '../.vitepress/components/DownloadButton.vue'
</script>

<DownloadButton />

## Requisitos del Sistema

- macOS 10.15 (Catalina) o posterior
- Procesador Apple Silicon (M1/M2/M3) o Intel
- 200 MB de espacio en disco

## Instalación

**Homebrew (Recomendado)**

```bash
brew install xiaolai/tap/tmark
```

Esto instala TMark y selecciona automáticamente la versión correcta para tu Mac (Apple Silicon o Intel).

**Actualización**

```bash
brew update && brew upgrade tmark
```

**Instalación Manual**

1. Descarga el archivo `.dmg`
2. Abre el archivo descargado
3. Arrastra TMark a tu carpeta de Aplicaciones
4. En el primer inicio, haz clic derecho en la aplicación y selecciona "Abrir" para omitir Gatekeeper

## Windows y Linux

TMark está construido con Tauri, que soporta compilación multiplataforma. Sin embargo, **el desarrollo activo y las pruebas están actualmente enfocados en macOS**. El soporte para Windows y Linux es limitado en el futuro previsible debido a restricciones de recursos.

Si deseas ejecutar TMark en Windows o Linux:

- **Binarios precompilados** están disponibles en [GitHub Releases](https://github.com/Afeng01/TMark/releases) (proporcionados tal como están, sin soporte garantizado)
- **Compilar desde el código fuente** siguiendo las instrucciones a continuación

## Verificación de Descargas

Todas las versiones se compilan automáticamente a través de GitHub Actions. Puedes verificar la autenticidad revisando la versión en nuestra [página de GitHub Releases](https://github.com/Afeng01/TMark/releases).

## Compilar desde el Código Fuente

Para desarrolladores que quieran compilar TMark desde el código fuente:

```bash
# Clonar el repositorio
git clone https://github.com/Afeng01/TMark.git
cd tmark

# Instalar dependencias
pnpm install

# Compilar para producción
pnpm tauri build
```

Consulta el [README](https://github.com/Afeng01/TMark#readme) para obtener instrucciones detalladas de compilación y requisitos previos.
