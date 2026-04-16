# GL Capital Underwriting Platform — System Walkthrough
# GL Capital Underwriting 系统功能介绍

## Note · 说明

Since the requirements are still being finalized, this first version reflects our initial interpretation of the workflow. There may be gaps with what you actually need — please flag any adjustments and we'll iterate quickly.

由于本次需求尚在明确过程中，本版本是我们基于初步理解先行设计的一版，可能与你们预期存在一定偏差。你们可以在此基础上提出更明确的需求或修改意见，我们会在后续迭代中快速响应。

Items marked with ⚠ are internal logic assumptions we made in the absence of complete spec — please confirm.

文中标注 ⚠ 的部分，是我们在需求不完整情况下所做的内部逻辑假设，需要你们重点确认。

---

## 1. Login & Project Management · 登录与项目管理

### Pain Points · 痛点
- Underwriters share Excel files over email — no version control, no team visibility.
- 团队之间通过邮件传递 Excel，缺乏统一的版本管理和协作视图。
- Admins have no centralized place to manage user accounts and permissions.
- 管理员没有集中的账号与权限管理入口。

### Solution · 解决方案
- Admins create users and assign roles (Administrator / Underwriter) under **Admin → Users**.
- 管理员在 Admin → Users 页面创建账户并分配角色。
- All projects appear on the **Projects** page as cards showing Offer Price, Units, Cap Rate, NOI, DSCR, IRR, AI Score, and upload status (T12 / RR / Debt).
- 所有项目集中在 Projects 页，以卡片形式展示报价、套数、Cap Rate、NOI、DSCR、IRR、AI 评分以及上传状态。
- Each project carries one of two states: **Draft** or **Complete**. Status changes require confirmation to prevent accidents.
- 每个项目有 Draft / Complete 两种状态，切换需二次确认。
- API keys (HelloData / RentCast / ATTOM) are configured under **Settings**; stored server-side, masked in the UI.
- 第三方 API Key 在 Settings 页配置，存储在服务端，前端以掩码展示。

### ⚠ Needs Confirmation · 需你们确认
- The current design assumes one underwriter per project. If multi-user collaboration is needed, we'll add edit-locking and conflict resolution.
- 当前假设每个项目由单一 Underwriter 负责。如需多人协作，我们会补充编辑锁与冲突解决机制。

---

## 2. File Upload · 文件上传

### Pain Points · 痛点
- Manually pulling data from broker-provided T12 / Rent Roll / Debt Excel files takes about 4 hours per deal.
- Underwriter 需要从 Broker 提供的 Excel 中手动提取数据，一个 deal 平均耗费约 4 个工时。

### Solution · 解决方案
The system supports four file types, each with its own tab:
系统支持四种文件类型，分别对应独立 Tab：

| Tab | File · 文件 | Purpose · 用途 |
|-----|------------|---------------|
| T12 | .xlsx | Trailing 12 months P&L · 近 12 个月历史财报 |
| Rent Roll | .xlsx | Current tenant roster · 当前租户明细 |
| HelloData | .xlsx | HD async dataset (market benchmarks) · HD 异步数据集（市场基准） |
| Debt Analysis | .xlsx | Loan summary (Current + Refinance) · 贷款合同摘要 |

**Steps · 操作步骤：**
1. Click the relevant tab → Upload button (or drag the file onto the dashed drop zone). · 点击对应 Tab → Upload 或拖拽到虚线区域。
2. The system parses the file and pushes data into downstream modules. · 系统自动解析并填充到相关模块。
3. Uploaded files appear as cards with file name, size, and parsed row count. · 已上传文件以卡片形式展示文件名、大小、解析行数。

### ⚠ Needs Confirmation · 需你们确认
- The T12 parser assumes a fixed column layout: Column A = labels, B–M = Y1 (12 months), N–Y = Y2 (12 months), Z = annual total. We'll adapt the parser if your T12 format differs.
- T12 解析器假设列结构固定（A=字段名，B-M=Y1，N-Y=Y2，Z=年度合计）。若格式不同，我们会做适配。
- Member Contributions / Intercompany Loans / Distributions vary per property (different investor names). The parser uses anchor rows (TOTAL CASH / TOTAL ACCOUNTS PAYABLE / TOTAL ADJUSTMENTS) to dynamically detect boundaries.
- Member Contributions / Intercompany Loans / Distributions 因物业而异，解析器用锚点行动态识别边界。

---

## 3. Summary & Residential Rent Roll · Summary 与租金清单

### Pain Points · 痛点
- Project Summary and Unit Mix are typically the first sections an underwriter fills in, but data often comes from multiple sources (RR actual vs HD market benchmark) with conflicting values.
- Project Summary 与 Unit Mix 是 Underwriter 最先录入的部分，但数据常来源于多个渠道，数值不一致，取舍困难。

### Solution · 解决方案

**Project Summary**
- Fields like Occupancy Rate and Total Apartment Units display both RR and HD values side-by-side; click one to mark it as the active value.
- Occupancy Rate 与 Total Apartment Units 等字段同时展示 RR 和 HD 两个值，点击其一作为生效值。
- Manual edits are flagged with an orange **Manual** badge.
- 手动修改后标注为橙色 Manual 标签。
- Click **+ Add Field** to add custom fields (Lot Size, Building Size, etc.).
- 点击 + Add Field 可补充自定义字段。

**Residential Rent Roll**
- The **2025 As-is Rent** column header has a dropdown that controls the data source for the entire column. Options:
- 2025 As-is Rent 列头含一个下拉选择器，控制整列的数据源，可选项为：
  - **RR** — Actual rent from Rent Roll · Rent Roll 实际租金
  - **HD Leased** — HelloData Leased Rent
  - **HD 30D / 60D / 90D Leased** — HD trailing 30/60/90-day leased rent · HD 近 30/60/90 天 Leased Rent
- After switching the column source, all unit-type rows (1BR / 2BR / 2BR Deluxe) display values from the selected source.
- 切换列头源后，所有户型行均以所选源的数据展示。
- In Edit Mode, the user can manually override a row's value; that row is auto-tagged **Manual** and is not affected by subsequent column source changes (clear via the × button).
- Edit Mode 下用户可对某行手动改值，该行自动标 Manual，且不受列头源切换影响（可点 × 清除）。
- **2025 As-is Rent Annually** and **2026 Projected Rent** columns auto-recalculate based on the active source.
- 2025 As-is Rent Annually 与 2026 Projected Rent 根据当前生效源自动重算。

### ⚠ Needs Confirmation · 需你们确认
- We group unit types by **sqft**, not bedroom count, since this matches the native RR file format. HelloData additionally provides a **Floorplan Name** which we can show as a label.
- 户型分组按 sqft 而非 Bedroom，这是 RR 文件原生格式；HD 数据集另提供 Floorplan Name，我们可作为辅助展示。
- RR–HD matching uses closest sqft within ±20% tolerance; rows beyond tolerance show "—" in the HD column.
- RR 与 HD 按 sqft 最接近匹配，容差 ±20%，超出容差显示 "—"。

---

## 4. Revenue · 收入

### Pain Points · 痛点
- T12 Rent Income and HD GPR Median often disagree — underwriters must judge which to anchor the stabilized year on.
- T12 Rent Income 与 HD GPR Median 常不一致，Underwriter 需判断稳定年用哪个为基准。
- Market benchmarks like GPR / Vacancy Loss / Parking Income don't exist in T12, but are sometimes needed as ad-hoc references.
- GPR / Vacancy Loss / Parking Income 等市场基准 T12 不含，但有时需作参考。

### Solution · 解决方案

The Revenue table is split into two sub-tables:
Revenue 表分为上下两个子表：

**Upper · Per-Unit Income** (incomes that scale with units)
**上表 · Per-Unit Income**（按单元计算的收入）
- Each row shows: Per Unit/mo, Source (dropdown), Units, Y1–Y7. · 每行展示 Per Unit/月、Source、Units、Y1–Y7。
- **Rent Income** is the only field with three switchable sources: T12 / HD / RentCast. · Rent Income 是唯一支持 T12 / HD / RentCast 三源切换的字段：
  - **T12**: Per Unit = Avg(Y1, Y2) ÷ Units ÷ 12; Y3 = Avg(Y1, Y2)
  - **HD**: Per Unit = GPR Median ÷ max Units ÷ 12; Y3 = GPR Median; Y1/Y2 left blank (HD has no historical data) · HD 无历史数据，Y1/Y2 留空
  - **RentCast**: Same logic as HD · 逻辑类似 HD
- All other rows (Late Fee / Pet Fee / etc.) are T12-only; their Source column shows a static T12 chip. · 其他行只有 T12 源，Source 列显示固定 T12 标签。

**Lower · Other Income** (flat, non-per-unit incomes)
**下表 · Other Income**（统一型收入）
- No Per Unit column (displays "—"). · 无 Per Unit 列。
- Used for Prepaid Rent, Miscellaneous Income, etc. · 用于 Prepaid Rent、Miscellaneous Income 等。

**Total · 合计**
- Subtotal (Per-Unit) + Subtotal (Other) = **Total Revenue**

**Add Field Modal**
- Click **+ Add Field** to add HD-only fields: GPR / Vacancy Loss / Parking / Other Income / EGI. · 可追加 HD 专有字段。
- A warning appears if the user adds EGI together with its components (GPR / Vacancy / Other) to avoid double counting. · 同时添加 EGI 与其组成部分时会提示避免重复计算。

### ⚠ Needs Confirmation · 需你们确认
- For HD-sourced Rent Income, we use **max Units** (including vacant) — not occupied — to keep the GPR figure intact.
- HD 源的 Rent Income 用最大 Units 数（含空置），以保持 GPR 口径完整性。
- Y4–Y7 are projected from Y3 using the **Residential Rent Growth Rate** (default 3%, adjustable in Assumptions panel).
- Y4-Y7 从 Y3 按住宅租金增长率推算（默认 3%，Assumptions 可调）。

---

## 5. Expenses · 支出

### Pain Points · 痛点
- T12 has 30+ expense line items spread across multiple categories. Users want to distinguish which scale per-unit vs. which are property-level fixed costs.
- T12 含 30+ 费用明细分多类，用户需要区分按单元变化 vs 物业级固定支出。
- Some items (Property Tax / Insurance / Management Fee) have HD market benchmarks worth comparing against.
- 部分费用有 HD 市场基准可做对比。

### Solution · 解决方案

**Two-table layout (mirrors Revenue) · 上下表分区**

- **Upper · Per-Unit Expenses (18 rows)** — scale with unit count
- **上表 · Per-Unit Expenses (18 行)** — 随单元数量变化
  - Property Tax, Property Insurance, Management Fee, all Utilities, Cleaning items, per-unit R&M, Administrative items
- **Lower · Flat Expenses (18 rows)** — property-level fixed
- **下表 · Flat Expenses (18 行)** — 物业级固定支出
  - Maintenance Labor, Insurance - Other, Accounting, Commissions, Painting, Flooring, Elevator Contract, etc.

**Three dual-source fields (T12 / HD switchable) · 三个双源字段**
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee Expense ↔ HD: Management Fees

**Growth Rates · 增长率规则**
- Property Tax uses an independent **Property Taxes Growth Rate**.
- Property Tax 使用独立的 Property Taxes Growth Rate。
- All other expenses use the **Operating Expenses Growth Rate**.
- 其余费用项统一使用 Operating Expenses Growth Rate。

**Add Field Modal**
- T12 non-default fields: Mortgage Interest / Depreciation / Amortization / Pref - Int, etc.
- HD category-level totals: Utilities / R&M / Marketing / Payroll, etc.

### ⚠ Needs Confirmation · 需你们确认
- The 18/18 row split is based on Cherry Commons' T12 structure; other properties may need a different split.
- 当前 18/18 行划分基于 Cherry Commons，其他物业可能需要相应调整。
- Depreciation / Amortization / Refinance Fee exist in T12 but are absent from the Cherry Commons Pro Forma Expenses section, so we exclude them by default (re-addable via Add Field).
- Depreciation / Amortization / Refinance Fee 在 T12 有但 Cherry Commons Pro Forma 未体现，因此默认剔除（可通过 Add Field 补回）。

---

## 6. NOI / Cash Flow / Debt Coverage · 净营业收入 / 现金流 / 债务覆盖

### Pain Points · 痛点
- NOI, Debt Service, and Cash Flow are scattered across multiple Excel sheets, making them hard to read or reconcile.
- 三个概念在 Excel 中分散在多个 Sheet，阅读和校对成本高。

### Solution — Three Stacked Cards · 拆分为三张独立卡片

**Card 1 · Net Operating Income**
- NOI = Total Revenue − Total Expenses

**Card 2 · Cash Flow**

| Line · 行 | Formula · 计算公式 |
|----------|------------------|
| Adjustment | T12 TOTAL CASH (Y1/Y2 actual), Y3 = Avg, Y4+ grown by OpEx rate · T12 TOTAL CASH，Y4+ 按 OpEx 增长率推算 |
| Debt Service | Y1–Y3 = Debt Current annual payment; Y4–Y7 = Refinance I/O (Principal × Interest per annum) |
| Capex Reserves from Cash Flow | Manual · 手动输入 |
| **Cash Flow after Debt Service** | NOI − Adjustment − Debt Service − Capex Reserves |
| Reserve for Capex | Manual · 手动输入 |
| Capex Reserves from {Year} Cash Flow | Manual · 手动输入 |

**Card 3 · Debt Coverage**
- Shows NOI, Debt Service, DSCR. · 展示 NOI、Debt Service、DSCR 三行。
- DSCR = NOI ÷ Debt Service.
- Color rules: ≥1.25 green (healthy) / 1.0–1.25 orange (warning) / <1.0 red (risk). · 颜色规则按健康度分级。

### ⚠ Needs Confirmation · 需你们确认
- The Adjustment row pulls only T12's **TOTAL CASH**, not TOTAL ADJUSTMENTS. Our reasoning: Member Contributions / Distributions / Retained Earnings are capital-structure items, not operating cash flow. This interpretation is also based on the Cherry Commons Pro Forma — please confirm it matches your standard practice.
- Adjustment 行只取 T12 的 TOTAL CASH，不取 TOTAL ADJUSTMENTS。基于 Cherry Commons Pro Forma 的写法推测，请确认是否符合标准做法。
- Y4–Y7 Debt Service currently assumes Interest-Only refinance. If amortization is in play, the formula needs adjustment.
- Y4-Y7 假设再融资为 Interest Only，若实际为 amortization loan，公式需调整。

---

## 7. Closing Costs · 交易成本

### Pain Points · 痛点
- Closing Costs mix fixed fees (Appraisal / Legal) with percentage-based fees (Origination / Transfer Tax / Acquisition Fee), making the Excel cluttered and hard to review.
- Closing Costs 混合了固定费用和百分比费用，Excel 中呈现凌乱，不易审阅。

### Solution · 解决方案
- 25+ line items in a three-column layout: % | Amount | Notes. · 25+ 条行项，三列布局。
- Only the following 7 rows have a percentage input (% column blank for others): · 只有以下 7 行有百分率输入框：

| Field · 字段 | % × Base · 百分率 × 基数 |
|-------------|------------------------|
| Origination Fee & Lender Fees | % × New Loan Size (from Refinance Event) |
| County/State Transfer Tax | % × Purchase Price (As-is value) |
| Recordation Tax | % × Purchase Price (As-is value) |
| Acquisition Fee | % × Purchase Price (As-is value) |
| Closing | Manual · 用户手填 |
| LLC Transfer-Related Fees | Manual · 用户手填 |
| Cash Reserve | Manual · 用户手填 |

- **Transfer of Membership Transaction** is a Yes/No selector (Yes = 0, No = 1). · 改为 Yes/No 单选。
- **Total Closing Costs** auto-sums; **Closing Cost Ratio** = Total ÷ Purchase Price. · 自动求和并计算比率。

---

## 8. Purchase Price / Construction Equity · 报价与建设权益

### Solution · 解决方案

**Purchase Price**

| Field · 字段 | Source · 数据源 |
|-------------|----------------|
| Purchase Price (As-is value) | Auto-filled from HD Pro Forma Model · Deal Assumptions (blue HD badge) · 从 HD 自动填充并标识 |
| Per Unit (Residential/Retail) | Purchase Price ÷ Units |
| NOI for Year 1 | Read from NOI card · 从 NOI 卡片读取 |
| Cap Rate on Year 1 Income | NOI ÷ Purchase Price |
| Closing Cost Percentage | From Closing Costs module · 来自 Closing Costs 模块 |
| Total Acquisition Cost | Closing + Purchase |
| Total Cost (excludes capex) | Same as above · 同上 |

**Construction Equity**
- Fields: Acquisition Reserves, Reserves for Distribution, Refinance Reserves, Capex Reserves.
- 字段：Acquisition Reserves、Reserves for Distribution、Refinance Reserves、Capex Reserves。
- These are manual inputs for now. We noticed Cherry Commons' Pro Forma uses `Total Capex Reserves = SUM(fields) + $2,000,000` buffer — we'll wire up auto-calculation once the $2M is confirmed as standard practice.
- 目前手动填写。我们注意到 Cherry Commons Pro Forma 中 Total Capex Reserves = SUM(各字段) + $2M 缓冲，待你们确认 $2M 是否为标准做法后再实现自动计算。

### ⚠ Needs Confirmation · 需你们确认
- Is the **$2M buffer** standard GL Capital practice? If yes, we'll hardcode it; if no, we can make it configurable.
- $2M 缓冲是否为标准做法？是则固化在公式里，否则做成可配置参数。

---

## 9. Sale Event · 出售事件

### Solution · 解决方案

Two scenarios switched via sub-tabs: **Regular Sale** and **After Refinance**.
两种场景，以子标签切换：Regular Sale 与 After Refinance。

| Field · 字段 | Source / Formula · 来源 / 公式 |
|-------------|------------------------------|
| Year of Sale | Year picker · 年份选择器 |
| Date | Date picker · 日期选择器 |
| NOI of that Year | Auto from NOI card · 从 NOI 卡片自动读取 |
| Cap Rate | HD badge (Going-in / Exit Cap Rate) · HD 标识 |
| Value of Property | NOI ÷ Cap Rate (or HD Property Value with HD badge) |
| Cost of Sale | % × Value of Property |
| Loan of that Year (Beg of Year) | Manual · 手填 |
| Capital Transaction Fee to Sponsor | % × Value of Property |
| **Final Proceeds from Sale** | Value − Cost of Sale − Loan − Capital Fee |
| Req return of capital to investors | Manual · 手填 |
| Excess avail after return of capital | IF(Final − Req > 0, Final − Req, 0) |
| Investor | % × Excess |
| Sponsor | % × Excess |

### ⚠ Needs Confirmation · 需你们确认
- For Sale After Refinance, Return of Capital is read from the Waterfall Distribution table's Beginning Investment Amount. Please confirm the source is correct.
- Sale After Refinance 中 Return of Capital 从 Waterfall 表的 Beginning Investment Amount 读取，请确认来源正确。

---

## 10. Equity Required (Regular / Refinance) · 所需权益

### Solution · 解决方案

**Regular** (three columns: Field | % | Value)
**Regular 场景**（三列：字段 | 百分率 | 值）

| Field · 字段 | % | Value · 值 |
|-------------|---|-----------|
| Loan to Cost % | New Loan Size ÷ Total Cost (excludes capex) | = New Loan Size |
| Equity | 1 − Loan to Cost % | Manual · 手动填写 |
| LTPP | LTPP ÷ Purchase Price (As-is value) | = Loan to Cost |
| Cash to Close | — | Total Acquisition − Loan to Cost − Acquisition Fee |

**Refinance** (additional rows on top of Regular)
**Refinance 场景**（在 Regular 基础上增加）

| Field · 字段 | % | Value · 值 |
|-------------|---|-----------|
| I/O Payment | User input · 用户输入 | = Loan to Cost × % |
| Loan to Cost % | Loan to Cost ÷ Total Cost (excludes capex) | = LTPP (same table) |
| Equity | 1 − Loan to Cost % | = % × Total Cost (excludes capex) |
| LTPP | Loan to Cost ÷ Purchase Price | = Loan to Cost (from Regular table) |
| Cash to Close | — | Total Cost − Loan to Cost − Acquisition Reserves |

### ⚠ Needs Confirmation · 需你们确认
- The **I/O Payment** here (Loan to Cost × %) is a different formula from the **I/O** in the Debt Refinance table (Principal × Interest per annum). Please confirm both formulas behave as expected.
- 此处 I/O Payment（Loan to Cost × %）与 Debt Refinance 表的 I/O（Principal × Interest per annum）是两个独立公式，请确认两者都符合预期。

---

## 11. Refinance Event · 再融资事件

### Solution · 解决方案

| Field · 字段 | Formula · 公式 |
|-------------|---------------|
| Year of Refinance | Manual · 手填 |
| Date | Date picker · 日期选择器 |
| NOI of that Year | Auto from NOI · 自动从 NOI 读取 |
| Cap Rate | Manual · 手填 |
| Value of Property | NOI ÷ Cap Rate |
| New Loan Size | % × Value of Property |
| Cost of Refinance (Include % Fee) | % × Value of Property |
| Loan of that Year (End of Year) | Manual · 手填 |
| Yield Maintenance / Prepay | % × Loan of that Year (End of Year) |
| Final Proceeds from Refinance | New Loan − Cost − Loan End − Yield Maintenance |
| Reserve for Unit Upgrades | Manual · 手填 |
| Total Distribution | Final Proceeds − Reserve for Unit Upgrades |

---

## 12. Tax Assessment / Waterfall Distribution · 税务评估 / 瀑布分配

### Current Status · 当前状态
- The Cherry Commons sample has many blank cells in these two sections, so we couldn't infer the field-level rules or intended outputs.
- 由于 Cherry Commons 示例表中这两部分存在大量空白单元格，我们无法推断字段间的计算规则与目标产出。
- Both modules are manual-input only at this stage, with no auto-calculation.
- 两个模块目前均为手动输入，暂未实现自动计算。

### ⚠ Needs Confirmation · 需你们确认
- **Waterfall Distribution**: Please provide the detailed allocation rules (preferred return, IRR hurdles, catch-up, carried interest tiers) so we can implement auto-calculation.
- Waterfall Distribution：请提供详细的分配规则，以便我们实现自动计算。
- **Tax Assessment**: Please share what you'd like this module to do (standard depreciation schedules? tax protest workflow?) so we can design accordingly.
- Tax Assessment：请说明具体诉求以便我们进一步设计。

---

## 13. Debt Analysis · 债务分析

### Solution · 解决方案

Two cards display the key fields for Debt Current and Debt Refinance.
当前提供两张卡片展示 Debt Current 与 Debt Refinance 的关键字段。

**Current Debt card** (13 fields):
**Current Debt 卡片**（13 字段）：
- Loan Amount, Principal, Interest per annum / per month, Mortgage Constant, Commencement / Maturity dates, Duration (Years / Months)
- Mortgage Insurance Premium (group header) → MIP per Annum, MIP per Month
- Annual Mortgage Payments, Interest per year Payment

**Refinance Scenario card** (13 fields): same structure, with I/O replacing Interest per year Payment.
**Refinance Scenario 卡片**（13 字段）：结构相似，但用 I/O 替代 Interest per year Payment。

**Year-by-Year DSCR table** (below the two cards): 7 rows × [Period | NOI | Debt Service | DSCR | Debt Type | Cash Flow After DS]
**Year-by-Year DSCR 表**（卡片下方）：7 行 × 6 列。

### ⚠ Needs Confirmation · 需你们确认
- Please confirm the data input approach for this module: do you prefer **uploading two Excel sheets (Debt Current + Debt Refinance) for system parsing**, or a **fixed field layout with direct manual entry**? We can implement either — just let us know your preference.
- 请确认此模块的录入方式：是上传 Debt Current 与 Debt Refinance Excel 由系统自动解析，还是固定字段布局由用户直接手填？两种方式我们都可以实现。

---

## 14. AI Score · AI 评分

### Pain Points · 痛点
- No objective benchmark to judge whether an underwriting is complete and reasonable before submission.
- 在提交审核前，缺乏客观标准判断一份 Underwriting 是否完整合理。

### Solution · 解决方案

A rule-based scoring engine (no external AI calls), capped at **85 / 100**. We deliberately reserve 15 points to reflect the principle that no underwriting can be "perfect."
采用规则引擎打分（不调用外部 AI），上限 85 分 / 满分 100。故意保留 15 分余量，体现"无 Underwriting 可以完美"的理念。

**Two evaluation dimensions · 两个评估维度：**
- **Completeness (max 50)**: checks whether Summary / RR / T12 / HD files are uploaded and key fields in Revenue / Expenses / Debt / Closing are filled.
- 完备性（最高 50 分）：检查文件上传与关键字段填写。
- **Correctness (max 35)**: sanity checks on NOI / DSCR / Cash Flow / Occupancy / Cap Rate / Expense Ratio / Growth Rates.
- 正确性（最高 35 分）：对核心指标做合理性校验。

**Grades · 等级：**

| Score · 分数 | Grade · 等级 | Color · 颜色 |
|-------------|-------------|-------------|
| ≥75 | Excellent | Dark Green · 深绿 |
| ≥60 | Good | Green · 绿 |
| ≥45 | Fair | Orange · 橙 |
| <45 | Needs Attention | Red · 红 |

**Display · 展示位置：**
- Circular progress ring (e.g. 67 / 100) on each project card. · 项目列表卡片上展示圆形进度环。
- Same ring + grade label next to project name on the detail page. · 详情页项目名旁同款进度环 + 等级文字。
- Click the ring → modal showing deduction breakdown. · 点击进度环弹窗显示扣分项明细。

**Recalculation triggers · 重新计算触发：**
- Every Save click. · 每次点击 Save。
- Project status change (Draft ↔ Complete). · 项目状态切换时。

### ⚠ Needs Confirmation · 需你们确认
- The current scoring rules are our initial guess. Senior GL Capital underwriters should review the weights and thresholds.
- 当前打分规则是初步推测，希望资深 Underwriter review 权重与阈值后调整。
- If higher fidelity is needed, we can swap in a real LLM (Claude / GPT) at the cost of latency and API spend.
- 如有更高要求，后续可接入真实 LLM 打分，但会引入额外延迟与 API 成本。

---

## 15. Edit Mode & Save · 编辑模式与保存

### Solution · 解决方案

**Edit Mode toggle** (button in page header):
**Edit Mode 开关**（位于页面头部按钮）：
- **OFF**: all fields display as read-only. · 关闭：所有字段以只读形式展示。
- **ON**: input fields appear for Per Unit / Units / Y3 in Revenue & Expenses, As-is Rent in Unit Mix, and editable cells in Closing Costs / Purchase Price / Sale Event / Equity Required / Refinance / Tax / Waterfall.
- 打开：Revenue / Expenses 的 Per Unit / Units / Y3、Unit Mix 的 As-is Rent，以及其他模块的可编辑单元格出现输入框。

**Manual override rule · 手动覆盖规则：**
- Any value typed in Edit Mode is tagged with the orange **Manual** badge.
- 用户在 Edit Mode 下输入的值均标注为橙色 Manual 标签。
- Manual values have the highest priority — even re-uploading T12 / HD won't override them, until the user explicitly clears them.
- Manual 值优先级最高，即使重新上传 T12/HD 文件也保留，直至用户显式清除。

**Save · 保存**
- Click Save → writes to local storage, re-renders tables, recalculates AI Score. · 写入本地存储、重新渲染、重算 AI 评分。
- Updates the "last modified" timestamp on the project card. · 同步更新项目卡片上的最后修改时间。

**Export · 导出**
- Click Export → exports the full Pro Forma to PDF in module order. · 按模块顺序导出 PDF。

---

## 16. Assumptions Panel · 假设面板

### Solution · 解决方案

Click the **Assumptions** button to open a modal with three growth rates (default 3.000%, 3-decimal precision):
点击 Assumptions 按钮打开弹窗，包含三个增长率（默认 3.000%，精确到 3 位小数）：
- **Residential Market Annual Rent Growth Rate** · 住宅市场租金增长率
- **Operating Expenses Growth Rate** · 运营费用增长率
- **Property Taxes Growth Rate** (independent) · 物业税增长率（独立）

These three rates drive all Y4–Y7 projections.
这三个增长率驱动 Y4-Y7 的所有预测。

Y1–Y3 are historical actuals and unaffected by growth rates.
Y1-Y3 是历史实际值，不受增长率影响。

---

*End of walkthrough. Ready for GL Capital review. · 文档结束，欢迎 GL Capital 审阅。*
