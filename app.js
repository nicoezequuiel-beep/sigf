const SOURCE = window.SIGF_DATA;
const STORAGE = "sigf_units_v1";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const mobileKey = s => {
  const n = norm(s);
  return /^(M)?[0-9]+$/.test(n) ? String(Number(n.replace(/^M/, ""))) : n;
};
const fmt = d => d ? d.split("-").reverse().join("/") : "Sin dato";
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
};
let units = structuredClone(SOURCE.units);
let storageMessage = "";
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
  if (saved && saved.sourceVersion === SOURCE.importedAt && Array.isArray(saved.units)) units = saved.units;
} catch (_) { storageMessage = "No se pudieron recuperar las ediciones locales."; }
const S = {view:"buscar",sel:null,f:{q:"",base:"",est:"",vtv:""}};
const role = () => $("#role").value;
const canEdit = () => role() !== "consulta";
const statusLabel = code => code === "OPER" ? "Operativa · OPER" : code || "Sin dato";
const vtvStatus = u => {
  if (!u.vtv) return {key:"sin",label:"Sin dato",style:"neutral"};
  if (u.vtv < today()) return {key:"vencida",label:"Vencida",style:"bad"};
  const days = Math.round((Date.parse(u.vtv+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/864e5);
  if (days <= 30) return {key:"proxima",label:days === 0 ? "Vence hoy" : "Vence en "+days+" días",style:"warn"};
  return {key:"vigente",label:"Vigente",style:"ok"};
};
const badge = u => { const v=vtvStatus(u); return '<span class="pill '+v.style+'">'+v.label+'</span>'; };
function toast(message) {
  const t=$("#toast"); t.textContent=message; t.hidden=false;
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.hidden=true,3200);
}
function save() {
  try {localStorage.setItem(STORAGE,JSON.stringify({sourceVersion:SOURCE.importedAt,units})); return true;}
  catch (_) {toast("El navegador no pudo guardar. El cambio durará solo en esta sesión."); return false;}
}
function go(view,sel) {S.view=view; S.sel=sel ?? null; render();}
function nav() {
  const items=[["buscar","⌕","Buscar"],["unidades","▦","Unidades"]];
  if(canEdit()) items.push(["nueva","＋","Nueva unidad"]);
  if(role()==="admin") items.push(["usuarios","☰","Usuarios"]);
  $("#nav").innerHTML=items.map(([v,i,l])=>'<button data-v="'+v+'" aria-current="'+((S.view==="ficha"?"unidades":S.view)===v)+'"><span class="ni" aria-hidden="true">'+i+'</span>'+l+'</button>').join("");
  $("#nav").querySelectorAll("button").forEach(b=>b.onclick=()=>b.dataset.v==="nueva"?form():go(b.dataset.v));
}
function matches(query) {
  const n=norm(query),m=mobileKey(query);
  if(!n) return [];
  const rank=u=>norm(u.plate)===n || mobileKey(u.mov)===m ? 0 : 1;
  return units.filter(u=>norm(u.plate).includes(n)||mobileKey(u.mov).includes(m))
    .sort((a,b)=>rank(a)-rank(b)||a.mov.localeCompare(b.mov,"es",{numeric:true}));
}
function search() {
  $("#app").innerHTML='<section class="hero"><h1>Buscá un móvil y consultá sus datos</h1><p>Ingresá la patente o el número de móvil.</p>'+
    '<div class="plate"><div class="plate-box"><div class="plate-top"><span>ARGENTINA</span><span>Patente o móvil</span></div>'+
    '<input id="q" autocomplete="off" placeholder="Patente / móvil" aria-label="Patente o número de móvil" maxlength="30"></div>'+
    '<ul class="sug" id="sug" hidden></ul></div><p id="searchCount" class="mut" aria-live="polite"></p>'+
    '<div class="chips"><span>Probá con:</span>'+units.slice(0,3).map(u=>'<button class="chip" data-p="'+esc(u.plate)+'">'+esc(u.plate)+'</button>').join("")+
    '<button class="chip" data-p="870">Móvil 870</button></div>'+
    '<p class="mut">'+units.length+' móviles cargados del Excel</p>'+
    '<div class="card source-note"><strong>Datos reales de flota</strong><p>Estado operativo, ubicación y vencimiento de VTV. La documentación del servidor todavía no está conectada.</p></div></section>';
  const input=$("#q"),suggestions=$("#sug");
  input.oninput=()=>{
    const results=matches(input.value);
    suggestions.hidden=!results.length;
    suggestions.innerHTML=results.slice(0,8).map(u=>'<li><button data-id="'+esc(u.plate)+'"><span class="pl">'+esc(u.plate)+'</span><span>Móvil '+esc(u.mov)+'</span><span class="sp"></span><span class="mut">'+esc(u.base)+'</span></button></li>').join("");
    $("#searchCount").textContent=!norm(input.value)?"":results.length?results.length+" coincidencia"+(results.length===1?"":"s")+(results.length>8?" · Se muestran las primeras 8. Ver todas en Unidades.":""):"No hay móviles con esa patente o número.";
    suggestions.querySelectorAll("button").forEach(b=>b.onclick=()=>go("ficha",b.dataset.id));
  };
  input.onkeydown=e=>{
    if(e.key==="Escape") suggestions.hidden=true;
    if(e.key==="Enter") {
      e.preventDefault(); const results=matches(input.value);
      const exact=results.filter(u=>norm(u.plate)===norm(input.value)||mobileKey(u.mov)===mobileKey(input.value));
      if(exact.length===1) go("ficha",exact[0].plate);
      else if(results.length===1) go("ficha",results[0].plate);
      else if(results.length>1) {S.f.q=input.value;go("unidades");}
      else toast("No hay móviles con esa patente o número.");
    }
  };
  $(".chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{input.value=b.dataset.p;input.oninput();input.focus();});
  input.focus();
}
function options(values,current) {return [...new Set(values.filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'" '+(v===current?"selected":"")+'>'+esc(v)+'</option>').join("");}
function filtered() {
  const f=S.f, result=f.q?new Set(matches(f.q).map(u=>u.plate)):null;
  return units.filter(u=>(!result||result.has(u.plate))&&(!f.base||u.base===f.base)&&(!f.est||u.estado===f.est)&&(!f.vtv||vtvStatus(u).key===f.vtv));
}
function listado() {
  const f=S.f;
  $("#app").innerHTML='<p class="eyebrow">Maestro de unidades</p><h2>Unidades</h2>'+
    '<div class="stats"><div class="mc"><span>Móviles cargados</span><strong>'+units.length+'</strong></div>'+
    '<div class="mc"><span>Operativas · OPER</span><strong>'+units.filter(u=>u.estado==="OPER").length+'</strong></div>'+
    '<div class="mc"><span>VTV vencidas · todos los estados</span><strong>'+units.filter(u=>vtvStatus(u).key==="vencida").length+'</strong></div></div>'+
    '<div class="filters"><input id="fq" placeholder="Patente o número de móvil" value="'+esc(f.q)+'" aria-label="Filtrar por patente o móvil">'+
    '<select id="ft" aria-label="Base"><option value="">Todas las bases</option>'+options(units.map(u=>u.base),f.base)+'</select>'+
    '<select id="fe" aria-label="Estado"><option value="">Todos los estados</option>'+options(units.map(u=>u.estado),f.est)+'</select>'+
    '<select id="fv" aria-label="VTV"><option value="">Todas las VTV</option>'+[["vencida","Vencidas"],["proxima","Vencen en 30 días"],["vigente","Vigentes"],["sin","Sin dato"]].map(([v,l])=>'<option value="'+v+'" '+(v===f.vtv?"selected":"")+'>'+l+'</option>').join("")+'</select>'+
    '<button class="btn" id="clear">Limpiar filtros</button><button class="btn" id="ex">Exportar CSV</button></div>'+
    '<p class="mut" id="resultCount" aria-live="polite"></p><div class="tw"><table><thead><tr><th>Patente</th><th>Móvil</th><th>Base</th><th>Clase</th><th>Estado del Excel</th><th>Vencimiento VTV</th></tr></thead><tbody id="tb"></tbody></table></div>';
  const draw=()=>{
    const result=filtered();$("#resultCount").textContent=result.length+" de "+units.length+" móviles";
    $("#tb").innerHTML=result.map(u=>'<tr tabindex="0" data-id="'+esc(u.plate)+'"><td class="pl">'+esc(u.plate)+'</td><td>'+esc(u.mov)+'</td><td>'+esc(u.base||"Sin dato")+'</td><td>'+esc(u.tipo||"Sin dato")+'</td><td>'+esc(statusLabel(u.estado))+'</td><td>'+fmt(u.vtv)+'<br>'+badge(u)+'</td></tr>').join("")||'<tr><td colspan="6" class="mut">Ningún móvil coincide con los filtros.</td></tr>';
    $("#tb").querySelectorAll("[data-id]").forEach(t=>{t.onclick=()=>go("ficha",t.dataset.id);t.onkeydown=e=>{if(e.key==="Enter")go("ficha",t.dataset.id);};});
  };
  $("#fq").oninput=e=>{f.q=e.target.value;draw();};
  [["ft","base"],["fe","est"],["fv","vtv"]].forEach(([id,key])=>$("#"+id).onchange=e=>{f[key]=e.target.value;draw();});
  $("#clear").onclick=()=>{S.f={q:"",base:"",est:"",vtv:""};listado();};
  $("#ex").onclick=()=>{
    const cell=value=>'"'+String(value??"").replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
    const rows=[["Patente","Móvil","Base","Estado","Vencimiento VTV","Observaciones"],...filtered().map(u=>[u.plate,u.mov,u.base,u.estado,fmt(u.vtv),u.obs])];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(cell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"}));a.download="SIGF-moviles.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }; draw();
}
function ficha() {
  const u=units.find(x=>x.plate===S.sel);if(!u)return go("unidades");
  const field=(label,value)=>'<div><span>'+label+'</span>'+esc(value||"Sin dato")+'</div>';
  $("#app").innerHTML='<button class="back" id="bk">‹ Volver a unidades</button>'+
    '<div class="row"><h2 class="pl" style="font-size:36px">'+esc(u.plate)+'</h2><span class="mut">Móvil '+esc(u.mov)+'</span>'+
    '<span class="pill '+(u.estado==="OPER"?"ok":"neutral")+'">'+esc(statusLabel(u.estado))+'</span><span class="sp"></span>'+
    (canEdit()?'<button class="btn" id="ed">Editar unidad</button>':"")+'</div>'+
    '<div class="card grid">'+field("Base / emplazamiento",u.base)+field("Ubicación técnica",u.ubicacion)+field("Clase de vehículo",u.tipo)+field("Año",u.anio)+field("Área",u.area)+field("Centro de coste",u.ceco)+field("Local",u.local)+field("Observaciones",u.obs)+'</div>'+
    '<h3 style="margin:24px 0 12px">VTV</h3><div class="card"><div class="row"><strong>Vencimiento: '+fmt(u.vtv)+'</strong>'+badge(u)+'</div><p class="mut">Fecha registrada en el Excel. El certificado todavía no está vinculado.</p></div>'+
    '<h3 style="margin:24px 0 12px">Documentación</h3><div class="card"><p>La conexión con las carpetas del servidor interno está pendiente.</p><p class="mut">Aquí se mostrarán la cédula, seguros, certificados, fotos y demás archivos del móvil.</p></div>'+
    '<h3 style="margin:24px 0 12px">Origen de los datos</h3><p class="mut">'+esc(SOURCE.source)+' · '+esc(SOURCE.sheet)+(u.sourceRow?' · Fila '+u.sourceRow:' · Alta local')+'</p>'+
    '<h3 style="margin:24px 0 4px">Historial de cambios locales</h3>'+
    (u.hist.length?'<ul class="h">'+u.hist.map(h=>'<li>'+esc(h)+'</li>').join("")+'</ul>':'<p class="mut">Sin ediciones locales.</p>');
  $("#bk").onclick=()=>go("unidades");if($("#ed"))$("#ed").onclick=()=>form(u);
}
function closeModal() {$("#modal").innerHTML="";document.removeEventListener("keydown",modalKey);}
function modalKey(e){if(e.key==="Escape")closeModal();}
function modal(html) {
  $("#modal").innerHTML='<div class="modal"><div class="card" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">'+html+'</div></div>';
  $("#modal .modal").onclick=e=>{if(e.target===e.currentTarget)closeModal();};
  $("#modal").querySelectorAll("[data-x]").forEach(b=>b.onclick=closeModal);
  document.addEventListener("keydown",modalKey);$("#modal input,#modal button")?.focus();
}
function form(existing) {
  if(!canEdit())return;
  const u=existing||{plate:"",mov:"",base:"",estado:"OPER",anio:"",tipo:"",ubicacion:"",area:"",ceco:"",local:"",vtv:"",obs:"",hist:[]};
  const input=(label,id,value,type="text")=>'<label>'+label+'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';
  modal('<h3 id="dialogTitle">'+(existing?"Editar":"Nueva")+' unidad</h3><p class="mut">Los cambios se guardan en este navegador.</p><form id="unitForm"><div class="f">'+
    '<div class="two">'+input("Patente","fp",u.plate)+input("Número de móvil","fm",u.mov)+'</div>'+
    '<div class="two"><label>Estado del Excel<select id="fs">'+options([...units.map(x=>x.estado),"OPER","VENT","NOPM","CARR","SINI","BAJA"],u.estado)+'</select></label>'+input("Base","fb",u.base)+'</div>'+
    '<div class="two">'+input("Clase de vehículo","ft2",u.tipo)+input("Año","fa",u.anio,"number")+'</div>'+
    '<div class="two">'+input("Ubicación técnica","fu",u.ubicacion)+input("Área","fr",u.area)+'</div>'+
    '<div class="two">'+input("Centro de coste","fc",u.ceco)+input("Local","fl",u.local)+'</div>'+
    input("Vencimiento VTV","fv2",u.vtv,"date")+
    '<label>Observaciones<textarea id="fo" rows="3">'+esc(u.obs)+'</textarea></label><p class="err" id="er" role="alert"></p></div>'+
    '<div class="row"><span class="sp"></span><button class="btn" type="button" data-x>Cancelar</button><button class="btn p" type="submit">Guardar unidad</button></div></form>');
  if(existing)$("#fp").readOnly=true;
  $("#unitForm").onsubmit=e=>{
    e.preventDefault();if(!canEdit())return;
    const plate=norm($("#fp").value),mov=$("#fm").value.trim().toUpperCase();
    if(!plate||!mov){$("#er").textContent="Completá la patente y el número de móvil.";return;}
    if(units.some(x=>x!==existing&&(norm(x.plate)===plate||mobileKey(x.mov)===mobileKey(mov)))){$("#er").textContent="Ya existe una unidad con esa patente o número de móvil.";return;}
    Object.assign(u,{plate,mov,estado:$("#fs").value,base:$("#fb").value.trim(),tipo:$("#ft2").value.trim(),anio:$("#fa").value,
      ubicacion:$("#fu").value.trim(),area:$("#fr").value.trim(),ceco:$("#fc").value.trim(),local:$("#fl").value.trim(),
      vtv:$("#fv2").value,obs:$("#fo").value.trim()});
    u.hist.unshift(new Date().toLocaleString("es-AR")+" · "+(existing?"Unidad editada":"Unidad creada"));
    if(!existing)units.unshift(u);
    const saved=save();closeModal();go("ficha",plate);if(saved)toast("Unidad guardada en este navegador.");
  };
}
function usuarios(){
  $("#app").innerHTML='<h2>Usuarios y roles</h2><div class="card"><p>El selector de rol permite probar las vistas de Consulta, Carga y Administrador.</p><p class="mut">Esta versión todavía no tiene cuentas ni inicio de sesión corporativo.</p></div>';
}
function render(){
  closeModal();if(S.view==="usuarios"&&role()!=="admin")S.view="buscar";
  nav();$("#tt").textContent=({buscar:"Buscar unidad",unidades:"Unidades",ficha:"Ficha de unidad",usuarios:"Usuarios y roles"})[S.view];
  ({buscar:search,unidades:listado,ficha,usuarios})[S.view]();window.scrollTo(0,0);
}
$("#role").onchange=render;
$("#rs").onclick=()=>modal('<h3 id="dialogTitle">Restablecer datos del Excel</h3><p>Se eliminarán las altas y ediciones guardadas en este navegador. El Excel original conserva sus datos.</p><div class="row"><button class="btn" data-x>Cancelar</button><button class="btn p" id="confirmReset">Restablecer</button></div>');
$("#modal").addEventListener("click",e=>{
  if(e.target.id==="confirmReset"){
    try{localStorage.removeItem(STORAGE);}catch(_){toast("No se pudo restablecer el almacenamiento del navegador.");return;}
    units=structuredClone(SOURCE.units);S.f={q:"",base:"",est:"",vtv:""};go("buscar");toast("Datos originales del Excel restaurados.");
  }
});
$("#td").textContent=new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
const root=document.documentElement;
function theme(t){root.dataset.theme=t;try{localStorage.setItem("sigf_theme",t);}catch(_){}$("#th").textContent=t==="dark"?"☀️":"🌙";}
try{const t=localStorage.getItem("sigf_theme");if(t)theme(t);}catch(_){}
$("#th").onclick=()=>theme(root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme:dark)").matches)?"light":"dark");
render();if(storageMessage)toast(storageMessage);
