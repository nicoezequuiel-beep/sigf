const {chromium}=require('C:/Users/ndesbat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),python='C:/Users/ndesbat/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sigf-intranet-')),docs=path.join(tmp,'docs'),binary=Buffer.from([0,255,37,80,68,70,13,10]);
  let server,browser;
  try {
    for(const name of ['AG369SA-890/VTV.pdf','AG369SA-890/Cédula.jpeg','3 VEHICULOS BAJAS/AG369SA-890/NO.pdf','1 NACION SEGUROS PÓLIZAS/Pólizas Flota.pdf']){const target=path.join(docs,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,binary);}
    const config=path.join(tmp,'config.json');fs.writeFileSync(config,JSON.stringify({documentsRoot:docs,host:'127.0.0.1',port:18765,refreshSeconds:1}));
    server=cp.spawn(python,[path.join(root,'scripts/servidor_documentacion.py'),'--config',config],{cwd:root,env:{...process.env,PYTHONPATH:path.join(root,'.intranet-deps')},windowsHide:true,stdio:'pipe'});
    let logs='';server.stderr.on('data',c=>logs+=c);
    let ready=false;
    for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:18765/');if(r.ok){ready=true;break;}}catch(_){}await new Promise(resolve=>setTimeout(resolve,200));}
    assert(ready,'No inició el servidor de prueba: '+logs);
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:18765/');await page.locator('#q').fill('890');await page.locator('#q').press('Enter');
    await page.locator('#unitDocumentFiles a[download]').first().waitFor();assert.equal(await page.locator('#unitDocumentFiles > ul a').count(),2);
    assert.equal(await page.locator('input[type=file]').count(),0);
    const fileWaiting=page.waitForEvent('download');await page.locator('#unitDocumentFiles > ul a').first().click();const file=await fileWaiting;
    assert.deepEqual(fs.readFileSync(await file.path()),binary);
    await page.screenshot({path:path.join(root,'verificacion','documentacion-real-ficha-intranet.png'),fullPage:true});
    await page.locator('[data-v="documentacion"]').click();await page.locator('#realSummary').filter({hasText:'patentes con archivos'}).waitFor();
    await page.locator('#fq').fill('890');await page.locator('#realSelect').click();
    const zipWaiting=page.waitForEvent('download');await page.locator('#realZip').click();const zip=await zipWaiting;
    const zipPath=path.join(root,'verificacion','documentacion-real-intranet.zip');await zip.saveAs(zipPath);
    const names=JSON.parse(cp.execFileSync(python,['-c','import json,zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))',zipPath],{encoding:'utf8'}));
    assert.equal(names.length,3);assert(!names.some(n=>n.includes('NO.pdf')||n.includes('Flota.pdf')));
    await page.locator('#fq').fill('AI387BW');assert.match(await page.locator('#realSelected').innerText(),/1 móvil seleccionado/);assert.match(await page.locator('#selectionHint').innerText(),/1 seleccionado/);
    await page.locator('[data-v="buscar"]').click();await page.locator('[data-v="documentacion"]').click();assert.match(await page.locator('#realSelected').innerText(),/1 móvil seleccionado/);
    for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await page.screenshot({path:path.join(root,'verificacion','documentacion-real-intranet-movil.png'),fullPage:true});
    await page.reload();await page.locator('#q').fill('890');await page.locator('#q').press('Enter');await page.locator('#unitDocumentFiles > ul a').first().waitFor();assert.equal(await page.locator('input[type=file]').count(),0);
    await page.route('**/api/documents',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Servicio no disponible'})}));
    await page.reload();await page.locator('[data-v="documentacion"]').click();await page.locator('#retryDocs:not([hidden])').waitFor();assert.equal(await page.locator('#realZip').isDisabled(),true);assert.match(await page.locator('#realSummary').innerText(),/Servicio no disponible/);
    assert.deepEqual(errors,[]);console.log('OK: ficha automática, recarga sin carpeta, descarga individual y ZIP real, exclusión de bajas, filtros, móvil y fallo de servicio explícito.');
  }finally{if(browser)await browser.close();if(server)server.kill();const resolved=path.resolve(tmp);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert(path.basename(resolved).startsWith('sigf-intranet-'));fs.rmSync(resolved,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
