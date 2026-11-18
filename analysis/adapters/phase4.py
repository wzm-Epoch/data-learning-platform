"""Build all verified course resources in batches. Original source is read-only."""
import sys,platform,re,json,hashlib,importlib,os
os.environ.setdefault('OMP_NUM_THREADS','1')
from pathlib import Path
import pandas as pd
import numpy as np
from phase4_common import *
BATCHES={'A':['P21','P11','P17','P23'],'B':['P05','P06','P09','P12','P13','P15','P20','P28','P29'],'C':['P01','P02','P03','P04','P10','P22','P24'],'D':['P14','P16','P18','P19','P25','P26','P27'],'E':['P07','P08']}
def key_explanation(code):
 rules=[('read_csv','read_csv只读取指定CSV；编码、表头和字段需要与输入字典核对。'),('read_excel','read_excel读取指定工作表，不把不同sheet合并成独立样本。'),('groupby','groupby先定义分组键，再计算聚合；count、size与nunique的计数粒度不同。'),('dropna','dropna会删除缺失行/列；删除前后的行数和选择偏差需要检查。'),('fillna','fillna改变缺失值含义；未知与0必须分别解释。'),('get_dummies','get_dummies把类别转成0/1列，不能把类别编号当连续距离。'),('fit','fit拟合对象状态；是否仅在训练数据拟合决定评估边界。'),('predict','predict给出类别或预测量；概率排序需要predict_proba或decision_function。'),('corr','corr描述数值相关；ID和任意名义编码不能直接用于实质解释。'),('plot','绘图参数只控制展示；结论仍须受输入范围与统计口径约束。'),('JsCode','JsCode是原Pyecharts脚本；平台只展示代码，不求值或执行。'),('requests','联网采集代码仅作来源阅读；离线课程使用附带数据，不发请求。')]
 found=[text for token,text in rules if token in code]
 return found or ['本步展示原变量赋值、查看或配置；变量实际内容以保存输出与本次数据证据为准，不从代码存在推断执行成功。']
def source_lesson(p):
 # Follow actual Notebook sections, retaining exact cell references. No synthetic results.
 groups=[];cells=[];narrative=[];heading=p.detail['title']
 for i,c in enumerate(p.nb['cells']):
  text=''.join(c.get('source',[])).strip()
  if c['cell_type']=='markdown':
   hs=re.findall(r'^#{1,6}\s+(.+)',text,re.M)
   if hs and cells:groups.append((heading,cells,narrative));cells=[];narrative=[]
   if hs:heading=re.sub('<[^>]+>','',hs[0]).strip()[:100]
   if text:narrative.append(re.sub('<[^>]+>','',text)[:1800])
  elif c['cell_type']=='code' and text and not all(line.strip().startswith(('#','!pip','%pip')) or not line.strip() for line in text.splitlines()):
   cells.append(i+1)
   if len(cells)>=5:groups.append((heading,cells,narrative));cells=[];narrative=[]
 if cells:groups.append((heading,cells,narrative))
 steps=[]
 for gi,(title,cis,notes) in enumerate(groups):
  refs=p.saved(cis,f'source-{gi+1}',f'原单元{cis[0]}—{cis[-1]}保存输出')
  code='\n'.join(''.join(p.nb['cells'][ci-1]['source']) for ci in cis)
  if not refs:refs=[p.add(f'evidence-{gi+1}',f'原单元{cis[0]}—{cis[-1]}的执行证据边界',[],[],'教学说明，不是原程序执行结果。',identity='teaching-adaptation',text='这些单元没有可安全独立提取的数值或PNG输出。原HTML/Plotly对象不会当脚本执行；原变量或预测数组未另存时，不能补造ROC、残差或错分样本。可在本课数据实验步骤查看已实际导出的同源数据。')]
  explanations=[f'本步按原Notebook顺序阅读单元{cis[0]}—{cis[-1]}。原保存输出尚未重跑；安装、联网采集、写原文件和模型加载均不会在网页运行。']+key_explanation(code)
  explanations+=['原讲解摘录（保留原作者表达，事实或推断需结合局限审辨）：'+n for n in notes[:3]]
  if p.id=='P06':explanations+=['原文把1924冬奥举办地写成慕尼黑有误，应为法国霞慕尼（Chamonix）；核对依据：IOC官方FAQ，https://www.olympics.com/ioc/faq/history-and-origin-of-the-games/when-were-the-first-olympic-winter-games-held。原文奖牌榜也受赛事去重口径限制。']
  if p.id=='P23':explanations+=['原单元59把y_pred_train硬标签输入ROC；单元63重新fit后单元65仍用旧y_pred_train。保存测试矩阵[[6722,11],[862,1]]的正类召回率为1/863；新概率版本在末尾独立展示。']
  if p.id=='P14':explanations+=['原文转表引用1_simplifyweibo.txt缺失，4_simplifyweibo.txt不作为替身。只开放来源阅读与现成CSV后续分析；最后3×3单位阵是演示，不是测试成绩。']
  steps.append(dict(id=f'source-{cis[0]:03d}-{cis[-1]:03d}',title=f'{title} · 单元{cis[0]}—{cis[-1]}',status='ready',kind='modeling' if 'fit(' in code else 'analysis',knowledgeIds=p.detail['skillTags'][:5] or ['Pandas'],explanation=explanations,teachingCode='# 原代码仅供阅读，不由网页执行。\n# 本次可运行适配实现见末尾数据实验步骤。',limitations=p.detail['limitations']+['原代码与保存输出保持原身份；新改编计算另列。'],codeRefs=[code_ref(p.nbpath,p.nb,ci) for ci in cis],inputRefs=list(p.refs.values()),outputRefs=refs,exercise={'prompt':f'根据本步单元{cis[0]}—{cis[-1]}和保存证据，说明一次变换的输入、输出和一项无法验证的结论。','hint':'先查看代码中的列选择/过滤/拟合，再核对输出身份和本项目局限。','checklist':[f'准确引用原单元{cis[0]}—{cis[-1]}','指出实际字段或变量与一项真实输出','把未重跑、资料缺失和统计缺陷分别说明'],'provenance':'第四阶段教学补充，自评，不代表原文件试题'}))
 return {'schemaVersion':'1.0','contentVersion':'0.4.0','projectId':p.id,'id':'main-analysis','title':p.detail['lessons'][0]['title'],'status':'ready','steps':steps}
def supplement(p,refs,module):
 codes=[i+1 for i,c in enumerate(p.nb['cells']) if c['cell_type']=='code' and any(t in ''.join(c['source']) for t in ['read_csv','read_excel','groupby','KMeans','LogisticRegression','linkage','OLS'])][:4]
 if not codes:codes=[i+1 for i,c in enumerate(p.nb['cells']) if c['cell_type']=='code' and ''.join(c['source']).strip()][:1]
 return dict(id='phase4-data',title='真实数据实验 · '+p.detail['title'],status='ready',kind='analysis',knowledgeIds=p.detail['skillTags'][:5],explanation=[p.detail.get('summary',p.detail['title']),'本步运行工程适配器，展示真实输入的质量、专属聚合与图表。清洗、分组和模型边界见代码与每份结果说明。教学代码为本项目经过审查的实现；不会执行原Notebook。',f'已实际准备{len(refs)}份结果；请切换结果逐项核对问题、单位、范围、分母、过滤条件和来源身份。']+[f"受阻步骤：{b['step']}；原因：{b['reason']}" for b in p.blocks],teachingCode=__import__('inspect').getsource(module.FUNCTIONS[p.id]) if hasattr(module,'FUNCTIONS') else Path(module.__file__).read_text(encoding='utf-8'),limitations=p.detail['limitations']+['新版本不覆盖原保存成绩；所有新训练均在构建清单中单列。'],codeRefs=[code_ref(p.nbpath,p.nb,ci) for ci in codes],inputRefs=list(p.refs.values()),outputRefs=refs,exercise={'prompt':p.detail.get('exercise',{}).get('text','从一份真实输出复核分组口径、分母与结论边界。'),'hint':'从同源表取数，写出算式；先核对全量/抽样和原保存/新计算身份。','checklist':['列出真实字段、筛选规则和当前样本范围','用表格复核至少一个频数、比率或模型指标','指出一个不能由本图推出的结论'],'provenance':'已批准路线练习与第四阶段核对清单，采用自评'})
def build(batches,only=None):
 index=read(OUT/'index.json');manifest=read(OUT/'build.json');base=read(ROOT/'docs/stages/phase-03-precompute.json');coverage=[]
 if (ROOT/'docs/stages/phase-04-coverage.json').exists():coverage=read(ROOT/'docs/stages/phase-04-coverage.json')
 executed=[]
 for batch in batches:
  module=importlib.import_module('phase4_batch_a' if batch=='A' else 'phase4_projects')
  for pid in BATCHES[batch]:
   if only and pid!=only:continue
   print('BEGIN',batch,pid,flush=True);p=Project(pid)
   for src in p.detail['sourceRefs']:
    if src['path'].endswith('.py'):
     p.verify(src);(SOURCE/src['path']).read_text(encoding='utf-8-sig',errors='replace')
   module.run(p);executed.append({'projectId':pid,'trainedVersions':[m['version'] for m in p.models]});quality=p.base_data();calculated=list(p.resources)
   entry=next(x for x in index['projects'] if x['id']==pid)
   if pid in ['P21','P11','P17']:
    meta=entry['lessons'][0];lesson=read(ROOT/'content-source'/meta['ref']);lesson['steps']=[s for s in lesson['steps'] if s['id']!='phase4-data']
   else:lesson=source_lesson(p);meta=entry['lessons'][0]
   lesson['steps'].append(supplement(p,calculated,module));lesson['contentVersion']='0.4.0'
   # All project dependencies are verified before binding outputs to the course step.
   for st in lesson['steps']:
    if st['id']=='phase4-data' or pid not in ['P21','P11','P17']:st['inputRefs']=list(p.refs.values())
    st['outputTitles']={ref:read(ROOT/'content-source'/ref)['title'] for ref in st['outputRefs']}
   save(meta['ref'],lesson);meta.update(status='ready',steps=[{k:s[k] for k in ['id','title','status']} for s in lesson['steps']])
   all_outputs=[r for s in lesson['steps'] for r in s['outputRefs']]+p.outputs
   for ref in set(all_outputs):
    manifest['outputs']=[o for o in manifest['outputs'] if o['ref']!=ref];manifest['outputs'].append({'ref':ref,'sha256':sha(ROOT/'content-source'/ref)})
   manifest['inputs']=[r for r in manifest['inputs'] if r['path'] not in p.refs]+list(p.refs.values())
   entrycov={'projectId':pid,'batch':batch,'status':'partial-source-gaps' if p.blocks else 'available-content-open','lessonCount':len(entry['lessons']),'readySteps':sum(len(lesson['steps']) if l is meta else len(l['steps']) for l in entry['lessons']),'inputRefs':list(p.refs.values()),'resources':sorted(set(all_outputs)),'transforms':p.transforms,'checks':p.checks,'models':p.models,'blocked':p.blocks,'originalModelRerun':False,'savedOutputIdentity':'original-saved; extraction time only; original execution time unknown','validation':'adapter assertions passed; schema/production/browser tracked separately'}
   coverage=[c for c in coverage if c['projectId']!=pid]+[entrycov]
   save(f'learning/manifests/{pid}.json',entrycov)
   print('END',pid,'steps',len(lesson['steps']),'resources',len(set(all_outputs)),'blocks',len(p.blocks),'checks',p.checks,flush=True)
  index['contentVersion']='0.4.0';save('learning/index.json',index)
  save('learning/build.json',manifest)
  (ROOT/'docs/stages/phase-04-coverage.json').write_text(json.dumps(sorted(coverage,key=lambda c:c['projectId']),ensure_ascii=False,indent=2),encoding='utf-8')
  save('learning/coverage.json',sorted(coverage,key=lambda c:c['projectId']))
 manifest.update(buildId=BUILD,createdAt=CREATED,adapterSha256=sha(__file__),environment={'python':platform.python_version(),'pandas':pd.__version__,'numpy':np.__version__,'sklearn':importlib.import_module('sklearn').__version__},status='success',modelTrainingExecuted=any(p['trainedVersions'] for p in executed),originalModelRerun=False,sourceWrites=False,notebookExecution=False,checks=base['checks'])
 manifest['codeHashes']=[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)} for p in (ROOT/'analysis/adapters').glob('phase4*.py')]
 save('learning/build.json',manifest);(ROOT/'docs/stages/phase-04-precompute.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 manifest['lastRunProjects']=executed
 save('learning/build.json',manifest)
 from phase4_evidence import finalize
 finalize()
if __name__=='__main__':build([sys.argv[1]] if len(sys.argv)>1 else list(BATCHES))
