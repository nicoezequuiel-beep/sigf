const { chromium } = require("C:/Users/ndesbat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("fs");
const http = require("http");
const path = require("path");
const assert = require("assert/strict");
(async()=>{
  const root=path.resolve(__dirname,"..");
  const server=http.createServer((req,res)=>{
    const filename=path.resolve(root,"."+decodeURIComponent(req.url.split("?")[0]==="/"?"/index.html":req.url.split("?")[0]));
    if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(filename,(err,data)=>{
      if(err){res.writeHead(404).end();return;}
      res.setHeader("Content-Type",({".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",".png":"image/png"})[path.extname(filename)]||"application/octet-stream");
      res.end(data);
    });
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({channel:"msedge",headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port);
    await page.waitForSelector("#q");
    assert.equal(await page.evaluate(()=>units.length),309);
    const coverage=await page.evaluate(()=>SOURCE.units.every(u=>
      matches(u.plate)[0]?.plate===u.plate && matches(u.mov)[0]?.plate===u.plate &&
      (!/^\d+$/.test(u.mov)||matches("M-"+u.mov)[0]?.plate===u.plate)));
    assert(coverage,"Every source plate and mobile must resolve exactly");
    for(const [query,plate,mov] of [["ab-870-sv","AB870SV","185"],["M-870","AA034KM","870"],["UDM1","MIE247","UDM1"],["0","C547550","0"]]){
      await page.locator("#q").fill(query);await page.locator("#q").press("Enter");
      await page.waitForSelector("#bk");assert.equal(await page.locator("h2").innerText(),plate);
      assert((await page.locator("#app").innerText()).includes("Móvil "+mov));
      await page.locator('[data-v="buscar"]').click();
    }
    await page.locator("#q").fill("NOEXISTE");assert.match(await page.locator("#searchCount").innerText(),/No hay/);
    await page.locator("#q").fill("870");
    fs.mkdirSync(path.join(root,"verificacion"),{recursive:true});
    await page.screenshot({path:path.join(root,"verificacion","busqueda.png"),fullPage:true});
    await page.locator("#q").press("Enter");
    await page.screenshot({path:path.join(root,"verificacion","ficha.png"),fullPage:true});
    await page.locator('[data-v="unidades"]').click();
    assert.equal(await page.locator("#tb tr").count(),309);
    assert.equal(await page.locator("#fv").count(),0);
    await page.locator("#ft").selectOption("CABA");assert.equal(await page.locator("#tb tr").count(),31);
    await page.locator("#fe").selectOption("UTIM");assert.equal(await page.locator("#tb tr").count(),await page.evaluate(()=>units.filter(u=>u.base==='CABA'&&u.area==='UTIM').length));
    await page.locator("#clear").click();
    await page.locator("#fq").fill("M-870");assert.equal(await page.locator("#tb tr").count(),1);
    await page.locator("#tb tr").click();
    await page.locator("#ed").click();await page.locator("#fo").fill("Prueba temporal de guardado");
    await page.locator('#unitForm button[type="submit"]').click();
    await page.reload();await page.locator("#q").fill("870");await page.locator("#q").press("Enter");
    assert((await page.locator("#app").innerText()).includes("Prueba temporal de guardado"));
    await page.locator("#rs").click();await page.locator("#confirmReset").click();
    assert.equal(await page.evaluate(()=>localStorage.getItem("sigf_units_v1")),null);
    await page.locator("#role").selectOption("consulta");assert.equal(await page.locator('[data-v="nueva"]').count(),0);
    await page.locator("#q").fill("870");await page.locator("#q").press("Enter");assert.equal(await page.locator("#ed").count(),0);
    await page.waitForTimeout(3400); await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(root,"verificacion","ficha-movil.png"),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Mobile overflow");
    assert.deepEqual(errors,[]); const local = await browser.newPage(); await local.goto(require("url").pathToFileURL(path.join(root,"index.html")).href); await local.locator("#q").fill("185"); await local.locator("#q").press("Enter"); assert.equal(await local.locator("h2").innerText(),"AB870SV"); await local.close();
    console.log(JSON.stringify({records:309,allIdentifiersVerified:coverage,missingVtv:await page.evaluate(()=>SOURCE.units.filter(u=>!u.vtv).length),searchExamples:4,persistence:true,roles:true,mobileOverflow:false,pageErrors:errors}));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
