/* ZIP estándar sin dependencias. Los documentos de esta versión son ejemplos de texto. */
function createZip(entries) {
  const encoder=new TextEncoder(),parts=[],directory=[];
  const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  let offset=0;
  for(const entry of entries) {
    const name=encoder.encode(entry.name),data=encoder.encode(entry.text),crc=crc32(data);
    if(name.length>65535||offset+data.length+name.length+30>0xffffffff)throw Error('El ZIP supera el tamaño admitido.');
    const header=new Uint8Array(30),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);
    h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
    parts.push(header,name,data);
    const central=new Uint8Array(46),c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);
    c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
    directory.push(central,name);offset+=header.length+name.length+data.length;
  }
  if(entries.length>65535)throw Error('Hay demasiados archivos para este ZIP.');
  const size=directory.reduce((sum,p)=>sum+p.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...directory,end],{type:'application/zip'});
}
function demoDocuments(selected) {
  const safe=value=>String(value).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').slice(0,90)||'Sin dato';
  return selected.flatMap(u=>['VTV-RTO','Seguro','Cedula'].map(type=>({
    name:safe(u.plate)+' - '+safe(u.mov)+'/'+type+' - DEMO.txt',
    text:'SIGF — DEMOSTRACIÓN\r\n\r\n'+type+'\r\nPatente: '+u.plate+'\r\nInterno: '+u.mov+'\r\n\r\nArchivo de ejemplo para probar la descarga por móvil.\r\nNo contiene documentación real ni acredita vigencia o cobertura.\r\nLa conexión al servidor de IHSA está pendiente.\r\n'
  })));
}
function documentacion() {
  const f=S.docs;
  // Las selecciones sobreviven a filtros y navegación, sin modificar los datos guardados.
  const known=new Set(units.map(u=>u.plate));
  for(const plate of S.selected)if(!known.has(plate))S.selected.delete(plate);
  $('#app').innerHTML='<p class="eyebrow">Documentación de flota</p><h2>Descarga de documentación</h2>'+
    '<p class="mut">Seleccioná uno o varios móviles. Recibirás un único ZIP con una carpeta por patente e interno.</p>'+
    '<div class="card demo-notice"><strong>Modo demo · archivos de ejemplo</strong><p>Incluye VTV/RTO, seguro y cédula como archivos de texto identificados como DEMO. La documentación real se incorporará al conectar el servidor de IHSA.</p></div>'+
    fleetFilters(f)+'<div class="card download-panel"><div class="row"><strong id="selectedCount" aria-live="polite"></strong><span class="sp"></span>'+
    '<button class="btn" id="selectResults">Seleccionar resultados</button><button class="btn" id="clearSelected">Quitar selección</button><button class="btn p" id="downloadZip">Descargar ZIP demo</button></div>'+
    '<p class="mut" id="selectionHint"></p><div class="selection-list" id="selectedList" aria-label="Móviles seleccionados"></div></div>'+
    '<p class="mut" id="resultCount" aria-live="polite"></p><div class="tw"><table class="docs-table"><thead><tr><th><input type="checkbox" id="selectVisible" aria-label="Seleccionar todos los resultados"></th><th>Patente</th><th>Interno</th><th>Emplazamiento</th><th>Tipo de móvil</th><th>Documentación demo</th></tr></thead><tbody id="docsBody"></tbody></table></div>';
  const draw=()=>{
    const result=filtered(f),selected=units.filter(u=>S.selected.has(u.plate)),visibleSelected=result.filter(u=>S.selected.has(u.plate)).length;
    $('#resultCount').textContent=result.length+' de '+units.length+' móviles';
    $('#selectedCount').textContent=selected.length+' móvil'+(selected.length===1?' seleccionado':'es seleccionados');
    $('#selectionHint').textContent='VTV/RTO · Seguro · Cédula. La selección se conserva al cambiar los filtros.'+(selected.length>visibleSelected?' Hay '+(selected.length-visibleSelected)+' seleccionado(s) fuera del filtro actual.':'');
    $('#downloadZip').disabled=!selected.length;$('#clearSelected').disabled=!selected.length;$('#selectResults').disabled=!result.length;
    $('#selectVisible').checked=!!result.length&&visibleSelected===result.length;
    $('#selectVisible').indeterminate=visibleSelected>0&&visibleSelected<result.length;$('#selectVisible').disabled=!result.length;
    $('#selectedList').innerHTML=selected.map(u=>'<button class="chip" data-remove="'+esc(u.plate)+'" aria-label="Quitar '+esc(u.plate)+' interno '+esc(u.mov)+'">'+esc(u.plate)+' · '+esc(u.mov)+' ×</button>').join('');
    $('#selectedList').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{S.selected.delete(b.dataset.remove);draw();});
    $('#docsBody').innerHTML=result.map(u=>'<tr><td><input type="checkbox" data-plate="'+esc(u.plate)+'" aria-label="Seleccionar '+esc(u.plate)+' interno '+esc(u.mov)+'" '+(S.selected.has(u.plate)?'checked':'')+'></td><td class="pl">'+esc(u.plate)+'</td><td>'+esc(u.mov)+'</td><td>'+esc(u.base||'Sin dato')+'</td><td>'+esc(areaLabel(u.area))+'</td><td><span class="pill neutral">3 archivos de ejemplo</span></td></tr>').join('')||'<tr><td colspan="6" class="mut">Ningún móvil coincide con los filtros.</td></tr>';
    $('#docsBody').querySelectorAll('[data-plate]').forEach(input=>input.onchange=()=>{input.checked?S.selected.add(input.dataset.plate):S.selected.delete(input.dataset.plate);draw();});
  };
  bindFilters(f,draw);
  $('#selectResults').onclick=()=>{filtered(f).forEach(u=>S.selected.add(u.plate));draw();};
  $('#selectVisible').onchange=e=>{filtered(f).forEach(u=>e.target.checked?S.selected.add(u.plate):S.selected.delete(u.plate));draw();};
  $('#clearSelected').onclick=()=>{S.selected.clear();draw();};
  $('#downloadZip').onclick=()=>{
    const selected=units.filter(u=>S.selected.has(u.plate));if(!selected.length)return;
    try {
      const zip=createZip(demoDocuments(selected)),url=URL.createObjectURL(zip),a=document.createElement('a');
      a.href=url;a.download='SIGF-documentacion-DEMO-'+selected.length+'-moviles-'+today()+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      toast('ZIP demo generado: '+selected.length+' móviles, '+selected.length*3+' archivos de ejemplo.');
    }catch(error){toast('No se pudo generar el ZIP. '+error.message);}
  };
  draw();
}
