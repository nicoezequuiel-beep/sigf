"""Comprobación de lectura real; no modifica ni copia al proyecto los documentos."""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
config = json.loads((ROOT / 'config-documentacion.local.json').read_text(encoding='utf-8-sig'))
base = 'http://' + config['host'] + ':' + str(config['port'])
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
print('Consultando el índice automático del servidor IHSA...', flush=True)
with opener.open(base + '/api/documents', timeout=600) as response:
    manifest = json.load(response)
assert manifest['readErrors'] == 0, 'La lectura del servidor fue parcial'
entries = manifest['byPlate'].get('AG369SA', [])
assert entries, 'AG369SA debe tener documentación real'
assert all(e.get('type') in ('VTV/RTO', 'Seguro', 'Cédula') for e in entries), 'Tipo documental fuera del filtro'
assert len(entries) <= 3 and len({e['type'] for e in entries}) == len(entries), 'Debe haber como máximo un archivo por tipo'
assert manifest.get('selection') == 'latest-modified-per-type'
assert not manifest['insurance'], 'No deben publicarse seguros sin patente'
entry = next(e for e in entries if e['name'].lower().endswith(('.jpeg', '.jpg', '.pdf')))
with opener.open(base + entry['url'], timeout=120) as response:
    assert response.headers['Content-Disposition'].startswith('attachment;')
    actual_hash = hashlib.sha256(response.read()).hexdigest()
with opener.open(base + entry['url'] + '?view=1', timeout=120) as response:
    assert response.headers['Content-Disposition'].startswith('inline;')
    assert hashlib.sha256(response.read()).hexdigest() == actual_hash
source = Path(config['documentsRoot']) / entry['path']
with source.open('rb') as original:
    assert hashlib.file_digest(original, 'sha256').hexdigest() == actual_hash, 'La descarga individual difiere del original'
print('Descarga individual real verificada. Preparando ZIP de AG369SA...', flush=True)
with opener.open(base + '/api/zip?plate=AG369SA', timeout=600) as response:
    archive_bytes = response.read()
with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
    assert archive.testzip() is None, 'CRC inválido'
    assert len(archive.namelist()) == len(entries) + 1
    assert not any('VEHICULOS BAJAS' in n.upper() for n in archive.namelist())
report = dict(address=base, matchedUnits=manifest['matchedUnits'], matchedFiles=manifest['matchedFiles'],
              readErrors=manifest['readErrors'], excludedFolders=manifest['excludedFolders'],
              AG369SAFiles=len(entries), realDownloadHashVerified=True, zipVerified=True, zipBytes=len(archive_bytes))
(ROOT / 'outputs/documentacion-servicio.local.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report), flush=True)
