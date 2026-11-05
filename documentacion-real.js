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
  return entries.length?'<ul class="real-file-list">'+entries.map(entry=>
    '<li><strong>'+esc(entry.type)+': </strong><a href="'+esc(entry.url)+'" download>'+esc(entry.name)+'</a> <span class="mut">('+Math.ceil(entry.size/1024)+' KB)</span><small class="mut" style="display:block">'+esc(entry.path)+'</small></li>'
  ).join('')+'</ul>':'<p class="mut">Sin archivos de VTV/RTO, seguro o cédula asociados a esta patente en el índice del servidor.</p>';
}
function automaticCoverageNote(manifest) {
  return '<p class="mut">Solo VTV/RTO, seguro y cédula asociados a esta patente. Se conservan las versiones y el frente/dorso. Revisá su contenido y vigencia antes de usarlas.</p>'+
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
    '<p class="mut">Seleccioná los móviles y descargá solo VTV/RTO, seguro y cédula en un ZIP con una carpeta por patente e interno. Incluye las versiones y el frente/dorso asociados a cada patente.</p>'+
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

