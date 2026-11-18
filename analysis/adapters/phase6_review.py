"""Read-only saved-output extraction and editorial overlay for final acceptance."""
from phase4_common import ROOT,SOURCE,read,save,sha
from phase4_evidence import finalize
from datetime import datetime,timezone
import re,json

def prepare():
 detail=read(ROOT/'content-source/projects/P14/project.json');source=detail['lessons'][0]['source'];notebook=read(SOURCE/source)
 cell=notebook['cells'][14];text='\n'.join(''.join(o.get('text',[])) for o in cell.get('outputs',[]))
 match=re.search(r'\[\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]\]',text)
 assert match,'原单元15未找到真实4x4矩阵，停止而不推测'
 values=list(map(int,match.groups()));rows=[[str(j),str(i),values[i*4+j]] for i in range(4) for j in range(4)]
 ref='learning/resources/p14-v6-saved-confusion.json'
 data={'schemaVersion':'1.0','id':'p14-v6-saved-confusion','title':'原保存真实四分类测试混淆矩阵（4×4）','kind':'table','columns':['预测类别编码','实际类别编码','原保存计数'],'rows':rows,'text':None,'context':{'identity':'original-saved','buildId':'phase6-saved-extraction-v1','createdAt':datetime.now(timezone.utc).isoformat(),'inputs':[{'path':source,'sha256':sha(SOURCE/source)}],'note':'仅从正式Notebook单元15保存输出提取，未重新训练。行=真实、列=预测；类别编码0—3，不推测未核验的情绪映射。末尾单元18的3×3单位阵代码属于演示，不能作为本四分类测试成绩。','unit':'条保存测试样本','sample':'原保存测试集，非新划分','modelRerun':False},'chart':{'type':'heatmap','x':0,'ys':[1,2],'question':'真实测试中，哪些类别被混淆？','xLabel':'预测类别编码','yLabel':'实际类别编码','denominator':str(sum(values))+'条原保存测试记录','range':'原Notebook单元15保存输出','filters':'无；不重新抽样或训练','nullPolicy':'全部16格均为保存整数计数','interpretation':'对角线为预测正确计数，不能用演示单位阵替代。保存准确率不代表本轮独立复现。'}}
 save(ref,data)
 index=read(ROOT/'content-source/learning/index.json');index['contentVersion']='0.6.0'
 for p in index['projects']:
  for meta in p['lessons']:
   lesson=read(ROOT/'content-source'/meta['ref']);lesson['contentVersion']='0.6.0'
   if p['id']=='P14':
    step=next(s for s in lesson['steps'] if s['id']=='source-012-017')
    if ref not in step['outputRefs']:step['outputRefs'].append(ref)
    step.setdefault('outputTitles',{})[ref]=data['title']
   save(meta['ref'],lesson)
 save('learning/index.json',index)
 summary=finalize()
 (ROOT/'docs/stages/phase-06-content-change.json').write_text(json.dumps({'matrixSource':source,'cell':15,'matrix': [values[i*4:i*4+4] for i in range(4)],'total':sum(values),'savedAccuracyFromMatrix':sum(values[i*4+i] for i in range(4))/sum(values),'newTraining':False,'summary':summary},ensure_ascii=False,indent=2),encoding='utf-8')
 print('第六阶段提取完成：',sum(values),'条原保存测试计数；没有训练模型')
if __name__=='__main__':prepare()
