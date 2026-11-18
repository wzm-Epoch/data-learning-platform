import { z } from 'zod';
const treeNode=z.lazy(()=>z.object({name:z.string().min(1),value:z.number().finite(),children:z.array(treeNode)}).strict());
export const chartSchema=z.object({
 type:z.enum(['bar','line','scatter','histogram','boxplot','heatmap','map','radar','tree','roc','table']),
 x:z.number().int().nonnegative(), ys:z.array(z.number().int().nonnegative()).min(1),
 question:z.string().min(1), xLabel:z.string().min(1), yLabel:z.string().min(1),
 denominator:z.string().min(1), range:z.string().min(1), filters:z.string().min(1),
 nullPolicy:z.string().min(1), interpretation:z.string().min(1),
 filterColumn:z.number().int().nonnegative().optional(),
 tree:treeNode.optional(),
 fallback:z.literal('bar').optional(),
}).strict().superRefine((c,ctx)=>{
 if(c.type==='tree'&&!c.tree)ctx.addIssue({code:'custom',message:'树图需要受控节点数据'});
 if(c.type==='heatmap'&&c.ys.length!==2)ctx.addIssue({code:'custom',message:'热力图需要类别列与数值列'});
 if(c.type==='boxplot'&&c.ys.length!==5)ctx.addIssue({code:'custom',message:'箱线图需要五数概括'});
 if(c.type==='map'&&c.fallback!=='bar')ctx.addIssue({code:'custom',message:'地图无本地核验资源，必须声明同源条形降级'});
});
export function selectRows(rows,{column,value,from='',to='',x=0}={}){
 const compare=(v,b)=>typeof v==='number'&&b.trim()!==''&&Number.isFinite(Number(b))?v-Number(b):String(v).localeCompare(b,undefined,{numeric:true});
 return rows.filter(r=>(column===undefined||!value||String(r[column]??'缺失')===value)&&(!from||r[x]!==null&&compare(r[x],from)>=0)&&(!to||r[x]!==null&&compare(r[x],to)<=0));
}
export function thresholdMetrics(rows,threshold){
 let tn=0,fp=0,fn=0,tp=0;
 for(const [actual,probability] of rows){if(probability>=threshold){if(actual===1)tp++;else fp++;}else if(actual===1)fn++;else tn++;}
 return {tn,fp,fn,tp,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,accuracy:rows.length?(tp+tn)/rows.length:null};
}
