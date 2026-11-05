"""Extrae el Listado del Excel sin modificarlo ni ejecutar macros."""
from pathlib import Path
from datetime import datetime, date
from collections import Counter
import json
import sys
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'Fechas VTV moviles.xlsm'
workbook = openpyxl.load_workbook(source, data_only=True, read_only=True)
sheet = workbook['Listado']
rows = list(sheet.iter_rows(max_col=12, values_only=True))
expected = ['Equipo', 'Nºidentific.vehículo', 'Centro de coste', 'Status de usuario']
if list(rows[0][:4]) != expected:
    raise ValueError('Las columnas de Listado cambiaron: revisar antes de importar.')

def text(value):
    return '' if value is None else str(value).strip()

units = []
for row_number, row in enumerate(rows[1:], 2):
    if not any(value is not None for value in row[:12]):
        continue
    if row[0] is None or row[1] is None:
        raise ValueError(f'Falta patente o interno en fila {row_number}')
    expiry = row[10]
    # El Listado usa un punto para indicar que no hay fecha disponible.
    if isinstance(expiry, str) and expiry.strip() == '.':
        expiry = None
    if expiry is not None and not isinstance(expiry, (date, datetime)):
        raise ValueError(f'Fecha de VTV no reconocida en fila {row_number}: {expiry}')
    units.append(dict(plate=text(row[0]).upper(), mov=text(row[1]), ceco=text(row[2]),
        estado=text(row[3]), anio=text(row[4]), ubicacion=text(row[5]), base=text(row[6]),
        local=text(row[7]), area=text(row[8]), tipo=text(row[9]),
        vtv=expiry.strftime('%Y-%m-%d') if expiry else '', obs=text(row[11]),
        sourceRow=row_number, hist=[]))
for key in ['plate', 'mov']:
    duplicates = [value for value, count in Counter(u[key] for u in units).items() if count > 1]
    if duplicates:
        raise ValueError(f'Duplicados en {key}: {duplicates}')
payload = dict(source=source.name, sheet='Listado', importedAt=datetime.now().isoformat(timespec='seconds'), units=units)
serialized = json.dumps(payload, ensure_ascii=False, indent=2).replace('<', '\\u003c')
(ROOT / 'data.js').write_text('window.SIGF_DATA = ' + serialized + ';\n', encoding='utf-8')
print(json.dumps(dict(units=len(units), statuses=dict(Counter(u['estado'] for u in units)),
    missingVtv=sum(not u['vtv'] for u in units)), ensure_ascii=False))
