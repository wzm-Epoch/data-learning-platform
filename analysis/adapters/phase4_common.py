"""Reviewed offline exports. Never executes Notebook source or loads pickle/HTML scripts."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,platform,re,base64,sys
import numpy as np
import pandas as pd
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'analysis/vendor-phase4'))
SOURCE=Path(json.loads((ROOT/'local-config/paths.json').read_text(encoding='utf-8'))['sourceRoot'])
OUT=ROOT/'content-source/learning'
BUILD='phase4-v1';CREATED=datetime.now(timezone.utc).isoformat()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def save(ref,value):
 p=ROOT/'content-source'/ref;p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2),encoding='utf-8');return ref
def cleanrows(rows):return json.loads(pd.DataFrame(rows).to_json(orient='values',force_ascii=False,date_format='iso',double_precision=15))
def code_ref(path,nb,ci):
 c=''.join(nb['cells'][ci-1]['source'])
 return dict(path=path,notebookSha256=sha(SOURCE/path),cell=ci,code=c,codeSha256=hashlib.sha256(c.encode()).hexdigest())
class Project:
 def __init__(self,pid):
  self.id=pid;self.detail=read(ROOT/f'content-source/projects/{pid}/project.json');self.refs={};self.frames={};self.resources=[];self.outputs=[];self.checks={};self.blocks=[];self.models=[];self.transforms=[]
  for l in self.detail['lessons']:
   ref=next(r for r in self.detail['sourceRefs'] if r['path']==l['source']);self.verify(ref)
  self.nbpath=self.detail['lessons'][0]['source'];self.nb=read(SOURCE/self.nbpath)
 def verify(self,ref):
  path=SOURCE/ref['path'];assert sha(path)==ref['sha256'],f'原资产发生变化：{path}'
  self.refs[ref['path']]={'path':ref['path'],'sha256':ref['sha256']}
 def load(self,name=None,sheet=None,**kwargs):
  ds=next(d for d in self.detail['datasets'] if (name is None or Path(d['path']).name==name) and (sheet is None or d.get('sheet')==sheet))
  self.verify(ds);path=SOURCE/ds['path']
  if path.suffix.lower()=='.csv':df=pd.read_csv(path,encoding=ds.get('encoding') or 'utf-8-sig',**kwargs)
  else:df=pd.read_excel(path,sheet_name=sheet or ds.get('sheet') or 0,**kwargs)
  self.frames[ds['path']+'#'+str(ds.get('sheet'))]=df
  self.transforms.append({'input':ds['path'],'sheet':ds.get('sheet'),'readRows':len(df),'columns':[str(x) for x in df.columns],'missing':{str(k):int(v) for k,v in df.isna().sum().items()},'readerOptions':{k:str(v) for k,v in kwargs.items()}})
  return df
 def add(self,key,title,columns,rows,note,chart=None,identity='new-precomputed',unit='原字段单位；未核实单位不补填',sample=None,model=None,text=None,images=None,probabilities=False):
  safe=re.sub(r'[^a-zA-Z0-9_-]','_',key)
  if safe!=key:safe+='-'+hashlib.sha256(key.encode()).hexdigest()[:8]
  key=self.id.lower()+'-v4-'+safe;ref=f'learning/resources/{key}.json'
  obj={'schemaVersion':'1.0','id':key,'title':title,'kind':'image' if images else 'text' if text else 'table','columns':[str(c) for c in columns],'rows':cleanrows(rows),'text':text,'context':{'identity':identity,'buildId':BUILD,'createdAt':CREATED,'inputs':list(self.refs.values()),'note':note,'unit':unit,'sample':sample,'modelRerun':bool(model)}}
  if model:obj['context']['modelVersion']=model
  if chart:obj['chart']=chart
  if images:obj['images']=images
  if probabilities:obj['probabilities']=True
  save(ref,obj);self.resources.append(ref);self.outputs.append(ref);return ref
 def frame(self,key,title,df,note,**kwargs):return self.add(key,title,df.columns,df.values.tolist(),note,**kwargs)
 def chart(self,key,title,df,kind='bar',x=0,ys=None,note='',denominator='不涉及比率；展示原量或统计量',unit='原字段单位待核实',sample=None,filtercol=None,model=None,**extra):
  ys=ys or [1];d={'type':kind,'x':x,'ys':ys,'question':title,'xLabel':str(df.columns[x]),'yLabel':unit,'denominator':denominator,'range':sample or '当前输入已说明范围的全量聚合','filters':note or '无额外过滤','nullPolicy':'缺失为null，保留0；不连接缺失点','interpretation':extra.pop('interpretation','对照同源表读取差异；关联不能推出因果或样本外结论。')}
  if filtercol is not None:d['filterColumn']=filtercol
  d.update(extra)
  return self.frame(key,title,df,note or title,chart=d,unit=unit,sample=sample,model=model,identity='teaching-adaptation' if model else 'new-precomputed')
 def counts(self,df,col,key=None):
  v=df[col].fillna('未知（缺失）').astype(str).value_counts(dropna=False).rename_axis(col).reset_index(name='记录数')
  v['全量比例']=v['记录数']/len(df) if len(df) else None
  return self.chart(key or str(col),f'{col}：记录数与全量比例',v.head(50),note=f'全量{len(df)}行，最多展示前50类别；缺失单列，0是有效取值',denominator=f'当前输入全部{len(df)}行；隐藏类别不改变比例分母',filtercol=0,unit='记录数',ys=[1])
 def hist(self,df,col,key=None,bins=24):
  v=pd.to_numeric(df[col],errors='coerce').dropna();n,edges=np.histogram(v,bins=bins)
  assert int(n.sum())==len(v)
  return self.chart(key or str(col),f'{col}的全量等宽分布',pd.DataFrame({'区间（左闭右开，末箱右闭）':[f'{edges[i]:.6g}–{edges[i+1]:.6g}' for i in range(len(n))],'记录数':n}),kind='histogram',note=f'输入{len(df)}行，有效数值{len(v)}行，缺失/不可解析{len(df)-len(v)}行；{bins}等宽箱',unit='行')
 def scatter(self,df,x,y,key):
  valid=df[[x,y]].apply(pd.to_numeric,errors='coerce').dropna();idx=np.linspace(0,len(valid)-1,min(3000,len(valid)),dtype=int) if len(valid) else []
  v=valid.iloc[idx].copy();v['原行索引']=valid.iloc[idx].index.astype(str)
  return self.chart(key,f'{x}与{y}的关系',v,kind='scatter',note='只作关系探索；剔除两轴缺失，不修改输入',sample=f'有效{len(valid)}行，按原顺序等距索引取{len(v)}行（确定性展示，非随机样本）',unit='各轴采用原字段单位，未核实不换算')
 def corr(self,df,cols,key='correlation'):
  corr=df[cols].apply(pd.to_numeric,errors='coerce').corr();rows=[[a,b,None if pd.isna(corr.loc[a,b]) else float(corr.loc[a,b])] for a in cols for b in cols]
  return self.chart(key,'指定数值字段的Pearson相关',pd.DataFrame(rows,columns=['字段X','字段Y','r']),kind='heatmap',ys=[1,2],unit='无量纲',note='逐对有效观测；不把ID或名义类别编码纳入相关。')
 def saved(self,cells,key,title):
  parts=[];imgs=[]
  for ci in cells:
   for oi,o in enumerate(self.nb['cells'][ci-1].get('outputs',[])):
    if o.get('name')=='stderr':continue
    txt=''.join(o.get('text',[]) or o.get('data',{}).get('text/plain',[]))
    # No executable HTML, terminal install logs or absolute local paths in learning outputs.
    if txt and not txt.startswith('<') and not any(t in txt for t in ['Collecting ','Requirement already','Looking in indexes','C:\\','/site-packages/']):parts.append(f'原单元{ci}\n'+txt[:30000])
    png=o.get('data',{}).get('image/png')
    if png:
     ref=f'learning/assets/{self.id.lower()}-cell{ci}-{oi}.png';p=ROOT/'content-source'/ref;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(''.join(png) if isinstance(png,list) else png));imgs.append(ref);self.outputs.append(ref)
  refs=[]
  if parts:refs.append(self.add(key,title,[],[],'逐单元只读提取原文本；原运行时间未知，本次时间仅为提取时间。',identity='original-saved',text='\n\n'.join(parts)))
  if imgs:refs.append(self.add(key+'-images',title+' · 原保存图',[],[],'原图未经本次重跑；必须结合本步局限阅读，图片中的旧标注不代表本次认可。',identity='original-saved',images=imgs))
  return refs
 def base_data(self):
  # Read every supplied table independently; old outputs/dictionaries keep their source role.
  seen=set()
  for ds in self.detail['datasets']:
   if self.id=='P21' and not ds['path'].endswith('/order-14.3.csv'):continue
   key=ds['path']+'#'+str(ds.get('sheet'))
   if key in seen or key in self.frames:continue
   seen.add(key)
   if ds['rows']>500000:continue # explicit per-project streaming adapter handles LP
   try:self.load(Path(ds['path']).name,sheet=ds.get('sheet'))
   except (ImportError,ValueError) as e:self.blocks.append({'step':'附表读取','input':ds['path'],'reason':str(e)})
  rows=[]
  for path,df in self.frames.items():
   rows.append([path.split('/')[-1],len(df),len(df.columns),int(df.isna().sum().sum()),int(df.duplicated().sum())])
  return self.add('input-quality','本项目各输入表的读取与质量核对',['输入文件/工作表','读取行','列数','缺失单元格','完全重复行'],rows,'每张表分别统计；衍生表不当原始独立样本。人口多层表头在专属适配中另行解析。',unit='行 / 列 / 单元格')
