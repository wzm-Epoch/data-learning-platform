import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chartSchema} from '../schemas/charts.mjs';
import {imageCaption} from '../schemas/image-caption.mjs';
import * as learning from '../schemas/learning.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const resource=name=>read('content-source/learning/resources/'+name+'.json');

test('tree contract permits data nodes only and requires type-specific dimensions',async()=>{
 const r=await resource('p26-v4-tree');
 assert.equal(chartSchema.safeParse({...r.chart,tree:{...r.chart.tree,symbol:'image://https://example.com/a.png'}}).success,false,'node renderer options must not pass through');
 assert.equal(chartSchema.safeParse({...r.chart,tree:undefined}).success,false);
 const h=await resource('p23-v4-matrix');
 assert.equal(chartSchema.safeParse({...h.chart,ys:[2]}).success,false);
 assert.equal(chartSchema.safeParse({...h.chart,type:'boxplot',ys:[1,2]}).success,false);
});

test('numeric chart mappings reject textual values but preserve null and real zero',async()=>{
 const r=await resource('p21-v4-stores');const bad=structuredClone(r);bad.rows[0][1]='not a number';
 assert.equal(learning.resourceSchema.safeParse(bad).success,false);
 const nullable=structuredClone(r);nullable.rows[0][1]=null;nullable.rows[1][1]=0;
 assert.equal(learning.resourceSchema.safeParse(nullable).success,true);
});

test('image captions distinguish saved Notebook plots from converted source photos',async()=>{
 const r=await resource('p07-v4-photos');
 assert.equal(typeof imageCaption,'function');
 assert.doesNotMatch(imageCaption(r),/Notebook|尚未重跑/);
 assert.match(imageCaption({...r,context:{...r.context,identity:'original-saved'}}),/Notebook/);
 assert.equal(r.context.sample,'原资产顺序前3张 / 附带199张照片');
});

test('P21 coverage includes both lessons and every project contract matches current coverage',async()=>{
 const index=await read('content-source/learning/index.json');const coverage=await read('docs/stages/phase-04-coverage.json');
 for(const p of index.projects){
  const c=coverage.find(c=>c.projectId===p.id);const active=new Set();let steps=0;
  for(const meta of p.lessons){const l=await read('content-source/'+meta.ref);for(const s of l.steps){steps++;for(const ref of s.outputRefs){active.add(ref);for(const img of (await read('content-source/'+ref)).images||[])active.add(img);}}}
  assert.equal(c.readySteps,steps);assert.deepEqual([...active].sort(),c.resources,p.id+' complete active coverage');
  assert.deepEqual(await read('analysis/adapters/'+p.id+'/contract.json'),c,p.id+' adapter contract');
  assert.deepEqual(await read('content-source/learning/manifests/'+p.id+'.json'),c,p.id+' runtime manifest');
 }
});

test('rebuild retains full environment, all adapter hashes and exactly active resources',async()=>{
 const m=await read('content-source/learning/build.json');
 for(const name of ['python','pandas','numpy','scikit-learn','scipy','statsmodels','openpyxl','xlrd','Pillow'])assert.ok(m.environment[name],name);
 const files=await readdir(new URL('analysis/adapters/',root),{recursive:true});
 const all=files.filter(f=>f.endsWith('.py')).map(f=>'analysis/adapters/'+f.replaceAll('\\','/')).sort();
 assert.deepEqual(m.codeHashes.map(x=>x.path).sort(),all);
 for(const x of m.codeHashes)assert.equal(createHash('sha256').update(await readFile(new URL(x.path,root))).digest('hex'),x.sha256);
 const coverage=await read('docs/stages/phase-04-coverage.json');
 assert.deepEqual(m.outputs.map(x=>x.ref).sort(),[...new Set(coverage.flatMap(c=>c.resources))].sort());
 const s=await read('docs/stages/phase-04-summary.json');assert.deepEqual(s.environment,m.environment);
 assert.deepEqual(await read('docs/stages/phase-04-precompute.json'),m);
 const requirements=await readFile(new URL('analysis/environments/phase4-requirements.txt',root),'utf8');
 assert.match(requirements,/Pillow==/);
});
