# GL Capital Underwriting Platform — System Walkthrough

## Note

The current platform is a **prototype** — think of it as an interactive interface demo, not a fully production-ready system.

Since no detailed requirement spec or rule documentation was provided, we derived the business logic from the files you shared (Cherry Commons property model, HelloData dataset Excel). Some of this logic may be inaccurate. If anything looks off, let us know and we can adjust quickly.

Items marked with ⚠ are internal logic assumptions we made where the requirements were unclear. We need you to confirm whether they are correct.

---

## 1. Login & Project Management

### Pain Points
- Underwriters share Excel files over email — no version control, no team visibility.
- Admins have no centralized place to manage accounts and permissions.

### Solution
- Admins create users and assign roles (Administrator / Underwriter) under **Admin → Users**.
- All projects appear on the **Projects** page as cards showing Offer Price, Units, Cap Rate, NOI, DSCR, IRR, AI Score, and upload status (T12 / RR / Debt).
- Each project has two states: **Draft** or **Complete**. Switching requires confirmation to prevent accidents.
- API keys (HelloData / RentCast / ATTOM) are configured under **Settings** — stored server-side, masked in the UI.

### ⚠ Needs Your Confirmation
- Current design assumes one underwriter per project. If multi-user collaboration is needed, we will add edit-locking and conflict resolution.

---

## 2. File Upload

### Pain Points
- Manually pulling data from broker-provided T12 / Rent Roll / Debt Excel files takes about 4 hours per deal.

### Solution
The system supports four file types, each with its own tab:

| Tab | File Type | Purpose |
|-----|-----------|---------|
| T12 | .xlsx | Trailing 12-month P&L |
| Rent Roll | .xlsx | Current tenant roster |
| HelloData | .xlsx | HD async dataset (market benchmarks) |
| Debt Analysis | .xlsx | Loan summary (Current + Refinance) |

**Steps:**
1. Click the relevant tab, then click Upload or drag the file into the drop zone.
2. The system parses the file and pushes data into downstream modules automatically.
3. Uploaded files appear as cards with file name, size, and parsed row count.

### ⚠ Needs Your Confirmation
- The T12 parser assumes a fixed column layout: Column A = labels, B–M = Year 1 (12 months), N–Y = Year 2 (12 months), Z = annual total. If your T12 format differs, we will adapt the parser.
- Member Contributions / Intercompany Loans / Distributions vary per property (different investor names). The parser uses anchor rows (TOTAL CASH / TOTAL ACCOUNTS PAYABLE / TOTAL ADJUSTMENTS) to detect boundaries automatically.

---

## 3. Summary & Residential Rent Roll

### Pain Points
- Project Summary and Unit Mix are the first sections an underwriter fills in, but data often comes from multiple sources (RR actual vs HD market benchmark) with conflicting values.

### Solution

**Project Summary**
- Fields like Occupancy Rate and Total Apartment Units display both RR and HD values side by side. Click one to mark it as the active value.
- Manual edits are flagged with an orange **Manual** badge.
- Click **+ Add Field** to add custom fields (Lot Size, Building Size, etc.).

**Residential Rent Roll**
- The **2025 As-is Rent** column header has a dropdown that controls the data source for the entire column. Options:
  - RR — actual rent from Rent Roll
  - HD Leased — HelloData Leased Rent
  - HD 30D / 60D / 90D Leased — HD trailing 30/60/90-day leased rent
- After switching the column source, all unit-type rows (1BR / 2BR / 2BR Deluxe) display values from the selected source.
- In Edit Mode, manually changing a row's value auto-tags it as **Manual**. Manual values are not affected by column source switching (clear via the × button).
- **2025 As-is Rent Annually** and **2026 Projected Rent** columns auto-recalculate based on the active source.

### ⚠ Needs Your Confirmation
- Unit types are grouped by **sqft**, not bedroom count — this matches the Rent Roll file format. HelloData also provides a Floorplan Name, which we can show as a label.
- RR–HD matching uses closest sqft within ±20% tolerance. Rows beyond tolerance show "—".

---

## 4. Revenue

### Pain Points
- T12 Rent Income and HD GPR Median often disagree. Underwriters must decide which to anchor the stabilized year on.
- Market benchmarks like GPR / Vacancy Loss / Parking Income don't exist in T12 but are sometimes needed as references.

### Solution

The Revenue table is split into two sub-tables:

**Upper Table: Per-Unit Income**
- Each row shows Per Unit/mo, Source (dropdown), Units, Y1–Y7.
- Some fields (e.g. Rent Income) support multiple data sources (T12 / HD / RentCast):
  - T12: Per Unit = Avg(Y1, Y2) ÷ Units ÷ 12, Y3 = Avg(Y1, Y2). This rule is derived from the Cherry Commons example.
  - HD: Per Unit = GPR Median ÷ max Units ÷ 12, Y3 = GPR Median, Y1/Y2 blank (HD has no historical data).
  - RentCast: same logic as HD.
- All other rows (Late Fee, Pet Fee, etc.) are T12 only. Their Source column shows a fixed T12 label.

**Lower Table: Other Income**
- No Per Unit column (shows "—").
- Used for Prepaid Rent, Miscellaneous Income, etc.

**Total**
- Subtotal (Per-Unit) + Subtotal (Other) = **Total Revenue**.

**Add Field Modal**
- Click **+ Add Field** to add HD-only fields: GPR, Vacancy Loss, Parking Income, Other Income, EGI.
- A warning appears if the user adds EGI together with its components (GPR / Vacancy / Other) to prevent double counting.

### ⚠ Needs Your Confirmation
- For HD-sourced Rent Income, we use **max Units** (including vacant) — not occupied — to keep the GPR figure intact.
- Y4–Y7 are projected from Y3 using the Residential Rent Growth Rate (default 3%, adjustable in Assumptions).

---

## 5. Expenses

### Pain Points
- T12 has 30+ expense line items across many categories. Users need to distinguish which scale per-unit vs. which are property-level fixed costs.
- Some items (Property Tax / Insurance / Management Fee) have HD market benchmarks worth comparing against.

### Solution

**Two-Table Layout (mirrors Revenue)**
- **Upper: Per-Unit Expenses (18 rows)** — scale with unit count. Includes Property Tax, Property Insurance, Management Fee, all Utilities, Cleaning, per-unit R&M, Administrative items.
- **Lower: Flat Expenses (18 rows)** — property-level fixed. Includes Maintenance Labor, Insurance - Other, Accounting, Commissions, Painting, Flooring, Elevator Contract, etc.

**Three Dual-Source Fields (T12 / HD switchable)**
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee Expense ↔ HD: Management Fees

**Growth Rates**
- Property Tax uses an independent **Property Taxes Growth Rate**.
- All other expenses use the **Operating Expenses Growth Rate**.

**Add Field Modal**
- T12 non-default fields: Mortgage Interest, Depreciation, Amortization, Pref - Int, etc.
- HD category totals: Utilities, R&M, Marketing, Payroll, etc.

### ⚠ Needs Your Confirmation
- The 18/18 row split is based on the Cherry Commons T12 structure. Other properties may need a different split.
- Depreciation, Amortization, and Refinance Fee exist in T12 data but are absent from the Cherry Commons Pro Forma Expenses section. We exclude them by default (re-addable via Add Field).

---

## 6. NOI / Cash Flow / Debt Coverage

### Pain Points
- NOI, Debt Service, and Cash Flow are scattered across multiple Excel sheets, making them hard to read and reconcile.

### Solution — Three Stacked Cards

**Card 1: Net Operating Income**
- NOI = Total Revenue − Total Expenses

**Card 2: Cash Flow**

| Line | Formula |
|------|---------|
| Adjustment | T12 TOTAL CASH (Y1/Y2 actual), Y3 = Avg, Y4+ grown by OpEx rate |
| Debt Service | Y1–Y3 = Debt Current annual payment; Y4–Y7 = Refinance I/O (Principal × Interest per annum) |
| Capex Reserves from Cash Flow | Manual input |
| **Cash Flow after Debt Service** | NOI − Adjustment − Debt Service − Capex Reserves |
| Reserve for Capex | Manual input |
| Capex Reserves from {Year} Cash Flow | Manual input |

**Card 3: Debt Coverage**
- Shows NOI, Debt Service, DSCR.
- DSCR = NOI ÷ Debt Service.
- Color rules: ≥1.25 green (healthy) / 1.0–1.25 orange (warning) / <1.0 red (risk).

### ⚠ Needs Your Confirmation
- The Adjustment row only pulls **TOTAL CASH** from T12, not TOTAL ADJUSTMENTS. Our reasoning: Member Contributions / Distributions / Retained Earnings are capital-structure items, not operating cash flow. This interpretation is based on the Cherry Commons Pro Forma. Please confirm this matches your standard practice.
- Y4–Y7 Debt Service assumes Interest-Only refinance. If amortization loans are used, the formula needs adjustment.

---

## 7. Closing Costs

### Pain Points
- Closing Costs mix fixed fees (Appraisal, Legal) with percentage-based fees (Origination, Transfer Tax, Acquisition Fee), making the Excel hard to review.

### Solution
- 25+ line items in a three-column layout: %, Amount, Notes.
- Only 7 rows have a percentage input (others show blank % column):

| Field | % × Base |
|-------|---------|
| Origination Fee & Lender Fees | % × New Loan Size (from Refinance Event) |
| County/State Transfer Tax | % × Purchase Price (As-is value) |
| Recordation Tax | % × Purchase Price (As-is value) |
| Acquisition Fee | % × Purchase Price (As-is value) |
| Closing | Manual |
| LLC Transfer-Related Fees | Manual |
| Cash Reserve | Manual |

- **Transfer of Membership Transaction** is a Yes/No selector (Yes = 0, No = 1).
- **Total Closing Costs** auto-sums. **Closing Cost Ratio** = Total ÷ Purchase Price.

---

## 8. Purchase Price / Construction Equity

### Solution

**Purchase Price**

| Field | Source |
|-------|--------|
| Purchase Price (As-is value) | Auto-filled from HD Pro Forma Model · Deal Assumptions (blue HD badge) |
| Per Unit (Residential/Retail) | Purchase Price ÷ Units |
| NOI for Year 1 | From NOI card |
| Cap Rate on Year 1 Income | NOI ÷ Purchase Price |
| Closing Cost Percentage | From Closing Costs module |
| Total Acquisition Cost | Closing + Purchase |
| Total Cost (excludes capex) | Same as above |

**Construction Equity**
- Fields: Acquisition Reserves, Reserves for Distribution, Refinance Reserves, Capex Reserves.
- Currently manual input. We noticed Cherry Commons Pro Forma uses Total Capex Reserves = SUM(fields) + $2,000,000 buffer. We will implement auto-calculation once the $2M is confirmed as standard practice.

### ⚠ Needs Your Confirmation
- Is the **$2M buffer** standard GL Capital practice? If yes, we will hardcode it. If not, we can make it configurable.

---

## 9. Sale Event

### Solution

Two scenarios switched via sub-tabs: **Regular Sale** and **After Refinance**.

| Field | Source / Formula |
|-------|-----------------|
| Year of Sale | Year picker |
| Date | Date picker |
| NOI of that Year | Auto from NOI card |
| Cap Rate | HD badge (Going-in / Exit Cap Rate) |
| Value of Property | NOI ÷ Cap Rate (or HD Property Value with HD badge) |
| Cost of Sale | % × Value of Property |
| Loan of that Year (Beg of Year) | Manual |
| Capital Transaction Fee to Sponsor | % × Value of Property |
| **Final Proceeds from Sale** | Value − Cost of Sale − Loan − Capital Fee |
| Req return of capital to investors | Manual |
| Excess avail after return of capital | IF(Final − Req > 0, Final − Req, 0) |
| Investor | % × Excess |
| Sponsor | % × Excess |

### ⚠ Needs Your Confirmation
- In the After Refinance scenario, Return of Capital reads from the Waterfall Distribution table's Beginning Investment Amount. Please confirm this source is correct.

---

## 10. Equity Required (Regular / Refinance)

### Solution

**Regular** (three columns: Field | % | Value)

| Field | % | Value |
|-------|---|-------|
| Loan to Cost % | New Loan Size ÷ Total Cost (excludes capex) | = New Loan Size |
| Equity | 1 − Loan to Cost % | Manual |
| LTPP | LTPP ÷ Purchase Price (As-is value) | = Loan to Cost |
| Cash to Close | — | Total Acquisition − Loan to Cost − Acquisition Fee |

**Refinance** (additional rows on top of Regular)
The Refinance view adds an I/O Payment row and adjusts the Cash to Close formula to include Acquisition Reserves.

| Field | % | Value |
|-------|---|-------|
| I/O Payment | User input | = Loan to Cost × % |
| Loan to Cost % | Loan to Cost ÷ Total Cost (excludes capex) | = LTPP (same table) |
| Equity | 1 − Loan to Cost % | = % × Total Cost (excludes capex) |
| LTPP | Loan to Cost ÷ Purchase Price | = Loan to Cost (from Regular table) |
| Cash to Close | — | Total Cost − Loan to Cost − Acquisition Reserves |

### ⚠ Needs Your Confirmation
- The **I/O Payment** here (Loan to Cost × %) uses a different formula from the **I/O** in the Debt Refinance table (Principal × Interest per annum). Please confirm both formulas are correct.

---

## 11. Refinance Event

### Solution

| Field | Formula |
|-------|---------|
| Year of Refinance | Manual |
| Date | Date picker |
| NOI of that Year | Auto from NOI |
| Cap Rate | Manual |
| Value of Property | NOI ÷ Cap Rate |
| New Loan Size | % × Value of Property |
| Cost of Refinance (Include % Fee) | % × Value of Property |
| Loan of that Year (End of Year) | Manual |
| Yield Maintenance / Prepay | % × Loan of that Year (End of Year) |
| Final Proceeds from Refinance | New Loan − Cost − Loan End − Yield Maintenance |
| Reserve for Unit Upgrades | Manual |
| Total Distribution | Final Proceeds − Reserve for Unit Upgrades |

---

## 12. Tax Assessment / Waterfall Distribution

### Current Status
- The Cherry Commons sample had many blank cells in these two sections. We could not infer the field-level calculation rules or intended outputs.
- Both modules are manual-input only at this stage. No auto-calculation.

### ⚠ Needs Your Confirmation
- **Waterfall Distribution**: Please provide detailed allocation rules (preferred return, IRR hurdles, catch-up, carried interest tiers) so we can build auto-calculation.
- **Tax Assessment**: Please share what you want this module to do (standard depreciation schedules? tax protest workflow?) so we can design accordingly.
- **Please provide business rules and requirement descriptions in as much detail as possible.**

---

## 13. Debt Analysis

### Solution

Two side-by-side cards display key fields for Debt Current and Debt Refinance.

**Current Debt card** (13 fields):
- Loan Amount, Principal, Interest per annum / per month, Mortgage Constant, Commencement / Maturity dates, Duration (Years / Months)
- Mortgage Insurance Premium (group header) → MIP per Annum, MIP per Month
- Annual Mortgage Payments, Interest per year Payment

**Refinance Scenario card** (13 fields): same structure, with I/O replacing Interest per year Payment.

**Year-by-Year DSCR table** (below the cards): 7 rows × [Period | NOI | Debt Service | DSCR | Debt Type | Cash Flow After DS]

### ⚠ Needs Your Confirmation
- For data input: do you prefer **uploading Excel files for system parsing**, or a **fixed field layout with direct manual entry**? We can implement either — just let us know your preference.

---

## 14. AI Score

### Pain Points
- No objective benchmark to judge whether an underwriting is complete and reasonable before submission.

### Solution

A rule-based scoring engine (no external AI calls), capped at **85 / 100**. We deliberately reserve 15 points — no underwriting can be "perfect."

**Two dimensions:**
- **Completeness (max 50)**: checks whether Summary / RR / T12 / HD files are uploaded and key fields in Revenue / Expenses / Debt / Closing are filled.
- **Correctness (max 35)**: sanity checks on NOI / DSCR / Cash Flow / Occupancy / Cap Rate / Expense Ratio / Growth Rates.

**Grades:**

| Score | Grade | Color |
|-------|-------|-------|
| ≥75 | Excellent | Dark Green |
| ≥60 | Good | Green |
| ≥45 | Fair | Orange |
| <45 | Needs Attention | Red |

**Display:**
- Circular progress ring (e.g. 67 / 100) on each project card.
- Same ring + grade label next to project name on the detail page.
- Click the ring → modal showing deduction breakdown.

**Recalculation triggers:**
- Every Save click.
- Project status change (Draft ↔ Complete).

### ⚠ Needs Your Confirmation
- The scoring rules are our initial guess. We would like your senior underwriters to review the weights and thresholds.
- If higher accuracy is needed, we can connect a real AI model (Claude / GPT), but that adds latency and API cost.

---

## 15. Edit Mode, Save, and Export

### Solution

**Edit Mode toggle** (button in page header):
- OFF: all fields are read-only.
- ON: input fields appear for Per Unit / Units / Y3 in Revenue & Expenses, As-is Rent in Unit Mix, and editable cells in Closing Costs / Purchase Price / Sale Event / Equity Required / Refinance / Tax / Waterfall.

**Manual override rule:**
- Any value typed in Edit Mode gets the orange **Manual** badge.
- Manual values have the highest priority. Even re-uploading T12 / HD files will not overwrite them — they persist until the user explicitly clears them.

**Save**
- Click Save → data is saved, tables re-render, AI Score recalculates.
- The "last modified" timestamp on the project card updates.

**Export**
- Click Export → full Pro Forma exported to PDF in module order.

---

## 16. Assumptions Panel

### Solution

Click the **Assumptions** button to open a modal with three growth rates (default 3.000%, 3-decimal precision):
- **Residential Market Annual Rent Growth Rate** — drives rent projections.
- **Operating Expenses Growth Rate** — drives expense projections.
- **Property Taxes Growth Rate** — independent from the other two.

These three rates control all Y4–Y7 projections.

Y1–Y3 are historical actuals and are not affected by growth rates.

---

*End of walkthrough. Ready for GL Capital review.*
