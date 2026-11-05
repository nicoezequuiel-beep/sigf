"""SIGF intranet: lectura del recurso compartido y ZIP; nunca escribe en el origen."""
import argparse
import hashlib
import io
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import socket
import sys
import tempfile
import threading
import time
import unicodedata
from urllib.parse import parse_qs, quote, urlsplit
from wsgiref.util import FileWrapper
import zipfile

APP_ROOT = Path(__file__).resolve().parent.parent
PLATE = re.compile(r"(?<![A-Z0-9])(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3}|[A-Z]\d{3}[A-Z]{3})(?![A-Z0-9])")
ASSETS = {'index.html', 'app.js', 'style.css', 'data.js', 'documentacion.js', 'documentacion-real.js', 'logo-ihsa.png'}


def folded(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c)).upper()


def excluded(part):
    return bool(re.search(r'VEHICULOS\s+BAJAS', folded(part)))


def safe_name(text):
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', str(text)).rstrip('. ') or 'Sin dato'


def load_fleet(root):
    source = (root / 'data.js').read_text(encoding='utf-8-sig')
    return json.loads(source[source.index('{'):].rstrip().removesuffix(';'))['units']


class Documents:
    def __init__(self, root, fleet, refresh_seconds=300):
        self.root = Path(root).resolve()
        self.fleet = {u['plate']: u for u in fleet}
        self.refresh_seconds = refresh_seconds
        self.lock = threading.Lock()
        self.snapshot = None

    def safe_file(self, relative):
        candidate = self.root / relative
        # Rechazar también enlaces/junctions creados después de indexar.
        for part in candidate.relative_to(self.root).parts:
            if excluded(part):
                raise PermissionError('Ruta excluida')
        current = self.root
        for part in candidate.relative_to(self.root).parts:
            current = current / part
            if current.is_symlink() or getattr(current, 'is_junction', lambda: False)():
                raise PermissionError('Enlace no permitido')
        candidate.resolve().relative_to(self.root)
        return candidate

    def get(self):
        with self.lock:
            if self.snapshot and time.monotonic() - self.snapshot['clock'] < self.refresh_seconds:
                return self.snapshot
            # No devolver un índice viejo como si la red estuviera disponible.
            if not self.root.is_dir():
                raise OSError('Recurso compartido no disponible')
            by_plate, files, insurance, errors = {}, {}, [], []
            skipped, unmatched = 0, 0
            queue = [self.root]
            while queue:
                directory = queue.pop()
                try:
                    with os.scandir(directory) as entries:
                        for item in entries:
                            try:
                                if item.is_symlink() or getattr(os.path, 'isjunction', lambda p: False)(item.path):
                                    continue
                                if item.is_dir(follow_symlinks=False):
                                    if excluded(item.name):
                                        skipped += 1
                                    else:
                                        queue.append(Path(item.path))
                                    continue
                                if not item.is_file(follow_symlinks=False) or item.name.upper() in ('THUMBS.DB', 'DESKTOP.INI') or item.name.startswith('~$'):
                                    continue
                                relative = Path(item.path).relative_to(self.root).as_posix()
                                tokens = set(PLATE.findall(folded(relative)))
                                plate = next(iter(tokens)) if len(tokens) == 1 else None
                                is_insurance = any(re.search(r'NACION\s+SEGUROS', folded(p)) for p in Path(relative).parts)
                                if plate not in self.fleet and not is_insurance:
                                    unmatched += 1
                                    continue
                                stat = item.stat(follow_symlinks=False)
                                identifier = hashlib.sha256(relative.encode('utf-8')).hexdigest()
                                entry = dict(id=identifier, name=item.name, path=relative, size=stat.st_size,
                                             modified=stat.st_mtime, url='/api/files/' + identifier)
                                if plate in self.fleet:
                                    by_plate.setdefault(plate, []).append(entry)
                                else:
                                    insurance.append(entry)
                                files[identifier] = relative
                            except OSError:
                                errors.append('archivo')
                except OSError:
                    if directory == self.root:
                        raise
                    errors.append('carpeta')
            for entries in by_plate.values():
                entries.sort(key=lambda e: e['path'].casefold())
            insurance.sort(key=lambda e: e['path'].casefold())
            manifest = dict(byPlate=by_plate, insurance=insurance, unmatched=unmatched,
                            excludedFolders=skipped, readErrors=len(errors), scannedAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                            refreshSeconds=self.refresh_seconds, matchedUnits=len(by_plate),
                            matchedFiles=sum(map(len, by_plate.values())))
            self.snapshot = dict(clock=time.monotonic(), manifest=manifest, files=files)
            return self.snapshot


class IntranetApp:
    def __init__(self, root, documents, port=8765, max_zip_bytes=10 * 1024**3, extra_hosts=()):
        self.root, self.documents, self.port = Path(root), documents, port
        self.max_zip_bytes = max_zip_bytes
        self.zip_slots = threading.BoundedSemaphore(2)
        self.hosts = {'localhost', '127.0.0.1', '::1', socket.gethostname().lower(), socket.getfqdn().lower(), *extra_hosts}
        for name in (socket.gethostname(), socket.getfqdn()):
            try:
                self.hosts.update(a[4][0].lower() for a in socket.getaddrinfo(name, None))
            except OSError:
                pass

    def response(self, start, status, body, content_type='application/json; charset=utf-8', extra=()):
        if isinstance(body, dict):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        start(status, [('Content-Type', content_type), ('Content-Length', str(len(body))),
                       ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'),
                       ('Referrer-Policy', 'same-origin'), *extra])
        return [body]

    def stream(self, start, file, size, name, content_type, head=False):
        start('200 OK', [('Content-Type', content_type), ('Content-Length', str(size)),
                         ('Content-Disposition', "attachment; filename*=UTF-8''" + quote(name)),
                         ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'),
                         ('Referrer-Policy', 'same-origin')])
        if head:
            file.close()
            return []
        return FileWrapper(file, 128 * 1024)

    def __call__(self, env, start):
        fail = lambda status, message: self.response(start, status, {'error': message})
        try:
            host = urlsplit('//' + env.get('HTTP_HOST', '')).hostname
            if not host or host.lower() not in self.hosts:
                return fail('403 Forbidden', 'Dirección del servicio no habilitada.')
            client = ipaddress.ip_address(env.get('REMOTE_ADDR', '127.0.0.1'))
            if not (client.is_private or client.is_loopback):
                return fail('403 Forbidden', 'Acceso disponible en la red interna.')
            if env.get('HTTP_SEC_FETCH_SITE') == 'cross-site':
                return fail('403 Forbidden', 'Abrí los documentos desde SIGF.')
            origin = env.get('HTTP_ORIGIN')
            if origin and origin != env.get('wsgi.url_scheme', 'http') + '://' + env.get('HTTP_HOST', ''):
                return fail('403 Forbidden', 'Origen no habilitado.')
            method, path = env['REQUEST_METHOD'], env['PATH_INFO']
            if method not in ('GET', 'HEAD'):
                return fail('405 Method Not Allowed', 'Método no admitido.')
            if path == '/api/documents':
                manifest = self.documents.get()['manifest']
                return self.response(start, '200 OK', manifest if method == 'GET' else b'')
            if path.startswith('/api/files/'):
                snapshot = self.documents.get()
                relative = snapshot['files'].get(path.removeprefix('/api/files/'))
                if not relative:
                    return fail('404 Not Found', 'Documento no encontrado.')
                file = self.documents.safe_file(relative).open('rb')
                return self.stream(start, file, os.fstat(file.fileno()).st_size, Path(relative).name,
                                   mimetypes.guess_type(relative)[0] or 'application/octet-stream', method == 'HEAD')
            if path == '/api/zip':
                selected = list(dict.fromkeys(parse_qs(env.get('QUERY_STRING', '')).get('plate', [])))
                if not selected or any(p not in self.documents.fleet for p in selected):
                    return fail('400 Bad Request', 'Seleccioná patentes válidas de la flota.')
                snapshot = self.documents.get()
                entries = [(p, e) for p in selected for e in snapshot['manifest']['byPlate'].get(p, [])]
                if not entries:
                    return fail('404 Not Found', 'No hay archivos asociados a los móviles seleccionados.')
                if sum(e['size'] for _, e in entries) > self.max_zip_bytes:
                    return fail('413 Content Too Large', 'La selección es demasiado grande. Descargá por grupos.')
                if not self.zip_slots.acquire(blocking=False):
                    return fail('503 Service Unavailable', 'Se están preparando otras descargas. Reintentá en unos minutos.')
                archive = tempfile.TemporaryFile()
                try:
                    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_STORED, allowZip64=True, strict_timestamps=False) as zip_file:
                        missing = [p for p in selected if not snapshot['manifest']['byPlate'].get(p)]
                        actual_size = 0
                        for plate, entry in entries:
                            relative = snapshot['files'][entry['id']]
                            source = self.documents.safe_file(relative)
                            folder = safe_name(plate) + ' - ' + safe_name(self.documents.fleet[plate]['mov'])
                            # Mantener subcarpetas para evitar colisiones y conservar versiones.
                            name = folder + '/' + '/'.join(safe_name(p) for p in Path(relative).parts)
                            with source.open('rb') as input_file, zip_file.open(name, 'w', force_zip64=True) as output:
                                while chunk := input_file.read(128 * 1024):
                                    actual_size += len(chunk)
                                    if actual_size > self.max_zip_bytes:
                                        raise ValueError('La selección supera el tamaño admitido.')
                                    output.write(chunk)
                        zip_file.writestr('LEER - alcance de la descarga.txt',
                            'SIGF - Documentación real\r\nSe excluyó Vehículos bajas. Se incluyen todas las versiones asociadas por patente; no se verificó vigencia.\r\n'
                            'Las pólizas sin patente única están disponibles por separado en SIGF.\r\n'
                            'Móviles seleccionados sin archivos: ' + (', '.join(missing) or 'ninguno') + '\r\n'
                            'Errores de lectura del último índice: ' + str(snapshot['manifest']['readErrors']))
                    size = archive.tell()
                    archive.seek(0)
                    return self.stream(start, archive, size, 'SIGF-documentacion-REAL-' + time.strftime('%Y-%m-%d') + '.zip',
                                       'application/zip', method == 'HEAD')
                except Exception:
                    archive.close()
                    raise
                finally:
                    self.zip_slots.release()
            asset = path.lstrip('/') if path != '/' else 'index.html'
            if asset not in ASSETS:
                return fail('404 Not Found', 'Recurso no encontrado.')
            body = (self.root / asset).read_bytes()
            return self.response(start, '200 OK', body if method == 'GET' else b'',
                                 mimetypes.guess_type(asset)[0] or 'application/octet-stream')
        except (OSError, ValueError):
            # No revelar rutas UNC, credenciales ni detalles del sistema al cliente.
            return fail('503 Service Unavailable', 'No se pudo leer la documentación. Revisá la conexión a la red de IHSA y los permisos del servicio.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default=str(APP_ROOT / 'config-documentacion.local.json'))
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8-sig'))
    root = Path(config['documentsRoot'])
    port, host = int(config.get('port', 8765)), config.get('host', '127.0.0.1')
    documents = Documents(root, load_fleet(APP_ROOT), config.get('refreshSeconds', 300))
    app = IntranetApp(APP_ROOT, documents, port, extra_hosts=config.get('allowedHosts', []))
    sys.path.insert(0, str(APP_ROOT / '.intranet-deps'))
    try:
        from waitress import serve
    except ImportError:
        raise SystemExit('Falta Waitress. Ejecutá: python -m pip install -r requirements-intranet.txt')
    print('SIGF interno: http://' + host + ':' + str(port), flush=True)
    print('La documentación se indexa automáticamente al consultar. No cerrar este servicio.', flush=True)
    serve(app, host=host, port=port, threads=6, channel_timeout=600, max_request_body_size=8192,
          max_request_header_size=16384, expose_tracebacks=False)


if __name__ == '__main__':
    main()
