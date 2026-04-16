---
name: Project Status
description: Current development progress and priorities
type: project
---

## 当前阶段
聚焦三个核心数据源：T12 + HelloData（HD）+ Rent Roll（RR）。明天（2026-04-15）甲方验收。

## 已完成
### 数据源 & 解析
- T12 Excel 解析 → Revenue & Expenses 表
- HD Financial Analysis sheet (#13) 解析 → Pro Forma 部分字段填充
- RR Excel 解析 → Residential Rent Roll 基础表（按 sqft 分组）
- HD Unit Mix sheet (#10) 解析 → floorplan/beds/sqft/多租金口径
- 数据源全局颜色标识系统（顶部 DATA SOURCE legend）
- RentCast 颜色改为青色 #0891B2（与 T12 绿色明显区分）

### Project Summary & Rent Roll
- Project Summary 双源对比（Occupancy Rate、Total Units 的 RR vs HD chip 选择 + Manual）
- Rent Roll 动态 HD 列（Market Ref 指标下拉，Gap/Gap% 已移除）
- Unit Mix As-is Rent 列**列头单下拉**控制整列源（RR / HD Leased / HD 30D/60D/90D）
- Edit Mode 下行内可修改，自动变 Manual（橙色 + 清除按钮 ×）
- As-is Rent Annually 与 Projected Rent 根据当前生效源自动重算

### Revenue & Expenses
- Revenue Income 表重构（上下分区、行级源选择、Add Field 弹窗）
- Revenue 表 Actual/Stabilized/Projected header 标注已移除
- Rent Income 三源切换（T12 / HD / RentCast），HD/RC mock 数据扩充覆盖 11 行 Per-Unit Income
- Expenses 模块重构（上下表 Per-Unit/Flat 分区、3 个双源字段、Add Field 弹窗、编辑模式 + Manual）
- Source 下拉框药丸样式 + 文字居中 + 宽度按当前选项自适应
- Edit 输入框宽度按字符数计算 px（不再撑满整个单元格）

### NOI / Cash Flow / Debt Coverage
- Cash Flow 表拆分为 CASH FLOW + DEBT COVERAGE 两张独立卡片
- Cash Flow: Debt Service Y4+ 使用 I/O（Principal × Interest per annum）
- Cash Flow: Adjustment Y3=Avg(Y1,Y2)，Y4+ 按 opexGrowth 推算
- Cash Flow: Adjustment 行只取 T12 TOTAL CASH（不取 TOTAL ADJUSTMENTS）
- Debt Coverage 卡片含 NOI / Debt Service / DSCR 三行（颜色按健康度）

### 其他模块
- Closing Costs: 只保留 7 行百分率输入框（Origination/Transfer Tax/Recordation/Acquisition/Closing/LLC Transfer/Cash Reserve），Transfer of Membership 改为 Yes/No 单选
- Sale Event: Cap Rate / Value of Property 加 HD 标识，去掉多余百分率框
- Equity Required (regular + refinance): 百分率列 + 公式逻辑明确（注意：refinance 表的 I/O Payment 与 Debt Refinance 表的 I/O 是两个独立公式）
- Debt Analysis: 上传按钮 + MIP 分组标题 + 动态 tbody IDs + 字段名修正（Interest per year Payment）
- T12 页面重构：补全 Building Expenses 全字段 + Depreciation Unused + Bank Reconciliation 卡片

### 用户与项目管理
- New Project 弹窗删除 Offer Price / Total Units 字段
- AI 评分系统（规则引擎）— 上限 85/100，完备性 50 + 正确性 35
- AI 评分圆形进度环展示在项目卡片 + 详情页 header
- AI 评分点击展开扣分项明细弹窗
- Save 按钮触发重新评分

### Bug 修复
- 修复 page-project-detail 缺少 `</div>` 导致 Users/Settings 页面被嵌套吞没
- Assumptions 三个增长率支持 3 位小数（step="0.001"，默认 3.000%）
- Assumptions 输入框宽度 62px → 78px 适配 3 位小数显示

### 文档
- PRD 文档完成：Revenue、Expenses、T12 解析、Rent Roll、Cash Flow、Debt Coverage
- 系统功能介绍文档（中文版 + 中英对照版）— `system_walkthrough.md` / `system_walkthrough_zh.md`
- 演示发言稿 cheat sheet — `demo_cheatsheet.md`

## 下一步待办

### P1 — 甲方验收后的高优先级
- **Tax Assessment 模块** — 等甲方提供详细规则后实现自动计算（标准折旧计划、税务申诉流程？）
- **Waterfall Distribution 模块** — 等甲方提供分配规则（优先回报、IRR 门槛、Catch-up、Carried Interest 分层）
- **HD Pro Forma Model 真实接入** — Purchase Price / Sale Event Cap Rate 自动填充（目前只是带蓝色 HD 标识，但数据链路未真正接通）
- **Debt Analysis HD 双源** — 从 HD Financing Assumptions 读取 Loan Amount/Interest Rate（待甲方确认是否需要 Excel 自动解析 vs 固定字段手填）
- **Construction Equity 公式实现** — 待甲方确认 $2M 缓冲是否标准做法

### P2 — 数据真实接入
- HD 数据真实接入 — Revenue/Expenses 的 HD 源目前为 demo 值，需从 HD Expense Benchmarks 读取
- T12 解析器实现 — PRD 已完成（三区域分治：固定/动态/对账），按 PRD 实现
- 文件预览弹窗 — 上传文件后点击可弹窗预览 Excel 内容
- RR 文件解析逻辑细化 — 明确上传后的字段解析规则和数据流向

### P3 — 协作与运维
- 多人协作 — 编辑锁、版本控制（当前假设单 underwriter 负责一个项目）
- AI 评分接入真实 LLM（Claude / GPT）打分（替代规则引擎）
- Pro Forma 导出 PDF / Excel
- 文件解析的格式适配（不同物业的 T12 格式）

### 待定
- RentCast API 集成（字段映射文档：.claude/rentcast_api_fields.md）
- ATTOM 数据接入
- HelloData API 实时调用（目前只用异步数据集/Excel）
- HD Property fees 字段需 HD API 接入后才可用

## ⚠ 待甲方确认事项汇总（来自 system_walkthrough.md）
1. 多人协作机制
2. T12 列结构是否与我们假设一致
3. Unit Mix 按 sqft 分组（非 Bedroom）是否合适
4. RR-HD 匹配 ±20% 容差是否合理
5. HD Rent Income 用最大 Units（含空置）是否符合预期
6. Cash Flow Adjustment 取 TOTAL CASH（非 TOTAL ADJUSTMENTS）是否符合标准做法
7. Y4-Y7 Debt Service 假设 I/O 是否符合实际
8. Construction Equity $2M 缓冲是否标准
9. Sale After Refinance 的 Return of Capital 来源
10. Equity Required 与 Debt Refinance 两个独立 I/O 公式是否都正确
11. Waterfall 详细规则
12. Tax Assessment 工作流
13. Debt Analysis 录入方式（Excel 解析 vs 手填）
14. AI 评分权重与阈值
15. Manual 值持久性策略

## 提交记录（关键 commit）
- `821c9ad` fix: page-project-detail 缺 `</div>` 导致 Users/Settings 不可见
- `198c7af` Assumptions 支持 3 位小数 + 文档更新
- `b13d96d` Unit Mix 列头 Source 选择器（替代行级）
- `9e356f6` 下拉框宽度计算修正
- `79e3ec8` 下拉框/输入框宽度自适应 + Unit Mix 合并 + New Project 简化
- `dcfc6e7` RentCast 改青色 + 下拉框药丸 + HD/RC mock 扩充
- `763bf89` Source 文字居中 + 输入框宽度 + Unit Mix 行级源
- `98358f7` AI 评分圆形进度环
- `c42a7ef` AI 评分规则引擎
- `bf84b91` Cash Flow / Debt Coverage 拆分 + T12 树形重建
- `1e63e1f` PRD 对齐：Cash Flow I/O / Closing Costs % / Sale Event HD / Equity Required
