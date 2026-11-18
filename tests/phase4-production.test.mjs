import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
const base='http://127.0.0.1:4173';
const fetchLocal=async ref=>{const r=await fetch(base+ref,{signal:AbortSignal.timeout(5000)});assert.equal(r.status,200,ref);return r;};
test('all active result and original PNG bytes match the served build manifest',async()=>{
 const m=await (await fetchLocal('/content/learning/build.json')).json();let png=0;
 for(const o of m.outputs){const r=await fetchLocal('/content/'+o.ref);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),o.sha256,o.ref);if(o.ref.endsWith('.png')){assert.match(r.headers.get('content-type'),/image\/png/);png++;}}
 assert.ok(png>=100);console.log('Active resources checked via loopback',m.outputs.length,'including PNG',png);
});
test('every emitted JS/CSS chunk is local and reachable including the lazy chart engine',async()=>{
 const dir=new URL('../dist/assets/',import.meta.url);const files=(await readdir(dir)).filter(f=>/\.(js|css)$/.test(f));
 assert.ok(files.some(f=>f.startsWith('ChartView-')&&f.endsWith('.js')));
 for(const f of files){const r=await fetchLocal('/assets/'+f);assert.match(r.headers.get('content-type'),f.endsWith('.js')?/javascript/:/css/);}
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.ok(!/(?:src|href)=["']https?:/i.test(html));
 console.log('Emitted JS/CSS chunks verified',files.length);
});
