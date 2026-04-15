# GL Capital Underwriting 系统功能介绍

## 说明

由于本次需求尚在明确过程中，本版本是我们基于初步理解先行设计的一版，可能与You预期存在一定偏差。欢迎You在此基础上提出更明确的需求或修改意见，我们会在后续迭代中快速响应。

文中标注 ⚠ 的部分，是我们在需求不完整情况下所做的内部逻辑假设，需要You重点确认。

---

## 1. 登录与项目管理

### 痛点
- Underwriter 之间通过邮件传递 Excel 文件，缺乏统一的版本管理和团队协作视图。
- 管理员没有集中的账号与权限管理入口。

### 解决方案
- 管理员在 **Admin → Users** 页面创建账户并分配角色（管理员 / Underwriter）。
- 所有项目集中在 **Projects** 页，以卡片形式展示：报价、套数、Cap Rate、NOI、DSCR、IRR、AI 评分以及文件上传状态（T12 / RR / Debt）。
- 每个项目有两种状态：**Draft**（进行中）与 **Complete**（已完成），切换需二次确认，避免误操作。
- 管理员在 **Settings** 页面配置第三方 API Key（HelloData / RentCast / ATTOM），密钥存储在服务端，前端仅以掩码形式展示。

### ⚠ 需 You 确认
- 当前设计假设每个项目由单一 Underwriter 负责。如果需要支持多人协作，我们会补充编辑锁与冲突解决机制。

---

## 2. 文件上传

### 痛点
- 当前流程中，Underwriter 需要从 Broker 提供的 T12 / Rent Roll / Debt Excel 中手动提取数据，一个 deal 平均耗费约 4 个工时。

### 解决方案
系统支持四种文件类型，分别对应独立 Tab：

| Tab | 文件类型 | 用途 |
|-----|---------|------|
| T12 | .xlsx | 近 12 个月历史财报 |
| Rent Roll | .xlsx | 当前租户明细 |
| HelloData | .xlsx | HD 异步数据集（市场基准） |
| Debt Analysis | .xlsx | 贷款合同摘要（Current + Refinance） |

**操作步骤：**
1. 点击对应 Tab，然后点击 Upload 按钮或拖拽文件到虚线区域。
2. 系统自动解析文件，并将数据填充到下游相关模块。
3. 已上传的文件以卡片形式展示文件名、大小、解析行数。

### ⚠ 需 You 确认
- 当前 T12 解析器基于以下列结构假设：A 列 = 字段名，B–M 列 = Y1（12 个月），N–Y 列 = Y2（12 个月），Z 列 = 年度合计。若You的 T12 格式不一致，我们需要对解析器做适配。
- Member Contributions / Intercompany Loans / Distributions 等字段因物业而异（涉及不同投资人姓名），解析器使用锚点行（TOTAL CASH / TOTAL ACCOUNTS PAYABLE / TOTAL ADJUSTMENTS）动态识别边界。

---

## 3. Summary 与 Residential Rent Roll

### 痛点
- Project Summary 与 Unit Mix 是 Underwriter 最先录入的部分，但数据常来源于多个渠道（RR 实际值 vs HD 市场基准），数值往往不一致，取舍困难。

### 解决方案

**Project Summary**
- Occupancy Rate、Total Apartment Units 等字段同时展示 RR 和 HD 两个值，用户点击其中之一作为生效值。
- 手动修改后，标注为橙色 **Manual** 标签。
- 点击 **+ Add Field** 可补充自定义字段（如 Lot Size、Building Size 等）。

**Residential Rent Roll**
- **2025 As-is Rent** 列头含一个下拉选择器，控制整列的数据源，可选项为：
  - RR：Rent Roll 的实际租金
  - HD Leased：HelloData Leased Rent
  - HD 30D Leased / HD 60D Leased / HD 90D Leased：HD 近 30/60/90 天的 Leased Rent
- 切换列头源后，1BR / 2BR / 2BR Deluxe 等户型行均以所选源的数据展示。
- 在 Edit Mode 下，用户可对某一行手动修改数值，该行自动标注为橙色 **Manual**，且手动值不随列头源切换而改变（可点击清除按钮恢复）。
- **2025 As-is Rent Annually** 与 **2026 Projected Rent** 两列根据当前生效的源值自动重算。

### ⚠ 需 You 确认
- 户型分组目前按 **sqft** 而非 Bedroom 数，这是 RR 文件的原生格式；HelloData 数据集则另外提供 **Floorplan Name**，我们可在界面上展示作为辅助。
- RR 与 HD 的匹配采用 sqft 最接近原则，容差 ±20%；超出容差的行 HD 列显示 "—"。

---

## 4. Revenue（收入）

### 痛点
- T12 Rent Income 与 HD GPR Median 数值常不一致，Underwriter 需要判断用哪个作为稳定年基准。
- GPR / Vacancy Loss / Parking Income 等市场基准字段 T12 不包含，但有时需要临时加入作参考。

### 解决方案

Revenue 表分为上下两个子表：

**上表：Per-Unit Income（按单元计算的收入）**
- 每行展示：Per Unit/月、Source（下拉）、Units、Y1–Y7。
- **Rent Income** 是唯一支持 T12 / HD / RentCast 三源切换的字段：
  - T12 源：Per Unit = Avg(Y1, Y2) ÷ Units ÷ 12，Y3 = Avg(Y1, Y2)
  - HD 源：Per Unit = GPR Median ÷ 最大 Units ÷ 12，Y3 = GPR Median，Y1/Y2 留空（HD 无历史数据）
  - RentCast 源：逻辑类似 HD
- 其他行（Late Fee / Pet Fee 等）只有 T12 源，Source 列显示为固定 T12 标签。

**下表：Other Income（统一型收入）**
- 无 Per Unit 列（显示 "—"）
- 用于 Prepaid Rent、Miscellaneous Income 等不按单元计算的收入项

**合计**
- 两个子表 Subtotal 之和 = **Total Revenue**

**Add Field 弹窗**
- 点击 **+ Add Field** 可追加 HD 专有字段（GPR / Vacancy Loss / Parking / Other Income / EGI）。
- 当用户同时添加 EGI 和其组成部分（GPR / Vacancy / Other）时，系统提示避免重复计算。

### ⚠ 需 You 确认
- HD 源的 Rent Income 使用**最大 Units 数**（含空置），而非 occupied units，以保持 GPR 口径的完整性。
- Y4–Y7 从 Y3 按 **住宅租金增长率** 推算（默认 3%，可在 Assumptions 面板调整）。

---

## 5. Expenses（支出）

### 痛点
- T12 含 30+ 条费用明细、分属多个分类，用户需要区分哪些是按单元变化、哪些是物业级固定支出。
- 部分费用（Property Tax / Insurance / Management Fee）有 HD 市场基准可做对比。

### 解决方案

**上下表分区（结构与 Revenue 一致）**

- **上表：Per-Unit Expenses（18 行）** — 随单元数量变化
  - 包含：Property Tax、Property Insurance、Management Fee、所有 Utilities、Cleaning 项、每单元 R&M 项、Administrative 项
- **下表：Flat Expenses（18 行）** — 物业级固定支出
  - 包含：Maintenance Labor、Insurance - Other、Accounting、Commissions、Painting、Flooring、Elevator Contract 等

**三个双源字段（支持 T12 / HD 切换）**
- Property Tax ↔ HD: Real Estate Taxes
- Property Insurance ↔ HD: Property Insurance
- Management Fee Expense ↔ HD: Management Fees

**增长率规则**
- Property Tax 使用独立的 **Property Taxes Growth Rate**。
- 其余费用项统一使用 **Operating Expenses Growth Rate**。

**Add Field 弹窗**
- T12 非默认字段：Mortgage Interest / Depreciation / Amortization / Pref - Int 等。
- HD 类别级汇总：Utilities / R&M / Marketing / Payroll 等基准值。

### ⚠ 需 You 确认
- 目前的 18/18 行划分基于 Cherry Commons 的 T12 结构，其他物业可能需要相应调整。
- Depreciation / Amortization / Refinance Fee 虽在 T12 中有记录，但在 Cherry Commons 的 Pro Forma Expenses 分区并未体现，因此我们在系统中默认剔除（可通过 Add Field 补回）。

---

## 6. NOI / Cash Flow / Debt Coverage（净营业收入 / 现金流 / 债务覆盖）

### 痛点
- NOI、Debt Service、Cash Flow 三个概念在 Excel 中分散在多个 Sheet，阅读和校对成本高。

### 解决方案 — 拆分为三张独立卡片

**卡片 1：Net Operating Income**
- NOI = Total Revenue − Total Expenses

**卡片 2：Cash Flow**

| 行 | 计算公式 |
|----|---------|
| Adjustment | T12 TOTAL CASH（Y1/Y2 实际值），Y3 = Avg，Y4+ 按 OpEx 增长率推算 |
| Debt Service | Y1–Y3 = Debt Current 年还款额；Y4–Y7 = Refinance I/O（Principal × Interest per annum） |
| Capex Reserves from Cash Flow | 手动输入 |
| **Cash Flow after Debt Service** | NOI − Adjustment − Debt Service − Capex Reserves |
| Reserve for Capex | 手动输入 |
| Capex Reserves from {Year} Cash Flow | 手动输入 |

**卡片 3：Debt Coverage**
- 展示 NOI、Debt Service、DSCR 三行。
- DSCR = NOI ÷ Debt Service。
- 颜色规则：≥1.25 绿色（健康）/ 1.0–1.25 橙色（警戒）/ <1.0 红色（风险）。

### ⚠ 需 You 确认
- Adjustment 行只取 T12 的 **TOTAL CASH**，而非 TOTAL ADJUSTMENTS。我们的理解是 Member Contributions / Distributions / Retained Earnings 属于资本结构项、非运营现金流。该判断亦基于 Cherry Commons Pro Forma 的写法，请You确认是否符合标准做法。
- Y4–Y7 的 Debt Service 当前假设再融资贷款为 Interest Only。如实际为含本金摊还的 amortization loan，公式需要调整。

---

## 7. Closing Costs（交易成本）

### 痛点
- Closing Costs 混合了固定费用（Appraisal / Legal）和百分比费用（Origination / Transfer Tax / Acquisition Fee），在 Excel 中呈现凌乱，不易审阅。

### 解决方案
- 25+ 条行项，采用三列布局：百分率（%）、金额（Amount）、备注（Notes）。
- 只有以下 7 行有百分率输入框，其他行的 % 列为空：

| 字段 | 百分率 × 基数 |
|------|--------------|
| Origination Fee & Lender Fees | % × New Loan Size（来自 Refinance Event） |
| County/State Transfer Tax | % × Purchase Price (As-is value) |
| Recordation Tax | % × Purchase Price (As-is value) |
| Acquisition Fee | % × Purchase Price (As-is value) |
| Closing | 用户手填 |
| LLC Transfer-Related Fees | 用户手填 |
| Cash Reserve | 用户手填 |

- **Transfer of Membership Transaction** 改为 Yes/No 单选（Yes = 0，No = 1）。
- **Total Closing Costs** 自动求和，**Closing Cost Ratio** = Total ÷ Purchase Price。

---

## 8. Purchase Price / Construction Equity（报价与建设权益）

### 解决方案

**Purchase Price**

| 字段 | 数据源 |
|------|-------|
| Purchase Price (As-is value) | 从 HD Pro Forma Model · Deal Assumptions 自动填充（带蓝色 HD 标识） |
| Per Unit (Residential/Retail) | Purchase Price ÷ Units |
| NOI for Year 1 | 从 NOI 卡片读取 |
| Cap Rate on Year 1 Income | NOI ÷ Purchase Price |
| Closing Cost Percentage | 来自 Closing Costs 模块 |
| Total Acquisition Cost | Closing + Purchase |
| Total Cost (excludes capex) | 同上 |

**Construction Equity**
- 字段：Acquisition Reserves、Reserves for Distribution、Refinance Reserves、Capex Reserves。
- 目前这些字段为手动填写。我们注意到 Cherry Commons Pro Forma 中 Total Capex Reserves 的结构为 SUM(各字段) + $2,000,000 缓冲，待You确认该 $2M 是否为 GL Capital 的标准做法，我们再实现自动计算。

### ⚠ 需 You 确认
- $2M 缓冲是否为 GL Capital 的标准做法？如是，我们会在 Total Capex Reserves 公式中固化；如否，可做成可配置参数。

---

## 9. Sale Event（出售事件）

### 解决方案

两种场景：**Regular Sale** 与 **After Refinance**，以子标签切换。

| 字段 | 来源 / 公式 |
|------|-----------|
| Year of Sale | 年份选择器 |
| Date | 日期选择器 |
| NOI of that Year | 从 NOI 卡片自动读取 |
| Cap Rate | HD 标识（来自 Going-in Cap Rate / Exit Cap Rate） |
| Value of Property | NOI ÷ Cap Rate（或取 HD Property Value，带 HD 标识） |
| Cost of Sale | 百分率 × Value of Property |
| Loan of that Year (Beg of Year) | 手填 |
| Capital Transaction Fee to Sponsor | 百分率 × Value of Property |
| **Final Proceeds from Sale** | Value − Cost of Sale − Loan − Capital Fee |
| Req return of capital to investors | 手填 |
| Excess avail after return of capital | IF(Final − Req > 0, Final − Req, 0) |
| Investor | 百分率 × Excess |
| Sponsor | 百分率 × Excess |

### ⚠ 需 You 确认
- Sale After Refinance 中 Return of Capital 从 Waterfall Distribution 表的 Beginning Investment Amount 读取，请确认取值来源是否正确。

---

## 10. Equity Required (Regular / Refinance)（所需权益）

### 解决方案

**Regular 场景**（三列：字段 | 百分率 | 值）

| 字段 | 百分率 | 值 |
|------|--------|---|
| Loan to Cost % | New Loan Size ÷ Total Cost (excludes capex) | = New Loan Size |
| Equity | 1 − Loan to Cost % | 手动填写 |
| LTPP | LTPP ÷ Purchase Price (As-is value) | = Loan to Cost |
| Cash to Close | — | Total Acquisition − Loan to Cost − Acquisition Fee |

**Refinance 场景**（在 Regular 的基础上增加）

| 字段 | 百分率 | 值 |
|------|--------|---|
| I/O Payment | 用户输入 | = Loan to Cost × 百分率 |
| Loan to Cost % | Loan to Cost ÷ Total Cost (excludes capex) | = LTPP（本表） |
| Equity | 1 − Loan to Cost % | = 百分率 × Total Cost (excludes capex) |
| LTPP | Loan to Cost ÷ Purchase Price | = Loan to Cost（来自 Regular 表） |
| Cash to Close | — | Total Cost − Loan to Cost − Acquisition Reserves |

### ⚠ 需 You 确认
- 此处的 **I/O Payment** 公式（Loan to Cost × 百分率）与 Debt Refinance 表的 **I/O**（Principal × Interest per annum）是两个独立的公式，请You确认两者是否都符合预期。

---

## 11. Refinance Event（再融资事件）

### 解决方案

| 字段 | 公式 |
|------|------|
| Year of Refinance | 手填 |
| Date | 日期选择器 |
| NOI of that Year | 自动从 NOI 读取 |
| Cap Rate | 手填 |
| Value of Property | NOI ÷ Cap Rate |
| New Loan Size | 百分率 × Value of Property |
| Cost of Refinance (Include % Fee) | 百分率 × Value of Property |
| Loan of that Year (End of Year) | 手填 |
| Yield Maintenance / Prepay | 百分率 × Loan of that Year (End of Year) |
| Final Proceeds from Refinance | New Loan − Cost − Loan End − Yield Maintenance |
| Reserve for Unit Upgrades | 手填 |
| Total Distribution | Final Proceeds − Reserve for Unit Upgrades |

---

## 12. Tax Assessment / Waterfall Distribution（税务评估 / 瀑布分配）

### 当前状态
- 由于 Cherry Commons 示例表中这两部分存在大量空白单元格，我们目前无法推断字段间的计算规则与目标产出。
- 两个模块目前均为手动输入，暂未实现自动计算。

### ⚠ 需 You 确认
- **Waterfall Distribution**：请提供详细的分配规则（优先回报率、IRR 门槛、Catch-up、Carried Interest 分层等），以便我们实现自动计算。
- **Tax Assessment**：请说明具体诉求（标准折旧计划？税务申诉流程？）以便我们进一步设计。

---

## 13. Debt Analysis（债务分析）

### 解决方案

当前提供两张卡片用于展示 Debt Current 与 Debt Refinance 的关键字段。

**Current Debt 卡片**（13 字段）：
- Loan Amount、Principal、Interest per annum / per month、Mortgage Constant、Commencement / Maturity 日期、Duration (Years / Months)
- Mortgage Insurance Premium（作为分组标题） → MIP per Annum、MIP per Month
- Annual Mortgage Payments、Interest per year Payment

**Refinance Scenario 卡片**（13 字段）：结构相似，但使用 I/O 替代 Interest per year Payment。

**Year-by-Year DSCR 表**（两张卡片下方）：7 行 × [Period | NOI | Debt Service | DSCR | Debt Type | Cash Flow After DS]

### ⚠ 需 You 确认
- 请You确认此模块的数据录入方式：是倾向于 **由用户上传 Debt Current 与 Debt Refinance 两张 Excel sheet，由系统自动解析**，还是**保留固定字段布局、由用户直接手填**？两种方式我们都可以实现，但需您先明确偏好。

---

## 14. AI 评分

### 痛点
- 在提交审核前，缺乏客观标准判断一份 Underwriting 是否完整合理。

### 解决方案
采用**规则引擎**打分（不调用外部 AI），上限 **85 分 / 满分 100**。故意保留 15 分余量，体现"无 Underwriting 可以完美"的理念。

**两个评估维度：**
- **完备性（最高 50 分）**：检查 Summary / RR / T12 / HD 文件是否上传，以及 Revenue / Expenses / Debt / Closing 的关键字段是否填写。
- **正确性（最高 35 分）**：对 NOI / DSCR / Cash Flow / Occupancy / Cap Rate / 费用比率 / 增长率做合理性校验。

**等级：**

| 分数 | 等级 | 颜色 |
|------|------|------|
| ≥75 | Excellent | 深绿 |
| ≥60 | Good | 绿 |
| ≥45 | Fair | 橙 |
| <45 | Needs Attention | 红 |

**展示位置：**
- 项目列表每个卡片右侧显示圆形进度环（如 67 / 100）。
- 项目详情页项目名旁边显示同款进度环 + 等级文字。
- 点击进度环弹窗显示扣分项明细。

**重新计算触发：**
- 每次点击 Save。
- 项目状态切换时（Draft ↔ Complete）。

### ⚠ 需 You 确认
- 当前打分规则是我们的初步推测，希望 GL Capital 资深 Underwriter review 权重与阈值后调整。
- 如You有更高要求，后续可接入真实 LLM（Claude / GPT）打分，但会引入额外延迟与 API 成本。

---

## 15. 编辑模式与保存

### 解决方案

**Edit Mode 开关**（位于页面头部按钮）：
- 关闭：所有字段以只读形式展示。
- 打开：Revenue / Expenses 的 Per Unit / Units / Y3、Unit Mix 的 As-is Rent、Closing Costs / Purchase Price / Sale Event / Equity Required / Refinance / Tax / Waterfall 的可编辑单元格出现输入框。

**手动覆盖规则：**
- 用户在 Edit Mode 下输入的值均标注为橙色 **Manual** 标签。
- Manual 值拥有最高优先级，即使重新上传 T12/HD 文件，手动值也保留，直至用户显式清除。

**保存**
- 点击 Save → 写入本地存储，重新渲染表格，重算 AI 评分。
- 同步更新项目卡片上的最后修改时间。

**导出**
- 点击 Export → 按模块顺序导出完整 Pro Forma 为 PDF。

---

## 16. Assumptions 假设面板

### 解决方案

点击 **Assumptions** 按钮打开弹窗，包含三个增长率（默认 3.000%，精确到 3 位小数）：
- **Residential Market Annual Rent Growth Rate**（住宅市场租金增长率）
- **Operating Expenses Growth Rate**（运营费用增长率）
- **Property Taxes Growth Rate**（物业税增长率，独立）

这三个增长率驱动 Y4–Y7 的所有预测。

Y1–Y3 是历史实际值，不受增长率影响。

---

*文档结束，欢迎 GL Capital 审阅。*
