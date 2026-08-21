# 前台 Make App Skill 平台化

## 范围

仅处理 `makeui`、`canvas-table-integration` 与 `make-app-permission` 三个前台应用相关 Skill；不修改其他 Skill 的规则、示例或本地安装副本。

## 变更

- 将三个 Skill 中“POC”导向的默认规则统一为“Make App”，保留原有前台 UI、表格编辑、字段注册与组件化合同。
- 将 `make-app-permission` 中本机安装目录的字面路径改为通用的“未版本化本地 Skill 安装”，避免发布内容携带本机目录约定。
- 新增三目录专用的平台化合同测试，以通用标识模式阻断 POC/控制台命名和本机路径再次进入这三个 Skill。
- 仅同步本次触及的本地安装副本文件；不覆盖 `canvas-table-integration` 安装副本中与本次无关的既有差异。

## 验证

- 运行前台 Skill 平台化合同、现有 UI/CanvasTable/权限合同、元数据检查和格式检查。
- 对源码与本地安装副本分别扫描项目标识、POC 表述与本机路径。
