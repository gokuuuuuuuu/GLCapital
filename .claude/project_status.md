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
- Rent Roll 动态 HD 列（Market Ref 指标下拉，Gap/Gap% 已移除）
- Revenue Income 表重构（上下分区、行级源选择、Add Field 弹窗，Actual/Stabilized 标注已移除）
- Expenses 模块重构（上下表 Per-Unit/Flat 分区、3 个双源字段、Add Field 弹窗、编辑模式 + Manual 源切换）
- Cash Flow 表拆分为 CASH FLOW + DEBT COVERAGE 两张独立卡片
- Cash Flow: Debt Service Y4+ 使用 I/O（Principal × Interest per annum）
- Cash Flow: Adjustment Y3=Avg(Y1,Y2)，Y4+ 按 opexGrowth 推算
- Closing Costs: 只保留 7 行百分率输入框，Transfer of Membership 改为 Yes/No 单选
- Sale Event: Cap Rate / Value of Property 加 HD 标识，去掉多余百分率框
- Equity Required (regular + refinance): 百分率列 + 公式逻辑明确
- Debt Analysis: 上传按钮 + MIP 分组标题 + 动态 tbody IDs
- Unit Mix: As-is Rent 活跃源标记（✓）联动 Annually/Projected 计算
- T12 页面重构：补全 Building Expenses 全字段 + Depreciation Unused + Bank Reconciliation 卡片
- PRD 文档完成：Revenue、Expenses、T12 解析、Rent Roll、Cash Flow、Debt Coverage

## 下一步待办
- **AI 评分功能** — 每次 Save 时 AI 对 underwriting 内容打分，展示在页面上
- **Tax Assessment 模块** — 明确功能定义和计算逻辑
- **Waterfall Distribution 模块** — 明确解析逻辑和分配计算
- **RR 文件解析逻辑** — 明确上传后的字段解析规则和数据流向
- **HD 数据真实接入** — Revenue/Expenses 的 HD 源目前为 demo 值，需从 HD Expense Benchmarks 读取
- **Debt Analysis HD 双源** — 从 HD Pro Forma Model Financing Assumptions 读取 Loan Amount/Interest Rate
- **Purchase Price / Sale Event HD 自动填充** — 从 HD Deal Assumptions 读取 Purchase Price、Cap Rate
- **T12 解析器实现** — PRD 已完成，按三区域分治策略（固定/动态/对账）解析 Excel
- **文件预览弹窗** — 上传文件后点击可弹窗预览 Excel 内容

## 待定
- RentCast API 集成（字段映射文档：.claude/rentcast_api_fields.md）
- ATTOM 数据接入
- HelloData API 实时调用（目前只用异步数据集/Excel）
- HD Property fees 字段需 HD API 接入后才可用
- Pro Forma 导出 PDF/Excel
