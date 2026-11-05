/* Prueba local: los archivos permanecen en la carpeta elegida por el usuario. */
const realDocs = {connected:false, byPlate:new Map(), insurance:[], unmatched:[], excluded:0, urls:[]};
const docText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function indexRealDocuments(files, fleet) {
  const known=new Map(fleet.map(u=>[norm(u.plate),u.plate]));
  const result={byPlate:new Map(),insurance:[],unmatched:[],excluded:0};
  for(const file of files) {
    const path=file.webkitRelativePath||file.name, parts=path.split('/'), folded=parts.map(docText);
    if(folded.some(p=>/VEHICULOS\s+BAJAS/.test(p))){result.excluded++;continue;}
    if(/^(THUMBS\.DB|DESKTOP\.INI|~\$)/i.test(file.name))continue;
    const isInsurance=folded.some(p=>/NACION\s+SEGUROS/.test(p));
    // Tokens completos: no vincular por interno ni por coincidencias parciales.
    const tokens=[...new Set(folded.flatMap(p=>p.match(/(?<![A-Z0-9])(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3}|[A-Z]\d{3}[A-Z]{3})(?![A-Z0-9])/g)||[]))];
    const plates=tokens.length===1&&known.has(tokens[0])?[known.get(tokens[0])]:[];
    const entry={file,path,insurance:isInsurance};
    if(plates.length===1){const plate=plates[0];if(!result.byPlate.has(plate))result.byPlate.set(plate,[]);result.byPlate.get(plate).push(entry);}
    else if(isInsurance)result.insurance.push(entry);
    else result.unmatched.push(entry);
  }
  return result;
}
function clearDocUrls(){realDocs.urls.forEach(URL.revokeObjectURL);realDocs.urls=[];}
function realFileList(entries) {
  return entries.length?'<ul class="real-file-list">'+entries.map(entry=>{
    const url=URL.createObjectURL(entry.file);realDocs.urls.push(url);
    return '<li><a href="'+url+'" download="'+esc(entry.file.name)+'">'+esc(entry.path)+'</a> <span class="mut">('+Math.ceil(entry.file.size/1024)+' KB)</span></li>';
  }).join('')+'</ul>':'<p class="mut">Sin archivos asociados por patente.</p>';
}
function realDocumentacion() {
  clearDocUrls();
  $('#app').innerHTML='<p class="eyebrow">Prueba local</p><h2>Documentación real</h2>'+
    '<div class="card"><label class="btn">Elegir carpeta DOCUMENTOS MÓVILES<input id="realFolder" type="file" webkitdirectory multiple hidden></label> <button class="btn" id="backDemo">Volver a demo</button>'+
    '<p class="mut">Pegá la ruta del servidor en el selector de carpetas. Los archivos se consultan en esta sesión; al recargar hay que elegir la carpeta otra vez. No se suben a Internet ni se modifican los originales.</p>'+
    '<p class="mut">Se excluye Vehículos bajas. Se incluyen todas las versiones encontradas, sin deducir vigencia por nombre o fecha de modificación.</p><p id="realSummary" role="status"></p></div>'+
    fleetFilters(S.docs)+'<div class="card row"><button class="btn" id="realSelect">Seleccionar resultados</button><button class="btn" id="realClear">Quitar selección</button><button class="btn p" id="realZip">Descargar ZIP real</button><span id="realSelected"></span></div>'+
    '<p id="realResultCount" class="mut"></p><div class="tw"><table><thead><tr><th>Selección</th><th>Patente</th><th>Interno</th><th>Archivos</th><th>Documentos</th></tr></thead><tbody id="realBody"></tbody></table></div>'+
    '<details class="card"><summary>Seguros sin patente única · revisar asociación</summary><p class="mut">Estos archivos pueden corresponder a varios vehículos. Podés descargarlos por separado; no se agregan automáticamente a cada móvil ni acreditan cobertura.</p><div id="sharedInsurance"></div></details>'+
    '<details class="card"><summary>Otros archivos sin asociación única</summary><div id="unmatchedDocs"></div></details>';
  const draw=()=>{
    const result=filtered(S.docs),selected=units.filter(u=>S.selected.has(u.plate));
    $('#realSummary').textContent=realDocs.connected?realDocs.byPlate.size+' patentes con archivos · '+realDocs.insurance.length+' seguros por revisar · '+realDocs.unmatched.length+' otros sin asociación · '+realDocs.excluded+' archivos de bajas excluidos.':'Elegí la carpeta principal para comenzar.';
    $('#realSelected').textContent=selected.length+(selected.length===1?' móvil seleccionado':' móviles seleccionados');
    $('#realResultCount').textContent=result.length+' de '+units.length+' móviles';
    $('#realZip').disabled=!realDocs.connected||!selected.some(u=>(realDocs.byPlate.get(u.plate)||[]).length);
    $('#realBody').innerHTML=result.map(u=>{const entries=realDocs.byPlate.get(u.plate)||[];return '<tr><td><input type="checkbox" data-real-plate="'+esc(u.plate)+'" aria-label="Seleccionar '+esc(u.plate)+'" '+(S.selected.has(u.plate)?'checked':'')+'></td><td class="pl">'+esc(u.plate)+'</td><td>'+esc(u.mov)+'</td><td>'+entries.length+'</td><td><button class="btn" data-real-show="'+esc(u.plate)+'">Ver archivos</button></td></tr>';}).join('');
    $('#realBody').querySelectorAll('[data-real-plate]').forEach(input=>input.onchange=()=>{input.checked?S.selected.add(input.dataset.realPlate):S.selected.delete(input.dataset.realPlate);draw();});
    $('#realBody').querySelectorAll('[data-real-show]').forEach(button=>button.onclick=()=>{
      modal('<h3 id="dialogTitle">Documentos · '+esc(button.dataset.realShow)+'</h3><p class="mut">Todos los archivos asociados por patente. Revisá su contenido y vigencia antes de usarlos.</p>'+realFileList(realDocs.byPlate.get(button.dataset.realShow)||[])+'<button class="btn" data-x>Cerrar</button>');
    });
  };
  $('#backDemo').onclick=()=>{clearDocUrls();realDocs.connected=false;documentacion();};
  $('#realFolder').onchange=event=>{
    if(!event.target.files.length)return;
    clearDocUrls();Object.assign(realDocs,indexRealDocuments(event.target.files,units),{connected:true});
    $('#sharedInsurance').innerHTML=realFileList(realDocs.insurance);
    $('#unmatchedDocs').innerHTML=realFileList(realDocs.unmatched);draw();
  };
  $('#sharedInsurance').innerHTML=realFileList(realDocs.insurance);
  $('#unmatchedDocs').innerHTML=realFileList(realDocs.unmatched);
  $('#realSelect').onclick=()=>{filtered(S.docs).forEach(u=>S.selected.add(u.plate));draw();};
  $('#realClear').onclick=()=>{S.selected.clear();draw();};
  $('#realZip').onclick=async()=>{
    const button=$('#realZip');button.disabled=true;
    try {
      const selected=units.filter(u=>S.selected.has(u.plate));
      const total=selected.flatMap(u=>realDocs.byPlate.get(u.plate)||[]).reduce((sum,e)=>sum+e.file.size,0);
      if(total>250*1024*1024)throw Error('La selección supera 250 MB. Descargá menos móviles por vez.');
      const entries=[],missing=[];
      for(const u of selected){const docs=realDocs.byPlate.get(u.plate)||[];if(!docs.length)missing.push(u.plate);for(const entry of docs)entries.push({name:u.plate+' - '+String(u.mov).replace(/[^a-z0-9-]/gi,'_')+'/'+entry.path.replace(/[<>:"\\|?*\u0000-\u001f]/g,'_'),data:new Uint8Array(await entry.file.arrayBuffer())});}
      entries.push({name:'LEER - alcance de la descarga.txt',text:'Archivos asociados por patente. No se verificó vigencia ni contenido. Se excluyó Vehículos bajas. Los seguros sin patente única se descargan por separado.\r\nMóviles seleccionados sin archivos: '+(missing.join(', ')||'ninguno')});
      const url=URL.createObjectURL(createZip(entries)),a=document.createElement('a');a.href=url;a.download='SIGF-documentacion-REAL-'+today()+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      toast('ZIP real generado.'+(missing.length?' '+missing.length+' móviles sin archivos; revisá el informe del ZIP.':''));
    }catch(error){toast('No se pudo generar el ZIP. '+error.message);}finally{if($('#realZip')===button)draw();}
  };
  bindFilters(S.docs,draw);draw();
}
