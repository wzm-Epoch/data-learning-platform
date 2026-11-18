"""Build phase-2 editorial metadata from approved documents; never execute notebooks."""
from pathlib import Path,PureWindowsPath
import json,re,csv,hashlib,ast
ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'local-config/paths.json').read_text(encoding='utf-8'))
DESIGN=Path(CONFIG['designRoot']);SOURCE=Path(CONFIG['sourceRoot'])
def read(name):return (DESIGN/name).read_text(encoding='utf-8-sig')
def save(path,obj):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
assets=read('01_项目资产盘点.md');route=read('03_完整学习路线.md');appendix=read('附录B_全数据字段与缺失字典.md')
audit=json.loads(read('文件与字段审计.json'));audited=json.loads(read('项目目录_审计版.json'))
base=json.loads((ROOT/'content-source/projects.json').read_text(encoding='utf-8'))
asset_sections={id:b for id,b in re.findall(r'^## (P\d{2}) [^\n]+\n(.*?)(?=^## |\Z)',assets,re.M|re.S)}
route_sections={id:b for id,b in re.findall(r'^### (P\d{2}) [^\n]+\n(.*?)(?=^### |^## |\Z)',route,re.M|re.S)}
def field(body,label):
 m=re.search(r'\*\*'+re.escape(label)+r'\*\*：(.*?)(?=\n\n|\*\*|\Z)',body,re.S)
 return m[1].strip() if m else None

# Known meanings are copied only from supplied dictionaries; units remain unknown unless explicit.
semantics={}
legacy=json.loads(read('证据/legacy-excel.json'))
air=next(x for x in legacy if x['path'].endswith('客户信息属性说明.xls'))
for sheet in air['sheets']:
 vals=sheet['values'];width=sheet['columns']
 for row in [vals[i:i+width] for i in range(0,len(vals),width)][1:]:
  if len(row)>1 and row[0] and row[1]:semantics[('P03',str(row[1]).lower())]=(str(row[0])+('；'+str(row[2]) if row[2] else ''),'客户信息属性说明.xls / '+sheet['name'],None)
# XLSX XML is read directly with the standard library; no formula or macro execution.
from zipfile import ZipFile
from xml.etree import ElementTree as ET
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def workbook_rows(file):
 with ZipFile(file) as z:
  strings=[''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)] if 'xl/sharedStrings.xml'in z.namelist() else []
  doc=ET.fromstring(z.read('xl/worksheets/sheet1.xml'));result=[]
  for row in doc.findall('.//m:row',ns):
   cols={}
   for cell in row.findall('m:c',ns):
    v=cell.find('m:v',ns);text=v.text if v is not None else None
    if cell.attrib.get('t')=='s' and text is not None:text=strings[int(text)]
    elif cell.attrib.get('t')=='inlineStr':text=''.join(cell.find('m:is',ns).itertext())
    cols[re.sub(r'\d','',cell.attrib['r'])]=text
   result.append(cols)
  return result
for entry in next(x for x in audit['datasetsByProject'] if x['id']=='P08')['datasets']:
 if '字典.xlsx' not in entry['path']:continue
 for row in workbook_rows(SOURCE/PureWindowsPath(entry['path'])):
  name=row.get('C');meaning=row.get('E' if 'LCIS'in entry['path'] else 'D')
  if name and meaning and name!='字段名':
   unit='月' if name=='借款期限' and '按月计'in meaning else '%' if name=='借款利率' and '百分数'in meaning else None
   semantics[('P08',name)]=(meaning,entry['path'].replace('\\','/'),unit)

summaries=[];details=[];knowledge={}
patterns={'Pandas':r'\bpd\.\w+\(', 'NumPy':r'\bnp\.\w+\(', 'Matplotlib':r'\bplt\.\w+\(', 'Seaborn':r'\bsns\.\w+\(', 'Plotly':r'\b(?:px|go)\.\w+\(', 'Altair':r'\balt\.Chart\(', '层次聚类':r'\b(?:hierarchy\.)?(?:linkage|fcluster|dendrogram)\(', 'SciPy':r'\b(?:hierarchy\.)?(?:linkage|fcluster|dendrogram)\(', 'KMeans':r'\bKMeans\(', 'groupby':r'\.groupby\(', 'pivot_table':r'\.pivot_table\(', 'merge':r'\.merge\(', '逻辑回归':r'\bLogisticRegression\(', '线性回归':r'\b(?:LinearRegression|ols)\(', 'SVC':r'\bSVC\(', 'SVR':r'\bSVR\(', 'Jieba':r'\bjieba\.(?:cut|lcut|extract_tags)\(', 'Pillow':r'\bImage\.open\(', '轮廓系数':r'\bsilhouette_score\('}
for old in base:
 id=old['id'];original=next(x for x in audited if x['id']==id);body=route_sections[id];card=asset_sections[id];dp=next(x for x in audit['datasetsByProject'] if x['id']==id)
 prerequisites=field(body,'硬前置知识');recommendation=field(body,'建议先学')
 notebooks=[]
 for name in original['sourceNotebooks']:
  path=SOURCE/PureWindowsPath(name);nb=json.loads(path.read_text(encoding='utf-8-sig'));notebooks.append((name.replace('\\','/'),nb))
 summary={k:v for k,v in old.items() if k not in ['sourceRefs','limitations','lessons','methods']}
 summary.update({'detailRef':f'projects/{id}/project.json','searchKeywords':original['learningSteps'],'prerequisites':prerequisites,'recommendedProjectIds':re.findall(r'P\d{2}',recommendation or ''),'recommendationNote':recommendation or '未指定建议项目'})
 summaries.append(summary)
 lessons=[{'id':'sales-explore' if id=='P21' and i==0 else 'monthly-report' if id=='P21' else 'main-analysis','title':PureWindowsPath(n).stem,'source':n.replace('\\','/')} for i,n in enumerate(original['sourceNotebooks'])]
 datasets=[]
 for i,data in enumerate(dp['datasets']):
  path=data['path'].replace('\\','/');source_ref=next(x for x in old['sourceRefs'] if x['path']==path)
  for si,sheet in enumerate(data.get('sheets',[data])):
   fields=[]
   for f in sheet['fields']:
    fields.append({'name':str(f['name']),'dtype':str(f['dtype']),'missing':f['missing'],'meaning':None,'unit':None,'evidence':f'文件与字段审计.json / {id} / {path}'+(' / '+str(sheet['sheet']) if 'sheet'in sheet else '')})
   for f in fields:
    key=(id,f['name'].lower() if id=='P03' else f['name'])
    if key in semantics:
     meaning,evidence,unit=semantics[key];f.update({'meaning':meaning,'unit':unit,'evidence':f['evidence']+'；语义来源：'+evidence+'（原字典声明）'})
   mappings=[]
   # Preserve transformation code as a separate original-code reference, never overwrite physical fields.
   if id in ['P25','P26']:
    filename=PureWindowsPath(data['path']).name
    for n,nb in notebooks:
     cells=nb['cells'];readcells=[]
     for ci,cell in enumerate(cells):
      code=''.join(cell.get('source',[]))
      if cell['cell_type']=='code' and filename in code and 'read_csv' in code:readcells.append(ci)
     for start in readcells:
      for ci in range(start,min(start+5,len(cells))):
       cell=cells[ci];code=''.join(cell.get('source',[]))
       if ci>start and 'read_csv' in code:break
       if cell['cell_type']=='code' and any(k in code for k in ['.columns =','rename(', 'column_name_map =','skiprows=','drop(labels=']):
        lines=code.splitlines();snippet='\n'.join(lines[:40])
        input_fields=[];output_fields=[]
        assignment=re.search(r'\.columns\s*=\s*(\[[^]]+\])',code)
        rename=re.search(r'column_name_map\s*=\s*(\{[^}]+\})',code)
        try:
         if assignment:output_fields=ast.literal_eval(assignment[1])
         if rename:
          mapping=ast.literal_eval(rename[1]);input_fields=list(mapping);output_fields=list(mapping.values())
        except (ValueError,SyntaxError):pass
        mappings.append({'source':n,'cell':ci+1,'code':snippet,'inputFields':input_fields,'outputFields':output_fields,'note':'原代码读取/清洗映射参考；本阶段未执行，不代表已生成清洗表，类型与缺失数不从物理表继承。'})
   grain='待核实；读取行数不等于独立业务实体数'
   if id=='P21' and path.endswith(('order-14.1.csv','order-14.3.csv')):grain='商品交易明细；同一订单可包含多行'
   if id=='P06' and path.endswith('athlete_events.csv'):grain='运动员参赛事件，非独立运动员'
   if id=='P04':grain='酒店预订记录'
   if id=='P08' and path.endswith('/LP.csv'):grain='借款标的按期还款记录；须进一步核对时间快照'
   datasets.append({'id':f'D{i+1:02d}-{si+1}','path':path,'sha256':source_ref['sha256'],'sheet':str(sheet.get('sheet','')) or None,'rows':sheet['rows'],'columns':sheet['columns'],'encoding':data.get('encoding'),'grain':grain,'origin':None,'license':None,'fields':fields,'teachingMappings':mappings})
 detail={**old,**summary,'schemaVersion':'1.0','contentVersion':'0.2.0','learningObjectives':[field(body,'学习目标')]+original['learningSteps'],'exercise':{'text':original['exercise'],'provenance':'已批准路线中新设计的巩固练习；非原文件已有试题','answerStatus':'参考答案尚未制作'},'lessons':lessons,'datasets':datasets,'scopeNotes':[],'originalWorkflow':field(card,'原分析流程'),'savedResult':field(card,'已有结果'),'sourceEvidence':['01_项目资产盘点.md#'+id,'03_完整学习路线.md#'+id,'附录B_全数据字段与缺失字典.md#'+id]}
 if id=='P04':
  d=next(x for x in datasets if x['path'].endswith('2022_hotel_bookings.csv'))
  with (SOURCE/PureWindowsPath(d['path'])).open(encoding='utf-8-sig',newline='') as f:years=sorted({row['arrival_date_year'] for row in csv.DictReader(f)})
  assert years==['2015','2016','2017'];detail['scopeNotes'].append('已只读核对 arrival_date_year：2015—2017。文件名2022不是实际数据年份。')
 if id=='P07':detail['scopeNotes'].append('199张图像与203行特征，缺1_42、2_38、3_10、3_11共4图。picData特征支路与moment训练支路未证实一一对应；实际SVC训练读取moment.csv，不能宣称已打通图像到预测。')
 if id in ['P25','P26']:detail['scopeNotes'].append('与另一人口项目共享6份普查CSV，保留独立项目和原代码。物理表头、读取缺失与原代码清洗映射分区展示；未执行清洗，不编造清洗后统计。')
 if id in ['P09','P11']:detail['scopeNotes'].append('P09与P11的深圳表存在title差异，分别保留原路径与哈希，不能直接覆盖为同一版本。')
 for tag in old['skillTags']:
  item=knowledge.setdefault(tag,{'id':tag,'title':tag,'evidenceNote':'来自项目资产审计的已实际使用标签，不将import或文本提及计为使用。','usages':[]})
  codeRefs=[]
  if tag in patterns:
   for n,nb in notebooks:
    for ci,cell in enumerate(nb['cells']):
     if cell['cell_type']!='code':continue
     for line in ''.join(cell.get('source',[])).splitlines():
      clean=line.strip()
      if not clean.startswith(('#','import ','from ')) and re.search(patterns[tag],clean):codeRefs.append({'source':n,'cell':ci+1,'snippet':clean[:240]});break
  item['usages'].append({'projectId':id,'auditEvidence':'01_项目资产盘点.md#'+id+' / 已核实技术标签','codeRefs':codeRefs[:2]})
 save(f'content-source/projects/{id}/project.json',detail);details.append(detail)
save('content-source/registry.json',summaries)
categories=json.loads((ROOT/'content-source/categories.json').read_text(encoding='utf-8'));stages=json.loads((ROOT/'content-source/stages.json').read_text(encoding='utf-8'));order=[id for s in stages for id in s['projectIds']]
intros={'commerce':'从交易、商品、评论与渠道数据理解零售业务问题。','property':'围绕历史挂牌样本，连接数据采集、探索分析与房价回归。','travel':'从租赁、乘机、预订与景点样本理解出行和旅游业务。','risk':'以信用卡欺诈样本练习不平衡分类和评估审辨。','education':'整理考研分数线和调剂资料，理解跨表口径与可视化。','platform':'通过借款、按期还款和投资快照理解平台多表业务。','environment':'了解水色图像特征与水质分类，同时辨认源材料缺口。','society':'利用人口和婚姻横截面样本探索结构变化与省际差异。','daily':'以月度批发价探索农产品趋势、季节性与回归边界。','sport':'通过历史奥运会参赛事件，理解统计粒度和奖牌口径。','culture':'分别探索票房统计与微博文本分类，保留不同业务问题。','career':'通过历史招聘和员工样本理解岗位需求与离职关联。'}
for cat in categories:
 ids=[id for id in order if next(x for x in summaries if x['id']==id)['categoryId']==cat['id']]
 cat.update({'intro':intros[cat['id']],'objectives':[next(x for x in audited if x['id']==id)['learningSteps'][0] for id in ids[:3]],'projectIds':ids})
save('content-source/categories.json',categories)
# Store the approved hard knowledge dependency graph separately from project recommendations.
graph=re.search(r'```mermaid\s*flowchart TD(.*?)```',route,re.S)[1];nodes={};edges=[]
for line in graph.splitlines():
 m=re.search(r'(\w+)(?:\[([^]]+)\])? --> (\w+)(?:\[([^]]+)\])?',line)
 if m:
  a,al,b,bl=m.groups();nodes[a]=al or nodes.get(a,a);nodes[b]=bl or nodes.get(b,b);edges.append({'from':a,'to':b})
save('content-source/knowledge.json',{'schemaVersion':'1.0','tags':list(knowledge.values()),'branches':[{'id':id,'title':title,'requires':[e['from'] for e in edges if e['to']==id]} for id,title in nodes.items()]})
print('Prepared',len(details),'project packages,',sum(len(d['datasets']) for d in details),'tables,',len(knowledge),'verified tags')
