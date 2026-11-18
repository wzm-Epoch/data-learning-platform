import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chartSchema,selectRows,thresholdMetrics} from '../schemas/charts.mjs';
import {resourceSchema} from '../schemas/learning.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const resource=name=>read('content-source/learning/resources/'+name+'.json');
const cov=await read('docs/stages/phase-04-coverage.json');
test('29 independent coverage records, 30 real lessons and source-specific steps',async()=>{
 assert.equal(cov.length,29);assert.equal(new Set(cov.map(c=>c.projectId)).size,29);
 const index=await read('content-source/learning/index.json');let lessons=0,steps=0;
 for(const p of index.projects)for(const meta of p.lessons){lessons++;const l=await read('content-source/'+meta.ref);assert.equal(l.status,'ready');assert.ok(l.steps.length>=3);for(const s of l.steps){steps++;assert.ok(s.explanation.length&&s.exercise.checklist.length&&s.codeRefs.length);assert.ok(s.outputRefs.every(ref=>s.outputTitles[ref]));}}
 assert.equal(lessons,30);assert.ok(steps>=350);
 for(const c of cov){assert.ok(c.transforms.length&&c.inputRefs.length&&c.resources.length);assert.equal(c.originalModelRerun,false);}
 assert.ok(cov.find(c=>c.projectId==='P07').blocked.some(b=>b.reason.includes('1_42')));
 assert.ok(cov.find(c=>c.projectId==='P14').blocked.some(b=>b.reason.includes('1_simplifyweibo.txt')));
});
test('sales exact amounts reconcile without binary-floating rounding',async()=>{
 const r=await resource('p21-v4-stores');const fixed=s=>BigInt(s.replace('.','').padEnd(s.includes('.')?s.indexOf('.')+5:s.length+5,'0'));
 const sum=r.rows.reduce((a,row)=>a+fixed(row[2]),0n);assert.equal(sum,2895006645n);
 assert.ok(Math.abs(r.rows.reduce((a,row)=>a+row[3],0)-1)<1e-12);
 assert.ok(r.context.inputs.every(i=>!i.path.endsWith('/order-14.1.csv')&&!i.path.endsWith('/order.csv')));
});
test('P17 computed k schemes each contain all 889 channels; original outputs stay original',async()=>{
 const r=await resource('p17-v4-counts');for(let k=2;k<=7;k++)assert.equal(r.rows.filter(x=>x[0]===String(k)).reduce((n,x)=>n+x[2],0),889);
 assert.equal(r.context.modelRerun,true);assert.equal((await resource('p17-counts')).context.identity,'original-saved');
 const means=await resource('p17-v4-means');assert.equal(means.rows.length,27);assert.match(means.context.note,/mean/);
});
test('P23 independent test probabilities reproduce AUC by rank and threshold confusion counts',async()=>{
 const r=await resource('p23-v4-probabilities');assert.equal(r.rows.length,7596);assert.equal(r.context.identity,'teaching-adaptation');
 const actual=thresholdMetrics(r.rows,.5);assert.deepEqual([actual.tn,actual.fp,actual.fn,actual.tp],[6702,6,886,2]);
 const ranked=[...r.rows].sort((a,b)=>a[1]-b[1]);let sum=0,pos=0;
 for(let i=0;i<ranked.length;){let end=i+1;while(end<ranked.length&&ranked[end][1]===ranked[i][1])end++;for(let j=i;j<end;j++)if(ranked[j][0]===1){sum+=(i+1+end)/2;pos++;}i=end;}
 const auc=(sum-pos*(pos+1)/2)/(pos*(ranked.length-pos));assert.ok(Math.abs(auc-cov.find(c=>c.projectId==='P23').checks.probabilityAUC)<1e-12);
 assert.equal(thresholdMetrics(r.rows,0).fn,0);assert.equal(thresholdMetrics(r.rows,1).precision,null);
 const c=cov.find(c=>c.projectId==='P23');assert.equal(c.models[0].trainTestIntersection,0);assert.equal(c.models[0].trainRows+c.models[0].testRows,25317);
 const roc=await resource('p23-v4-roc');assert.ok(roc.rows.every((r,i,a)=>!i||r[0]>=a[i-1][0]&&r[1]>=a[i-1][1]));
});
test('full-rank seasonal correction, age subset and LP streaming denominator are explicit',async()=>{
 const rank=await resource('p16-v4-rank');assert.equal(rank.rows.length,46);assert.ok(rank.rows.every(r=>r[1]===24&&r[2]===13&&r[3]===13));
 const ages=await resource('p26-v4-ages');assert.equal(ages.rows.length,31);assert.ok(ages.rows.every(r=>Math.abs(r[1]+r[2]+r[3]-1)<.0002));
 const lp=await resource('p08-v4-repayment');assert.equal(lp.rows.reduce((n,r)=>n+r[1],0),3203276);
 const prev=await resource('p08-v4-lp-preview');assert.equal(prev.rows.length,100);assert.equal(typeof prev.rows[0][0],'string');
 assert.ok(cov.find(c=>c.projectId==='P24').checks.holdoutR2<.1);
});
test('filter numerics, missing/zero and unchanged denominators; unsafe chart scripts rejected',async()=>{
 const rows=[[0,'A'],[2,'A'],[10,'B'],[null,'A']];assert.deepEqual(selectRows(rows,{from:'2',to:'10'}),[[2,'A'],[10,'B']]);assert.deepEqual(selectRows(rows,{column:0,value:'0'}),[[0,'A']]);
 const r=await resource('p21-v4-stores');assert.equal(selectRows(r.rows,{column:0,value:'CDLG'}).length,1);assert.match(r.chart.denominator,/28950.06645/);
 assert.equal(chartSchema.safeParse({...r.chart,formatter:'alert(1)'}).success,false);
 assert.equal(chartSchema.safeParse({...r.chart,type:'map'}).success,false);
 const bad=structuredClone(await resource('p23-v4-probabilities'));bad.context.modelRerun=false;assert.equal(resourceSchema.safeParse(bad).success,false);
});
test('every result/PNG has a verified build hash and every chart has a valid typed contract',async()=>{
 const m=await read('content-source/learning/build.json');let charts=0,images=0;
 for(const out of m.outputs){const bytes=await readFile(new URL('content-source/'+out.ref,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),out.sha256,out.ref);if(out.ref.endsWith('.png')){images++;assert.equal(bytes.subarray(1,4).toString(),'PNG');}else {const r=resourceSchema.parse(JSON.parse(bytes));if(r.chart){charts++;assert.ok(r.rows.length<=5000);assert.ok(r.chart.question&&r.chart.nullPolicy);}if(r.context.identity==='original-saved')assert.equal(r.context.modelRerun,false);}}
 assert.ok(charts>=70);assert.ok(images>=100);assert.equal(m.notebookExecution,false);assert.equal(m.sourceWrites,false);
});
