---
name: PRD - Expenses Module
description: Product Requirements Document for the Expenses module in Pro Forma
type: reference
---

## Expenses Module — PRD

### 1. 模块位置
Pro Forma 分析页 → Revenue & Expenses 子标签 → EXPENSES 区域（紧接 INCOME 区域下方）。

### 2. 核心目的
汇总物业所有运营支出，支持多数据源对比（T12 实际 vs HD 市场基准 vs 手动输入），结合增长率假设生成未来年度费用预测，为 NOI 计算提供支出端数据。

### 3. 数据源

| 数据源 | 标识颜色 | 提供内容 | 获取方式 |
|--------|---------|---------|---------|
| T12 | 绿色 #2E7D32 | 实际历史支出（Y1、Y2） | 用户上传 T12 Excel，解析 Expenses 区块 |
| HelloData (HD) | 蓝色 #1565C0 | 市场基准支出 | 用户上传 HD Excel → Expense Benchmarks |
| Manual | 橙色 #E65100 | 用户手动输入/修改 | 编辑模式直接输入 |

### 4. 表结构

- **上表（Per-Unit Expenses）**：随单元数量变化的费用，每行带 Per Unit 值、Source 下拉、Units 数
- **Subtotal (Per-Unit Expenses)**
- **FLAT EXPENSES 分隔行**
- **下表（Flat Expenses）**：物业级固定支出，无 Per Unit 列（显示 "—"）
- **Subtotal (Flat Expenses)**
- **Total Expenses** = 上表 Subtotal + 下表 Subtotal
- **% of EGI** = Total Expenses ÷ Total Revenue
- **[+ Add Field] 按钮**

### 5. 列定义

| # | 列名 | 说明 |
|---|------|------|
| 1 | Line Item | 费用项名称 + 数据源颜色标签 |
| 2 | Per Unit | 每单元每月金额，上表显示数值+"/mo"，下表显示 "—" |
| 3 | Source | 数据源下拉选择器（仅双源字段可切换） |
| 4 | Units | 单元数量 |
| 5 | Y1 (2023) | T12 第一年实际值 |
| 6 | Y2 (2024) | T12 第二年实际值 |
| 7 | Y3 (2025) | 基准年 |
| 8-11 | Y4-Y7 | 未来预测年，逐年按增长率推算 |

### 6. 默认行项 — 上表（Per-Unit Expenses）18 行

| # | 字段 | T12 分组 | 双源 |
|---|------|---------|------|
| 1 | Property Tax | TAXES | ✅ HD: Real Estate Taxes |
| 2 | Property Insurance | INSURANCE | ✅ HD: Property Insurance |
| 3 | Management Fee | MANAGEMENT | ✅ HD: Management Fees |
| 4 | Electricity | UTILITIES | |
| 5 | Gas | UTILITIES | |
| 6 | Water | UTILITIES | |
| 7 | Telephone / WiFi | UTILITIES | |
| 8 | Cleaning & Janitorial | CLEANING | |
| 9 | Garbage & Recycling | CLEANING | |
| 10 | Pest Control | CLEANING | |
| 11 | Plumbing | R&M | |
| 12 | HVAC | R&M | |
| 13 | Appliance Repair | R&M | |
| 14 | Repairs - Other | R&M | |
| 15 | Supplies | R&M | |
| 16 | Salary Expense | ADMIN | |
| 17 | Office Expense | ADMIN | |
| 18 | Bank Fees | ADMIN | |

### 7. 默认行项 — 下表（Flat Expenses）18 行

| # | 字段 | T12 分组 |
|---|------|---------|
| 19 | Maintenance Labor | CLEANING |
| 20 | Insurance - Other | INSURANCE |
| 21 | Accounting | LEGAL |
| 22 | Appfolio / Yardi | LEGAL |
| 23 | Commissions / Placement | MANAGEMENT |
| 24 | Painting | R&M |
| 25 | Flooring | R&M |
| 26 | Sub Contractor | R&M |
| 27 | Key / Lock Replacement | R&M |
| 28 | Security Service | R&M |
| 29 | Roof / Exterior | R&M |
| 30 | Elevator Contract | R&M |
| 31 | Elevator Repair | R&M |
| 32 | Taxes - Other | TAXES |
| 33 | Licenses & Registration | TAXES |
| 34 | Advertising | MARKETING |
| 35 | Meetings & Events | MARKETING |
| 36 | Inspection Costs | BUILDING |

### 8. 双源字段计算逻辑

三个双源字段：Property Tax、Property Insurance、Management Fee。

**T12 源（默认）：**
- Per Unit = Y3 ÷ Units ÷ 12
- Units = T12 实际 occupied units
- Y1、Y2 = T12 实际值
- Y3 = Avg(Y1, Y2)
- Y4+ = 前一年 × (1 + growth rate%)

**HD 源：**
- Per Unit = HD 值 ÷ 最大 Units 数 ÷ 12（最大 Units 含空置）
- Units = 自动填入最大 Units 数
- Y1、Y2 = 留空
- Y3 = HD 报告值
- Y4+ = 前一年 × (1 + growth rate%)

**Manual 源：**
修改 Per Unit 或 Units 后：Y3 = Per Unit × Units × 12，Source 自动变 Manual。

### 9. 增长率规则

| 字段 | 使用的增长率 | Assumptions 面板 |
|------|------------|-----------------|
| Property Tax | Property taxes growth rate | asmtTaxGrowth（独立） |
| 其余所有行项 | Operating expenses growth rate | asmtOpexGrowth |

### 10. Add Field 弹窗

**T12 字段（非默认行项，绿色标签）：**
Mortgage Interest, Mortgage - Other, Other Interest, Depreciation Expense, Amortization Expense, Refinance Fee Expense, Miscellaneous Expense, Guaranteed Payments, Pref - Int, Ask My Accountant, Marketing Expense → 均添加到下表

**HD 字段（类别级市场基准，蓝色标签）：**
- Utilities, Repair and Maintenance, Payroll and Benefits → 默认上表
- Marketing, Professional Fees, General and Administrative, Other Expenses, Total Operating Expenses → 默认下表

### 11. 编辑模式行为

| 交互 | 行为 |
|------|------|
| Per Unit 输入框 | 编辑模式下可修改，Y3 = Per Unit × Units × 12，Source 变 Manual |
| Units 输入框 | 编辑模式下可修改，Y3 联动更新 |
| Source 下拉 | 始终可切换（仅双源字段），不需要编辑模式 |
| Add Field 按钮 | 始终可见 |

### 12. T12 完整数据架构参考

T12 ADJUSTMENTS 区域（非 Pro Forma 使用，仅供参考）：
- CASH: Secondary Checking, Escrow-Prepaid Property Taxes, Escrow-Capex Reserves, Reserves, Investment in GLC Penn → TOTAL CASH
- ACCOUNTS PAYABLE: Buildings, Building Improvements, Building Depreciation, 5 Year Property, Deferred Loan Costs, Accumulated Amortization, Intercompany Loans (多个), Owner Held Security Deposits, Clearing Account, Prepaid Rent, BofA Credit Card, Mortgage Payable → TOTAL ACCOUNTS PAYABLE
- Member Contributions, Owner/Member Distributions, Retained Earnings
- TOTAL ADJUSTMENTS = TOTAL CASH + TOTAL AP + Contributions + Distributions + Retained Earnings
- CASH FLOW = NET INCOME + TOTAL ADJUSTMENTS
