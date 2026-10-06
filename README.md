# SIGF · Sistema Integral de Gestión de Flota

Prototipo interactivo de la **Etapa 1: maestro de unidades y documentación** para Emergencias Salud (Grupo IHSA).

> **Demo:** usa datos ficticios generados en el navegador. Los cambios no se guardan al recargar la página.

## Qué incluye

- Buscador por patente o número de interno, con tiempo de búsqueda.
- Listado de unidades con filtros e indicadores de documentación.
- Ficha de unidad con VTV, cédula, seguro y título (ver, descargar y reemplazar de forma simulada).
- Alta y edición de unidades, con historial de cambios.
- Roles de ejemplo (Consulta, Carga, Administrador) que cambian lo que se puede hacer.
- Modo claro y oscuro.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la página |
| `style.css` | Diseño (compartido con el Centro de operaciones IHSA) |
| `app.js` | Lógica y datos de muestra |
| `logo-ihsa.png` | Logo de Grupo IHSA |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll |

## Cómo verlo en tu computadora

Abrí `index.html` en el navegador. No requiere instalar nada.

## Cómo publicarlo en GitHub Pages

1. Creá un repositorio nuevo en GitHub y subí todos los archivos de esta carpeta a la raíz.
2. En el repositorio, entrá a **Settings > Pages**.
3. En **Build and deployment**, elegí **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
4. Guardá y esperá unos minutos: GitHub te mostrará la dirección del sitio.

## Próximas etapas

Alertas y semáforo de vencimientos, mantenimiento, reportes y tablero de control, e integraciones.
