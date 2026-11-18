# 添加和维护项目

当前基线为P01—P29、12分类，P21两课。ID永不复用；原始目录只读，所有适配与输出写入新工程。

1. 审查原输入，登记相对路径、SHA-256、粒度、字段、缺失、单位及来源已知/未知状态。不运行原Notebook的安装、联网采集、pickle或写文件单元。
2. 添加registry.json条目和projects/Pxx/project.json，在一个主分类和路线阶段声明归属。推荐关系和知识硬前置必须存在且无环。
3. 为每个实际使用的技术标签提供knowledge.json中的原单元与片段证据；导入未用、岗位词汇、平台ECharts实现不倒灌为原项目技术。
4. 添加learning/projects课节及learning/index.json索引。只有讲解、代码、结果与练习实际就绪才标ready；在progress-policy.json声明选修或不适用步骤。
5. 通过受控JSON导出结果；记录输入、单位、范围、分母和局限。原保存与新计算分开，不执行元数据脚本，不编造缺失预测明细。
6. 同步coverage、项目adapter contract、构建输出及代码哈希。phase4_evidence.py的finalize负责现有证据汇总；当前沿用phase-04-*文件名作为发布证据镜像，历史报告保留原叙述。
7. 运行build、test、test:production、verify:sources和audit:final，检查页面与迁移。正式增加P30时需明确更新29项目基线测试并报告范围变化；当前交付不包含P30。

普通文字编辑只需build。方法解释发生实质变化但代码数据未变时，增加对应复合步骤ID的semanticRevision。删除步骤须登记旧ID→新ID或null，旧ID不能复用。

结果修改须更新learning/build.json输出哈希并核对输入归属。原代码、教学修正代码、输入哈希和结果数据变化会改变进度指纹，触发复习。

旧content:prepare/lessons:prepare是历史重导工具，不要覆盖当前发布。完整phase4:prepare重建后，需再执行phase6:prepare补回第六阶段审校层。phase6:prepare仅提取P14保存矩阵、同步0.6.0课程版本和证据，不训练模型。

生产HTTP检查需先启动正式服务。npm.cmd run check:final依次执行构建、测试、生产资源检查、原始哈希和内容审计，日志在docs/acceptance/logs。Python已验证3.13.9，直接依赖锁见analysis/environments/phase4-requirements.txt；只运行dist无需Python。
