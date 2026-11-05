import io
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import urlencode
import zipfile

from servidor_documentacion import APP_ROOT, Documents, IntranetApp, load_fleet, document_type


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.fleet = [dict(plate='AG369SA', mov='890'), dict(plate='AI387BW', mov='55')]
        self.binary = bytes([0, 255, 37, 80, 68, 70, 13, 10])
        for relative in ['AG369SA-890/VTV.pdf', 'AG369SA-890/Cédula frente.jpeg',
                         'AG369SA-890/Cedula dorso.jpeg', 'AG369SA-890/Nación SEGUROS 2026.pdf',
                         'AG369SA-890/RTO2025.pdf', '1 NACION SEGUROS PÓLIZAS/Seguro AG369SA.pdf',
                         '3 VEHÍCULOS BAJAS/AG369SA-890/BAJA.pdf',
                         'AG369SA-890/sub/VEHICULOS BAJAS/NO.pdf',
                         '1 NACION SEGUROS PÓLIZAS/Seguro general.pdf',
                         'AG369SA-890/VTV AI387BW.pdf', 'XAG369SA9/VTV.pdf', 'AG369SA-890/Thumbs.db',
                         'AG369SA-890/Acta entrega.pdf', 'AG369SA-890/Titulo.pdf', 'VTV/AG369SA/Factura.pdf']:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(self.binary)
        self.documents = Documents(self.root, self.fleet, 0)
        self.app = IntranetApp(APP_ROOT, self.documents)

    def tearDown(self):
        self.tmp.cleanup()

    def request(self, path, query='', **extra):
        env = dict(HTTP_HOST='localhost:8765', REMOTE_ADDR='127.0.0.1',
                   REQUEST_METHOD='GET', PATH_INFO=path, QUERY_STRING=query)
        env.update(extra)
        captured = {}
        def start(status, headers):
            captured.update(status=status, headers=dict(headers))
        result = self.app(env, start)
        try:
            captured['body'] = b''.join(result)
        finally:
            if hasattr(result, 'close'):
                result.close()
        return captured

    def test_automatic_files_and_zip_preserve_binary_and_exclude_bajas(self):
        response = self.request('/api/documents')
        data = json.loads(response['body'])
        self.assertEqual(response['status'], '200 OK')
        self.assertEqual(data['matchedFiles'], 6)
        self.assertEqual(data['excludedFolders'], 2)
        self.assertEqual(len(data['insurance']), 0)
        self.assertEqual(data['unmatched'], 3)
        self.assertEqual({e['type'] for e in data['byPlate']['AG369SA']}, {'VTV/RTO', 'Seguro', 'Cédula'})
        self.assertNotIn(str(self.root), response['body'].decode())
        file = self.request(data['byPlate']['AG369SA'][0]['url'])
        self.assertEqual(file['body'], self.binary)
        response = self.request('/api/zip', urlencode([('plate', 'AG369SA'), ('plate', 'AI387BW')]))
        self.assertEqual(response['status'], '200 OK')
        with zipfile.ZipFile(io.BytesIO(response['body'])) as archive:
            self.assertIsNone(archive.testzip())
            names = archive.namelist()
            self.assertEqual(len(names), 7)
            self.assertFalse(any('BAJA' in n or 'general' in n or 'Acta' in n or 'Titulo' in n or 'Factura' in n for n in names))
            for name in names:
                if name.endswith(('.pdf', '.jpeg')):
                    self.assertEqual(archive.read(name), self.binary)
            self.assertIn('AI387BW', archive.read(names[-1]).decode())

    def test_files_cannot_escape_index_and_private_paths_are_not_served(self):
        for path in ['/api/files/../../data.js', '/config-documentacion.local.json', '/outputs/documentacion-inventario.local.json', '/.git/config', '/scripts/servidor_documentacion.py']:
            self.assertEqual(self.request(path)['status'], '404 Not Found')
        self.assertEqual(self.request('/', HTTP_HOST='evil.example')['status'], '403 Forbidden')
        self.assertEqual(self.request('/api/documents', HTTP_SEC_FETCH_SITE='cross-site')['status'], '403 Forbidden')
        self.assertEqual(self.request('/api/documents', HTTP_ORIGIN='https://evil.example')['status'], '403 Forbidden')
        self.assertEqual(self.request('/api/zip', 'plate=DESCONOCIDA')['status'], '400 Bad Request')

    def test_refresh_picks_up_new_files_and_removal(self):
        self.assertEqual(self.documents.get()['manifest']['matchedFiles'], 6)
        (self.root / 'AG369SA-890/VTV nuevo.pdf').write_bytes(b'new')
        self.assertEqual(self.documents.get()['manifest']['matchedFiles'], 7)
        (self.root / 'AG369SA-890/VTV.pdf').unlink()
        self.assertEqual(self.documents.get()['manifest']['matchedFiles'], 6)

    def test_filter_uses_filename_and_keeps_both_cedula_sides(self):
        self.assertEqual(document_type('CÉDULA AG369SA.jpeg'), 'Cédula')
        self.assertEqual(document_type('VTV2026.pdf'), 'VTV/RTO')
        self.assertEqual(document_type('Nación Seguros 2026.pdf'), 'Seguro')
        self.assertIsNone(document_type('PUERTO - Factura.pdf'))
        self.assertIsNone(document_type('VTV/Factura.pdf'))
        manifest = self.documents.get()['manifest']
        names = [e['name'] for e in manifest['byPlate']['AG369SA']]
        self.assertIn('Cédula frente.jpeg', names)
        self.assertIn('Cedula dorso.jpeg', names)
        import hashlib
        identifier = hashlib.sha256('AG369SA-890/Acta entrega.pdf'.encode()).hexdigest()
        self.assertEqual(self.request('/api/files/' + identifier)['status'], '404 Not Found')

    def test_unavailable_share_is_an_error_and_not_zero_files(self):
        self.documents.root = self.root / 'not-available'
        response = self.request('/api/documents')
        self.assertEqual(response['status'], '503 Service Unavailable')
        self.assertNotIn(str(self.root), response['body'].decode())

    def test_zip_limit_is_enforced(self):
        self.app.max_zip_bytes = 1
        self.assertEqual(self.request('/api/zip', 'plate=AG369SA')['status'], '413 Content Too Large')

    def test_real_fleet_loads(self):
        self.assertEqual(len(load_fleet(APP_ROOT)), 309)


if __name__ == '__main__':
    unittest.main()
