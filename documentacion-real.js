/* Documentación automática, servida desde la misma dirección interna que SIGF. */
const automaticDocs={manifest:null,pending:null,loadedAt:0};
async function getAutomaticDocuments(force=false) {
  if(location.protocol==='file:')throw Error('Abrí SIGF desde su dirección interna para consultar los documentos.');
  if(automaticDocs.pending)return automaticDocs.pending;
  if(!force&&automaticDocs.manifest&&Date.now()-automaticDocs.loadedAt<60000)return automaticDocs.manifest;
  automaticDocs.pending=(async()=>{
    let response;
    try {response=await fetch('/api/documents',{cache:'no-store',signal:AbortSignal.timeout(600000)});}
    catch (_) {throw Error('No se pudo conectar con la documentación. Revisá la conexión a IHSA y que la computadora que aloja SIGF esté encendida.');}
    const body=await response.json().catch(()=>null);
    if(!response.ok||!body||!body.byPlate)throw Error(body?.error||'No se pudo conectar con la documentación. Verificá que estés usando la dirección interna de SIGF y que el servicio esté encendido.');
    automaticDocs.manifest=body;automaticDocs.loadedAt=Date.now();return body;
  })();
  try{return await automaticDocs.pending;}finally{automaticDocs.pending=null;}
}
function automaticFileList(entries) {
  const types=[['VTV/RTO','VTV'],['Seguro','Seguro'],['Cédula','Cédula']];
  return '<div class="document-tiles">'+types.map(([type,label])=>{
    const entry=entries.find(e=>e.type===type);
    const canPreview=entry&&/\.(pdf|jpe?g|png|gif|webp|bmp|avif)$/i.test(entry.name);
    const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></svg>';
    return '<article class="document-tile '+(entry?'':'document-missing')+'" data-document-type="'+esc(type)+'"><div class="document-tile-top"><span class="document-icon">'+icon+'</span><span class="pill '+(entry?'ok':'neutral')+'">'+(entry?'Disponible':'Sin archivo')+'</span></div><h4>'+label+'</h4>'+
      (entry?'<p class="document-file-name">'+esc(entry.name)+'</p><p class="document-modified">Modificado: '+esc(new Date(entry.modified*1000).toLocaleString('es-AR',{timeZone:'America/Buenos_Aires'}))+'</p><div class="document-actions">'+(canPreview?'<a class="btn" href="'+esc(entry.url)+'?view=1" target="_blank" rel="noopener noreferrer" aria-label="Ver '+label+' en otra pestaña">Ver</a>':'<button class="btn" disabled title="Este formato requiere descargarlo para abrirlo">Ver</button>')+'<a class="btn p" href="'+esc(entry.url)+'" download aria-label="Descargar '+label+'">Descargar</a></div>':'<p class="document-file-name mut">No se encontró un archivo asociado a esta patente.</p><button class="btn" disabled>Sin archivo</button>')+'</article>';
  }).join('')+'</div>';
}
function automaticCoverageNote(manifest) {
  return '<p class="mut">Un archivo por tipo: el de modificación más reciente asociado a esta patente. La fecha de modificación no indica vigencia.</p>'+
    (manifest.readErrors?'<p role="alert">La lectura fue parcial: '+manifest.readErrors+' archivo(s) o carpeta(s) no pudieron consultarse. Algunos documentos pueden faltar.</p>':'');
}
async function loadUnitDocuments(plate, target) {
  target.innerHTML='<p role="status">Consultando documentos en la red de IHSA… La primera consulta puede tardar unos minutos.</p>';
  try {
    const manifest=await getAutomaticDocuments();if(!target.isConnected)return;
    target.innerHTML=automaticFileList(manifest.byPlate[plate]||[])+automaticCoverageNote(manifest);
  }catch(error){if(target.isConnected){target.innerHTML='<p role="alert">'+esc(error.message)+'</p><button class="btn">Reintentar</button>';target.querySelector('button').onclick=()=>loadUnitDocuments(plate,target);}}
}
function requestRealZip(selected, manifest) {
  const missing=selected.filter(u=>!(manifest.byPlate[u.plate]||[]).length);
  const url='/api/zip?'+selected.map(u=>'plate='+encodeURIComponent(u.plate)).join('&');
  const link=document.createElement('a');link.href=url;link.download='SIGF-documentacion-real.zip';document.body.append(link);link.click();link.remove();
  toast('Preparando descarga de documentación.'+(missing.length?' '+missing.length+' móvil(es) sin archivos; se detallan en el ZIP.':''));
}
function realDocumentacion() {
  const known=new Set(units.map(u=>u.plate));for(const plate of S.selected)if(!known.has(plate))S.selected.delete(plate);
  $('#app').innerHTML='<p class="eyebrow">Documentación de flota</p><h2>Descarga de documentación</h2>'+
    '<p class="mut">Seleccioná los móviles y descargá VTV/RTO, seguro y cédula en un ZIP con una carpeta por patente e interno. Incluye un archivo por tipo: el de modificación más reciente.</p>'+
    '<div class="card"><p id="realSummary" role="status">Consultando documentos en la red de IHSA… La primera consulta puede tardar unos minutos.</p><button class="btn" id="retryDocs" hidden>Reintentar conexión</button></div>'+
    fleetFilters(S.docs)+'<div class="card download-panel"><div class="row"><strong id="realSelected" aria-live="polite"></strong><span class="sp"></span><button class="btn" id="realSelect">Seleccionar resultados</button><button class="btn" id="realClear">Quitar selección</button><button class="btn p" id="realZip" disabled>Descargar documentación</button></div><p class="mut" id="selectionHint"></p><div class="selection-list" id="selectedList"></div></div>'+
    '<p id="realResultCount" class="mut"></p><div class="tw"><table><thead><tr><th>Selección</th><th>Patente</th><th>Interno</th><th>Archivos</th><th>Documentos</th></tr></thead><tbody id="realBody"></tbody></table></div>';
  const container=$('#realBody'),summary=$('#realSummary');let manifest=null;
  const draw=()=>{
    if(!container.isConnected)return;
    const result=filtered(S.docs),selected=units.filter(u=>S.selected.has(u.plate)),visibleSelected=result.filter(u=>S.selected.has(u.plate)).length;
    $('#realSelected').textContent=selected.length+(selected.length===1?' móvil seleccionado':' móviles seleccionados');
    $('#selectionHint').textContent='La selección se conserva al cambiar los filtros.'+(selected.length>visibleSelected?' Hay '+(selected.length-visibleSelected)+' seleccionado(s) fuera del filtro actual.':'');
    $('#realResultCount').textContent=result.length+' de '+units.length+' móviles';
    $('#realZip').disabled=!manifest||!selected.some(u=>(manifest.byPlate[u.plate]||[]).length);
    $('#realClear').disabled=!selected.length;$('#realSelect').disabled=!result.length;
    $('#selectedList').innerHTML=selected.map(u=>'<button class="chip" data-remove="'+esc(u.plate)+'">'+esc(u.plate)+' · '+esc(u.mov)+' ×</button>').join('');
    $('#selectedList').querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{S.selected.delete(button.dataset.remove);draw();});
    container.innerHTML=result.map(u=>{const entries=manifest?.byPlate[u.plate]||[];return '<tr><td><input type="checkbox" data-real-plate="'+esc(u.plate)+'" aria-label="Seleccionar '+esc(u.plate)+'" '+(S.selected.has(u.plate)?'checked':'')+'></td><td class="pl">'+esc(u.plate)+'</td><td>'+esc(u.mov)+'</td><td>'+(manifest?entries.length:'Pendiente de conexión')+'</td><td><button class="btn" data-real-show="'+esc(u.plate)+'" '+(!manifest?'disabled':'')+'>Ver archivos</button></td></tr>';}).join('')||'<tr><td colspan="5">Ningún móvil coincide con los filtros.</td></tr>';
    container.querySelectorAll('[data-real-plate]').forEach(input=>input.onchange=()=>{input.checked?S.selected.add(input.dataset.realPlate):S.selected.delete(input.dataset.realPlate);draw();});
    container.querySelectorAll('[data-real-show]').forEach(button=>button.onclick=()=>modal('<h3 id="dialogTitle">Documentos · '+esc(button.dataset.realShow)+'</h3>'+automaticFileList(manifest.byPlate[button.dataset.realShow]||[])+automaticCoverageNote(manifest)+'<button class="btn" data-x>Cerrar</button>'));
  };
  const connect=async(force=false)=>{
    summary.textContent='Consultando documentos en la red de IHSA… La primera consulta puede tardar unos minutos.';$('#retryDocs').hidden=true;
    try {
      manifest=await getAutomaticDocuments(force);if(!container.isConnected)return;
      summary.textContent=manifest.matchedUnits+' patentes con archivos · Solo VTV/RTO, seguro y cédula · '+manifest.unmatched+' archivos de esos tipos sin asociación única · '+manifest.excludedFolders+' carpeta(s) de bajas excluida(s).'+(manifest.readErrors?' Lectura parcial: '+manifest.readErrors+' errores.':'');
      draw();
    }catch(error){if(container.isConnected){manifest=null;summary.textContent=error.message;$('#retryDocs').hidden=false;draw();}}
  };
  $('#retryDocs').onclick=()=>connect(true);
  $('#realSelect').onclick=()=>{filtered(S.docs).forEach(u=>S.selected.add(u.plate));draw();};
  $('#realClear').onclick=()=>{S.selected.clear();draw();};
  $('#realZip').onclick=()=>{if(manifest)requestRealZip(units.filter(u=>S.selected.has(u.plate)),manifest);};
  bindFilters(S.docs,draw);draw();connect();
}


