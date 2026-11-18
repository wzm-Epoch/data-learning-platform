"""Read-only, reviewed phase-3 adapter. No notebook execution, network, or model training."""
from pathlib import Path
from decimal import Decimal
from datetime import datetime,timezone
import json,hashlib,re,csv,sys,platform
import pandas as pd
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
CFG=json.loads((ROOT/'local-config/paths.json').read_text(encoding='utf-8'))
SOURCE=Path(CFG['sourceRoot'])
OUT=ROOT/'content-source/learning';OUT.mkdir(parents=True,exist_ok=True)
BUILD='phase3-v1';CREATED=datetime.now(timezone.utc).isoformat()
def sha(path):
 with path.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def readj(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(ref,value):
 p=OUT/ref;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2),encoding='utf-8');return 'learning/'+ref
projects={x['id']:x for x in readj(ROOT/'content-source/projects.json')}
inputs={};notebooks={}
for id in ['P21','P11','P17']:
 detail=readj(ROOT/f'content-source/projects/{id}/project.json')
 for ref in detail['sourceRefs']:
  if ref['path'].endswith('.csv')or(ref['path'].endswith('.ipynb')and '.ipynb_checkpoints'not in ref['path']):
   path=SOURCE/ref['path'];assert sha(path)==ref['sha256'],f'原资产已变化: {path}'
   inputs[ref['path']]={'path':ref['path'],'sha256':ref['sha256']}
 for lesson in detail['lessons']:notebooks[(id,lesson['id'])]=(lesson['source'],readj(SOURCE/lesson['source']))
RESOURCES={};OUTPUTS=[]
def inputref(id,filename):
 return next(v for k,v in inputs.items()if k.startswith(projects[id]['originalNames'][0]+'/')and k.endswith('/'+filename))
def normalize(rows):return json.loads(pd.DataFrame(rows).to_json(orient='values',force_ascii=False,date_format='iso'))
def table(key,title,columns,rows,refs,note,identity='new-precomputed',unit='未知 / 原数据单位待核实',sample=None):
 obj={'schemaVersion':'1.0','id':key,'title':title,'kind':'table','columns':columns,'rows':normalize(rows),'text':None,'context':{'identity':identity,'buildId':BUILD,'createdAt':CREATED,'inputs':refs,'note':note,'unit':unit,'sample':sample,'modelRerun':False}}
 ref=save('resources/'+key+'.json',obj);RESOURCES[key]=ref;OUTPUTS.append({'ref':ref,'sha256':sha(OUT/'resources'/f'{key}.json')});return ref
def saved(key,title,id,lesson,cells):
 name,nb=notebooks[(id,lesson)];parts=[]
 for ci in cells:
  for o in nb['cells'][ci-1].get('outputs',[]):
   if o.get('name')=='stderr':continue
   txt=''.join(o.get('text',[])or o.get('data',{}).get('text/plain',[]))
   if txt and 'FutureWarning'not in txt and not txt.startswith('<'):
    parts.append(f'原单元 {ci}\n'+txt)
 obj={'schemaVersion':'1.0','id':key,'title':title,'kind':'text','columns':[],'rows':[],'text':'\n\n'.join(parts),'context':{'identity':'original-saved','buildId':BUILD,'createdAt':CREATED,'inputs':[inputs[name]],'note':'原Notebook保存输出，只读提取；未重跑，警告与环境路径未混作结果。','unit':'按原输出；未核实单位保留未知','sample':None,'modelRerun':False}}
 ref=save('resources/'+key+'.json',obj);RESOURCES[key]=ref;OUTPUTS.append({'ref':ref,'sha256':sha(OUT/'resources'/f'{key}.json')});return obj['text']
def frame(key,title,df,refs,note,**kwargs):return table(key,title,[str(x)for x in df.columns],df.values.tolist(),refs,note,**kwargs)
# P21 A: Decimal follows source strings, not formatted display values.
aRef=inputref('P21','order-14.3.csv');bRef=inputref('P21','order-14.1.csv');reportRef=inputref('P21','order.csv')
def sales_rows(ref):
 with (SOURCE/ref['path']).open(encoding='gb18030',newline='')as f:return list(csv.DictReader(f))
ar=sales_rows(aRef);br=sales_rows(bRef);aclean=[x for x in ar if any(x.values())];bclean=[x for x in br if any(x.values())]
amount=lambda row:Decimal(row['单价'])*Decimal(row['销量'])
total=sum((amount(x)for x in aclean),Decimal('0'));orders=len({x['订单ID']for x in aclean});assert len(ar)==3478 and orders==918 and total==Decimal('28950.06645')
a=pd.read_csv(SOURCE/aRef['path'],encoding='gb18030',dtype={'商品ID':str,'类别ID':str,'订单ID':str});a['成交时间']=pd.to_datetime(a['成交时间']);a['销售额']=a['单价']*a['销量']
table('p21-a-grain','明细与订单的不同粒度',['统计项','核对值'],[['明细行数',len(ar)],['不同订单ID数',orders],['日期范围',str(a['成交时间'].min())+' 至 '+str(a['成交时间'].max())]],[aRef],'全量只读核对。订单不是顾客人数。',unit='行 / 订单')
firstorder=aclean[0]['订单ID'];selected=[list(x.values())for x in aclean if x['订单ID']==firstorder]
table('p21-a-order','同一真实订单中的商品明细',list(aclean[0]),selected,[aRef],'仅展示输入第一条记录所属订单；保持原始顺序。',sample='按首条明细订单ID选取，非全量明细')
frame('p21-a-types','原文本与解析日期',[ ] if False else pd.DataFrame([['成交时间',aclean[0]['成交时间'],str(a['成交时间'].iloc[0]),str(a['成交时间'].dtype)],['订单ID',firstorder,firstorder,'字符串；不转为数值']],columns=['字段','原字符串','教学读取后值','读取后类型']),[aRef],'教学补充读取检查，原Notebook单元3使用parse_dates；未改原文件。',identity='teaching-adaptation')
for col,key in [('类别ID','category'),('商品ID','product')]:
 data=a.groupby(col,sort=True)['销量'].sum().sort_values(ascending=False).head(10).reset_index();frame('p21-a-'+key,'按'+col+'聚合的销量Top10',data,[aRef],'全量分组后取前10；ID名称与销量单位未知，不把不同计量商品合计解释为实物件数。')
store={}
for x in aclean:store[x['门店编号']]=store.get(x['门店编号'],Decimal(0))+amount(x)
table('p21-a-stores','门店金额与总额对账',['门店','原精度金额','全量金额占比'],[[k,str(v),float(v/total)]for k,v in sorted(store.items())]+[['总计',str(total),1.0]],[aRef],'金额=单价×销量；聚合不预先舍入，占比分母为全部3478条明细的金额。')
a['小时']=a['成交时间'].dt.hour;hour=a.groupby('小时').size().rename('明细条数').to_frame().join(a[['小时','订单ID']].drop_duplicates().groupby('小时').size().rename('小时内不同订单数')).reset_index();frame('p21-a-hour','小时内明细与订单计数',hour,[aRef],'按小时+订单ID去重。各小时订单数相加不保证等于全日不同订单数。',unit='行 / 订单')
# P21 B: current input has date-only midnight records; half-open is a methodological correction.
b=pd.read_csv(SOURCE/bRef['path'],encoding='gb18030',dtype={'订单ID':str});dt=pd.to_datetime(b['成交时间']);empty=int(b.isna().all(axis=1).sum());assert len(br)==3744 and empty==266 and len(bclean)==3478
frame('p21-b-quality','原报表输入的质量变化',pd.DataFrame([['物理行',len(b)],['七列全空',empty],['仅剔除全空行后',len(bclean)],['其余记录仍需独立核查',len(bclean)]],columns=['阶段','行数']),[bRef],'教学适配仅去除全空行，不更改原文件，不将全空行删除误说成原代码已有处理。',identity='teaching-adaptation',unit='行')
periods=[('本月累计','2018-02-01','2018-03-01','2018-02-28'),('上月同期','2018-01-01','2018-02-01','2018-01-31'),('去年同期','2017-02-01','2017-03-01','2017-02-28')]
periodRows=[];periodValues=[]
for title,start,end,last in periods:
 pick=[row for row in bclean if pd.Timestamp(start)<=pd.Timestamp(row['成交时间'])<pd.Timestamp(end)]
 val=sum((amount(x)for x in pick),Decimal(0));n=len({x['订单ID']for x in pick});avg=val/n if n else None;oldMask=(dt>=start)&(dt<=last);newMask=(dt>=start)&(dt<end)
 periodRows.append([title,start+' ≤ t < '+end,len(pick),int(oldMask.sum()),int((newMask&~oldMask).sum())]);periodValues.append((val,n,avg))
table('p21-b-periods','原筛选与半开区间核对',['期间','教学半开区间','半开区间行数','原代码闭区间行数','本文件新增纳入行数'],periodRows,[bRef],'本文件日期均为00:00，三期间本次边界修正新增均为0。不能把潜在月末遗漏说成本文件已发生。',identity='teaching-adaptation',unit='行')
safe_ratio=lambda x,y:None if y is None or y==0 or x is None else float(x/y-1)
metricRows=[]
for i,name in enumerate(['金额（单位未知）','订单量（去重ID）','平均每订单金额']):
 vals=[x[i]for x in periodValues];metricRows.append([name]+[str(v)if isinstance(v,Decimal)else v for v in vals]+[safe_ratio(vals[0],vals[1]),safe_ratio(vals[0],vals[2])])
table('p21-b-report','本次重算月度对比',['指标','2018-02','2018-01','2017-02','环比（比例）','同比（比例）'],metricRows,[bRef],'本次只读预计算；订单量不称客流；本月为原分析指定期间，不是今天。比较天数不同，未调整营业日。',identity='teaching-adaptation')
zero_pick=[row for row in bclean if pd.Timestamp('2019-01-01')<=pd.Timestamp(row['成交时间'])<pd.Timestamp('2019-02-01')]
zero_amount=sum((amount(x)for x in zero_pick),Decimal(0));zero_orders=len({x['订单ID']for x in zero_pick});zero_average=zero_amount/zero_orders if zero_orders else None
table('p21-b-zero','输入范围以外期间的分母检查',['期间','行数','订单量','金额','每订单金额','相对空期间增长率'],[['2019-01（当前文件无记录）',len(zero_pick),zero_orders,str(zero_amount),None if zero_average is None else str(zero_average),safe_ratio(periodValues[0][0],zero_amount)]],[bRef],'确定性筛选无记录期间；分母0显示不可计算。它不是模拟数据或新经营观测。',identity='teaching-adaptation')
attached=pd.read_csv(SOURCE/reportRef['path'],encoding='utf-8-sig');frame('p21-b-attached','原附order.csv（只读提取）',attached,[reportRef],'附带结果，非原始明细；保留原“客流量”行名，但教学解释为订单量。',identity='original-saved')
for j,row in attached.iterrows():
 for col,i in [('本月累计',0),('上月同期',1),('去年同期',2)]:assert abs(float(row[col])-float(periodValues[i][j]))<1e-8
# P11: reviewed deterministic EDA, preserve the anomaly, never guess its true area.
hRef=inputref('P11','shenzhen.csv');h=pd.read_csv(SOURCE/hRef['path'],encoding='utf-8-sig');anomaly=h[h.hourseSize>10000];clean=h.loc[h.hourseSize<=10000].copy();assert len(h)==18907 and len(anomaly)==1 and float(anomaly.hourseSize.iloc[0])==10871
frame('p11-preview','历史挂牌样本前12行',h[['Unnamed: 0','area','hourseType','hourseSize','total_price','unit_price']].head(12),[hRef],'固定原顺序前12行；非全量分布或随机抽样。',sample='前12行，保留原行ID')
frame('p11-fields','12列读取质量',pd.DataFrame({'字段':h.columns,'读取类型':[str(x)for x in h.dtypes],'缺失数':h.isna().sum().values}),[hRef],'全量读取统计。原始字段hourse拼写保留，不偷偷重命名。',unit='条')
frame('p11-anomaly','调查原异常记录',anomaly[['Unnamed: 0','area','hourseType','hourseSize','total_price','unit_price']],[hRef],'原行ID12546，面积10871触发原代码>10000规则；不能推定真实面积为108.71。')
frame('p11-change','剔除前后对照',pd.DataFrame([['原输入',len(h),h.hourseSize.mean()],['按原规则面积≤10000',len(clean),clean.hourseSize.mean()]],columns=['阶段','行数','面积均值（原字段单位）']),[hRef],'在新适配层按原单元10规则计算；原异常保留在独立快照。',identity='teaching-adaptation')
frame('p11-area','按区域的挂牌记录聚合',clean.groupby('area').agg(挂牌行数=('area','size'),平均总价=('total_price','mean'),平均单价=('unit_price','mean')).reset_index(),[hRef],'剔除1条原规则异常后聚合；价格单位未独立核实，不照抄原文错误量级。')
structure=[]
for col in ['hourseType','fitment','direction']:
 for value,n in clean[col].value_counts().head(10).items():structure.append([col,str(value),int(n),float(n/len(clean))])
table('p11-structure','户型、装修与朝向的频数',['字段','原类别','记录数','占清洗后全部挂牌行比例'],structure,[hRef],'每维展示前10类别；分别统计、不可跨维相加；采用明确分母。',unit='条 / 比例')
frame('p11-relation','面积与总价的确定性明细',clean[['Unnamed: 0','hourseSize','total_price']].head(20),[hRef],'前20行用于对照字段；不能从这20行概括全部关系。完整散点图留第四阶段。',sample='清洗后前20行')
frame('p11-correlation','清洗后全量面积与总价相关',pd.DataFrame([['Pearson',len(clean),clean.hourseSize.corr(clean.total_price)]],columns=['方法','样本行数','相关系数']),[hRef],'本次全量描述性统计；相关关系不能解释为面积造成房价变化。')
# P17: preprocessing only. Keep model outputs as saved, do not invent missing label assignments.
adRef=inputref('P17','ad_performance.csv');ad=pd.read_csv(SOURCE/adRef['path'],encoding='utf-8-sig');assert ad.shape==(889,13)
frame('p17-preview','渠道原始记录前10行',ad.head(10),[adRef],'固定原顺序前10行；不把渠道代号当数值距离特征。',sample='前10行')
frame('p17-missing','字段缺失核对',pd.DataFrame({'字段':ad.columns,'缺失数':ad.isna().sum().values}),[adRef],'平均停留时间2处缺失；原单元24直接删除该列，未做插补。',unit='条')
ad2=ad.drop(columns=['平均停留时间']);cols=['素材类型','广告类型','合作方式','广告尺寸','广告卖点'];onehot=pd.get_dummies(ad2[cols],dtype=int);nums=ad2.iloc[:,1:7];scaled=(nums-nums.min())/(nums.max()-nums.min());assert nums.notna().all().all(), '六个数值特征有未处理缺失，停止导出'
scaled=scaled.fillna(0)
assert onehot.shape==(889,27)and nums.shape==(889,6)
frame('p17-encoding','实际独热编码的前5行',onehot.head(),[adRef],'教学适配用pandas固定列序生成27个0/1列；原OneHotEncoder输出列序需按各自类别顺序理解，不把任意编号当距离。',identity='teaching-adaptation',sample='前5行，27列')
scaleRows=[]
for col in nums:
 for i in range(2):scaleRows.append([i,str(ad.iloc[i]['渠道代号']),col,float(nums.iloc[i][col]),float(nums[col].min()),float(nums[col].max()),float(scaled.iloc[i][col])])
table('p17-scale','六数值特征的MinMax对照',['原行','渠道','字段','原值','全量最小','全量最大','缩放后'],scaleRows,[adRef],'本次确定性预处理；(x-min)/(max-min)。六数值特征加27独热列，共33维；未运行KMeans。',identity='teaching-adaptation')
scoretext=saved('p17-scores-saved','原保存k搜索结果','P17','main-analysis',[35]);pairs=re.findall(r'\[\s*([2-7])\.\s+([0-9.]+)\s*\]',scoretext);assert len(pairs)==6
name,nb=notebooks[('P17','main-analysis')];nbref=inputs[name]
table('p17-scores','原保存轮廓系数（非本次训练）',['k','原保存系数（显示精度）'],[[int(k),float(v)]for k,v in pairs],[nbref],'仅解析原单元35输出，未重训；原未固定随机种子。',identity='original-saved',unit='k / 无量纲')
counttext=saved('p17-counts-saved','原保存簇数量与比例','P17','main-analysis',[41]);m=re.search(r'counts\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',counttext);counts=[int(x)for x in m.groups()];assert sum(counts)==len(ad)
table('p17-counts','按原簇ID对齐的保存数量',['原簇ID','数量','按保存数量确定性计算比例'],[[i,n,n/sum(counts)]for i,n in enumerate(counts)],[nbref],'0→73，1→154，2→313，3→349。比例由原保存数量除889，不是本次聚类。',identity='original-saved',unit='渠道 / 比例')
saved('p17-profile-saved','原保存画像数值（实际为标准差）','P17','main-analysis',[43,45])
table('p17-profile-audit','画像审辨的可验证边界',['问题','原代码或证据','教学解释'],[['数值统计量','part1_desc.iloc[2, :]','describe第2位置为std，不是mean；原注释写均值错误'],['编号对应','原单元41/43保存0,1,2,3簇数量73,154,313,349','原单元48/50的顺序和描述错位，不能直接照抄'],['中心均值','缺少完整逐行标签和原聚类中心导出','本阶段不补造逐簇均值、中心或预测标签'],['ROI','原数据无完整成本收益字段','合作方式roi是类别值，不能据此证明投入产出效果']],[nbref,adRef],'教学审辨；原保存雷达与数值表不能作为真实均值中心图。',identity='teaching-adaptation',unit='不适用')
# Course package assembly from reviewed editorial specs.
specs=readj(ROOT/'content-source/curriculum/representative-lessons.json');index={'schemaVersion':'1.0','contentVersion':'0.3.0','projects':[]}
def code_ref(id,lid,ci):
 name,nb=notebooks[(id,lid)];code=''.join(nb['cells'][ci-1]['source']);assert nb['cells'][ci-1]['cell_type']=='code'
 return {'path':name,'notebookSha256':inputs[name]['sha256'],'cell':ci,'code':code,'codeSha256':hashlib.sha256(code.encode('utf-8')).hexdigest()}
for project in readj(ROOT/'content-source/registry.json'):
 id=project['id'];old=readj(ROOT/f'content-source/projects/{id}/project.json');item={'id':id,'lessons':[]}
 for lesson in old['lessons']:
  lid=lesson['id'];spec=next((x for x in specs if x['projectId']==id and x['id']==lid),None)
  if spec:
   steps=[]
   for x in spec['steps']:
    refs=[inputref(id,n) for n in x['inputFiles']];steps.append({k:v for k,v in x.items()if k not in ['cells','inputFiles','outputs']}|{'status':'ready','codeRefs':[code_ref(id,lid,c)for c in x['cells']],'inputRefs':refs,'outputRefs':[RESOURCES[k]for k in x['outputs']]})
   course={'schemaVersion':'1.0','contentVersion':'0.3.0','projectId':id,'id':lid,'title':lesson['title'],'status':'ready','steps':steps}
  else:
   titles=project['searchKeywords'];course={'schemaVersion':'1.0','contentVersion':'0.3.0','projectId':id,'id':lid,'title':lesson['title'],'status':'planned','steps':[{'id':f'planned-{i+1:02d}','title':title,'status':'planned'}for i,title in enumerate(titles)]}
  ref=save(f'projects/{id}/{lid}.json',course);item['lessons'].append({'id':lid,'title':lesson['title'],'status':course['status'],'ref':ref,'steps':[{'id':s['id'],'title':s['title'],'status':s['status']}for s in course['steps']]})
 index['projects'].append(item)
save('index.json',index)
manifest={'schemaVersion':'1.0','buildId':BUILD,'createdAt':CREATED,'adapterSha256':sha(Path(__file__)),'editorialSha256':sha(ROOT/'content-source/curriculum/representative-lessons.json'),'environment':{'python':platform.python_version(),'pandas':pd.__version__,'numpy':np.__version__},'inputs':list(inputs.values()),'outputs':OUTPUTS,'status':'success','modelTrainingExecuted':False,'notebookExecution':False,'sourceWrites':False,'checks':{'aRows':len(ar),'aOrders':orders,'aExactAmount':str(total),'bRows':len(br),'bAllEmpty':empty,'bCleanRows':len(bclean),'bPeriods':[[str(v),n,str(avg)]for v,n,avg in periodValues],'bAttachedResultMatches':True,'p11Rows':len(h),'p11CleanRows':len(clean),'p17Rows':len(ad),'p17OneHotColumns':onehot.shape[1],'p17FeatureColumns':onehot.shape[1]+nums.shape[1],'p17SavedCounts':counts,'p17SavedProfileStatistic':'std, not mean'}}
save('build.json',manifest);(ROOT/'docs/stages/phase-03-precompute.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest['checks'],ensure_ascii=False));print('Ready lessons',sum(l['status']=='ready'for p in index['projects']for l in p['lessons']),'steps',sum(len(l['steps'])for p in index['projects']for l in p['lessons']if l['status']=='ready'))
