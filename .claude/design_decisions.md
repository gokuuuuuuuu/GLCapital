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
| RentCast | 青绿 | #00695C |
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

### HD 动态列
- 位于 As-is Rent 与 Growth 之间
- 用户可通过下拉切换 HD 租金口径：Leased Rent / NER / Active Listing / 30d / 60d / 90d
- 编辑模式下可通过 × 按钮移除 HD 列
- 重新上传 HD 文件后自动恢复
- **Gap 和 Gap% 列已移除**（用户要求删除）

### 三种数据场景
1. 无 RR 无 HD → 基础 8 列空表
2. 有 RR 无 HD → 基础 8 列，As-is Rent 填充
3. 有 HD 无 RR → 基础 8 列 + HD 列，As-is Rent 空
4. 有 RR + 有 HD → 完整对比

### HD 数据源区分
- **HD 异步数据集（Excel 导出）**：Unit Mix sheet #10 — 按 floorplan 聚合的市场租金，多时间窗口（30/60/90天），用户上传文件
- **HD API（实时）**：market_rents 端点 — ML 预测最优租金；building_availability — 当前挂牌。暂不实现

### 产品渐进式体验
- 先传 HD → 能看到市场数据框架
- 再传 RR → 补全实际租金 + mark-to-market 对比
- 编辑模式下双源冲突字段可手动选择数据源

## Revenue 模块

### HD 字段整合方式
- HD 字段**不直接出现**在 Revenue 表中，而是通过 Add Field 弹窗让用户选择添加
- 用户可选择将 HD 字段添加到**上表**（Per-Unit Income，带 Per Unit 列）或**下表**（Other Income，统一型收入）
- Add Field 列表来自 HD Expense Benchmarks API（GPR、Vacancy Loss、Parking Income、Other Income、EGI）
- **HD Property fees 字段已暂时移除**（Dogs/Cats Monthly Rent、Application Fee、Storage Fee、各类 Parking），因为这些需要 HD API 实时调用，不在用户上传的 Excel 异步数据集中

### Rent Income 双源逻辑
- **唯一一个可同时由 T12 和 HD 提供的字段是 Rent Income**
- T12 源：直接用 T12 的 "Rent Income" 行数据，Y3 = Avg(Y1, Y2)
- HD 源：用 HD Expense Benchmarks 的 **GPR Median** 字段
- 选 HD 源时：
  - Per Unit 租金 = GPR Median ÷ 最大 Units 数（含空置单元）
  - Units 自动填入**最大 Units 数**（不管是否 occupied）
  - Y3 = GPR Median 值
  - Y1、Y2 留空
  - Y4+ 基于 Y3 按增长率推算

### Stabilized 年（Y3）
- 指物业达到正常运营状态后的第一个完整年度
- T12 源：Y3 = Avg(Y1, Y2)，消除历史波动
- HD 源：Y3 = HD 报告值（GPR Median）
- 是未来预测（Y4+）的起点基准
- **Revenue 和 Expenses 表均不再显示 "Actual" / "Stabilized" 列标注**（用户要求移除）

### EGI 冲突警告
- 当用户同时添加 EGI 和 GPR/Vacancy/Other Income 组件时，显示警告提示

## Expenses 模块

### 上下表分区
- **上表（Per-Unit Expenses）**：18 行，随单元数量变化，带 Per Unit / Source / Units 列
- **下表（Flat Expenses）**：18 行，物业级固定支出，Per Unit 显示 "—"

### 三个双源字段
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee ↔ HD: Management Fees
- 其余 33 个 T12 行项仅有 T12 源

### 增长率
- Property Tax 使用独立的 Property taxes growth rate（asmtTaxGrowth）
- 其余所有 Expense 行项使用 Operating expenses growth rate（asmtOpexGrowth）

### HD 字段在 Add Field 弹窗中
- HD Expense Benchmarks 提供的类别级汇总字段（Utilities、R&M、Payroll、Marketing、Professional Fees、G&A、Other、Total OpEx）
- 这些是类别汇总值，无法与 T12 单行 1:1 对应，仅作市场基准参考
- 用户通过 Add Field 弹窗选择添加

### T12 非默认行项在 Add Field 弹窗中
- Mortgage Interest/Other, Other Interest, Depreciation/Amortization, Refinance Fee, Miscellaneous, Guaranteed Payments, Pref-Int, Ask My Accountant, Marketing Expense
- 这些是 T12 中存在但默认不显示在 Pro Forma 中的项目（多为非现金、一次性或债务相关）

## T12 完整数据架构
- REVENUE = TOTAL RENTS + TOTAL MANAGEMENT INCOME + TOTAL FEES
- EXPENSES = 10 个分类（Cleaning, Insurance, Legal, Management, Mortgage, R&M, Taxes, Utilities, Admin, Marketing, Building, Preferred Returns）
- NET INCOME = TOTAL REVENUE - TOTAL EXPENSES
- ADJUSTMENTS = TOTAL CASH + TOTAL ACCOUNTS PAYABLE + Member Contributions + Distributions + Retained Earnings
- CASH FLOW = NET INCOME + TOTAL ADJUSTMENTS
- ADJUSTMENTS 区域为资产负债表调整项，Pro Forma 不使用
