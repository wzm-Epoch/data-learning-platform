"""Refresh publish evidence from active lessons after every supported adapter run."""
import importlib.metadata,platform
from phase4_common import ROOT,read,save,sha

def finalize():
 index=read(ROOT/'content-source/learning/index.json')
 coverage=read(ROOT/'docs/stages/phase-04-coverage.json')
 manifest=read(ROOT/'content-source/learning/build.json')
 active=set();inputs={};lessons=[]
 for project in index['projects']:
  record=next(c for c in coverage if c['projectId']==project['id'])
  refs=set();project_inputs={};count=0
  for meta in project['lessons']:
   lesson=read(ROOT/'content-source'/meta['ref']);lessons.append(lesson)
   for step in lesson['steps']:
    count+=1
    for item in step['inputRefs']:project_inputs[item['path']]=item
    for ref in step['outputRefs']:
     obj=read(ROOT/'content-source'/ref);refs.add(ref);refs.update(obj.get('images',[]))
  record.update(resources=sorted(refs),readySteps=count,lessonCount=len(project['lessons']),inputRefs=sorted(project_inputs.values(),key=lambda x:x['path']))
  save(f"learning/manifests/{project['id']}.json",record)
  (ROOT/f"analysis/adapters/{project['id']}/contract.json").write_text(__import__('json').dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
  active.update(refs);inputs.update(project_inputs)
 coverage.sort(key=lambda x:x['projectId'])
 save('learning/coverage.json',coverage)
 (ROOT/'docs/stages/phase-04-coverage.json').write_text(__import__('json').dumps(coverage,ensure_ascii=False,indent=2),encoding='utf-8')
 manifest['inputs']=sorted(inputs.values(),key=lambda x:x['path'])
 manifest['outputs']=[{'ref':ref,'sha256':sha(ROOT/'content-source'/ref)} for ref in sorted(active)]
 manifest['codeHashes']=[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)} for p in sorted((ROOT/'analysis/adapters').rglob('*.py'))]
 packages=['pandas','numpy','scikit-learn','scipy','statsmodels','openpyxl','xlrd','Pillow']
 manifest['environment']={'python':platform.python_version(),**{p:importlib.metadata.version(p) for p in packages}}
 manifest['parametersByProject']='learning/coverage.json'
 manifest['adapterSha256']=sha(ROOT/'analysis/adapters/phase4.py')
 manifest['requirements']={'path':'analysis/environments/phase4-requirements.txt','sha256':sha(ROOT/'analysis/environments/phase4-requirements.txt')}
 save('learning/build.json',manifest)
 (ROOT/'docs/stages/phase-04-precompute.json').write_text(__import__('json').dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 summary={'projects':len(index['projects']),'lessons':len(lessons),'steps':sum(len(l['steps']) for l in lessons),'activeResults':sum(r.endswith('.json') for r in active),'savedPNG':sum(r.endswith('.png') for r in active),'charts':sum(bool(read(ROOT/'content-source'/r).get('chart')) for r in active if r.endswith('.json')),'newModelProjects':[c['projectId'] for c in coverage if c['models']],'blocked':{c['projectId']:c['blocked'] for c in coverage if c['blocked']},'environment':manifest['environment']}
 (ROOT/'docs/stages/phase-04-summary.json').write_text(__import__('json').dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
 return summary

if __name__=='__main__':print(finalize())
