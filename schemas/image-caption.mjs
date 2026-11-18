export function imageCaption(resource) {
 return resource.context.identity==='original-saved'
  ? '原 Notebook 保存图；尚未重跑，局限见本步讲解。'
  : '本次转换的本地预览；原图来源、转换方式与取样范围见上方说明。';
}
