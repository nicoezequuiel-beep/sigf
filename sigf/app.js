const DOCS=["VTV","Cédula","Seguro","Título"],TITULARES=["Propio","Contratista Norte","Contratista Sur","Alquiler"],TIPOS=["Ambulancia UTIM","Ambulancia UTIA","Traslado","Utilitario"];
const MARCAS=[["Mercedes-Benz","Sprinter"],["Renault","Master"],["Fiat","Ducato"],["Peugeot","Boxer"],["Ford","Transit"]];
let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280,pick=a=>a[Math.floor(rnd()*a.length)];
const day=864e5,iso=d=>new Date(d).toISOString().slice(0,10),now=Date.now();
const L="ABCDEFGHJKLMNPRSTUVWXYZ";
function mk(i){const [m,mo]=pick(MARCAS),plate=pick(L)+pick(L)+String(100+Math.floor(rnd()*899))+pick(L)+pick(L),docs={};
DOCS.forEach(d=>{if(rnd()<.1){docs[d]=null;return}const emi=now-Math.floor(rnd()*300)*day;docs[d]={emi:iso(emi),ven:d==="Título"?"":iso(emi+365*day),file:`${d}_${plate}.pdf`}});
return{plate,mov:"M-"+String(i+1).padStart(3,"0"),titular:pick(TITULARES),marca:m,modelo:mo,anio:2016+Math.floor(rnd()*10),tipo:pick(TIPOS),estado:rnd()<.9?"En servicio":"Fuera de servicio",obs:"",docs,hist:[]}}
const units=Array.from({length:24},(_,i)=>mk(i));
const users=[["Nicolás","Administrador"],["Laura Méndez","Carga"],["Diego Ríos","Carga"],["Dirección general","Consulta"]];
const S={view:"buscar",sel:null,t0:null,found:null,f:{q:"",tit:"",est:""}};
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s).toUpperCase().replace(/[^A-Z0-9]/g,""),role=()=>$("#role").value,canEdit=()=>role()!=="consulta";
const fmt=d=>d?d.split("-").reverse().join("/"):"Sin vencimiento";
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2600)}
function go(v,sel){S.view=v;S.sel=sel??null;render()}
function nav(){const t=[["buscar","⌕","Buscar"],["unidades","▦","Unidades"]];if(canEdit())t.push(["nueva","＋","Nueva unidad"]);if(role()==="admin")t.push(["usuarios","☰","Usuarios"]);
const cur=S.view==="ficha"?"unidades":S.view;$("#nav").innerHTML=t.map(([k,i,l])=>`<button data-v="${k}" aria-current="${cur===k}"><span class="ni" aria-hidden="true">${i}</span>${l}</button>`).join("");
$("#nav").querySelectorAll("button").forEach(b=>b.onclick=()=>b.dataset.v==="nueva"?form():go(b.dataset.v))}
function match(q){const n=norm(q);if(!n)return[];return units.filter(u=>norm(u.plate).includes(n)||norm(u.mov).includes(n)).slice(0,6)}
function buscar(){$("#app").innerHTML=`<section class="hero"><h1>Buscá un móvil y mirá toda su documentación</h1><p>Escribí la patente o el número de interno. Sin carpetas ni planillas.</p>
<div class="plate"><div class="plate-box"><div class="plate-top"><span>ARGENTINA</span><span>Patente o interno</span></div><input id="q" autocomplete="off" placeholder="AB123CD" aria-label="Patente o número de interno" maxlength="8"></div><ul class="sug" id="sug" hidden></ul></div>
<div class="chips"><span>Probá con:</span>${units.slice(0,3).map(u=>`<button class="chip" data-p="${u.plate}">${u.plate}</button>`).join("")}<button class="chip" data-p="M-007">M-007</button></div>
<div class="chips"><span>${units.length} unidades de muestra (la flota real tiene 350)</span></div></section>`;
const q=$("#q"),sg=$("#sug");
q.oninput=()=>{if(!S.t0)S.t0=performance.now();const r=match(q.value);sg.hidden=!r.length;sg.innerHTML=r.map(u=>`<li><button data-id="${u.plate}"><span class="pl">${u.plate}</span><span>${u.mov} · ${esc(u.marca)} ${esc(u.modelo)}</span><span class="sp"></span><span class="mut">${esc(u.titular)}</span></button></li>`).join("");
sg.querySelectorAll("button").forEach(b=>b.onclick=()=>open(b.dataset.id,true))};
q.onkeydown=e=>{if(e.key==="Enter"){const r=match(q.value);r[0]?open(r[0].plate,true):toast("No hay ninguna unidad con esa patente o interno")}};
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{q.value=c.dataset.p;S.t0=performance.now();q.oninput();q.focus()});q.focus()}
function open(plate,timed){S.found=timed&&S.t0?((performance.now()-S.t0)/1000).toFixed(1):null;S.t0=null;go("ficha",plate)}
function unidades(){const f=S.f,tot=units.length,comp=units.filter(u=>DOCS.every(d=>u.docs[d])).length,falt=units.reduce((a,u)=>a+DOCS.filter(d=>!u.docs[d]).length,0);$("#app").innerHTML=`<p class="eyebrow">Maestro de unidades</p><h2>Unidades</h2><div class="stats"><div class="mc"><span>Unidades cargadas</span><strong>${tot}</strong></div><div class="mc"><span>Con documentación completa</span><strong>${comp}</strong></div><div class="mc"><span>Documentos faltantes</span><strong>${falt}</strong></div></div><div class="filters"><input id="fq" placeholder="Filtrar por patente o interno" value="${esc(f.q)}" aria-label="Filtrar">
<select id="ft" aria-label="Titular"><option value="">Todos los titulares</option>${TITULARES.map(t=>`<option ${f.tit===t?"selected":""}>${t}</option>`).join("")}</select>
<select id="fe" aria-label="Estado"><option value="">Todos los estados</option>${["En servicio","Fuera de servicio"].map(t=>`<option ${f.est===t?"selected":""}>${t}</option>`).join("")}</select><span class="sp"></span>
<button class="btn" id="ex">Exportar a Excel</button></div><div class="tw"><table><thead><tr><th>Patente</th><th>Interno</th><th>Titular</th><th>Vehículo</th><th>Estado</th><th>Documentos</th></tr></thead><tbody id="tb"></tbody></table></div>`;
const draw=()=>{const n=norm(f.q),r=units.filter(u=>(!n||norm(u.plate).includes(n)||norm(u.mov).includes(n))&&(!f.tit||u.titular===f.tit)&&(!f.est||u.estado===f.est));
$("#tb").innerHTML=r.map(u=>{const m=DOCS.filter(d=>!u.docs[d]).length;return`<tr tabindex="0" data-id="${u.plate}"><td class="pl">${u.plate}</td><td>${u.mov}</td><td>${esc(u.titular)}</td><td>${esc(u.marca)} ${esc(u.modelo)}</td><td>${esc(u.estado)}</td><td>${m?`<span class="pill bad">Falta${m>1?"n":""} ${m}</span>`:`<span class="pill ok">Completa</span>`}</td></tr>`}).join("")||`<tr><td colspan="6" class="mut">Ninguna unidad coincide con los filtros. Probá quitar alguno.</td></tr>`;
$("#tb").querySelectorAll("tr[data-id]").forEach(t=>{t.onclick=()=>open(t.dataset.id);t.onkeydown=e=>{if(e.key==="Enter")open(t.dataset.id)}})};
$("#fq").oninput=e=>{f.q=e.target.value;draw()};$("#ft").onchange=e=>{f.tit=e.target.value;draw()};$("#fe").onchange=e=>{f.est=e.target.value;draw()};
$("#ex").onclick=()=>toast("Exportación simulada: unidades.xlsx");draw()}
function ficha(){const u=units.find(x=>x.plate===S.sel);if(!u)return go("unidades");
$("#app").innerHTML=`<button class="back" id="bk">‹ Volver a unidades</button>
<div class="row"><h2 class="pl" style="font-size:36px">${u.plate}</h2><span class="mut">Interno ${u.mov}</span><span class="pill ${u.estado==="En servicio"?"ok":"bad"}">${esc(u.estado)}</span><span class="sp"></span>${S.found?`<span class="found">Encontrada en ${S.found} s</span>`:""}${canEdit()?`<button class="btn" id="ed">Editar unidad</button>`:""}</div>
<div class="card grid"><div><span>Titular</span>${esc(u.titular)}</div><div><span>Vehículo</span>${esc(u.marca)} ${esc(u.modelo)} ${u.anio}</div><div><span>Tipo</span>${esc(u.tipo)}</div><div><span>Observaciones</span>${esc(u.obs)||"—"}</div></div>
<h3 style="margin:24px 0 12px">Documentación</h3><div class="docs">${DOCS.map(d=>{const x=u.docs[d];return x?`<div class="card doc"><h3>${d}</h3><div class="mut">Emitido: ${fmt(x.emi)}</div><div class="mut">Vence: ${fmt(x.ven)}</div><div class="row"><button class="btn s" data-a="ver" data-d="${d}">Ver</button><button class="btn s" data-a="dl" data-d="${d}">Descargar</button>${canEdit()?`<button class="btn s" data-a="up" data-d="${d}">Reemplazar</button>`:""}</div></div>`
:`<div class="card doc miss"><h3>${d}</h3><span class="pill bad">Documento faltante</span><div class="row">${canEdit()?`<button class="btn p s" data-a="up" data-d="${d}">Subir documento</button>`:`<span class="mut">Pedí la carga a un usuario con rol Carga.</span>`}</div></div>`}).join("")}</div>
<h3 style="margin:24px 0 4px">Historial de cambios</h3>${u.hist.length?`<ul class="h">${u.hist.map(h=>`<li>${esc(h)}</li>`).join("")}</ul>`:`<p class="mut" style="margin:4px 0">Todavía no hay cambios registrados en esta sesión.</p>`}`;
$("#bk").onclick=()=>go("unidades");if($("#ed"))$("#ed").onclick=()=>form(u);
document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const d=b.dataset.d,a=b.dataset.a;if(a==="dl")toast(`Descarga simulada: ${u.docs[d].file}`);if(a==="ver")modal(`<h3>${d} · ${u.plate}</h3><div class="scan">Vista previa simulada del escaneo<br>${esc(u.docs[d].file)}</div><div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn" data-x>Cerrar</button></div>`);if(a==="up")upload(u,d)})}
function modal(h){$("#modal").innerHTML=`<div class="modal" data-x><div class="card" role="dialog" aria-modal="true" onclick="event.stopPropagation()">${h}</div></div>`;$("#modal").querySelectorAll("[data-x]").forEach(x=>x.onclick=e=>{if(e.currentTarget===x)$("#modal").innerHTML=""});const i=$("#modal input,#modal button");i&&i.focus()}
function upload(u,d){modal(`<h3>${u.docs[d]?"Reemplazar":"Subir"} ${d} · ${u.plate}</h3><div class="f"><label>Archivo escaneado<input type="file" id="uf" accept=".pdf,image/*"></label><div class="two"><label>Fecha de emisión<input type="date" id="ue" value="${iso(now)}"></label>${d==="Título"?"":`<label>Fecha de vencimiento<input type="date" id="uv" required></label>`}</div><div class="err" id="er"></div></div><div class="row"><span class="sp"></span><button class="btn" data-x>Cancelar</button><button class="btn p" id="us">Guardar documento</button></div>`);
$("#us").onclick=()=>{const v=$("#uv")?$("#uv").value:"";if($("#uv")&&!v)return $("#er").textContent="Indicá la fecha de vencimiento para guardar el documento.";
const f=$("#uf").files[0];u.docs[d]={emi:$("#ue").value,ven:v,file:f?f.name:`${d}_${u.plate}.pdf`};u.hist.unshift(`${new Date().toLocaleString("es-AR")} · ${role()==="admin"?"Administrador":"Carga"} · ${d} guardado`);$("#modal").innerHTML="";toast(`${d} guardado`);ficha()}}
function form(u){const e=!!u;u=u||{plate:"",mov:"",titular:TITULARES[0],marca:"",modelo:"",anio:2024,tipo:TIPOS[0],estado:"En servicio",obs:""};
const sel=(id,a,v)=>`<select id="${id}">${a.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("")}</select>`;
modal(`<h3>${e?"Editar":"Nueva"} unidad</h3><div class="f"><div class="two"><label>Patente<input id="fp" value="${esc(u.plate)}" ${e?"readonly":""} maxlength="8" placeholder="AB123CD"></label><label>Interno<input id="fm" value="${esc(u.mov)}" placeholder="M-025"></label></div>
<div class="two"><label>Marca<input id="fk" value="${esc(u.marca)}"></label><label>Modelo<input id="fo" value="${esc(u.modelo)}"></label></div>
<div class="two"><label>Año<input id="fa" type="number" min="1990" max="2030" value="${u.anio}"></label><label>Tipo${sel("ft2",TIPOS,u.tipo)}</label></div>
<div class="two"><label>Titular${sel("fh",TITULARES,u.titular)}</label><label>Estado${sel("fs",["En servicio","Fuera de servicio"],u.estado)}</label></div>
<label>Observaciones<textarea id="fb" rows="2">${esc(u.obs)}</textarea></label><div class="err" id="er"></div></div><div class="row"><span class="sp"></span><button class="btn" data-x>Cancelar</button><button class="btn p" id="fg">Guardar unidad</button></div>`);
$("#fg").onclick=()=>{const p=norm($("#fp").value),m=$("#fm").value.trim();if(!p||!m)return $("#er").textContent="Completá la patente y el número de interno.";
if(!e&&units.some(x=>norm(x.plate)===p||norm(x.mov)===norm(m)))return $("#er").textContent="Ya existe una unidad con esa patente o ese interno.";
const t=e?u:{docs:Object.fromEntries(DOCS.map(d=>[d,null])),hist:[]};Object.assign(t,{plate:p,mov:m,marca:$("#fk").value,modelo:$("#fo").value,anio:$("#fa").value,tipo:$("#ft2").value,titular:$("#fh").value,estado:$("#fs").value,obs:$("#fb").value});
t.hist.unshift(`${new Date().toLocaleString("es-AR")} · ${role()==="admin"?"Administrador":"Carga"} · ${e?"datos editados":"unidad creada"}`);if(!e)units.unshift(t);$("#modal").innerHTML="";toast(e?"Unidad actualizada":"Unidad creada");go("ficha",p)}}
function usuarios(){$("#app").innerHTML=`<h2>Usuarios</h2><p class="mut">Versión mínima: cada usuario tiene un rol que define qué puede hacer.</p><div class="tw"><table><thead><tr><th>Usuario</th><th>Rol</th></tr></thead><tbody>${users.map((x,i)=>`<tr style="cursor:default"><td>${esc(x[0])}</td><td><select data-i="${i}" aria-label="Rol de ${esc(x[0])}">${["Consulta","Carga","Administrador"].map(r=>`<option ${r===x[1]?"selected":""}>${r}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
document.querySelectorAll("select[data-i]").forEach(s=>s.onchange=()=>{users[s.dataset.i][1]=s.value;toast("Rol actualizado")})}
function render(){$("#modal").innerHTML="";if(S.view==="nueva")S.view="unidades";if(S.view==="usuarios"&&role()!=="admin")S.view="buscar";nav();$("#tt").textContent=({buscar:"Buscar unidad",unidades:"Unidades",ficha:"Ficha de unidad",usuarios:"Usuarios y roles"})[S.view];({buscar,unidades,ficha,usuarios})[S.view]();window.scrollTo(0,0)}
$("#role").onchange=render;$("#rs").onclick=()=>location.reload();
$("#td").textContent=new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
const root=document.documentElement;function theme(t){root.dataset.theme=t;try{localStorage.setItem("sigf_theme",t)}catch(_){}$("#th").textContent=t==="dark"?"☀️":"🌙"}
try{const t=localStorage.getItem("sigf_theme");if(t)theme(t)}catch(_){}
$("#th").onclick=()=>theme(root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme:dark)").matches)?"light":"dark");

render();
