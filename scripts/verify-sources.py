import pathlib,json,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
audit=json.loads((root/'content-source/audit/文件与字段审计.json').read_text(encoding='utf-8-sig'))
config=json.loads((root/'local-config/paths.json').read_text(encoding='utf-8-sig')); source=pathlib.Path(config['sourceRoot'])
errors=[]
for item in audit['files']:
    p=source/pathlib.PureWindowsPath(item['path'])
    try:
        with p.open('rb') as f: actual=hashlib.file_digest(f,'sha256').hexdigest()
        if actual!=item['sha256']: errors.append({'path':item['path'],'reason':'hash mismatch'})
    except OSError as e: errors.append({'path':item['path'],'reason':str(e)})
expected={str(pathlib.PureWindowsPath(x['path'])).replace('\\','/') for x in audit['files']}
actual={p.relative_to(source).as_posix() for d in {x['path'].split('\\')[0] for x in audit['files']} for p in (source/d).rglob('*') if p.is_file()}
result={'checked':len(audit['files']),'hashMismatches':errors,'addedFiles':sorted(actual-expected),'missingFiles':sorted(expected-actual),'sourceReadOnly':True}
p=root/'docs/stages/source-integrity.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True));sys.exit(1 if errors or result['addedFiles'] or result['missingFiles'] else 0)
