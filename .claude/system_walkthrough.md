# GL Capital Underwriting Platform — System Walkthrough

> **Disclaimer · 说明**
> Since the business requirements are still evolving, this first version reflects our best interpretation of the workflow. We welcome the client to refine requirements or request changes based on what you see here.
> · 由于我们接到的需求并不是很具体，本版本是我们基于理解先设计的一版，可能与甲方预期存在偏差。请甲方在此基础上提出更明确的需求或修改意见。
>
> Items marked with ⚠ indicate internal logic assumptions that deserve special attention.
> · 标注 ⚠ 的地方是我们做的内部逻辑假设，需要甲方重点确认。

---

## 1. Login & Project Management · 登录与项目管理

### Pain Point · 痛点
- Underwriters share Excel files over email, making version control and team visibility difficult.
  · Underwriter 通过邮件传递 Excel 文件，版本管理和团队可见性都很困难。
- Admins have no centralized way to assign users or manage access.
  · 管理员没有集中管理用户和权限的入口。

### Solution · 解决方案
- Admin role creates users via the **Admin → Users** panel. Each user gets a role (`Administrator` or `Underwriter`).
  · 管理员通过 **Admin → Users** 页面创建账户，分配角色（管理员 / Underwriter）。
- All projects live in the **Projects** page as cards showing Offer Price, Units, Cap Rate, NOI, DSCR, IRR, AI Score, and upload status (T12 / RR / Debt).
  · 所有项目在 **Projects** 页以卡片展示，含报价、套数、Cap Rate、NOI、DSCR、IRR、AI 评分和文件上传状态。
- Each project has status: **Draft** (work in progress) or **Complete** (finalized). Switching status requires confirmation.
  · 每个项目有两种状态：Draft（进行中）和 Complete（已完成），切换需二次确认。
- Admin → Settings stores API keys (HelloData / RentCast / ATTOM) server-side, displayed as masked values.
  · 管理员在 Settings 页配置 API Key，存储在服务端，前端显示掩码。

### ⚠ Needs Confirmation · 需甲方确认
- We assume one underwriter is assigned per project. If multiple underwriters collaborate, we need edit-lock / conflict-resolution logic.
  · 我们假设每个项目由一个 underwriter 负责。如果需要多人协作，我们需要增加编辑锁和冲突解决机制。

---

## 2. File Upload · 文件上传

### Pain Point · 痛点
- Underwriters manually parse T12 / Rent Roll / Debt schedules from vendor Excel files, which takes ~4 hours per deal.
  · 从 broker 提供的 T12 / Rent Roll / Debt Excel 中手动提取数据，一个 deal 平均耗费 4 个工时。

### Solution · 解决方案
The system supports four file types, each with its own tab:

| Tab | File Type | Purpose · 用途 |
|-----|-----------|---------------|
| T12 | `.xlsx` | Trailing 12 months P&L · 近 12 个月历史财报 |
| Rent Roll | `.xlsx` | Current tenant roster · 当前租户明细 |
| HelloData | `.xlsx` | HD async dataset (market benchmarks) · HD 异步数据集（市场基准） |
| Debt Analysis | `.xlsx` | Debt Current / Refinance sheets · 贷款合同摘要 |

Steps · 操作步骤：
1. Click the target tab, then click **Upload** or drag the file into the drop zone.
   · 点击对应 Tab，然后点击 Upload 按钮或拖拽文件到虚线框。
2. The system parses the file and populates downstream modules automatically.
   · 系统自动解析文件，将数据填充到相关模块。
3. Uploaded files show as cards with file name, size, parsed row count.
   · 已上传的文件以卡片展示文件名、大小、解析行数。

### ⚠ Needs Confirmation · 需甲方确认
- Our T12 parser assumes the column layout: Column A = labels, B-M = Year 1 (12 months), N-Y = Year 2 (12 months), Z = annual total. Different T12 formats need custom parsers.
  · T12 解析器假设列结构固定：A = 字段名，B-M = Y1（12个月），N-Y = Y2（12个月），Z = 年度合计。不同格式的 T12 需要单独适配。
- Member Contributions, Intercompany Loans, and Distributions vary per property (different investor names). The parser uses anchor rows (`TOTAL CASH`, `TOTAL ACCOUNTS PAYABLE`, `TOTAL ADJUSTMENTS`) to dynamically extract these.
  · Member Contributions / Intercompany Loans / Distributions 因物业而异（投资人姓名不同），解析器用锚点行动态识别边界。

---

## 3. Summary & Rent Roll · 摘要与租金清单

### Pain Point · 痛点
- The **Project Summary** and **Unit Mix** sections are the first things an underwriter fills in, but data often comes from multiple sources (Rent Roll actual vs. HelloData market benchmark) with different values.
  · Project Summary 和 Unit Mix 是 underwriter 最先填的部分，但数据往往来自多个源（RR 实际 vs HD 市场基准），数值不同。

### Solution · 解决方案

**Project Summary**
- Fields like **Occupancy Rate** and **Total Apartment Units** show both RR and HD values side-by-side. User clicks one to mark it as the active source.
  · Occupancy Rate 和 Total Units 等字段同时展示 RR 和 HD 两个值，用户点击其中一个作为生效值。
- Manual edits override both sources and are flagged with an orange **Manual** badge.
  · 手动修改后标记为橙色 Manual。
- Click **+ Add Field** to add custom fields (Lot Size, Building Size, etc.).
  · 点击 + Add Field 添加自定义字段。

**Residential Rent Roll**
- Each unit type row has its own **As-is Rent** source selector (per-row dropdown):
  · 每个户型行有独立的 As-is Rent 源下拉框：
  - `RR` — actual rent from Rent Roll · 实际租金
  - `HD Leased / NER / 30d / 60d / 90d` — HelloData market rent by metric · HD 市场租金的不同口径
  - `Manual` — set automatically when user types a value in Edit Mode · 编辑模式下手动输入则变 Manual
- The **As-is Rent Annually** and **2026 Projected Rent** columns recalculate based on each row's active source.
  · 年化收入和预测收入根据每行活跃源重新计算。

### ⚠ Needs Confirmation · 需甲方确认
- We group Unit Mix rows by **sqft** (not bedroom count), to match the most common Appfolio export format.
  · 我们按 sqft（不是卧室数）分组户型，这是 Appfolio 导出最常见的格式。
- RR ↔ HD matching uses closest sqft within ±20% tolerance. Rows beyond tolerance show "—" for HD values.
  · RR 和 HD 按 sqft 最接近匹配，容差 ±20%，超出容差显示 "—"。

---

## 4. Revenue (Income) · 收入

### Pain Point · 痛点
- T12 Rent Income and HelloData GPR Median often disagree. Underwriters need to choose which to trust for the stabilized year.
  · T12 Rent Income 和 HD GPR Median 数值常常不一致，underwriter 需要选择用哪个作为稳定年的基准。
- Market benchmark fields (GPR, Vacancy Loss, Parking Income) don't exist in T12 but need to be added as ad-hoc rows.
  · GPR / Vacancy Loss / Parking Income 这些市场基准字段 T12 没有，但有时需要临时加进来做参考。

### Solution · 解决方案

The Revenue table splits into two sub-tables:

**Upper Table: Per-Unit Income** · 上表：按单元计算的收入
- Each row has **Per Unit / mo**, **Source** (dropdown), **Units**, **Y1-Y7** columns.
  · 每行展示：Per Unit/月、Source（下拉）、Units、Y1-Y7。
- **Rent Income** is the only field with dual sources (T12 / HD / RentCast):
  · Rent Income 是唯一可在 T12 / HD / RentCast 之间切换的字段：
  - **T12 source**: Per Unit = Avg(Y1, Y2) ÷ Units ÷ 12, Y3 = Avg(Y1, Y2)
  - **HD source**: Per Unit = GPR Median ÷ max Units ÷ 12, Y3 = GPR Median, Y1/Y2 blank (HD has no history)
  - **RentCast source**: similar to HD
- Other rows (Late Fee, Pet Fee, etc.) are T12-only. Their Source column shows a static T12 pill.
  · 其他行（Late Fee / Pet Fee 等）只有 T12 源，Source 列显示固定 T12 药丸。

**Lower Table: Other Income** · 下表：统一型收入
- No Per Unit column (shows "—") · 无 Per Unit 列（显示 "—"）
- Used for items like Prepaid Rent, Miscellaneous Income · 用于 Prepaid Rent、Miscellaneous Income 等

**Totals** · 合计
- Subtotal (Per-Unit Income) + Subtotal (Other Income) = **Total Revenue**
  · 两个子表 Subtotal 之和 = Total Revenue

**Add Field modal** · Add Field 弹窗
- Users click **+ Add Field** to add HD-specific fields (GPR, Vacancy Loss, Parking Income, Other Income, EGI).
  · 点击 + Add Field 可添加 HD 专有字段（GPR / Vacancy Loss / Parking / Other Income / EGI）。
- Warning shown if user adds EGI alongside its components (GPR + Vacancy + Other) to avoid double-counting.
  · 如果同时添加 EGI 和它的组成部分（GPR/Vacancy/Other），系统提示避免重复计算。

### ⚠ Needs Confirmation · 需甲方确认
- For HD-sourced Rent Income, we use **max units (including vacant)** — not occupied — to keep GPR intact.
  · HD 源的 Rent Income 用最大 Units 数（含空置），不用 occupied，保持 GPR 完整性。
- Y4-Y7 are projected from Y3 by the **Residential Rent Growth Rate** (default 3%, editable in Assumptions).
  · Y4-Y7 从 Y3 按租金增长率推算（默认 3%，Assumptions 可改）。

---

## 5. Expenses · 支出

### Pain Point · 痛点
- T12 has 30+ expense line items grouped by category (Cleaning, Insurance, R&M, Taxes, Utilities, etc.). Users want to see which are per-unit costs vs. flat property-level costs.
  · T12 有 30+ 费用行项按分类归组，用户需要区分哪些是按单元计算、哪些是物业级固定支出。
- Some expenses (Property Tax, Property Insurance, Management Fee) have HD market benchmarks that should be comparable to T12 actuals.
  · 部分费用（Property Tax / Insurance / Management Fee）有 HD 市场基准，可做对比。

### Solution · 解决方案

**Two-table split** (mirrors Revenue design):

- **Upper Table: Per-Unit Expenses (18 rows)** — scales with unit count
  · 上表：按单元变化的费用 18 行
  - Includes: Property Tax, Property Insurance, Management Fee, all Utilities, Cleaning items, per-unit R&M items, Admin items
- **Lower Table: Flat Expenses (18 rows)** — fixed property-level
  · 下表：物业级固定支出 18 行
  - Includes: Maintenance Labor, Insurance-Other, Accounting, Commissions, Painting, Flooring, Elevator Contract, etc.

**Three dual-source fields** (T12 / HD switchable):
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee Expense ↔ HD: Management Fees

**Growth rate handling** · 增长率规则
- **Property Tax** uses its own **Property Taxes Growth Rate** (independent) · 独立增长率
- All other line items use **Operating Expenses Growth Rate** · 其余用 OpEx 增长率

**Add Field modal** · Add Field 弹窗
- Shows both T12-only fields (Mortgage Interest, Depreciation, Amortization, Pref-Int, etc.) and HD category-level benchmarks (Utilities total, R&M total, Marketing total, etc.).
  · 弹窗列出 T12 的非默认字段（Mortgage Interest / Depreciation 等）和 HD 的类别汇总（Utilities / R&M / Marketing 汇总）。

### ⚠ Needs Confirmation · 需甲方确认
- Our 18-row upper / 18-row lower split reflects how Cherry Commons' T12 breaks down. Other properties may need different grouping.
  · 我们按 Cherry Commons 的 T12 做了 18/18 行划分，其他物业可能需要调整。
- Depreciation, Amortization, and Refinance Fee are flagged with ⚠ because Pro Forma usually excludes non-cash items.
  · Depreciation / Amortization / Refinance Fee 标记为 ⚠，Pro Forma 通常剔除这些非现金项。

---

## 6. NOI / Cash Flow / Debt Coverage · 净营业收入 / 现金流 / 债务覆盖

### Pain Point · 痛点
- The relationship between NOI, Debt Service, and Cash Flow is often scattered across multiple spreadsheet tabs.
  · NOI / Debt Service / Cash Flow 的关系在 Excel 里散落在多个 sheet，不直观。

### Solution · 解决方案 — three stacked cards · 三张卡片

**Card 1: Net Operating Income**
- `NOI = Total Revenue − Total Expenses` · NOI = 总收入 − 总支出

**Card 2: Cash Flow**
| Line | Formula |
|------|---------|
| Adjustment | T12 TOTAL CASH (Y1/Y2 actuals), Y3 = Avg, Y4+ grows by OpEx rate |
| Debt Service | Y1-Y3 = Debt Current Annual Payment; Y4-Y7 = Refinance I/O (Principal × Interest per annum) |
| Capex Reserves from Cash Flow | Manual input |
| **Cash Flow after Debt Service** | NOI − Adjustment − Debt Service − Capex Reserves |
| Reserve for Capex | Manual |
| Capex Reserves from {Year} Cash Flow | Manual |

**Card 3: Debt Coverage**
- Shows NOI, Debt Service, DSCR side-by-side.
  · 展示 NOI、Debt Service、DSCR。
- `DSCR = NOI ÷ Debt Service` · 颜色：≥1.25 绿色健康，1.0-1.25 橙色警戒，<1.0 红色危险

### ⚠ Needs Confirmation · 需甲方确认
- **Adjustment** uses only **TOTAL CASH** from T12, not the full TOTAL ADJUSTMENTS, because Member Contributions / Distributions / Retained Earnings are capital-structure items, not operating cash flow.
  · Adjustment 行只取 T12 的 TOTAL CASH，不取 TOTAL ADJUSTMENTS。因为 Member Contributions / Distributions / Retained Earnings 属于资本结构，不是运营现金流。
- **I/O formula**: Y4-Y7 Debt Service assumes interest-only payments. If the refinance loan has amortization, this formula needs adjustment.
  · Y4-Y7 假设再融资贷款是 Interest Only。如果实际是 amortization loan，公式需调整。

---

## 7. Closing Costs · 交易成本

### Pain Point · 痛点
- Closing cost line items mix fixed fees (Appraisal, Legal) with percentage-based fees (Origination, Transfer Tax, Acquisition Fee), making the spreadsheet confusing.
  · Closing Costs 混合了固定费用（Appraisal / Legal）和百分比费用（Origination / Transfer Tax / Acquisition Fee），表格混乱。

### Solution · 解决方案
- 25+ line items listed with three columns: `%`, `Amount`, `Notes`.
  · 25+ 行项，三列布局：百分率、金额、备注。
- Only these 7 rows have the **`%` input field** (others show empty `%` column):
  · 只有这 7 行有百分率输入框（其他行百分率列为空）：

| Field | % × Base |
|-------|---------|
| Origination Fee & Lender Fees | % × New Loan Size (from Refinance Event) |
| County/State Transfer Tax | % × Purchase Price (As-is value) |
| Recordation Tax | % × Purchase Price (As-is value) |
| Acquisition Fee | % × Purchase Price (As-is value) |
| Closing | Manual · 用户填 |
| LLC Transfer-Related Fees | Manual · 用户填 |
| Cash Reserve | Manual · 用户填 |

- **Transfer of Membership Transaction** is a Yes/No dropdown (Yes = 0, No = 1).
  · Transfer of Membership 是 Yes/No 单选。
- **Total Closing Costs** auto-sums, and **Closing Cost Ratio** = Total ÷ Purchase Price.
  · 总计自动求和，比例 = 总计 ÷ Purchase Price。

---

## 8. Purchase Price / Construction Equity · 报价与建设权益

### Solution · 解决方案

**Purchase Price** · 报价表
| Field | Source |
|-------|--------|
| Purchase Price (As-is value) | Auto-filled from HD Pro Forma Model · Deal Assumptions (blue **HD** badge) · 从 HD 自动填充并标识 |
| Per Unit (Residential/Retail) | Purchase Price ÷ Units |
| NOI for Year 1 | From NOI card |
| Cap Rate on Year 1 Income | NOI ÷ Purchase Price |
| Closing Cost Percentage | From Closing Costs |
| Total Acquisition Cost | Closing + Purchase |
| Total Cost (excludes capex) | Same as Total Acquisition Cost |

**Construction Equity** · 建设权益
- Acquisition Reserves, Reserves for Distribution, Refinance Reserves, Capex Reserves
- Total Capex Reserves = SUM(all fields) + $2,000,000 (buffer)
  · 总资本储备 = 各项之和 + 200万缓冲

### ⚠ Needs Confirmation · 需甲方确认
- The $2M buffer in Total Capex Reserves is hardcoded. Is this a standard GL Capital practice, or should it be configurable?
  · 200 万缓冲目前写死在代码里，需要确认是否 GL Capital 标准做法，还是应该做成可配置。

---

## 9. Sale Event · 出售事件

### Solution · 解决方案

Two scenarios with sub-tabs: **Regular Sale** and **After Refinance**.

Each scenario shows:

| Field | Source |
|-------|--------|
| Year of Sale | Year picker |
| Date | Date picker |
| NOI of that Year | Auto from NOI card · 从 NOI 卡读取 |
| Cap Rate | HD badge (from Going-in / Exit Cap Rate) · HD 自动填充 |
| Value of Property | NOI ÷ Cap Rate, with HD badge option · 公式计算或取 HD 值 |
| Cost of Sale | % × Value of Property |
| Loan of that Year (Beg of Year) | Manual |
| Capital Transaction Fee to Sponsor | % × Value of Property |
| **Final Proceeds from Sale** | Value − Cost of Sale − Loan − Capital Fee |
| Req return of capital to investors | Manual |
| Excess avail after return of capital | `IF(Final − Req > 0, Final − Req, 0)` |
| Investor | % × Excess |
| Sponsor | % × Excess |

### ⚠ Needs Confirmation · 需甲方确认
- For **Sale Event After Refinance**, Return of Capital pulls from the Waterfall Distribution table (Investor's Beginning Investment Amount). Confirm this is the right source.
  · Sale After Refinance 中 Return of Capital 从 Waterfall 的 Beginning Investment 读取，请确认来源正确。

---

## 10. Equity Required (Regular / Refinance) · 所需权益

### Solution · 解决方案

**Regular scenario** (column layout: Field | % | Value):

| Field | % | Value |
|-------|---|-------|
| Loan to Cost % | New Loan Size ÷ Total Cost (excludes capex) | = New Loan Size |
| Equity | 1 − Loan to Cost % | Manual |
| LTPP | LTPP ÷ Purchase Price (As-is value) | = Loan to Cost |
| Cash to Close | — | Total Acquisition − Loan to Cost − Acquisition Fee |

**Refinance scenario** (additional rows):

| Field | % | Value |
|-------|---|-------|
| I/O Payment | **User-entered %** | = Loan to Cost × % |
| Loan to Cost % | Loan to Cost ÷ Total Cost (excludes capex) | = LTPP (same table) |
| Equity | 1 − Loan to Cost % | = % × Total Cost (excludes capex) |
| LTPP | Loan to Cost ÷ Purchase Price | = LTPP from Regular table |
| Cash to Close | — | Total Cost − Loan to Cost − Acquisition Reserves |

### ⚠ Needs Confirmation · 需甲方确认
- The Refinance **I/O Payment** here (Loan to Cost × %) is **different** from the Debt Refinance I/O (Principal × Interest per annum). Two independent formulas — please confirm both are correct.
  · Refinance 表里的 I/O Payment 公式（Loan to Cost × 百分率）和 Debt Refinance 的 I/O（Principal × Interest per annum）是两个独立的公式，请确认两者都是正确的。

---

## 11. Refinance Event · 再融资事件

### Solution · 解决方案

| Field | Formula |
|-------|---------|
| Year of Refinance | Manual |
| Date | Date picker |
| NOI of that Year | Auto from NOI |
| Cap Rate | Manual |
| Value of Property | NOI ÷ Cap Rate |
| New Loan Size | % × Value of Property |
| Cost of Refinance (include % Fee) | % × Value of Property |
| Loan of that Year (End of Year) | Manual |
| Yield Maintenance / Prepay | % × Loan of that Year (End of Year) |
| Final Proceeds from Refinance | New Loan − Cost − Loan End − Yield Maintenance |
| Reserve for Unit Upgrades | Manual |
| Total Distribution | Final Proceeds − Reserve for Unit Upgrades |

---

## 12. Tax Assessment / Waterfall Distribution · 税务评估与瀑布分配

### Current Status · 当前状态
- **All fields are manual input** at this stage. We haven't implemented auto-calculation or HD integration.
  · 两个模块目前全部手动填写，尚未实现自动计算或 HD 接入。

### ⚠ Needs Confirmation · 需甲方确认
- We need detailed logic for Waterfall Distribution (preferred return %, IRR hurdles, catch-up provisions, carried interest tiers) to auto-generate investor/sponsor cash flows.
  · 我们需要 Waterfall 的详细规则（优先回报率、IRR 门槛、catch-up、carried interest 分层）才能自动生成分配表。
- Tax Assessment currently mirrors the input of the property assessor. If there are standard depreciation schedules or tax protest workflows, let us know.
  · Tax Assessment 目前只是录入评估值，如果有标准折旧计划或税务申诉流程请告知。

---

## 13. Debt Analysis · 债务分析

### Solution · 解决方案

**Upload Debt Excel** to auto-parse both sheets.
  · 上传包含 Debt Current 和 Debt Refinance sheet 的 Excel，系统自动解析。

**Current Debt card** (13 fields):
- Loan Amount, Principal, Interest per annum/month, Mortgage Constant, Commencement/Maturity dates, Duration (Years/Months)
- Mortgage Insurance Premium (section header) → MIP per Annum + MIP per Month
- Annual Mortgage Payments, Interest per year Payment

**Refinance Scenario card** (13 fields): same structure, with I/O instead of Interest per year Payment.

**Year-by-Year DSCR table** (below the two cards): 7 rows × [Period | NOI | Debt Service | DSCR | Debt Type | Cash Flow After DS]
  · 下方还有一张按年度展开的 DSCR 覆盖表。

### ⚠ Needs Confirmation · 需甲方确认
- HD Pro Forma Model sheet has Financing Assumptions (Loan Amount, Interest Rate for both Current and Refin Loan). We plan to show HD badges on these Debt fields to indicate auto-filled values. Do you want HD to override user input, or the other way around?
  · HD 数据集的 Pro Forma Model sheet 有 Financing Assumptions（Loan Amount、Interest Rate），我们计划在 Debt 字段加蓝色 HD 标识。请确认 HD 值是否应覆盖手动输入，还是反之。

---

## 14. AI Score · AI 评分

### Pain Point · 痛点
- No objective way to judge whether an underwriting is complete and reasonable before submission.
  · 在提交审核前，没有客观标准判断一份 underwriting 是否完整合理。

### Solution · 解决方案

**Rule-based scoring engine** (no external AI API). Max score **85 / 100** — intentionally capped because no underwriting can be "perfect."
  · 规则引擎打分（不调外部 AI），最高 85 分（满分 100，故意留 15 分余量，没有任何 underwriting 可以完美）。

**Two dimensions:**
- **Completeness (max 50)**: checks if Summary, RR, T12, HD files are uploaded and Revenue/Expenses/Debt/Closing fields are filled.
  · 完备性（50 分）：检查文件上传情况和关键字段是否填写。
- **Correctness (max 35)**: sanity checks on NOI, DSCR, Cash Flow, Occupancy, Cap Rate, Expense Ratio, Growth Rates.
  · 正确性（35 分）：对 NOI / DSCR / Cash Flow / Occupancy / Cap Rate / 费用比率 / 增长率做合理性校验。

**Grade bands · 等级：**
| Score | Grade | Color |
|-------|-------|-------|
| ≥75 | Excellent | Dark Green |
| ≥60 | Good | Green |
| ≥45 | Fair | Orange |
| <45 | Needs Attention | Red |

**Display · 展示位置：**
- Circular progress ring on each project card in the list (`67/100`)
  · 项目列表每个卡片显示圆形进度环
- Same ring next to project name on the detail page (with grade label)
  · 详情页项目名旁边显示同款进度环 + 等级文字
- Click the ring → modal with breakdown + deduction list
  · 点击进度环弹窗显示扣分项明细

**Recalculation trigger · 重新计算触发：**
- On every Save click · 每次点击 Save
- On project status change (Draft ↔ Complete) · 项目状态切换时

### ⚠ Needs Confirmation · 需甲方确认
- The scoring rules are our best guess at what's important. GL Capital's senior underwriters should review and adjust the weights and thresholds.
  · 打分规则是我们推测的，GL Capital 资深 underwriter 应该 review 权重和阈值。
- We can swap the rule engine for an actual LLM (Claude / GPT) call once requirements are clearer. This would add latency and cost.
  · 需求明确后可以换成真实的 LLM 调用，但会增加延迟和成本。

---

## 15. Edit Mode & Save · 编辑模式与保存

### Solution · 解决方案

**Edit Mode toggle** in page header:
- When OFF: all values are read-only display.
- When ON: inputs appear for Per Unit / Units / Y3 (Stab) in Revenue & Expenses, for As-is Rent in Unit Mix, for all `data-editable` cells in Closing Costs / Purchase Price / Sale Event / Equity Required / Refinance / Tax / Waterfall.
  · Edit Mode 关闭：只读。打开：各模块出现可编辑输入框。

**Manual override rule · 手动覆盖规则：**
- Any value a user types in Edit Mode is flagged with the orange **Manual** badge.
  · 用户在 Edit Mode 下输入的值都标记 Manual。
- Manual values take priority over all data sources — even if T12/HD is re-uploaded, the manual value persists until the user clears it.
  · Manual 值优先级最高，即使重新上传 T12/HD，手动值也保留直到用户清空。

**Save** · 保存
- Click **Save** → writes all edits to localStorage, re-renders tables, recalculates AI Score.
  · 点击 Save → 写入 localStorage，重新渲染，重算 AI 评分。
- Save also updates `lastUpdated` timestamp on the project card.
  · 更新项目卡片上的最后修改时间。

**Export** · 导出
- Click **Export** → generates PDF of the full Pro Forma (modules rendered in order).
  · 导出 PDF，按模块顺序排列。

---

## 16. Assumptions Panel · 预测假设面板

### Solution · 解决方案

Modal opened via **Assumptions** button. Three growth rates (default 3%, 3-decimal precision):
- **Residential Market Annual Rent Growth Rate** · 租金增长率
- **Operating Expenses Growth Rate** · 运营费用增长率
- **Property Taxes Growth Rate** · 物业税增长率 (独立)

These rates drive Y4-Y7 projections in Revenue, Expenses, and Cash Flow.
  · 这三个增长率驱动 Y4-Y7 的所有预测。

Historical years (Y1-Y3) come from actual T12 data and are not affected by growth rates.
  · Y1-Y3 是历史实际值，不受增长率影响。

---

## ⚠ Summary of Assumptions for Client Review · 待甲方确认事项汇总

Consolidating all assumption flags from above sections:
  · 汇总以上各章节的 ⚠ 标记，方便甲方一次性 review：

1. **Project-level collaboration**: One underwriter per project. Multi-user edit lock not yet supported.
   · 每个项目一个 underwriter，尚不支持多人协作编辑锁。

2. **T12 parser layout**: Fixed column structure (B-M = Y1, N-Y = Y2, Z = total). Member Contributions / Intercompany Loans parsed by anchor-row boundaries.
   · T12 列结构固定，动态字段用锚点识别。

3. **Unit Mix grouping**: Grouped by sqft (not bedrooms). RR-HD matching uses ±20% sqft tolerance.
   · Unit Mix 按 sqft 分组，RR-HD 匹配容差 20%。

4. **Rent Income HD source**: Uses max Units (including vacant), not occupied, to preserve GPR integrity.
   · Rent Income HD 源用最大 Units（含空置）。

5. **Stabilized year (Y3)**: Avg(Y1, Y2) for T12 source, or the HD reported value for HD source.
   · 稳定年：T12 源取 Avg(Y1,Y2)，HD 源取 HD 报告值。

6. **Growth rates**: Property Tax has independent rate; all other expenses use OpEx rate.
   · Property Tax 独立增长率，其余用 OpEx 增长率。

7. **Expenses 18/18 split**: Based on Cherry Commons T12 structure. Other properties may need different grouping.
   · 上下表 18/18 行划分基于 Cherry Commons，其他物业可能需调整。

8. **Non-cash items**: Depreciation, Amortization, Refinance Fee excluded from default view (available via Add Field).
   · 非现金项默认剔除，可通过 Add Field 添加。

9. **Adjustment row** in Cash Flow: takes only TOTAL CASH from T12, not TOTAL ADJUSTMENTS.
   · Cash Flow 的 Adjustment 行只取 TOTAL CASH。

10. **Debt Service Y4+**: Assumes Interest-Only (Principal × Interest per annum). Amortizing loans would need a different formula.
    · Y4+ 假设再融资为 I/O 贷款。

11. **Capex buffer**: $2M hardcoded in Total Capex Reserves. Needs to be configurable or confirmed as standard.
    · 200 万资本储备缓冲写死，需确认或做成可配置。

12. **Sale After Refinance**: Return of Capital pulls from Waterfall Beginning Investment Amount. Source to be confirmed.
    · Sale After Refinance 的 Return of Capital 来源需确认。

13. **Two I/O formulas**: Equity Required Refinance I/O (= Loan to Cost × %) and Debt Refinance I/O (= Principal × Interest per annum) are independent. Both correct?
    · 两个 I/O 公式独立，都正确？

14. **HD override priority**: When HD and manual input conflict on Debt fields, whose value wins?
    · Debt 字段 HD 和手动值冲突时谁优先？

15. **Waterfall logic**: Needs detailed rules (preferred return, IRR hurdles, catch-up, carried interest tiers).
    · Waterfall 需要详细规则才能自动化。

16. **Tax Assessment workflow**: Is there a standard depreciation or protest process we should model?
    · 税务评估是否有标准流程需建模？

17. **AI Score weights**: Rule weights are our best guess. Senior underwriters should review.
    · AI 评分权重是推测的，资深 underwriter 应 review。

18. **Manual value persistence**: Manual values override ALL data sources and persist through re-uploads. Is this the right default?
    · Manual 值覆盖所有数据源且 re-upload 也保留，这个默认行为合理？

---

*End of walkthrough. Ready for GL Capital review. · 文档结束，欢迎 GL Capital 评审。*
