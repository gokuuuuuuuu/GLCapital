---
name: Design Decisions
description: Key architecture and product decisions made during development
type: reference
---

## 数据源颜色标识（全局）
| 数据源 | 颜色 | 色值 |
|--------|------|------|
| T12 | 绿色 | #2E7D32 |
| HelloData | 蓝色 | #1565C0 |
| Rent Roll | 紫色 | #6A1B9A |
| RentCast | **青色** | **#0891B2**（从旧色 #00695C 改过，与 T12 绿色区分） |
| ATTOM | 灰蓝 | #37474F |
| Manual | 橙色 | #E65100 |

## Residential Rent Roll 设计决策

### 分组主键
- 主键是 SQF（面积），不是 Bedroom
- Unit Type 只是显示名称

### RR ↔ HD 对齐方式
- 按 sqft 最近值匹配，容差 ≤20%
- 同一个 HD 行可被多个 RR 分组匹配
- 超出容差的不匹配，HD 列显示 "—"

### As-is Rent 列头源选择器（2026-04-16 更新）
- **不是每行独立选源，是列头单个下拉器控制整列**
- 列头显示：`2025 As-is Rent [RR ▼]`
- 可选项：RR / HD Leased / HD 30D Leased / HD 60D Leased / HD 90D Leased（**不含 NER**）
- 切换后所有户型行（1BR/2BR/2BR Deluxe）统一显示所选源数据
- Edit Mode 下用户可对单行手动修改，该行变 Manual（橙色 badge + × 清除按钮）
- Manual 不受列头源切换影响
- Gap 和 Gap% 列已移除

### 三种数据场景
1. 无 RR 无 HD → 基础列空表
2. 有 RR 无 HD → As-is Rent 填充，源只能选 RR
3. 有 HD 无 RR → 可选 HD 源，RR 值空
4. 有 RR + 有 HD → 完整对比

### HD 数据源区分
- **HD 异步数据集（Excel 导出）**：Unit Mix sheet #10 — 按 floorplan 聚合的市场租金，多时间窗口（30/60/90天），用户上传文件
- **HD API（实时）**：暂不实现

## Revenue 模块

### HD 字段整合方式
- HD 字段通过 Add Field 弹窗添加（GPR、Vacancy Loss、Parking Income、Other Income、EGI）
- HD Property fees 字段已暂时移除（需 HD API 实时调用）

### Rent Income 三源切换
- T12 / HD / RentCast 三源：唯一支持多源的字段
- T12 源：Y3 = Avg(Y1, Y2)，Per Unit = Y3 ÷ Units ÷ 12
- HD 源：Y3 = GPR Median，Units = 最大 Units（含空置），Y1/Y2 留空
- RentCast 源：逻辑类似 HD
- HD/RC mock 数据已扩充覆盖 11 行 Per-Unit Income

### Source 下拉框样式（2026-04-16 更新）
- 药丸形状（border-radius:11px），有色边框 + 下拉箭头
- 文字居中（text-align:center + text-align-last:center）
- **宽度按当前选中项文字自适应**（`_srcSelectWidth` helper 函数按字符计算 px）
- 单源行显示静态同款药丸（无箭头）

### Edit Mode 输入框（2026-04-16 更新）
- 不再使用 `width:100%`，改为按值字符数计算显式 px 宽度
- Per Unit / Units / Y3 (Stab) 三处输入框均适用
- Revenue 和 Expenses 表一致

### Stabilized 年（Y3）
- T12 源：Y3 = Avg(Y1, Y2)
- HD 源：Y3 = HD 报告值
- Revenue 和 Expenses 表均不显示 "Actual" / "Stabilized" 列标注

### EGI 冲突警告
- 同时添加 EGI 和 GPR/Vacancy/Other 时显示警告

## Expenses 模块

### 上下表分区
- 上表 18 行（Per-Unit），下表 18 行（Flat）
- 基于 Cherry Commons T12 结构

### 三个双源字段
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee ↔ HD: Management Fees

### 增长率
- Property Tax 独立（asmtTaxGrowth）
- 其余用 asmtOpexGrowth
- **Assumptions 面板支持 3 位小数**（step=0.001，默认 3.000%）

### 非现金项处理
- Depreciation / Amortization / Refinance Fee 在 T12 有但 Cherry Commons Pro Forma 未体现，默认剔除（可 Add Field 补回）

## Cash Flow & Debt Coverage（2026-04-16 更新）

### 拆分为两张独立卡片
- **CASH FLOW 卡片**：Adjustment → Debt Service → Capex Reserves → Cash Flow after DS → Reserve for Capex → Capex Reserves from {Year}
- **DEBT COVERAGE 卡片**：NOI → Debt Service → DSCR

### Adjustment 行
- 取 T12 TOTAL CASH（不取 TOTAL ADJUSTMENTS）
- Y3 = Avg(Y1, Y2)，Y4+ 按 opexGrowth 推算

### Debt Service
- Y1-Y3：Debt Current 的 Annual Mortgage Payments
- Y4-Y7：Refinance I/O = Principal × Interest per annum

### DSCR 颜色
- ≥1.25 绿色 / 1.0-1.25 橙色 / <1.0 红色

## Closing Costs（2026-04-16 更新）

### 7 行百分率输入框
- Origination Fee（% × New Loan Size）
- County/State Transfer Tax / Recordation Tax / Acquisition Fee（% × Purchase Price）
- Closing / LLC Transfer-Related Fees / Cash Reserve（用户手填）
- 其他行无 % 输入框
- Transfer of Membership = Yes/No 单选

## Equity Required（2026-04-16 更新）

### Regular 表
- Loan to Cost %：% = New Loan Size ÷ Total Cost，值 = New Loan Size
- Equity：% = 1 - LTC%，值 = 手填
- LTPP：% = LTPP ÷ Purchase Price，值 = Loan to Cost
- Cash to Close：Total Acquisition - Loan to Cost - Acquisition Fee

### Refinance 表
- I/O Payment：% = 用户输入，值 = Loan to Cost × %（注：与 Debt Refinance 的 I/O 是两个独立公式）
- Loan to Cost %：% = LTC ÷ Total Cost，值 = LTPP（本表）
- Equity：% = 1 - LTC%，值 = % × Total Cost
- LTPP：% = LTC ÷ Purchase Price，值 = Loan to Cost（来自 Regular 表）
- Cash to Close：Total Cost - Loan to Cost - Acquisition Reserves

## AI 评分（2026-04-16 新增）

### 评分引擎
- 规则引擎（不调外部 AI），上限 85/100
- 完备性最高 50 分 + 正确性最高 35 分
- 等级：≥75 Excellent / ≥60 Good / ≥45 Fair / <45 Needs Attention

### UI
- 圆形进度环 SVG（sm 52px 用于卡片，md 72px 用于详情页 header）
- 环形进度按 /100 刻度
- 点击展开扣分项明细弹窗
- Save 按钮和状态切换触发重算

## T12 完整数据架构
- REVENUE = TOTAL RENTS + TOTAL MANAGEMENT INCOME + TOTAL FEES
- EXPENSES = 多个分类（含 MORTGAGE / PREFERRED RETURNS 等非 OpEx 项）
- NET INCOME = TOTAL REVENUE - TOTAL EXPENSES
- ADJUSTMENTS:
  - TOTAL CASH = SUM(5 个 CASH 明细)
  - TOTAL ACCOUNTS PAYABLE = TOTAL CASH + SUM(AP 明细)（注：AP 包含 TOTAL CASH）
  - TOTAL ADJUSTMENTS = TOTAL AP + Member Contributions + Distributions + Retained Earnings
- CASH FLOW = NET INCOME + TOTAL ADJUSTMENTS
- Pro Forma 的 Adjustment 行只用 TOTAL CASH
- BANK RECONCILIATION 区域（展示用，不参与计算）

## New Project 弹窗（2026-04-16 更新）
- 只有 Project Name 和 Property Address 两个字段
- Offer Price 和 Total Units 已移除（进入项目后再填）

## HTML 结构注意事项
- page-project-detail 曾因缺少一个 `</div>` 导致 Users/Settings 页面被嵌套吞没，已修复（commit 821c9ad）
