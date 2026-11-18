"""Project-specific transformations, never executed from Notebook text."""
import pandas as pd
import numpy as np
import re,ast,io,json
from pathlib import Path
from phase4_common import *
def grouped_rate(p,d,col,target,key):
 g=d.groupby(col,dropna=False)[target].agg(['size','sum','mean']).reset_index();g.columns=[col,'分母行数','正类行数','组内正类比例']
 p.chart(key,f'{col}的组内{target}比例',g,x=0,ys=[3],filtercol=0,note='先在完整输入分组后计算sum/size；图例/类别筛选不重定义各组分母',unit='比例0—1',denominator='同一分组全部有效标签记录数')
def box(p,d,group,value,key,unit):
 rows=[]
 for name,g in d.groupby(group,dropna=False):
  v=pd.to_numeric(g[value],errors='coerce').dropna()
  if len(v):rows.append([str(name)]+v.quantile([0,.25,.5,.75,1]).tolist())
 p.chart(key,f'{group}的{value}五数概括',pd.DataFrame(rows,columns=[group,'最小','Q1','中位数','Q3','最大']),kind='boxplot',ys=[1,2,3,4,5],unit=unit,note='须端使用全量min/max，不是Tukey 1.5IQR异常值规则；缺失不作0')
def p01(p):
 d=p.load();assert len(d)==284807 and int(d.Class.sum())==492;p.counts(d,'Class');p.hist(d,'Amount');p.hist(d,'Time');box(p,d,'Class','Amount','class-amount','原Amount单位未核实')
 p.checks.update(rows=len(d),frauds=int(d.Class.sum()),classSum=int(d.Class.value_counts().sum()))
def p02(p):
 d=p.load();assert (d['casual']+d.registered==d['count']).all();d['小时']=pd.to_datetime(d.datetime).dt.hour
 g=d.groupby('小时')['count'].mean().reset_index(name='该小时观测的平均租赁数');p.chart('hour','租赁日内分布',g,kind='line',unit='租赁数量',note='不同日期同小时平均，不把随机切分成绩当未来时序预测')
 p.hist(d,'windspeed');q1,q3=d.windspeed.quantile([.25,.75]);mask=(d.windspeed<q1-1.5*(q3-q1))|(d.windspeed>q3+1.5*(q3-q1));fixed=d.windspeed.mask(mask,d.windspeed.median())
 p.add('wind-change','风速IQR替换的可追溯变化',['阶段','行数','被替换行数','均值'],[['原表',len(d),0,float(d.windspeed.mean())],['描述性教学复核',len(d),int(mask.sum()),float(fixed.mean())]],'按原IQR思路在副本描述性计算；预测任务必须只在训练集拟合阈值，不将全量处理当无泄漏评估。')
 p.corr(d,['temp','atemp','humidity','windspeed','count']);p.checks['compositionRows']=len(d)
def p03(p):
 from sklearn.cluster import KMeans
 d=p.load('air_data.csv');c=p.load('data_cleaned.csv');z=p.load('data_stand.csv');X=z[['zR','zF','zM','zC','zL']]
 m=KMeans(n_clusters=5,n_init=10,random_state=100).fit(X);version='P03-attached-standardized-k5-v1'
 p.models.append({'version':version,'input':'原附data_stand.csv五标准化字段，不声称本次重建全部LRFMC','seed':100,'k':5,'n_init':10,'fitRows':len(X)})
 p.chart('cluster-sizes','原附标准化表的新版本五群规模',pd.Series(m.labels_).value_counts().sort_index().rename_axis('新簇ID').reset_index(name='会员行数'),model=version,unit='会员记录',note='新簇编号不与原图客户名称直接绑定')
 center=pd.DataFrame(m.cluster_centers_.T,columns=[f'新簇{i}' for i in range(5)]);center.insert(0,'标准化指标',X.columns)
 p.chart('centers','五群标准化中心对照',center,kind='radar',ys=[1,2,3,4,5],unit='Z-score，无量纲',model=version,note='基于原附衍生标准化表重新聚类；负值表示低于原标准化均值')
 p.add('cleaning','原表与原附清洗表的行数差',['表','行数'],[['原表',len(d)],['原附清洗表',len(c)],['差额',len(d)-len(c)]],'只读比较原附表，完整清洗规则见原单元8；不声称仅靠行数证明逐行一致。',identity='teaching-adaptation',unit='行')
 p.checks.update(raw=len(d),attachedClean=len(c),standardized=len(X),newClusterSum=int(len(m.labels_)))
def p04(p):
 d=p.load();assert sorted(d.arrival_date_year.unique().tolist())==[2015,2016,2017]
 for col in ['hotel','market_segment','is_repeated_guest','deposit_type']:grouped_rate(p,d,col,'is_canceled',col)
 p.counts(d,'arrival_date_year');p.hist(d,'lead_time');p.checks['actualYears']=[2015,2016,2017]
def p05(p):
 d=p.load();c=d[d['销量']!=0].copy();assert len(d)==2443 and len(c)==2320
 p.add('zero-rule','零销量过滤前后',['规则','行数'],[['原输入',len(d)],['销量==0',len(d)-len(c)],['销量!=0',len(c)]],'按原规则副本过滤；无销量记录仍是实际输入，不能称无效真值。',unit='行')
 p.chart('top','景点销量前20',c.sort_values('销量',ascending=False)[['名称','销量','城市','价格']].head(20),note='过滤销量0后排序；景点售卖样本，不代表全国出游人数',unit='原销量单位',filtercol=2)
 p.counts(c,'星级');p.hist(c,'价格');g=c.groupby('城市')['销量'].sum().reset_index();p.chart('region','地区标签下的样本销量',g,kind='map',fallback='bar',unit='原销量单位',note='未核验本地地图；保留原地区文字，使用同源条形图')
 p.checks.update(raw=len(d),nonzero=len(c),zero=len(d)-len(c))
def p06(p):
 d=p.load('athlete_events.csv');noc=p.load('noc_regions.csv');assert noc.NOC.is_unique
 merged=d.merge(noc,on='NOC',how='left',validate='many_to_one');assert len(merged)==len(d)
 medal=merged.dropna(subset=['Medal']).drop_duplicates(['Year','Season','region','Medal','Event'])
 g=medal.groupby(['Season','region']).size().rename('按国家赛事奖牌去重数').reset_index();g=g.sort_values('按国家赛事奖牌去重数',ascending=False).groupby('Season',group_keys=False).head(20)
 p.chart('medals','按国家、届次、项目去重的奖牌计数',g,x=1,ys=[2],filtercol=0,unit='原项目赛事口径的奖牌数',note='按Year/Season/region/Medal/Event去重；团体只计一次，可能同赛事同国多获奖者，故不冒充官方完整奖牌榜')
 g=merged.groupby(['Season','Year'])['ID'].nunique().reset_index(name='不同运动员ID数');p.chart('athletes','夏冬奥历年参赛运动员数',g,kind='line',x=1,ys=[2],filtercol=0,unit='运动员ID',note='按ID去重；同一运动员不同届可重复参赛，不是生涯总人数')
 f=merged.drop_duplicates(['Season','Year','ID']);g=f.groupby(['Season','Year']).Sex.agg(总人数='size',女性人数=lambda s:int((s=='F').sum())).reset_index();g['女性比例']=g.女性人数/g.总人数
 p.chart('female','历届女性参赛比例',g,kind='line',x=1,ys=[4],filtercol=0,unit='比例0—1',denominator='同Season和Year的不同ID数',note='先按届次与运动员ID去重再算比例')
 p.checks.update(mergeRows=len(merged),inputRows=len(d),nocUnique=True)
def p07(p):
 from PIL import Image
 d=p.load('moment.csv');p.counts(d,'类别');features=list(d.columns[2:]);p.frame('moments','实际训练支路的九颜色特征前20行',d.head(20),'固定原顺序前20；moment与picData支路不能未经核对合并。',sample='前20/203行')
 imagefiles=[r for r in p.detail['sourceRefs'] if r['path'].lower().endswith('.jpg')]
 missing=[]
 for _,row in d.iterrows():
  name=f'{int(row.iloc[0])}_{int(row.iloc[1])}.jpg'
  if not any(Path(r['path']).name==name for r in imagefiles):missing.append(name)
 assert len(imagefiles)==199 and len(missing)==4
 p.blocks.append({'step':'全量图像到moment特征端到端','reason':'203行特征仅附199图；缺失'+','.join(missing)+'；两特征支路未证实一一对应'})
 imgs=[]
 for ref in imagefiles[:3]:
  p.verify(ref);im=Image.open(SOURCE/ref['path']);out=f'learning/assets/p07-source-{len(imgs)}.png';im.save(ROOT/'content-source'/out);imgs.append(out);p.outputs.append(out)
 p.add('photos','附带水色照片的只读格式转换',[],[],'按原资产顺序前3张，原JPEG解码为本地PNG用于预览；不补缺失图，不声称生成训练预测。',images=imgs,identity='teaching-adaptation',sample='原资产顺序前3张 / 附带199张照片')
 for name in ['train.xlsx','test.xlsx']:
  cm=p.load(name);vals=cm.iloc[:,1:].apply(pd.to_numeric);assert vals.shape==(5,5)
  p.chart(name.split('.')[0]+'-matrix','原附'+name+'矩阵',pd.DataFrame([[str(cm.columns[j+1]),str(cm.iloc[i,0]),int(vals.iloc[i,j])] for i in range(5) for j in range(5)],columns=['预测类别列','实际类别行','计数']),kind='heatmap',ys=[1,2],unit='样本',note='原附结果表，只读重绘；SVM未重跑。原表行列顺序按物理表保留')
  r=read(ROOT/'content-source'/p.resources[-1]);r['context']['identity']='original-saved';save(p.resources[-1],r)
 p.checks.update(features=len(d),photos=len(imagefiles),missing=missing)
def p08(p):
 from collections import Counter
 lc=p.load('LC.csv');p.counts(lc,'初始评级');p.hist(lc,'借款金额');d=lc.copy();d['借款日期']=pd.to_datetime(d['借款成功日期']).dt.strftime('%Y-%m')
 p.chart('monthly','LC按成功月份汇总借款金额',d.groupby('借款日期')['借款金额'].sum().reset_index(),kind='line',unit='原借款金额单位',note='仅LC每支标记录，未合计LCIS多期快照')
 ds=next(d for d in p.detail['datasets'] if d['path'].endswith('/LP.csv'));p.verify(ds);counts=Counter();n=0;missing=0;preview=None
 for chunk in pd.read_csv(SOURCE/ds['path'],encoding=ds['encoding'],chunksize=100000,dtype={'ListingId':str}):
  n+=len(chunk);missing+=int(chunk.isna().sum().sum());counts.update(chunk['还款状态'].fillna('未知（缺失）').astype(str))
  if preview is None:preview=chunk.head(100)
 assert n==3203276 and sum(counts.values())==n
 p.chart('repayment','LP全量还款状态的流式计数',pd.DataFrame(sorted(counts.items()),columns=['原还款状态码','期次记录数']),unit='期次记录',note='全量逐块读取10万行；状态码不假设连续量，不按借款人计数')
 p.frame('lp-preview','LP固定原顺序前100行',preview,'ListingId按字符串；首页不载入。仅预览，不代表总体分布。',sample='前100/3203276行')
 p.transforms.append({'input':ds['path'],'readRows':n,'chunkSize':100000,'missingCells':missing,'aggregation':'value_counts(还款状态,dropna=False)','preview':'first100','noLCISAmountSum':True})
 p.checks.update(lpRows=n,lpCountSum=sum(counts.values()),previewRows=len(preview));p.blocks.append({'step':'原复杂还款收益流程独立复现','reason':'已开放原保存代码/图及全量安全聚合；原多表回款收益计算未完整重跑，不将快照金额直接求和'})
def p09(p):
 d=p.load();p.scatter(d,'hourseSize','total_price','price-area');p.counts(d,'area');g=d.groupby('area').unit_price.mean().reset_index(name='原单价均值')
 p.chart('region-price','原地区标签下的挂牌单价均值',g,kind='map',fallback='bar',note='当前附带历史CSV；不发网络请求，未核实货币单位时不换算',unit='原单价单位')
 p.blocks.append({'step':'重新联网采集','reason':'离线主线使用本地shenzhen.csv，当前采集网站与可用性未验证；联网步骤仅供阅读'})
def p10(p):
 d=p.load();c=d.copy();c['建筑面积']=pd.to_numeric(c['建筑面积'].astype(str).str.replace('平米','',regex=False),errors='coerce');c['房屋总价']=pd.to_numeric(c['房屋总价'].astype(str).str.replace('万','',regex=False),errors='coerce')
 room=c['户型'].str.extract(r'(\d+)室(\d+)厅(\d+)卫').astype(float);c=c.join(room.rename(columns={0:'室',1:'厅',2:'卫'}));before=len(c);c=c.dropna(subset=['室','厅','卫','建筑面积','房屋总价']);p.scatter(c[c.建筑面积<=300],'建筑面积','房屋总价','area-price')
 p.add('cleaning','户型解析与面积筛选',['阶段','行数'],[['原表',before],['关键字段可解析',len(c)],['原规则面积≤300',int((c.建筑面积<=300).sum())]],'户型按原正则；只在副本处理，OLS原保存置信区间应读为95%区间。',unit='行');p.counts(c,'装修')
def p12(p):
 d=pd.concat([p.load(f'考研历年国家分数线({i}).csv') for i in range(1,7)],ignore_index=True);c=d.drop_duplicates().dropna(how='any');assert len(d)==100864 and len(c)==100563
 p.counts(c,'年份');v=c[c['年份']==2020].copy();v['总分数值']=pd.to_numeric(v['总分'],errors='coerce');p.hist(v,'总分数值');g=v.groupby('专业名称').agg(记录数=('总分数值','size'),有效总分数=('总分数值','count'),有效总分均值=('总分数值','mean')).sort_values('记录数',ascending=False).head(20).reset_index()
 p.chart('major','2020专业样本记录数',g,note='院校专业层级；总分“-”保留缺失，不按原代码补成0；不能称全国统一分数线',unit='记录')
 info=p.load('大学信息2021new.xlsx');adj=p.load('考研调剂数据-3.08.xlsx');p.add('join-audit','学校关联前的重复键检查',['表','行数','school非唯一行数'],[['学校信息',len(info),int(info.school.duplicated(keep=False).sum())],['调剂信息',len(adj),int(adj.school.duplicated(keep=False).sum())]],'关联键非唯一可能扩行；不把多对多合并后行数当新增学校。',unit='行');p.checks.update(raw=len(d),clean=len(c))
def p13(p):
 d=p.load('票房榜.xlsx');p.counts(d,'榜单类别');v=d.copy();v['票房原值']=pd.to_numeric(v['票房'],errors='coerce');v=v.sort_values(['榜单类别','排名']).groupby('榜单类别').head(20)
 p.chart('ranking','各榜单电影票房原值',v[['电影','票房原值','榜单类别','排名']],filtercol=2,unit='原票房值（原代码除1亿前）',note='150行有跨榜电影；筛选榜单后比较，不把各榜相加称市场总票房')
 dt=p.load('电影票房三十日时段详情.xlsx');dt['日期']=pd.to_datetime(dt['日期']).dt.strftime('%Y-%m-%d');names=dt['电影'].drop_duplicates().head(10);g=dt[dt['电影'].isin(names)].sort_values(['电影','日期'])[['日期','当前票房','电影']]
 p.chart('daily','原附前10部电影的逐日票房',g,kind='line',filtercol=2,unit='原当前票房值',note='按原出现顺序选择10部，必须选择影片后阅读；不同影片不是同一连续曲线',sample='原附影片顺序前10部的全部日期记录');p.checks.update(rankingRows=len(d),distinctMovieIDs=int(d.EnMovieID.nunique()))
def p14(p):
 d=p.load();p.counts(d,'type');d['字符数']=d.text.fillna('').str.len();p.hist(d,'字符数')
 from sklearn.feature_extraction.text import CountVectorizer
 # The CSV is not tokenized. Character bigrams are explicitly a new descriptive variant.
 vect=CountVectorizer(analyzer='char',ngram_range=(2,2),min_df=4,max_df=.9,max_features=30000);X=vect.fit_transform(d.text.fillna(''))
 values=np.asarray(X.sum(axis=0)).ravel();idx=np.argsort(-values,kind='stable')[:30];p.chart('tokens','现成CSV的字符二元组频次（非分词）',pd.DataFrame({'字符二元组':vect.get_feature_names_out()[idx],'出现次数':values[idx]}),note='教学描述版本：字符相邻二元组，不是Jieba词频或原模型重现；min_df=4表示至少4篇文档出现',unit='字符二元组次数')
 p.blocks.append({'step':'原文转CSV','reason':'代码引用1_simplifyweibo.txt缺失；不以4_simplifyweibo.txt替代；现成data.csv后续步骤可学'})
 p.checks.update(csvRows=len(d),labels={str(k):int(v) for k,v in d.type.value_counts().items()},sparseShape=list(X.shape))
def p15(p):
 d=p.load('春节档-电影票房表现概览.xlsx');p.chart('totals','春节档影片累计票房原值',d[['电影','累计票房']],unit='原累计票房值',note='保留原值；不把未核验xls“/万”列再次任意缩放')
 dt=p.load('春节档-票房详情.xlsx');dt['日期']=pd.to_datetime(dt['日期']).dt.strftime('%Y-%m-%d');p.chart('daily','附带票房详情的真实日期范围',dt[['日期','票房']],kind='line',note='展示底表全部日期，未自动称为七天春节档',unit='原票房值')
 reg=p.load('春节档-排片地域分布（场次）-top10影片.xlsx');reg=reg[~reg.电影.isin(['CLevel','CityLevel'])].copy();reg['场次']=pd.to_numeric(reg.场次,errors='coerce');g=reg.groupby(['城市','电影']).场次.sum(min_count=1).reset_index();p.chart('city-level','按原城市等级比较电影场次',g,x=1,ys=[2],filtercol=0,unit='场次',note='城市列实际是等级；剔除CLevel/CityLevel元记录，不伪造具体城市地图')
 p.blocks.append({'step':'旧xls票房单位解释','reason':'表头“/万”与原除数/改名存在矛盾；已开放原物理值与代码，不能给出未经核实单位的换算结论'})
def p16(p):
 import statsmodels.api as sm
 d=p.load();d['月份']=d.year_month.astype(str).str[-2:];d['每500克价格']=d.price/2
 p.chart('time','各农产品月价格（按原注释元/公斤除2）',d.assign(年月=d.year_month.astype(str)).sort_values(['product','年月'])[['年月','每500克价格','product']],kind='line',filtercol=2,unit='元/500克（依据原单元8注释，外部来源未复核）',note='只有两年，低价不能直接证明丰产或上市季；每次选择一种产品')
 rows=[];rankrows=[]
 for product,g in d.groupby('product'):
  g=g.sort_values('year_month');dummy=pd.get_dummies(g.月份,drop_first=True,dtype=float);X=pd.DataFrame({'const':np.ones(len(g)),'trend':np.arange(1,len(g)+1)},index=g.index).join(dummy);rank=np.linalg.matrix_rank(X.values);assert rank==len(X.columns)
  m=sm.OLS(g['每500克价格'],X).fit();rankrows.append([product,len(g),len(X.columns),rank,float(m.rsquared)])
  for col in X:rows.append([product,str(col),float(m.params[col]),float(m.bse[col]),float(m.pvalues[col])])
 version='P16-drop-first-month-v1';p.models.append({'version':version,'method':'OLS const + trend + 11 month dummies','baseline':'首月类别','trainScope':'全量描述性拟合，不是预测验证','products':len(rankrows),'seed':None})
 p.frame('coefficients','独立修正版：基准月编码的OLS系数',pd.DataFrame(rows,columns=['产品','项','系数','标准误','p值']),'截距+11月哑变量+趋势；小样本/多重检验风险，不能用p值直接认定上市季。',identity='teaching-adaptation',model=version)
 p.frame('rank','设计矩阵满秩核对',pd.DataFrame(rankrows,columns=['产品','行数','列数','矩阵秩','训练内R²']),'原12月全编码+常数奇异；修正版独立命名，原输出保留。',identity='teaching-adaptation',model=version)
 p.checks.update(products=len(rankrows),allFullRank=True)
def p18(p):
 d=p.load();p.counts(d,'score');d['评论字符数']=d.content.fillna('').astype(str).str.len();p.hist(d,'评论字符数')
 # SnowNLP scores are only available as saved output, never reinterpreted as true labels.
 p.add('sentiment','原保存情感阈值计数',['阈值规则','原保存计数'],[['SnowNLP分数≥0.5',2791],['SnowNLP分数<0.5',846]],'数值来自原单元25保存文本；不是人工情感标签，不是本次重跑，分数未经此数据校准。',identity='original-saved',unit='评论')
 assert len(d)==3637;p.checks['savedCountSum']=2791+846
def p19(p):
 d=p.load('(sample)sam_tianchi_mum_baby_trade_history.csv',dtype={'user_id':str,'auction_id':str,'cat_id':str,'cat1':str});baby=p.load('(sample)sam_tianchi_mum_baby.csv',dtype={'user_id':str});c=d[d.buy_mount.between(1,195)].copy();assert len(c)==29942 and int(c.buy_mount.sum())==49973
 c['月份']=pd.to_datetime(c.day.astype(str),format='%Y%m%d').dt.strftime('%Y-%m');g=c.groupby('月份').buy_mount.sum().reset_index();p.chart('monthly','月购买量趋势',g,kind='line',unit='原buy_mount计量',note='无单价字段，不称销售额；日期不同覆盖长度影响比较')
 p.chart('category','商品大类购买量',c.groupby('cat1').buy_mount.sum().reset_index(),note='cat1是类别标签；不当连续数轴',unit='原buy_mount计量');g=c.groupby(['月份','user_id']).size().rename('购买记录数').reset_index();rate=g.groupby('月份').购买记录数.agg(当月用户数='size',重复用户数=lambda s:int((s>1).sum())).reset_index();rate['复购用户比例']=rate.重复用户数/rate.当月用户数
 p.chart('repurchase','同月有两条以上购买记录的用户比例',rate[['月份','复购用户比例','当月用户数','重复用户数']],kind='line',note='按月份和user_id计记录；用户去重作分母，不把记录比例当用户比例',unit='比例0—1',denominator='每月样本中不同user_id数量')
 p.add('coverage','交易与婴儿表覆盖',['统计项','值'],[['交易原行',len(d)],['清洗后行',len(c)],['购买量',int(c.buy_mount.sum())],['婴儿表行',len(baby)],['交易中可在婴儿表匹配的用户数',len(set(c.user_id)&set(baby.user_id))]],'两表覆盖不同，不能把婴儿表953人当全部买家，也没有年龄预测。',unit='记录 / 用户 / 原购买量');p.checks.update(clean=len(c),quantity=int(c.buy_mount.sum()))
def p20(p):
 raw=p.load('双十一淘宝美妆数据.csv');c=p.load('clean_beautymakeup.xlsx');dedup=raw.drop_duplicates();assert len(dedup)==27512
 p.add('cleaning','原CSV去重与原附表核对',['项','行数'],[['原CSV',len(raw)],['完全去重后',len(dedup)],['原附clean表',len(c)]],'相同行数不等于逐行同值；类别规则与补0来自原附流程，未知与0分别说明。',unit='行')
 p.counts(c,'main_type');box(p,c,'店名','price','price-box','原price单位待核实');p.scatter(c,'price','sale_count','price-sale')
 g=c.groupby('店名').agg(快照行数=('id','size'),不同商品ID数=('id','nunique')).reset_index();p.chart('sku','店铺快照行数与不同商品ID',g,ys=[1,2],unit='行 / 商品ID',note='sale_count为快照口径，未证实可跨天相加，不把price×sale_count称核实成交额');p.checks.update(raw=len(raw),dedup=len(dedup),attached=len(c))
def p22(p):
 from sklearn.cluster import KMeans
 d=p.load('uniqlo2.csv');p.scatter(d,'经度','纬度','coordinates');counts=[];labels=[]
 for k in [3,8]:
  m=KMeans(n_clusters=k,n_init=10,random_state=100).fit(d[['经度','纬度']]);counts.extend([[str(k),str(cl),int((m.labels_==cl).sum())] for cl in range(k)]);labels.extend([[str(k),str(i),str(m.labels_[i]),float(d.iloc[i]['经度']),float(d.iloc[i]['纬度'])] for i in range(len(d))])
 version='P22-coordinate-k3-k8-v1';p.models.append({'version':version,'k':[3,8],'seed':100,'n_init':10,'features':['经度','纬度'],'rows':len(d),'limitation':'原坐标系未知，直接欧氏距离是近似，不等同地理路网/客户价值'})
 p.chart('counts','真实已算k=3/8地点分组数',pd.DataFrame(counts,columns=['k方案','新簇ID','行数']),x=1,ys=[2],filtercol=0,unit='拜访地点记录',model=version,note='只切换已算方案；地点分组不是消费价值')
 p.frame('labels','k=3/8完整地点标签',pd.DataFrame(labels,columns=['k方案','原行','新簇ID','经度','纬度']),'原坐标只作无底图坐标展示；不调用地理编码网络服务。',identity='teaching-adaptation',model=version);p.checks['coordinateRows']=len(d)
def p24(p):
 from sklearn.impute import SimpleImputer
 from sklearn.pipeline import make_pipeline
 from sklearn.linear_model import LinearRegression
 from sklearn.model_selection import train_test_split
 from sklearn.metrics import r2_score,mean_absolute_error,mean_squared_error
 d=p.load();d=d.rename(columns=lambda c:c.strip());p.hist(d,'age');p.hist(d,'revenue');p.scatter(d,'previous_order_amount','revenue','amount-revenue')
 p.add('missing','真实缺失率（分母为总行数）',['字段','缺失数','总行数','缺失比例'],[[c,int(d[c].isna().sum()),len(d),float(d[c].isna().mean())] for c in d.columns],'原isnull().sum()/count()分母为非空数，与缺失率不同；保留原字段与去空格映射。',unit='行 / 比例')
 # A separate holdout demonstration; no test-set imputation or tuning.
 X=d[['previous_order_amount','days_since_last_order']].copy();X['engaged_1']=pd.to_numeric(d.engaged_last_30,errors='coerce');X['lifecycle_C']=(d.lifecycle=='C').astype(int);y=d.revenue;valid=y.notna();tr,te=train_test_split(np.flatnonzero(valid),test_size=.3,random_state=100)
 m=make_pipeline(SimpleImputer(strategy='mean'),LinearRegression()).fit(X.iloc[tr],y.iloc[tr]);pred=m.predict(X.iloc[te]);version='P24-holdout-train-imputer-v1'
 p.models.append({'version':version,'features':list(X.columns),'seed':100,'test_size':.3,'trainRows':len(tr),'testRows':len(te),'trainTestIntersection':len(set(tr)&set(te)),'imputerFit':'train only mean','limitation':'训练外演示不保证成熟预测能力，engaged缺失数值均值是本教学选择'})
 p.frame('holdout','独立留出版本：真实测试指标',pd.DataFrame([['R²',r2_score(y.iloc[te],pred)],['MAE',mean_absolute_error(y.iloc[te],pred)],['RMSE',np.sqrt(mean_squared_error(y.iloc[te],pred))]],columns=['指标','值']),'原低R²是训练内结果；新留出独立版本不覆盖原成绩，不包装成成熟预测。',identity='teaching-adaptation',model=version)
 p.scatter(pd.DataFrame({'实际金额':y.iloc[te].values,'预测金额':pred}),'实际金额','预测金额','holdout-scatter')
 ref=p.resources[-1];res=read(ROOT/'content-source'/ref);res['context'].update(identity='teaching-adaptation',modelRerun=True,modelVersion=version);save(ref,res)
 p.checks.update(holdoutR2=float(r2_score(y.iloc[te],pred)),trainRows=len(tr),testRows=len(te),overlap=0)
def population(p):
 def region(v):
  v=re.sub(r'[\W\d_]','',str(v));return v[:3] if v.startswith(('黑龙江','内蒙古')) else v[:2]
 raw=p.load('各地区人口年龄构成.csv');age=raw.iloc[2:].copy();age.columns=['地区','0—14岁','15—59岁','60岁及以上','其中65岁及以上'];age['地区']=age.地区.map(region)
 for c in age.columns[1:]:age[c]=pd.to_numeric(age[c].astype(str).str.strip(),errors='coerce')/100
 age=age.dropna().set_index('地区');provinces=age.drop(index='全国',errors='ignore');assert len(provinces)==31 and provinces.index.is_unique
 assert np.allclose(provinces.iloc[:,:3].sum(axis=1),1,atol=.0002);assert (provinces.iloc[:,3]<=provinces.iloc[:,2]).all()
 p.chart('ages','各省三段互斥年龄比例',provinces.iloc[:,:3].reset_index(),ys=[1,2,3],filtercol=0,unit='比例0—1',denominator='各省全部人口；65+包含在60+内，不重复相加',note='人口年龄CSV剔除两说明行后按真实列序重建字段')
 pop=p.load('各地区人口.csv').iloc[2:].copy();pop.columns=['地区','人口数','2020占比','2010占比'];pop['地区']=pop.地区.map(region);pop['人口数']=pd.to_numeric(pop.人口数,errors='coerce');pop=pop.dropna(subset=['人口数']).set_index('地区')
 p.chart('population','各省人口数（同源地图降级）',pop.loc[provinces.index,['人口数']].reset_index(),kind='map',fallback='bar',unit='人（原物理表）',note='只有31省，不含全国总计与说明行；地图依赖未核验时使用同源条形图')
 p.checks.update(provinces=31,ageExclusive=True,age65Subset=True)
 if p.id=='P25':return
 from scipy.cluster.hierarchy import linkage,cut_tree,to_tree
 z=linkage(provinces.iloc[:,:3].values,method='ward');labels=cut_tree(z,n_clusters=3).ravel()+1
 def tree(node):return {'name':provinces.index[node.id] if node.is_leaf() else f'Ward距离 {node.dist:.6f}','value':float(node.dist),'children':[] if node.is_leaf() else [tree(node.left),tree(node.right)]}
 version='P26-age-ward-v1';p.models.append({'version':version,'method':'Ward Euclidean on 3 mutually exclusive age proportions','rows':31,'features':list(provinces.columns[:3]),'clusters':3,'seed':None})
 p.chart('tree','31省年龄结构Ward层次树',pd.DataFrame({'省份':provinces.index,'新群组':labels}),kind='tree',tree=tree(to_tree(z)),unit='Ward合并距离（节点文字）',model=version,note='树形只展示合并拓扑；横向位置不是距离刻度；真实距离见节点文字与合并表')
 p.frame('linkage','真实Ward合并序列',pd.DataFrame(z,columns=['左节点ID','右节点ID','合并距离','叶子数']),'前31节点为原省份顺序，后续内部节点从31递增；不伪造树高。',identity='teaching-adaptation',model=version)
 combined=provinces.copy();combined['人口数']=pop.loc[provinces.index,'人口数'];gdp=p.load('分省年度GDP数据.csv').set_index('地区')['2020年'];gdp.index=gdp.index.map(region);combined['2020GDP亿元']=gdp
 city=p.load('2005-2019年中国各地区城镇人口数量.csv').set_index('地区')['2019年'];res=p.load('2001-2020中国各地区常住人口数量.csv').set_index('地区')['2019年'];urban=city/res;urban.index=urban.index.map(region);combined['2019城镇化比例']=urban
 txt=next(ast.literal_eval(n.value) for n in ast.walk(ast.parse(''.join(p.nb['cells'][24]['source']))) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='floating_pop_data_txt' for t in n.targets));floating=pd.read_csv(io.StringIO(txt),sep='\t');floating.columns=['地区','省内','省外'];floating['地区']=floating.地区.map(region);floating=floating.set_index('地区');combined['省外流动人口比例']=floating['省外']/combined.人口数
 assert combined.notna().all().all();p.frame('aligned','31省多源实际对齐表',combined.reset_index(),'按规范化省名一对一对齐；GDP亿元、人口人、城镇比例分母来自对应2019常住人口；流动表为原单元25内嵌表。',unit='各列已注明')
 p.scatter(combined,'2019城镇化比例','省外流动人口比例','urban-floating');p.corr(combined,['0—14岁','15—59岁','60岁及以上','2019城镇化比例','省外流动人口比例']);p.checks['alignedRows']=len(combined)
def p27(p):
 d=p.load();g=d.groupby(['record_year','age','gender'])['pop'].sum().rename('同年龄性别分母').reset_index();c=d.merge(g,on=['record_year','age','gender'],validate='many_to_one');c['状态比例']=c['pop']/c['同年龄性别分母'].replace(0,np.nan)
 assert len(c)==len(d);c['筛选组']=c.record_year.astype(str)+' · '+c.gender.astype(str)+' · '+c.state.astype(str)
 p.chart('marriage','婚姻横截面同年龄性别状态比例',c[['age','状态比例','筛选组','同年龄性别分母','pop']],kind='line',filtercol=2,unit='比例0—1',denominator='同record_year+age+gender内各婚姻状态人口总和',note='每次选择同一调查年份、性别和状态；横截面不是个人轨迹或年度离婚发生率')
 p.checks.update(rawRows=len(d),mergedRows=len(c),maxProportion=float(c.状态比例.max()))
def p28(p):
 d=p.load();p.counts(d,'left');grouped_rate(p,d,'sales','left','department');grouped_rate(p,d,'salary','left','salary');grouped_rate(p,d,'promotion_last_5years','left','promotion')
 p.scatter(d,'satisfaction_level','last_evaluation','satisfaction');low=d[d.salary=='low'];p.checks.update(rows=len(d),lowSalaryLeftRate=float(low.left.mean()),left=int(d.left.sum()))
 assert abs(low.left.mean()-.2969)<.0001
def p29(p):
 d=p.load();p.counts(d,'address');p.counts(d,'experience');p.counts(d,'education');s=d.salary.astype(str).str.extract(r'^(\d+)[kK]?-(\d+)[kK]?$').astype(float);assert s.notna().all().all();c=d.copy();c['下界']=s[0];c['上界']=s[1];c['薪资中点']=(s[0]+s[1])/2
 box(p,c,'experience','薪资中点','experience-box','K/月（原单元23单位；区间中点不是实发）');p.hist(c,'薪资中点');p.frame('salary-preview','薪资字符串拆分前20行',c[['salary','下界','上界','薪资中点']].head(20),'原区间可解析；中点仅为汇总替代量，不作为个人实际收入。',sample='原顺序前20/436行')
 text=' '.join(d.description.fillna('')).lower();terms=['python','sql','excel','tableau','spss','hadoop','spark','r语言'];p.chart('skills-text','职位描述中预定义技能词的文本频次',pd.DataFrame([[t,len(re.findall(re.escape(t),text))] for t in terms],columns=['文本词','不区分大小写子串次数']),note='教学词表子串计数，不是Jieba重跑；文本提及SQL不等于本项目代码使用SQL',unit='子串次数');p.checks.update(rows=len(d),salaryParsed=len(c))
FUNCTIONS={f'P{i:02}':fn for i,fn in [(1,p01),(2,p02),(3,p03),(4,p04),(5,p05),(6,p06),(7,p07),(8,p08),(9,p09),(10,p10),(12,p12),(13,p13),(14,p14),(15,p15),(16,p16),(18,p18),(19,p19),(20,p20),(22,p22),(24,p24),(25,population),(26,population),(27,p27),(28,p28),(29,p29)]}
def run(p):FUNCTIONS[p.id](p)
