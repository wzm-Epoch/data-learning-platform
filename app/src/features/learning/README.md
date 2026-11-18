# 分步骤学习系统

content.ts定义按课加载与结果契约。LaboratoryPage编排桌面聚焦和手机同一步标签。CodeView只读展示、复制和下载文本；ResultView独立处理每份资源错误；Exercise仅临时答题与自评。

location.ts使用da-learning:location:v1，只保存一个最近有效阅读位置，含课程版本和稳定项目/课节/步骤ID。它不写da-learning:progress:v1，不记录完成率或自动判卷。无效/过期/仅规划步骤不覆盖有效位置。

课程编辑源：content-source/curriculum/representative-lessons.json。运行npm.cmd run lessons:prepare进行只读数据准备，再运行npm.cmd run build校验与发布本地资源。第四阶段扩展复杂图表，第五阶段扩展完成记录与备份。
