const {chromium}=require('C:/Users/ndesbat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const assets=new Set(['index.html','app.js','data.js','documentacion.js','documentacion-real.js','style.css','logo-ihsa.png']);
function csvRows(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===';'&&!quoted){row.push(cell);cell='';}
    else if(c==='\r'&&!quoted&&text[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}
    else cell+=c;
  }
  row.push(cell);rows.push(row);return rows;
}
(async()=>{
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    if(!assets.has(name)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.png':'image/png'})[path.extname(name)]);
    fs.createReadStream(path.join(root,name)).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/documents',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({byPlate:{},matchedUnits:0,matchedFiles:0,unmatched:0,excludedFolders:0,readErrors:0,scannedAt:'2026-11-13T12:00:00-0300'})}));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('[data-v="unidades"]').click();
    assert.equal(await page.locator('#tb [data-export-plate]').count(),309);
    assert(await page.locator('#ex').isDisabled());
    await page.locator('#fq').fill('M-870');
    await page.locator('[data-export-plate="AA034KM"]').check();
    assert(await page.locator('#exportSelectedCount').isVisible(),'Marcar una casilla no debe abrir la ficha');
    await page.locator('#fq').fill('890');
    await page.locator('[data-export-plate="AG369SA"]').check();
    assert.match(await page.locator('#exportSelectedCount').innerText(),/^2 móviles/);
    await page.locator('#fq').fill('NOEXISTE');
    assert.match(await page.locator('#exportSelectionHint').innerText(),/2 seleccionado\(s\) fuera/);
    assert(await page.locator('#exportSelect').isDisabled());
    assert(!(await page.locator('#ex').isDisabled()));
    await page.evaluate(()=>units.find(u=>u.plate==='AA034KM').obs='="texto";\r\ncon "comillas"');
    const downloadWaiting=page.waitForEvent('download');await page.locator('#ex').click();
    const download=await downloadWaiting;
    const csv=fs.readFileSync(await download.path(),'utf8'),rows=csvRows(csv);
    assert.equal(rows.length,3);assert(rows.every(r=>r.length===7));
    assert.deepEqual(rows.slice(1).map(r=>r[0]).sort(),['AA034KM','AG369SA']);
    assert.equal(rows.find(r=>r[0]==='AA034KM')[6],'\'="texto";\r\ncon "comillas"');
    await page.locator('[data-v="documentacion"]').click();
    await page.locator('#realSummary').filter({hasText:'patentes con archivos'}).waitFor();
    await page.locator('[data-real-plate="AG369SA"]').check();
    await page.locator('[data-v="unidades"]').click();
    assert.match(await page.locator('#exportSelectedCount').innerText(),/^2 móviles/);
    await page.locator('#clear').click();
    await page.locator('[data-export-plate="AA034KM"]').focus();await page.keyboard.press('Space');
    assert.match(await page.locator('#exportSelectedCount').innerText(),/^1 móvil/);
    await page.locator('[data-export-remove="AG369SA"]').click();assert(await page.locator('#ex').isDisabled());
    await page.locator('#ft').selectOption('CABA');await page.locator('#exportSelect').click();
    const caba=await page.evaluate(()=>units.filter(u=>u.base==='CABA').length);
    assert.match(await page.locator('#exportSelectedCount').innerText(),new RegExp('^'+caba+' móviles'));
    await page.locator('#exportSelect').click();assert.equal(await page.evaluate(()=>S.exportSelected.size),caba);
    await page.locator('#clear').click();await page.locator('#exportSelect').click();
    assert.equal(await page.evaluate(()=>S.exportSelected.size),309);
    const allWaiting=page.waitForEvent('download');await page.locator('#ex').click();
    const all=await allWaiting;assert.equal(csvRows(fs.readFileSync(await all.path(),'utf8')).length,310);
    await page.locator('#exportClear').click();assert(await page.locator('#ex').isDisabled());
    await page.locator('[data-v="documentacion"]').click();assert.match(await page.locator('#realSelected').innerText(),/^1 móvil/);
    await page.locator('[data-v="unidades"]').click();await page.locator('#ft').selectOption('CABA');
    await page.locator('[data-export-plate]').first().check();
    const output=path.join(root,'verificacion','renovacion-2026-11-13');fs.mkdirSync(output,{recursive:true});
    const layouts=[];
    for(const theme of ['light','dark']){
      await page.evaluate(t=>window.theme(t),theme);
      for(const width of [1440,1024,717,390,320]){
        await page.setViewportSize({width,height:900});
        for(const view of ['unidades','buscar','documentacion']){
          await page.locator('[data-v="'+view+'"]').click();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} ${theme} ${width}: desbordamiento`);
          assert(await page.locator('#nav').evaluate(nav=>{const buttons=[...nav.querySelectorAll('button')];return buttons.every(b=>Math.abs(b.getBoundingClientRect().top-buttons[0].getBoundingClientRect().top)<2);}),`Navegación horizontal ${width}`);
          assert((await page.locator('.side').boundingBox()).height<(width>1150?100:180),'Altura de cabecera');
          if([1440,390].includes(width))await page.screenshot({path:path.join(output,`${view}-${theme}-${width}.png`),fullPage:false});
        }
        layouts.push({theme,width});
      }
    }
    await page.locator('#role').selectOption('admin');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Navegación de administrador en 320px');
    await page.locator('[data-v="buscar"]').click();await page.locator('#q').fill('870');await page.locator('#q').press('Enter');
    assert.equal(await page.locator('h2').innerText(),'AA034KM');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Ficha móvil');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({selectionAcrossFilters:true,independentDocumentSelection:true,keyboard:true,csvSelected:2,csvAll:309,quotedCellsAndFormulaProtection:true,layouts,pageErrors:errors}));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
