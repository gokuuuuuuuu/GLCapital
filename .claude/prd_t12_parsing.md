---
name: PRD - T12 File Parsing
description: T12 Excel file parsing strategy and data structure
type: reference
---

## T12 文件解析 — PRD

### 解析策略：三区域分治 + 锚点边界

#### 固定区域（Revenue + Expenses）
字段名全物业一致，精确匹配。

#### 动态区域（Adjustments）
Intercompany Loans、Member Contributions 因物业而异，按锚点行切分动态收集。

#### 银行对账区域（Bank Reconciliation）
解析并展示。

### 完整字段树形图

```
T12 Cash Flow Statement
├── 元信息
│   ├── R1: 标题
│   ├── R2: 物业名称
│   ├── R3: 期间（如 "Period = Nov 2023-Oct 2025"）
│   └── R4: 记账基础（如 "Book = Cash"）
│
├── REVENUE
│   ├── [RENTS]
│   │   ├── Rent Income
│   │   ├── Other Rental Income
│   │   ├── Application Fee Income
│   │   ├── NSF Fees Collected
│   │   ├── Late Fee
│   │   ├── Pet Fee
│   │   ├── Furniture Charge
│   │   ├── Laundry Income
│   │   ├── Insurance Services
│   │   ├── Utility Reimbursement Fee
│   │   ├── Concessions
│   │   └── ★ TOTAL RENTS = SUM(上面11项)
│   ├── [MANAGEMENT INCOME]
│   │   ├── Maintenance Labor Fee Income and Materials Reimbursement
│   │   ├── Prepaid Rent
│   │   └── ★ TOTAL MANAGEMENT INCOME = SUM(上面2项)
│   ├── [FEES]
│   │   ├── Miscellaneous Income
│   │   └── ★ TOTAL FEES = SUM(上面1项)
│   └── ★★ TOTAL REVENUE = TOTAL RENTS + TOTAL MANAGEMENT INCOME + TOTAL FEES
│
├── EXPENSES
│   ├── [CLEANING AND JANITORIAL EXPENSE]（增长率：opexGrowth）
│   │   ├── Cleaning and Janitorial Expense
│   │   ├── Maintenance Labor Expense
│   │   ├── Garbage and Recycling
│   │   ├── Pest control
│   │   └── ★ TOTAL
│   ├── [INSURANCE]（opexGrowth）
│   │   ├── Property Insurance
│   │   ├── Insurance - Other
│   │   └── ★ TOTAL
│   ├── [LEGAL AND OTHER PROFESSIONAL FEES]（opexGrowth）
│   │   ├── Accounting
│   │   ├── Appfolio
│   │   └── ★ TOTAL
│   ├── [MANAGEMENT FEES EXPENSE]（opexGrowth）
│   │   ├── Management Fee Expense
│   │   ├── Commissions/Placement Fee Expense
│   │   └── ★ TOTAL
│   ├── [MORTGAGE]（不推算）
│   │   ├── Mortgage Interest
│   │   ├── Mortgage - Other
│   │   ├── Other interest
│   │   └── ★ TOTAL
│   ├── [REPAIRS AND MAINTENANCE]（opexGrowth）
│   │   ├── Painting / Plumbing / Flooring / HVAC / Sub Contractor
│   │   ├── Key/Lock Replacement / Security Service / Roof Repair
│   │   ├── Elevator Contract / Elevator Repair Expense
│   │   ├── Appliance Repair / Repairs - Other / Supplies
│   │   └── ★ TOTAL
│   ├── [TAXES]
│   │   ├── Property Tax（taxGrowth 独立）
│   │   ├── Taxes - Other（opexGrowth）
│   │   ├── Licenses and Registration Fees（opexGrowth）
│   │   └── ★ TOTAL
│   ├── [UTILITIES]（opexGrowth）
│   │   ├── Electricity / Gas / Water / Telephone
│   │   └── ★ TOTAL
│   ├── [ADMINISTRATIVE EXPENSES]（opexGrowth）
│   │   ├── Office Expense / Salary Expense / Bank Fees
│   │   └── ★ TOTAL
│   ├── [MARKETING]（opexGrowth，无独立分组头行）
│   │   ├── Marketing Expense / Advertising / Meetings and Events
│   │   └── ★ TOTAL MARKETING EXPENSES
│   ├── [BUILDING EXPENSES]
│   │   ├── Inspection Costs（opexGrowth）
│   │   ├── Depreciation expense（不推算，非现金）
│   │   ├── Amortization Expense（不推算，非现金）
│   │   ├── Refinance Fee Expense（不推算，一次性）
│   │   ├── Miscellaneous Expense（opexGrowth）
│   │   └── ★ TOTAL
│   ├── Depreciation Expense (Unused)（独立行，不推算）
│   ├── [PREFERRED RETURNS]（不推算）
│   │   ├── Guaranteed Payments
│   │   ├── Pref - Int - {Name}（动态）
│   │   └── ★ TOTAL PREFERRED PAYMENTS
│   ├── Ask My Accountant（独立行，opexGrowth）
│   └── ★★ TOTAL EXPENSES
│
├── ★★ NET INCOME = TOTAL REVENUE − TOTAL EXPENSES
│
├── ADJUSTMENTS
│   ├── [CASH]
│   │   ├── Secondary Checking
│   │   ├── Escrow - Prepaid Property Taxes
│   │   ├── Escrow - Capex Reserves
│   │   ├── Reserves
│   │   ├── Investment in {Name}（动态）
│   │   └── ★ TOTAL CASH = SUM(CASH明细)
│   ├── [ACCOUNTS PAYABLE]
│   │   ├── Buildings / Building Improvements / Building Depreciation
│   │   ├── 5 Year Property / Deferred Loan Costs / Accumulated Amortization
│   │   ├── Intercompany Loan - {Name}（动态，N个）
│   │   ├── Owner Held Security Deposits / Clearing Account / Prepaid Rent
│   │   ├── Bank of America Credit Card / Mortgage Payable
│   │   └── ★ TOTAL ACCOUNTS PAYABLE = TOTAL CASH + SUM(AP明细)
│   ├── [MEMBER CONTRIBUTIONS]（动态，N个投资人）
│   │   └── Member Contribution - {Name} × N
│   ├── [DISTRIBUTIONS]（动态）
│   │   ├── Owner Distribution
│   │   └── Member Distribution - {Name} × N
│   ├── Retained Earnings
│   ├── Prior Years Retained Earnings
│   └── ★ TOTAL ADJUSTMENTS = TOTAL AP + Contributions + Distributions + Retained Earnings
│
├── ★★ CASH FLOW = NET INCOME + TOTAL ADJUSTMENTS
│
└── [BANK RECONCILIATION]（展示用，不参与计算）
    ├── Operating Cash: Beginning Balance / Ending Balance / Difference
    ├── Secondary Checking: Beginning Balance / Ending Balance / Difference
    ├── Other Checking: Beginning Balance / Ending Balance / Difference
    └── Cash-Security Deposit: Beginning Balance / Ending Balance / Difference
```

### 数据提取规则
- Y1 = SUM(B:M)，Y2 = SUM(N:Y)，或直接取 Z 列年度合计
- 期间从 R3 解析：Y1年份 = startYear+1，Y2年份 = endYear
- Pro Forma Adjustment 行取 TOTAL CASH（不是 TOTAL ADJUSTMENTS）
