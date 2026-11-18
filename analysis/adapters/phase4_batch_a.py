import numpy as np
import pandas as pd
from decimal import Decimal
import csv
from sklearn.cluster import KMeans
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import silhouette_score,roc_curve,roc_auc_score,confusion_matrix,precision_score,recall_score,accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from phase4_common import SOURCE,ROOT,read
def run(p):
 if p.id=='P21':
  a=p.load('order-14.3.csv',dtype={'订单ID':str,'商品ID':str,'类别ID':str})
  # Decimal values are calculated from the original strings, never from rounded floats.
  ref=next(r for r in p.refs if r.endswith('/order-14.3.csv'))
  with (SOURCE/ref).open(encoding='gb18030',newline='') as f: raw=list(csv.DictReader(f))
  amounts={}
  for r in raw:amounts[r['门店编号']]=amounts.get(r['门店编号'],Decimal(0))+Decimal(r['单价'])*Decimal(r['销量'])
  total=sum(amounts.values());assert total==Decimal('28950.06645')
  p.chart('stores','三门店金额与全量占比',pd.DataFrame([[k,float(v),str(v),float(v/total)] for k,v in sorted(amounts.items())],columns=['门店','绘图金额','原精度金额','全量金额比例']),note='order-14.3.csv；金额=逐行单价×销量；只读精度对账',unit='金额单位待核实',denominator='全部3478行精确金额28950.06645',filtercol=0)
  a['小时']=pd.to_datetime(a['成交时间']).dt.hour
  hour=a.groupby('小时')['订单ID'].nunique().reset_index(name='小时内不同订单数')
  p.chart('hour','小时内独立订单数',hour,kind='line',unit='订单',note='按小时和订单ID去重；不同小时可能包含同一订单，不称顾客人数')
  for col in ['类别ID','商品ID']:
   v=a.groupby(col)['销量'].sum().sort_values(ascending=False).head(10).reset_index()
   p.chart('top-'+str(len(p.resources)),col+'销量Top10',v,note='全量分组后取10；编码按类别，未知销量单位',unit='销量单位待核实')
  p.checks.update({'exactAmount':str(total),'orders':int(a['订单ID'].nunique()),'aRows':len(a)})
 elif p.id=='P11':
  h=p.load('shenzhen.csv');clean=h[h.hourseSize<=10000].copy();assert len(h)-len(clean)==1
  p.scatter(clean,'hourseSize','total_price','scatter');v=clean.groupby('area').agg(挂牌行数=('area','size'),平均单价=('unit_price','mean')).reset_index()
  p.chart('area','清洗后各区域挂牌行数',v,note='按原面积≤10000规则剔除1条；不把挂牌价称成交价',unit='挂牌记录',filtercol=0)
  p.hist(clean,'hourseSize');p.checks.update({'before':len(h),'after':len(clean),'anomaly':float(h.loc[h.hourseSize>10000,'hourseSize'].iloc[0])})
 elif p.id=='P17':
  d=p.load('ad_performance.csv');d2=d.drop(columns=['平均停留时间']);nums=d2.iloc[:,1:7]
  cats=['素材类型','广告类型','合作方式','广告尺寸','广告卖点'];X=np.column_stack([MinMaxScaler().fit_transform(nums),pd.get_dummies(d2[cats],dtype=int).values])
  assert X.shape==(889,33);scores=[];counts=[];centers=[];samples=[]
  for k in range(2,8):
   m=KMeans(n_clusters=k,n_init=10,random_state=100);labels=m.fit_predict(X);scores.append([k,silhouette_score(X,labels),float(m.inertia_)])
   for cl in range(k):
    counts.append([str(k),str(cl),int((labels==cl).sum())]);means=nums.loc[labels==cl].mean()
    centers.append([str(k),str(cl)]+means.tolist())
   for i in range(len(d)):samples.append([str(k),str(i),str(labels[i]),float(nums.iloc[i,0]),float(nums.iloc[i,1])])
  model='P17-seed100-ninit10-v1';p.models.append({'version':model,'method':'KMeans','seed':100,'n_init':10,'k':list(range(2,8)),'preprocess':'6数值MinMax+27独热；删除平均停留时间；不含渠道ID','fitRows':889,'features':33})
  p.chart('silhouette','新版本已计算k=2—7轮廓系数',pd.DataFrame(scores,columns=['k','轮廓系数','inertia']),kind='line',unit='无量纲',model=model,note='独立教学版本；不是原保存k搜索的重现')
  p.chart('counts','新版本各k的簇数量',pd.DataFrame(counts,columns=['k方案','簇ID','渠道数']),x=1,ys=[2],filtercol=0,unit='渠道',model=model,note='选择k只切换这6个已算方案；簇ID无序且不能与原簇直接对应')
  p.frame('means','新版本逐簇六数值特征真实均值',pd.DataFrame(centers,columns=['k方案','簇ID']+list(nums.columns)),'本次根据完整新标签计算mean；与原错误使用describe.iloc[2]的std分开保存。',identity='teaching-adaptation',model=model)
  p.frame('labels','新版本完整逐行簇标签及两个原数值字段',pd.DataFrame(samples,columns=['k方案','原行索引','新簇ID',str(nums.columns[0]),str(nums.columns[1])]),'6方案×889行；表格分页，无任意在线重训。',identity='teaching-adaptation',model=model)
  p.checks.update({'rows':889,'features':33,'kValues':list(range(2,8)),'countSums':{str(k):sum(r[2] for r in counts if r[0]==str(k)) for k in range(2,8)}})
 elif p.id=='P23':
  d=p.load('tianmao.csv');p.counts(d,'coupon_ind','label-share');p.hist(d,'age')
  cols=['coupon_used_in_last_month','returned','loan','coupon_used_in_last6_month','default','age']
  X=d[cols].copy()
  for c in ['returned','loan','default']:
   assert set(X[c].unique())<={'yes','no'};X[c]=X[c].map({'yes':1,'no':0})
  y=d.coupon_ind;tr,te=train_test_split(np.arange(len(d)),test_size=.3,stratify=y,random_state=100)
  assert len(set(tr)&set(te))==0
  model=make_pipeline(StandardScaler(),LogisticRegression(max_iter=3000,random_state=100))
  model.fit(X.iloc[tr],y.iloc[tr]);probs=model.predict_proba(X.iloc[te])[:,1];pred=(probs>=.5).astype(int)
  fpr,tpr,threshold=roc_curve(y.iloc[te],probs);auc=roc_auc_score(y.iloc[te],probs);cm=confusion_matrix(y.iloc[te],pred)
  version='P23-stratified-probability-v1';p.models.append({'version':version,'method':'StandardScaler(train only) + LogisticRegression','features':cols,'seed':100,'test_size':.3,'stratify':'coupon_ind','trainRows':len(tr),'testRows':len(te),'trainIndexSha256':__import__('hashlib').sha256(tr.tobytes()).hexdigest(),'testIndexSha256':__import__('hashlib').sha256(te.tobytes()).hexdigest(),'trainTestIntersection':0,'max_iter':3000,'C':1,'class_weight':None,'solver':'lbfgs'})
  p.chart('roc','独立测试集概率ROC',pd.DataFrame({'FPR':fpr,'TPR':tpr}),kind='roc',unit='比例0—1',model=version,note=f'本次教学修正；AUC={auc:.8f}。未在测试集调参，原硬标签AUC另列。')
  p.frame('probabilities','独立测试集真实概率：浏览器阈值探索',pd.DataFrame({'实际标签':y.iloc[te].values,'正类概率':probs}),'仅从该新版本独立测试集计算；改变阈值不会重训，也不把测试阈值探索作为泛化保证。',identity='teaching-adaptation',model=version,probabilities=True)
  p.chart('matrix','新版本阈值0.5混淆矩阵',pd.DataFrame([[str(j),str(i),int(cm[i,j])] for i in range(2) for j in range(2)],columns=['预测标签','实际标签','人数']),kind='heatmap',ys=[1,2],unit='样本行',model=version,note='独立测试集，行是真实标签、列是预测标签')
  p.frame('metrics','新版本独立测试指标',pd.DataFrame([['概率AUC',auc],['Accuracy',accuracy_score(y.iloc[te],pred)],['Precision',precision_score(y.iloc[te],pred,zero_division=0)],['Recall',recall_score(y.iloc[te],pred,zero_division=0)],['全预测0准确率',float((y.iloc[te]==0).mean())]],columns=['指标','值']),'训练集17721行；测试集7596行；阈值0.5。独立版本不与原不同划分直接比优劣。',identity='teaching-adaptation',model=version)
  p.checks.update({'trainRows':len(tr),'testRows':len(te),'overlap':0,'probabilityAUC':auc,'matrix':cm.tolist(),'probabilityCount':len(probs),'positiveTotal':int(y.sum())})
