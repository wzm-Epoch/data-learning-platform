# 数据分析项目学习平台

在线预览：https://wzm-epoch.github.io/data-learning-platform/

在线版通过GitHub Pages提供页面与课程资源，学习进度保存在访问时使用的浏览器中，与本机版独立。已有本机进度可通过设置中的JSON备份导入。在线访问需要网络，本机离线入口仍保持原用法。

维护者使用 `npm.cmd run build:pages` 生成适用于仓库子路径的 `dist-pages`，由 `gh-pages` 分支根目录发布。`main` 保存源码，推送源码不会自动重建在线预览；更新预览需要重新发布构建目录。构建目录不包含个人学习记录或本机配置。

## 从 GitHub 下载后启动

GitHub 仓库不包含依赖目录 `node_modules`、构建目录 `dist`、发行压缩包 `delivery`、本机路径配置或个人学习进度备份。首次下载源码后需要安装依赖并构建；下文“已附dist”的说明针对本机原交付目录。

已验证 Node.js 24.18.0。使用 PowerShell：

```powershell
git clone https://github.com/wzm-Epoch/data-learning-platform.git
cd data-learning-platform
npm.cmd ci
npm.cmd run build
npm.cmd start
```

打开 http://127.0.0.1:4173 。首次安装依赖需要联网，构建完成后的日常学习使用本地资源。之后可以运行 `npm.cmd start` 或双击 `启动学习平台.cmd`；按 Ctrl+C 停止服务。

现成教学内容的构建与浏览不需要原始数据目录；重新生成分析结果或检查原始文件，需要另行准备原始数据、Python环境及本机路径配置。不要向公开仓库提交个人配置和学习进度。样本、原保存输出与教学改编结果保留各自来源和限制；上传不表示第三方资料获得新的授权。

个人本机、离线优先的 React + TypeScript + Vite 学习平台。当前第六阶段候选交付：29项目、30课节、385个可阅读步骤，含95份交互图表、554份有效结果与128张本地图像预览。已验证浏览器外网阻断下的整课流程；系统物理断网冷启动未测。页内确认的最后浏览器复测与测试记录恢复仍受来源策略阻挡，不宣称最终验收全部通过。

交付入口：[最终验收报告](docs/acceptance-report.md)、[第六阶段报告](docs/stages/phase-06-report.md)、[用户指南](docs/user-guide.md)、[添加项目指南](docs/add-project-guide.md)、[备份恢复](docs/backup-restore-guide.md)、[已知问题](docs/known-issues.md)。下文前期版本说明属于历史记录；当前应用与课程版本为0.6.0。最终复查命令为`npm.cmd run check:final`，需先启动正式服务，日志保存于docs/acceptance/logs。

## 实际启动

已验证环境：Windows、Node.js 24.18.0、npm 11.16.0、Python 3.13.9。生产运行只需要 Node.js；Python仅用于开发时原文件核对。依赖版本锁在 package-lock.json，没有更新全局运行时。

已附生产构建 dist。双击本目录的 `启动学习平台.cmd`，或在 PowerShell 中运行：

```powershell
cd D:\项目\data-learning-platform
npm.cmd start
```

然后打开 http://127.0.0.1:4173 。按 Ctrl+C 停止。启动脚本仅服务 dist，独立于 Vite 和 node_modules；断网也能使用。请使用此固定地址，localhost、不同端口或不同浏览器的存储不会互通。4173被占用会明确报错并退出，不自动换端口。

不要双击 dist/index.html。未附打包exe；双击cmd依赖已验证的本机Node运行时。网页不会运行Python，也不请求原始CSV、模型或远程脚本。

## 开发与校验

首次安装需要联网，之后学习无需联网：

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run verify:sources
npm.cmd run dev
```

build 自动重建目录并检查 TypeScript。dev 在127.0.0.1:5173，仅用于开发，不作为正式学习入口。

## 结构与内容维护

- app/src/pages：首页、基础搜索目录、设置和后续阶段状态页。
- app/src/components：通用错误边界、空状态与未开放提示。
- app/src/features/learning、progress：课程展示、统一进度适配、备份与迁移。
- app/src/charts：第四阶段图表适配边界，首页不加载ECharts。
- app/src/styles：设计令牌与CSS Modules。
- content-source：registry.json、categories.json、stages.json、projects/独立内容包和审计输入副本；内容不硬编码到首页。
- schemas/catalog.mjs：Zod Schema，同时在生成时与浏览器加载时校验。
- scripts/generate-catalog.mjs：生成app/public/content/catalog.json。
- analysis/adapters：以后离线预计算适配层，原项目只读。
- local-config/paths.json：本机路径，不进入dist；源文件只保存相对引用。
- docs/stages：阶段报告及源文件完整性核对。

修改内容源后运行 npm.cmd run build。稳定ID不可复用；每项保留原名称、SHA-256、限制与状态。当前技术标签沿用审计 verifiedSkills，不重新根据import或招聘文字推断；精确代码单元证据索引将在课程制作阶段补齐。每个项目 sourceRefs 保留审计中全部资产哈希；不搬运原始数据。

## 当前功能与内容维护

项目库支持业务、难度、已核实技术、资源就绪度组合筛选和两种排序。12分类和29项目总览均可浏览；79个表级字典保留物理字段、读取类型、缺失及已核实/未知语义。人口清洗字段与物理表头分区。

当前上线内容源为 content-source/registry.json、categories.json、stages.json、knowledge.json 和 projects/Pxx/project.json。构建时生成轻量catalog与29个独立详情包，按项目加载。旧projects.json保留为第一阶段导入快照。目录Schema版本1.1，内容版本0.4.0。

新增元数据项目：添加registry条目与独立project.json，在分类和学习阶段声明归属，必要时补知识证据，然后运行 npm.cmd run build。无需修改页面。临时P30实验已验证，正式目录仍29项目。

`npm.cmd run content:prepare` 是当前29项目审计的初始导入工具，读取local-config中的批准文档与原目录并重建导入内容。常规人工编辑后只执行build；避免再次导入覆盖课程改编。它只读原文件，不执行Notebook或分析模型。

当前30课385步可阅读，学习状态不预填。进度、前置知识自我确认、偏好、最近有效位置统一保存在当前来源的 `da-learning:progress:v1`，schemaVersion 1，内容版本仍为0.4.0（本阶段不重制课程）。旧偏好和位置键只在没有新记录时读取一次，原值保留。应用版本0.5.0。

步骤需主动开始/完成，可标待复习；每步必修自评“我能解释”后才能标记完成。自评属于学习者自我确认，不是考试评分。练习文字仍是临时输入，不在备份范围。项目进度按有效必修步骤计算，总进度按可学习项目等权平均，同时展示完整完成数与内容覆盖数。

主要入口：`/#/projects`、`/#/categories/commerce`、`/#/projects/P21`、`/#/projects/P26/dictionary`、`/#/roadmap`、`/#/knowledge`。

## 验收材料

详见 [第一阶段报告](docs/stages/phase-01-report.md)。生产服务启动后运行 `npm.cmd run test:production`；其检查固定端口资源和端口冲突。当前系统断网后的冷启动尚未实测，报告中单独保留此项。

第二阶段详见 [phase-02-report.md](docs/stages/phase-02-report.md)，包含13项自动检查、29项目刷新、临时注册实验、截图及原资产哈希核对。

## 第三阶段历史记录（勿覆盖当前发布）

P21交易探索6步、自动报表5步、P11异常调查/EDA7步、P17预处理/聚类证据审辨7步。项目总览可进入课程，首页可继续阅读。原代码、教学修正与结果身份分别显示；网页不执行Python。练习回答仅临时保留，离开步骤清空。

编辑content-source/curriculum/representative-lessons.json后执行`npm.cmd run lessons:prepare`与`npm.cmd run build`。Pandas/NumPy环境见analysis/environments/phase3-requirements.txt。适配器只读输入，原结果提取和新预计算分开；不重训模型。

详见[第三阶段报告](docs/stages/phase-03-report.md)、[课程覆盖矩阵](docs/stages/phase-03-coverage-matrix.json)和[预计算证据](docs/stages/phase-03-precompute.json)。系统实际断网冷启动仍未实测。


## 第四阶段课程、图表与重建

逐项目覆盖、复现状态、缺口和真实验收见[第四阶段报告](docs/stages/phase-04-report.md)、[覆盖记录](docs/stages/phase-04-coverage.json)。从项目总览进入课程，最后“真实数据实验”步骤可切换本项目图表、表格与模型版本。表图支持的数据交互才开放，不支持任意在线重训。

```powershell
npm.cmd run phase4:prepare
npm.cmd run build
npm.cmd test
```

单项目可运行 `python -X utf8 analysis/adapters/P23/adapter.py`。Python依赖版本在analysis/environments/phase4-requirements.txt；xlrd隔离于analysis/vendor-phase4。原文件只读，所有输出到新工程。原Notebook不自动执行，旧HTML脚本不嵌入。

不要用旧content:prepare/lessons:prepare重导当前发布；它们会重建前阶段内容。修改课程文字后只运行build。完整学习进度已在第五阶段接入，详见下文。

第4阶段复核（2026-11-17）：见[复核报告](docs/stages/phase-04-review.md)。正式重建会自动同步覆盖、环境和代码哈希证据。


## 第五阶段：记录与备份

正式学习入口仍为 http://127.0.0.1:4173 。进度只属于本浏览器及此来源；不同浏览器、localhost、不同端口不会共享。清理浏览器或结束隐私会话可能丢失，不承诺磁盘自动备份。

- 设置 → 导出学习进度 JSON，主动选择下载保存位置（建议 D:\项目）。
- 设置 → 选择文件或粘贴备份 JSON → 合并/替换 → 预览影响 → 确认导入；替换另外确认。上限1 MiB、最多100条事件，严格校验schema、课程版本、稳定ID、结构与状态。
- 损坏或未知版本记录不会自动覆盖。先导出“原始存储恢复副本”，再选择有效备份替换或二次确认重置。原始恢复副本供排错保存，不是直接可导入的正常备份。
- 跨标签变化会提示，选择读取最新或逐条合并；写前比较存储快照，支持 Web Locks 时同来源写入串行化。不支持该API时提示单标签使用，保留写前版本检查但无法保证完全同时写入的原子性。
- 当前已开放385步及每步自评为必修。新工程 `content-source/progress-policy.json` 可显式排除不适用步骤、设置选修、登记删除映射；未就绪步骤不计入。必修练习应归属必修步骤。
- `scripts/generate-progress.mjs` 在build时生成 `progress-manifest.json`。文字、标题、讲解修订保留完成；代码、教学修正代码、输入哈希、结果数据/图表定义变化触发待复习。仅方法解释发生实质变化时，维护者必须增加对应步骤的 `semanticRevision`；不自动分析自然语言语义。旧ID不得复用，删除映射指向替代ID或null，原记录归档。

运行 `npm.cmd run test:phase5`；完整验收见 [第五阶段报告](docs/stages/phase-05-report.md)。本阶段结束，不自动进入第六阶段。
