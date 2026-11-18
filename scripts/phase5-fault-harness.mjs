import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile('dist/index.html','utf8');
await writeFile('dist/phase5-storage-fault.js',`const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='da-learning:progress:v1')throw new DOMException('阶段5配额故障注入','QuotaExceededError');return set.call(this,k,v);};`);
await writeFile('dist/phase5-storage-failure.html',html.replace('<head>','<head><script src="/phase5-storage-fault.js"></script>'));
