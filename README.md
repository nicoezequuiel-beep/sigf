# SIGF · Gestión de flota

Versión con 309 móviles reales importados de "Fechas VTV moviles.xlsm", hoja "Listado".
Actualización del 30/10/2026, desde el archivo del servidor modificado el 29/10/2026: 31 móviles con cambios, sin altas ni bajas de registros. Cambiaron 19 vencimientos de VTV, 5 estados y 19 observaciones (un móvil puede tener varios cambios).

## Abrir
Para documentación real, abrí Iniciar SIGF.cmd y usá la dirección interna del servicio en Edge o Chrome. Abrir index.html directamente solo permite consultar los datos del Excel.
Para trasladarla a otra computadora, copiá la carpeta completa o descomprimí el ZIP completo antes de abrir index.html.

## Datos y búsqueda
- Buscá por patente, ignorando espacios y guiones, o por número de móvil.
- Acepta 870, M-870 e internos alfanuméricos como UDM1.
- Las coincidencias exactas aparecen primero; Enter abre la ficha exacta.
- En Unidades se puede filtrar por emplazamiento (valores actuales de Base) y tipo de móvil (Área del Excel). TRAS. ESPECIAL se muestra como Traslados. Clase conserva la clase de vehículo original.
- La ficha conserva clase, año, ubicación técnica, área, centro de coste, local y observaciones.
- OPER se muestra como operativa. Los demás códigos se conservan sin interpretar.
- 10 registros no tienen fecha de VTV; aparecen como "Sin dato". El punto del Excel en el móvil 0 (C547550) se interpreta como fecha no informada.
- Los indicadores de VTV se calculan al consultar: vencida antes de hoy, próxima desde hoy hasta 30 días, vigente después de 30 días.
- Se usa únicamente Listado: las otras hojas son resúmenes y no se suman como nuevos móviles.
- Exportar CSV descarga los resultados filtrados para abrir en Excel.

## Ediciones
Las altas y ediciones se guardan en el almacenamiento de este navegador.
No se comparten entre computadoras y no modifican el Excel original.
"Restablecer Excel" pide confirmar antes de descartar las ediciones locales.
El rol es un selector de prueba; todavía no hay autenticación ni cuentas corporativas.

## Documentación automática en la red IHSA

La ficha de cada móvil consulta automáticamente los archivos del servidor por patente. En **Descarga de documentación**, seleccioná móviles y usá **Descargar documentación** para recibir el ZIP real. No hay selector de carpetas ni archivos DEMO. La fecha de VTV del Excel sigue siendo independiente del contenido de los certificados.

### Usar esta computadora como servicio
- Abrí **Iniciar SIGF.cmd**. Inicia el servicio en segundo plano y abre la dirección interna configurada.
- La configuración privada está en `config-documentacion.local.json`. Incluye la carpeta UNC, la IP corporativa y el puerto 8765. No debe publicarse.
- Todos deben abrir SIGF desde esa dirección interna, mientras esta PC esté encendida y conectada a IHSA. La publicación estática anterior en Internet no ejecuta este servicio.
- No se configura inicio automático con Windows. Después de reiniciar, ejecutá **Iniciar SIGF.cmd** otra vez.
- El servicio escucha en la IP corporativa configurada, no en todas las interfaces. Si cambia la IP de la conexión IHSA, hay que actualizar `host` y `allowedHosts` en la configuración y reiniciar el servicio.
- Para otras computadoras, Windows Firewall y la red corporativa deben permitir el puerto de SIGF sobre la interfaz corporativa. No abrir el puerto en el perfil público ni publicar mediante redirección de puertos.
- En esta PC se verificó el servicio en `http://10.254.253.94:8765`. Windows denegó crear la regla de firewall sin permisos de administrador. Sistemas puede revisar y ejecutar `scripts/habilitar_acceso_ihsa.ps1` como administrador: permite solo clientes 10.x por Ethernet 3, perfil de dominio y puerto 8765. El acceso desde otra PC sigue sin verificarse.
- Los datos editados siguen siendo locales a cada navegador. El selector de roles no autentica personas. El servicio habilita consulta a quienes puedan acceder a su dirección interna; no reproduce permisos individuales del recurso compartido.

### Funcionamiento de los documentos
El servicio usa la cuenta de Windows que lo inicia y necesita permiso de lectura sobre la carpeta compartida. Nunca escribe en ella. Recibe peticiones del mismo origen que la página, no habilita CORS y solo publica los archivos de la interfaz y documentos presentes en el índice autorizado. No sirve el repositorio ni los índices privados como carpetas web.

El primer acceso indexa las subcarpetas del servidor, incluida Nación Seguros. Se omiten por completo las carpetas que contengan **Vehículos bajas**, en cualquier nivel, y no se siguen enlaces o junctions. Se omiten Thumbs.db, Desktop.ini y temporales de Office. La revisión se renueva al consultar si pasaron cinco minutos; el navegador reutiliza el resultado hasta un minuto. No se copian todos los documentos a esta computadora.

La asociación necesita una patente reconocible y única en la ruta, presente en el Excel. No se utiliza el interno como sustituto. Se conservan las distintas carpetas y versiones: no se elige la VTV más reciente por fecha de modificación. Los seguros sin patente única se muestran por separado y no se atribuye cobertura automáticamente a toda la flota.

Una falla al leer la raíz se informa como error de conexión. Las fallas parciales muestran una advertencia con su cantidad; un cero no acredita ausencia documental. Los archivos sin asociación única no se adjuntan automáticamente.

Los ZIP se preparan temporalmente en esta PC y se transmiten al navegador; el archivo temporal se elimina al finalizar o interrumpir la transmisión. Se admite ZIP64 y un máximo de 10 GB por selección, con hasta dos preparaciones simultáneas. Se conservan las rutas para evitar colisiones entre versiones. El informe del ZIP identifica móviles seleccionados sin archivos y errores de lectura del índice. Los seguros generales se descargan por separado.

### Instalar en otra computadora
Se necesita Python 3.11 o superior. Dentro de la carpeta SIGF:
```powershell
python -m pip install --target .intranet-deps -r requirements-intranet.txt
```
Crear la configuración privada, ajustando la IP corporativa de esa computadora:
```json
{
  "documentsRoot": "\\\\SERVIDOR\\recurso\\DOCUMENTOS MÓVILES",
  "host": "IP-CORPORATIVA-DEL-EQUIPO",
  "port": 8765,
  "refreshSeconds": 300,
  "allowedHosts": ["IP-CORPORATIVA-DEL-EQUIPO"]
}
```

Luego ejecutar **Iniciar SIGF.cmd**. Para un alojamiento permanente, Sistemas puede ejecutar `scripts/servidor_documentacion.py` como servicio usando Waitress y una cuenta con lectura del recurso. No se modifica automáticamente el firewall, la configuración de Windows ni el servidor ERFLS01.

### Verificación
```powershell
python scripts/test_servidor_documentacion.py
node scripts/verificar_documentacion_intranet.cjs
python scripts/verificar_conexion_documental_real.py
```
Las dos primeras verificaciones usan documentos sintéticos en una carpeta temporal. La última lee la configuración privada y comprueba documentos reales, descarga individual y ZIP sin modificar el origen. No publica copias de documentos en el proyecto.

## Actualizar desde otro Excel
Los datos incluidos son una copia del archivo importado, sin sincronización automática.
El script scripts/importar_excel.py vuelve a extraer Listado sin modificar el archivo ni ejecutar macros.
Requiere Python y openpyxl:
    python scripts/importar_excel.py "ruta/al/archivo.xlsm"
Conservá el mismo formato de columnas. Cada importación genera data.js.
Una nueva importación parte de los datos del nuevo Excel y deja de utilizar las ediciones de la importación anterior.
