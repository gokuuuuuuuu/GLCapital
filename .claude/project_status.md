---
name: Project Status
description: Current development progress and priorities
type: project
---

## 当前阶段
聚焦三个核心数据源：T12 + HelloData（HD）+ Rent Roll（RR），暂不扩展 ATTOM / RentCast。

## 已完成
- T12 Excel 解析 → Revenue & Expenses 表
- HD Financial Analysis sheet (#13) 解析 → Pro Forma 部分字段填充
- RR Excel 解析 → Residential Rent Roll 基础表（按 sqft 分组）
- 数据源全局颜色标识系统（顶部 DATA SOURCE legend）
- Project Summary 双源对比（Occupancy Rate、Total Units 的 RR vs HD chip 选择 + Manual）
- HD Unit Mix sheet (#10) 解析 → floorplan/beds/sqft/多租金口径
- Rent Roll 动态 HD 列（Market Ref + Gap + Gap%，指标下拉）
- Revenue Income 表重构（上下分区、行级源选择、Add Field 弹窗）
- Revenue 模块 PRD 完成（.claude/prd_revenue.md）
- Expenses 模块 PRD 完成（.claude/prd_expenses.md）

## 进行中 — Expenses 模块重构（部分完成）
已完成：
- HTML 结构改为上下表（Per-Unit + Flat）+ Add Field 弹窗
- JS 数据常量定义（EXP_UPPER_TABLE_LABELS, EXP_DUAL_SOURCE, EXP_ADDABLE_FIELDS）
- buildExpenseTable() 函数（替代旧 buildAccordion）
- Add Expense Field 弹窗逻辑 + 编辑模式 + Manual 源切换
- buildPFTable() 中替换旧 expense 渲染调用

待完成：
- **清理旧的 pfExpBody 引用**（app.js 中仍有残留）
- **删除 Revenue 表的 Actual/Stabilized 列标注**（用户要求移除）
- **Source 下拉框样式调整** — 双源字段的 select 宽度应与单源字段的 T12 badge 视觉一致
- **Rent Roll 表删除 Gap 和 Gap% 两列**
- **页面渲染验证** — 确认 Expenses 上下表、Subtotal、Total、NOI 计算正确

## 下一步
- **P2: HD 数据真实接入** — Revenue 和 Expenses 的 HD 源目前为 demo/placeholder 值
- **P2: Expenses 双源 HD 数据填充** — Property Tax / Property Insurance / Management Fee 的 HD 值需从 HD Expense Benchmarks 读取
- **P3: RentCast API 集成** — 字段映射文档已完成
- **P3: 导出功能** — Pro Forma 导出 PDF/Excel

## 待定
- RentCast API 集成（字段映射文档：.claude/rentcast_api_fields.md）
- ATTOM 数据接入
- HelloData API 实时调用（目前只用异步数据集/Excel）
- HD Property fees 字段（Dogs/Cats Monthly Rent, Application Fee 等）需 HD API 接入后才可用，已从 Revenue Add Field 列表移除
