import * as XLSX from "xlsx";

// ─── DOM READY HELPER (supports dynamic import after React render) ───────────
const _domReady = (fn) => {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
};

// ─── STATE ───────────────────────────────────────────────────────────────────
const USERS_KEY = "glcapital_users";
const SESSION_KEY = "glcapital_session";
const PROJECTS_KEY = "glcapital_projects";
const SUBMISSIONS_KEY = "glcapital_submissions";

// In-memory storage fallback (works in sandboxed environments)
const _store = {};
const _ls = {
  getItem: (k) => _store[k] || null,
  setItem: (k, v) => {
    _store[k] = v;
  },
  removeItem: (k) => {
    delete _store[k];
  },
};
try {
  localStorage.setItem("_test", "1");
  localStorage.removeItem("_test");
} catch (e) {
  // localStorage blocked — use in-memory store
  Object.defineProperty(window, "localStorage", {
    value: _ls,
    writable: false,
  });
}

const T12_MONTHS = [];
// T12_ROWS removed — T12 data is now parsed dynamically from uploaded xlsx files.
var T12_ROWS = [];
// PF_DATA is now dynamically loaded from localStorage per project.
// Use _getProjectPFData(pid) to read and _saveProjectPFData(pid, data) to write.
var PF_DATA = {
  cols: [],
  revenue: [],
  expenses: [],
  noi: [],
  debt: [],
  cf: [],
  dscr: [],
  adjustment: [],
};
// RR_DATA is now dynamically loaded from localStorage per project.
// Use _getRRData(pid) to read and _saveRRData(pid, data) to write.
var RR_DATA = [];

// Clean up old file dataUrls from project objects and orphaned file_data_ keys
function _cleanupOldFileData(pid) {
  try {
    var projs = JSON.parse(localStorage.getItem("glcapital_projects") || "[]");
    var changed = false;
    projs.forEach(function (p) {
      (p.files || []).forEach(function (f) {
        if (f.dataUrl) {
          // Migrate: move dataUrl to separate key, then delete from project
          try {
            localStorage.setItem("file_data_" + f.id, f.dataUrl);
          } catch (e) {}
          delete f.dataUrl;
          delete f.rawData;
          changed = true;
        }
        if (f.rawData) {
          delete f.rawData;
          changed = true;
        }
      });
    });
    if (changed)
      localStorage.setItem("glcapital_projects", JSON.stringify(projs));
  } catch (e) {
    console.warn("[cleanup]", e);
  }
}
// Run cleanup on load
setTimeout(_cleanupOldFileData, 500);

const MARKET_DATA = {};
const COMPS_DATA = {
  sales: [],
  rental: [],
  expense: [],
};
var currentLang = "en";

// ─── PROJECT DATA ACCESS LAYER ──────────────────────────────────────────────
function _getT12Data(pid) {
  try {
    return JSON.parse(localStorage.getItem("t12_parsed_" + pid) || "null");
  } catch (e) {
    return null;
  }
}
function _saveT12Data(pid, d) {
  localStorage.setItem("t12_parsed_" + pid, JSON.stringify(d));
}
function _getRRData(pid) {
  try {
    return JSON.parse(localStorage.getItem("rr_data_" + pid) || "null");
  } catch (e) {
    return null;
  }
}
function _saveRRData(pid, d) {
  localStorage.setItem("rr_data_" + pid, JSON.stringify(d));
}
function _getProjectPFData(pid) {
  try {
    return JSON.parse(localStorage.getItem("pf_data_" + pid) || "null");
  } catch (e) {
    return null;
  }
}
function _saveProjectPFData(pid, d) {
  localStorage.setItem("pf_data_" + pid, JSON.stringify(d));
}

// ─── XLSX PARSE FUNCTIONS ────────────────────────────────────────────────────

// Parse T12 sheet from uploaded xlsx ArrayBuffer
function _parseT12FromXlsx(buf, pid) {
  var wb = XLSX.read(buf, { type: "array" });
  var wsName =
    wb.SheetNames.find(function (n) {
      return n.toLowerCase().indexOf("t12") !== -1;
    }) || wb.SheetNames[0];
  var ws = wb.Sheets[wsName];
  if (!ws) return null;
  var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (contains "ACCOUNT" in col A and date serials in other cols)
  var headerIdx = -1;
  for (var i = 0; i < Math.min(rows.length, 10); i++) {
    if (
      rows[i] &&
      typeof rows[i][0] === "string" &&
      rows[i][0].toUpperCase().indexOf("ACCOUNT") !== -1
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 4; // fallback

  // Detect Y1/Y2 split: columns 1-12 = Y1, 13-24 = Y2, 25 = Total
  var nDataCols = 0;
  var hdr = rows[headerIdx] || [];
  for (var c = 1; c < hdr.length; c++) {
    if (hdr[c] != null) nDataCols++;
  }
  var y1End = 12; // first 12 months
  var y2End = 24; // next 12 months
  var totalCol = Math.min(nDataCols, hdr.length - 1); // last column is Total

  // Extract monthly arrays (each value rounded to cents)
  function getMonths(row, startCol, count) {
    var arr = [];
    for (var c = startCol; c < startCol + count && c < row.length; c++) {
      var v = parseFloat(row[c]);
      arr.push(isNaN(v) ? 0 : Math.round(v * 100) / 100);
    }
    while (arr.length < count) arr.push(0);
    return arr;
  }

  // Sum from already-rounded monthly values (consistent with display)
  function sumMonths(months) {
    var s = 0;
    for (var i = 0; i < months.length; i++) s += months[i];
    return Math.round(s * 100) / 100;
  }

  // Build result by scanning rows
  var result = { rows: [], sections: [], meta: {} };
  var currentSection = null;

  // Extract property name and period from first rows
  for (var r = 0; r < headerIdx; r++) {
    var txt = rows[r] && rows[r][0];
    if (typeof txt === "string") {
      if (txt.indexOf("Period") !== -1) result.meta.period = txt;
      else if (r === 1) result.meta.property = txt;
    }
  }

  for (var r = headerIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row[0]) continue;
    var label = String(row[0]).trim();
    if (!label) continue;

    var y1Months = getMonths(row, 1, 12);
    var y2Months = getMonths(row, 13, 12);
    var y1Total = sumMonths(y1Months);
    var y2Total = sumMonths(y2Months);
    var grandTotal =
      row[totalCol] != null ? parseFloat(row[totalCol]) : y1Total + y2Total;
    if (isNaN(grandTotal)) grandTotal = y1Total + y2Total;

    // Detect section headers (all-caps with no numeric data)
    var isSection =
      label === label.toUpperCase() && label.length > 2 && !label.match(/^\d/);
    var isTotal = label.toUpperCase().indexOf("TOTAL") !== -1;

    result.rows.push({
      label: label,
      y1: y1Months,
      y2: y2Months,
      y1Total: y1Total,
      y2Total: y2Total,
      total: Math.round(grandTotal * 100) / 100,
      isSection: isSection && !isTotal,
      isTotal: isTotal,
      section: currentSection,
    });

    if (isSection && !isTotal) currentSection = label;
  }

  if (pid) _saveT12Data(pid, result);
  return result;
}

// Parse Rent Roll sheet from uploaded xlsx ArrayBuffer
function _parseRRFromXlsx(buf, pid) {
  var wb = XLSX.read(buf, { type: "array" });
  var wsName =
    wb.SheetNames.find(function (n) {
      return (
        n.toUpperCase() === "RR" || n.toLowerCase().indexOf("rent roll") !== -1
      );
    }) || wb.SheetNames[0];
  var ws = wb.Sheets[wsName];
  if (!ws) return null;
  var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Extract report date from header area (e.g. "As Of = 11/12/2025" or "Month = 11/2025")
  var rrReportYear = null;
  for (var ri = 0; ri < Math.min(rows.length, 8); ri++) {
    var rr = rows[ri];
    if (!rr) continue;
    for (var ci2 = 0; ci2 < rr.length; ci2++) {
      var cv = String(rr[ci2] || "");
      var dateMatch = cv.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        rrReportYear = parseInt(dateMatch[3], 10);
        break;
      }
      var monthMatch = cv.match(/(\d{1,2})\/(\d{4})/);
      if (monthMatch) {
        rrReportYear = parseInt(monthMatch[2], 10);
        break;
      }
    }
    if (rrReportYear) break;
  }

  // Find header row: look for "Unit" and "Sqft" or "Rent"
  var headerIdx = -1;
  for (var i = 0; i < Math.min(rows.length, 10); i++) {
    var r = rows[i];
    if (!r) continue;
    var joined = r
      .map(function (v) {
        return String(v || "").toLowerCase();
      })
      .join(" ");
    if (
      joined.indexOf("unit") !== -1 &&
      (joined.indexOf("sqft") !== -1 ||
        joined.indexOf("sq ft") !== -1 ||
        joined.indexOf("rent") !== -1)
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  // Map header columns
  var hdr = rows[headerIdx].map(function (v) {
    return String(v || "")
      .toLowerCase()
      .trim();
  });
  // Check if next row is a sub-header (e.g. "SqFt" under "Unit")
  var subHdr = rows[headerIdx + 1]
    ? rows[headerIdx + 1].map(function (v) {
        return String(v || "")
          .toLowerCase()
          .trim();
      })
    : [];
  var startRow = headerIdx + 1;
  if (
    subHdr.some(function (s) {
      return s.indexOf("sqft") !== -1 || s.indexOf("sq ft") !== -1;
    })
  ) {
    // Merge headers
    for (var c = 0; c < subHdr.length; c++) {
      if (subHdr[c] && !hdr[c]) hdr[c] = subHdr[c];
      else if (subHdr[c]) hdr[c] = hdr[c] + " " + subHdr[c];
    }
    startRow = headerIdx + 2;
  }

  function findCol(keywords) {
    for (var c = 0; c < hdr.length; c++) {
      for (var k = 0; k < keywords.length; k++) {
        if (hdr[c].indexOf(keywords[k]) !== -1) return c;
      }
    }
    return -1;
  }

  var colUnit = findCol(["unit"]);
  var colSqft = findCol(["sqft", "sq ft", "square"]);
  var colTenant = findCol(["tenant"]);
  var colBeds = findCol(["bed", "bedroom", "br"]);
  var colRent = findCol(["actual rent", "contract rent", "rent"]);
  var colRentPsf = findCol(["rent per", "per sqft", "$/sf", "rent psf"]);
  var colTenantDep = findCol([
    "tenant deposit",
    "security deposit",
    "tenant dep",
  ]);
  var colOtherDep = findCol(["other deposit", "other dep"]);
  var colMoveIn = findCol(["move in", "move-in"]);
  var colLeaseExp = findCol(["lease exp", "lease expir"]);
  var colMoveOut = findCol(["move out", "move-out"]);
  var colBalance = findCol(["balance"]);

  // Pre-scan: detect "% Unit Occupancy" in RR summary section
  // Format: multi-row header with "% Unit" in one row and "Occupancy" below,
  // then data rows like "Current/Notice/Vacant Tenants" with value in that column
  var rrMeta = {};
  for (var sr = startRow; sr < rows.length; sr++) {
    var srow = rows[sr];
    if (!srow) continue;
    // Look for a row containing "% Unit" or "% unit occupancy" in any cell
    var occCol = -1;
    for (var sc = 0; sc < srow.length; sc++) {
      var sv = String(srow[sc] || "")
        .trim()
        .toLowerCase();
      if (sv === "% unit" || sv === "% unit occupancy" || sv === "occupancy") {
        occCol = sc;
      }
    }
    if (occCol < 0) continue;
    // Check if next row also has "Occupancy" in the same or adjacent column (multi-row header)
    var nextRow = rows[sr + 1];
    if (nextRow) {
      var nv = String(nextRow[occCol] || "")
        .trim()
        .toLowerCase();
      if (nv === "occupancy" || nv === "occupied") {
        // This is a two-row header; data starts at sr + 2
        for (var dr = sr + 2; dr < Math.min(sr + 6, rows.length); dr++) {
          var drow = rows[dr];
          if (!drow) continue;
          var fc = String(drow[0] || "").toLowerCase();
          if (
            fc.indexOf("current") !== -1 ||
            fc.indexOf("occupied unit") !== -1
          ) {
            var ov = parseFloat(drow[occCol]);
            if (!isNaN(ov) && ov > 0) {
              rrMeta.unitOccupancy = ov <= 1 ? ov * 100 : ov;
              break;
            }
          }
        }
        break;
      }
    }
    // Single-row header: data follows immediately
    for (var dr2 = sr + 1; dr2 < Math.min(sr + 5, rows.length); dr2++) {
      var drow2 = rows[dr2];
      if (!drow2) continue;
      var ov2 = parseFloat(drow2[occCol]);
      if (!isNaN(ov2) && ov2 > 0) {
        rrMeta.unitOccupancy = ov2 <= 1 ? ov2 * 100 : ov2;
        break;
      }
    }
    break;
  }

  var units = [];
  for (var r = startRow; r < rows.length; r++) {
    var row = rows[r];
    if (!row) continue;
    var unitVal = row[colUnit];
    if (unitVal == null || String(unitVal).trim() === "") continue;
    var unitLower = String(unitVal).toLowerCase();
    // Skip summary/total rows
    if (unitLower.indexOf("total") !== -1) continue;
    if (unitLower.indexOf("occupied") !== -1) continue;
    if (unitLower.indexOf("summary") !== -1) continue;
    if (unitLower.indexOf("current/notice") !== -1) continue;
    if (unitLower.indexOf("future tenant") !== -1) continue;
    if (unitLower.indexOf("vacant unit") !== -1) continue;
    if (unitLower.indexOf("non rev") !== -1) continue;

    var rent = colRent >= 0 ? parseFloat(row[colRent]) || 0 : 0;
    var sqft = colSqft >= 0 ? parseFloat(row[colSqft]) || 0 : 0;
    var tenant = colTenant >= 0 ? row[colTenant] || "" : "";
    var isVacant = !tenant || String(tenant).toLowerCase() === "vacant";

    function fmtDate(v) {
      if (!v) return "";
      if (typeof v === "number") {
        // Excel date serial
        var d = XLSX.SSF.parse_date_code(v);
        if (d)
          return (
            (d.m < 10 ? "0" : "") +
            d.m +
            "/" +
            (d.d < 10 ? "0" : "") +
            d.d +
            "/" +
            d.y
          );
      }
      return String(v);
    }

    units.push({
      unit: String(unitVal).trim(),
      sqft: sqft,
      beds: colBeds >= 0 ? parseInt(row[colBeds], 10) || null : null,
      tenant: String(tenant).trim(),
      actual_rent: rent,
      rent_psf:
        colRentPsf >= 0
          ? parseFloat(row[colRentPsf]) ||
            (sqft ? Math.round((rent / sqft) * 100) / 100 : 0)
          : sqft
            ? Math.round((rent / sqft) * 100) / 100
            : 0,
      tenant_dep: colTenantDep >= 0 ? parseFloat(row[colTenantDep]) || 0 : 0,
      other_dep: colOtherDep >= 0 ? parseFloat(row[colOtherDep]) || 0 : 0,
      move_in: colMoveIn >= 0 ? fmtDate(row[colMoveIn]) : "",
      lease_exp: colLeaseExp >= 0 ? fmtDate(row[colLeaseExp]) : "",
      move_out: colMoveOut >= 0 ? fmtDate(row[colMoveOut]) : "",
      balance: colBalance >= 0 ? parseFloat(row[colBalance]) || 0 : 0,
      status: isVacant ? "Vacant" : "Occupied",
    });
  }

  if (pid) {
    _saveRRData(pid, units);
    // Save RR metadata (occupancy, report year, etc.)
    if (rrReportYear) rrMeta.reportYear = rrReportYear;
    if (Object.keys(rrMeta).length > 0) {
      localStorage.setItem("rr_meta_" + pid, JSON.stringify(rrMeta));
    }
  }
  return units;
}

// Parse Debt Current + Debt Refinance sheets from uploaded xlsx
function _parseDebtFromXlsx(buf, pid) {
  var wb = XLSX.read(buf, { type: "array" });
  function parseDebtSheet(sheetName) {
    var ws = wb.Sheets[sheetName];
    if (!ws) return null;
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    var data = {};

    // Scan for key-value pairs: label in col B (idx 1), value in col I (idx 8)
    var labelMap = {
      "loan amount": "loanAmount",
      principal: "principal",
      "interest per annum": "interestPerAnnum",
      "interest per month": "interestPerMonth",
      "mortgage constant": "mortgageConstant",
      "commencement date": "commencementDate",
      "final maturity date": "finalMaturityDate",
      "duration (years)": "durationYears",
      "duration (months)": "durationMonths",
      "mortgage insurance premium per annum":
        "mortgageInsurancePremiumPerAnnum",
      "mortgage insurance premium per month":
        "mortgageInsurancePremiumPerMonth",
      "mortgage insurance premium": "mortgageInsurancePremium",
    };

    for (var r = 0; r < Math.min(rows.length, 30); r++) {
      var row = rows[r];
      if (!row) continue;
      // Find label (usually col 1) and value (usually col 8)
      var label = null;
      var value = null;
      for (var c = 0; c < row.length; c++) {
        if (typeof row[c] === "string" && row[c].trim()) {
          label = row[c].trim().toLowerCase();
        }
        if (typeof row[c] === "number" && label) {
          value = row[c];
          break;
        }
      }
      if (label && value != null) {
        for (var key in labelMap) {
          if (label.indexOf(key) !== -1) {
            data[labelMap[key]] = value;
            break;
          }
        }
      }
    }

    // Compute derived values
    if (data.interestPerAnnum && !data.interestPerMonth) {
      data.interestPerMonth = data.interestPerAnnum / 12;
    }
    if (data.durationYears && !data.durationMonths) {
      data.durationMonths = data.durationYears * 12;
    }

    // Compute mortgage constant if not found
    if (
      !data.mortgageConstant &&
      data.interestPerMonth &&
      data.durationMonths
    ) {
      var i = data.interestPerMonth;
      var n = data.durationMonths;
      data.mortgageConstant = i / (1 - Math.pow(1 + i, -n));
    }

    // Compute annual mortgage payments from amortization schedule
    // Find the first row of amort schedule (has Month/Period in col B)
    var amortStart = -1;
    for (var r = 15; r < Math.min(rows.length, 40); r++) {
      var row = rows[r];
      if (!row) continue;
      var txt = String(row[1] || "").toLowerCase();
      if (
        txt.indexOf("month") !== -1 ||
        txt.indexOf("period") !== -1 ||
        txt === "1"
      ) {
        amortStart = r + 1;
        break;
      }
      // Check if row has numbers in payment columns (month 1 of amort)
      if (row[1] === 1 || row[1] === "1") {
        amortStart = r;
        break;
      }
    }

    if (amortStart > 0) {
      var annualPayment = 0;
      for (var m = 0; m < 12; m++) {
        var arow = rows[amortStart + m];
        if (!arow) break;
        // Payment is typically the sum of Interest + Amortization columns
        // Look for the Payment/Total column (usually col ~5 or ~6)
        var payment = 0;
        for (var c = 2; c < Math.min(arow.length, 10); c++) {
          if (typeof arow[c] === "number" && arow[c] > 0 && arow[c] < 100000) {
            payment += arow[c];
          }
        }
        if (payment > 0) annualPayment += payment;
      }
      if (annualPayment > 0)
        data.annualMortgagePayments = Math.round(annualPayment * 100) / 100;
    }

    // Fallback: compute from MC × Principal
    if (
      !data.annualMortgagePayments &&
      data.mortgageConstant &&
      data.principal
    ) {
      data.annualMortgagePayments =
        Math.round(data.mortgageConstant * data.principal * 12 * 100) / 100;
    }

    // Interest per year
    if (data.principal && data.interestPerAnnum) {
      data.interestPerYear =
        Math.round(data.principal * data.interestPerAnnum * 100) / 100;
    }

    // Format dates
    if (typeof data.commencementDate === "number") {
      try {
        var d = XLSX.SSF.parse_date_code(data.commencementDate);
        data.commencementDate =
          [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ][d.m - 1] +
          " " +
          d.d +
          ", " +
          d.y;
      } catch (e) {}
    }
    if (typeof data.finalMaturityDate === "number") {
      try {
        var d = XLSX.SSF.parse_date_code(data.finalMaturityDate);
        data.finalMaturityDate =
          [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ][d.m - 1] +
          " " +
          d.d +
          ", " +
          d.y;
      } catch (e) {}
    }

    return data;
  }

  var current = parseDebtSheet("Debt Current");
  var refi = parseDebtSheet("Debt Refinance");
  var result = { current: current, refi: refi };
  if (pid) _saveDebtData(pid, result);
  return result;
}

// Build PF_DATA-shaped object from parsed T12 + Debt + Assumptions
function _t12ToPFData(pid) {
  var t12 = _getT12Data(pid);
  var debt = _getDebtData(pid);
  var asmt = getProjectAssumptions
    ? getProjectAssumptions()
    : { rentGrowth: 3, opexGrowth: 3, taxGrowth: 3 };
  if (!t12 || !t12.rows || !t12.rows.length) return null;

  var rentRate = 1 + (asmt.rentGrowth || 3) / 100;
  var opexRate = 1 + (asmt.opexGrowth || 3) / 100;
  var taxRate = 1 + (asmt.taxGrowth || 3) / 100;

  // Known T12 section categories (upper-cased for matching)
  var KNOWN_REV_SECTIONS = ["RENTS", "MANAGEMENT INCOME", "FEES"];
  var KNOWN_EXP_SECTIONS = [
    "CLEANING AND JANITORIAL EXPENSE",
    "CLEANING & JANITORIAL EXPENSE",
    "CLEANING AND JANITORIAL",
    "CLEANING & JANITORIAL",
    "INSURANCE",
    "LEGAL AND OTHER PROFESSIONAL FEES",
    "LEGAL & OTHER PROFESSIONAL FEES",
    "LEGAL AND PROFESSIONAL",
    "LEGAL & PROFESSIONAL",
    "MANAGEMENT FEES EXPENSE",
    "MANAGEMENT FEES",
    "MANAGEMENT",
    "MORTGAGE",
    "REPAIRS AND MAINTENANCE",
    "REPAIRS & MAINTENANCE",
    "TAXES",
    "UTILITIES",
    "ADMINISTRATIVE EXPENSES",
    "ADMINISTRATIVE",
    "MARKETING EXPENSES",
    "MARKETING",
    "BUILDING EXPENSES",
    "BUILDING",
    "PREFERRED RETURNS",
    "PREFERRED PAYMENTS",
  ];

  function _isKnownRevSection(label) {
    var up = label.toUpperCase().trim();
    return KNOWN_REV_SECTIONS.some(function (s) {
      return up === s;
    });
  }
  function _isKnownExpSection(label) {
    var up = label.toUpperCase().trim();
    return KNOWN_EXP_SECTIONS.some(function (s) {
      return up === s;
    });
  }

  // Map T12 rows to PF sections
  var revRows = [];
  var expRows = [];
  var currentPFSection = null;
  var revenuePhase = false;
  var expensePhase = false;
  var totalRevY1 = 0,
    totalRevY2 = 0;
  var totalExpY1 = 0,
    totalExpY2 = 0;
  var adjustmentY1 = 0,
    adjustmentY2 = 0;

  // Collect items for "Others" sections (items not in known categories)
  var revOthersItems = [];
  var expOthersItems = [];
  var inUnknownRevSection = false;
  var inUnknownExpSection = false;

  t12.rows.forEach(function (r) {
    var up = r.label.toUpperCase();

    // Phase detection
    if (up === "INCOME" || up === "REVENUE") {
      revenuePhase = true;
      expensePhase = false;
      inUnknownRevSection = false;
      return;
    }
    if (up === "EXPENSES") {
      revenuePhase = false;
      expensePhase = true;
      inUnknownExpSection = false;
      return;
    }
    if (up === "NET INCOME") {
      revenuePhase = false;
      expensePhase = false;
      return;
    }
    if (up === "ADJUSTMENTS") {
      revenuePhase = false;
      expensePhase = false;
      return;
    }

    // Track TOTAL CASH for adjustment
    if (up === "TOTAL CASH") {
      adjustmentY1 = r.y1Total;
      adjustmentY2 = r.y2Total;
      return;
    }

    if (revenuePhase) {
      if (r.isSection) {
        currentPFSection = r.label;
        if (_isKnownRevSection(r.label)) {
          inUnknownRevSection = false;
          revRows.push({
            isSectionHdr: true,
            label: r.label,
            secId: "rev-" + r.label.toLowerCase().replace(/\s+/g, "-"),
          });
        } else {
          inUnknownRevSection = true;
        }
      } else if (r.isTotal && up.indexOf("TOTAL REVENUE") !== -1) {
        totalRevY1 = r.y1Total;
        totalRevY2 = r.y2Total;
        revRows.push({
          label: "Total Revenue (EGI)",
          isTotal: true,
          vals: _projectRow([r.y1Total, r.y2Total], 7, rentRate),
        });
      } else if (r.isTotal) {
        if (!inUnknownRevSection) {
          revRows.push({
            label: r.label,
            isSubtotal: true,
            vals: _projectRow([r.y1Total, r.y2Total], 7, rentRate),
          });
        }
        // Reset unknown flag after subtotal
        inUnknownRevSection = false;
      } else if (!r.isSection) {
        if (inUnknownRevSection) {
          revOthersItems.push({
            label: r.label,
            vals: _projectRow([r.y1Total, r.y2Total], 7, rentRate),
          });
        } else {
          revRows.push({
            label: r.label,
            vals: _projectRow([r.y1Total, r.y2Total], 7, rentRate),
          });
        }
      }
    }

    if (expensePhase) {
      if (r.isSection) {
        currentPFSection = r.label;
        if (_isKnownExpSection(r.label)) {
          inUnknownExpSection = false;
          expRows.push({
            isSectionHdr: true,
            label: r.label,
            secId: "exp-" + r.label.toLowerCase().replace(/\s+/g, "-"),
          });
        } else {
          inUnknownExpSection = true;
        }
      } else if (r.isTotal && up.indexOf("TOTAL EXPENSES") !== -1) {
        totalExpY1 = r.y1Total;
        totalExpY2 = r.y2Total;
        expRows.push({
          label: "Total Expenses",
          isTotal: true,
          vals: _projectRow([r.y1Total, r.y2Total], 7, opexRate),
        });
        // Add % of EGI row
        var pctVals = [];
        var totRev = _projectRow([totalRevY1, totalRevY2], 7, rentRate);
        var totExp = _projectRow([r.y1Total, r.y2Total], 7, opexRate);
        for (var i = 0; i < 7; i++)
          pctVals.push(totRev[i] ? totExp[i] / totRev[i] : null);
        expRows.push({
          label: "% of EGI",
          isTotal: true,
          isPct: true,
          vals: pctVals,
        });
      } else if (r.isTotal) {
        if (!inUnknownExpSection) {
          var rate =
            currentPFSection &&
            currentPFSection.toUpperCase().indexOf("TAX") !== -1
              ? taxRate
              : opexRate;
          expRows.push({
            label: r.label,
            isSubtotal: true,
            vals: _projectRow([r.y1Total, r.y2Total], 7, rate),
          });
        }
        // Reset unknown flag after subtotal
        inUnknownExpSection = false;
      } else if (!r.isSection) {
        if (inUnknownExpSection) {
          expOthersItems.push({
            label: r.label,
            vals: _projectRow([r.y1Total, r.y2Total], 7, opexRate),
          });
        } else {
          var rate =
            r.label.toLowerCase().indexOf("property tax") !== -1
              ? taxRate
              : opexRate;
          expRows.push({
            label: r.label,
            vals: _projectRow([r.y1Total, r.y2Total], 7, rate),
          });
        }
      }
    }
  });

  // Insert "Others" section for revenue items not in known categories
  if (revOthersItems.length > 0) {
    // Insert before the Total Revenue row
    var revTotalIdx = -1;
    for (var ri = revRows.length - 1; ri >= 0; ri--) {
      if (revRows[ri].isTotal && revRows[ri].label === "Total Revenue (EGI)") {
        revTotalIdx = ri;
        break;
      }
    }
    var othersRevBlock = [
      { isSectionHdr: true, label: "OTHERS", secId: "rev-others" },
    ];
    var othersRevSubY1 = 0,
      othersRevSubY2 = 0;
    revOthersItems.forEach(function (item) {
      othersRevBlock.push(item);
    });
    // Compute subtotal from the vals arrays
    var othersRevSubVals = new Array(7).fill(0);
    revOthersItems.forEach(function (item) {
      item.vals.forEach(function (v, i) {
        if (typeof v === "number") othersRevSubVals[i] += v;
      });
    });
    othersRevBlock.push({
      label: "TOTAL OTHERS",
      isSubtotal: true,
      vals: othersRevSubVals,
    });
    if (revTotalIdx >= 0) {
      revRows.splice.apply(revRows, [revTotalIdx, 0].concat(othersRevBlock));
    } else {
      revRows = revRows.concat(othersRevBlock);
    }
  }

  // Insert "Others" section for expense items not in known categories
  if (expOthersItems.length > 0) {
    var expTotalIdx = -1;
    for (var ei = expRows.length - 1; ei >= 0; ei--) {
      if (expRows[ei].isTotal && expRows[ei].label === "Total Expenses") {
        expTotalIdx = ei;
        break;
      }
    }
    var othersExpBlock = [
      { isSectionHdr: true, label: "OTHERS", secId: "exp-others" },
    ];
    expOthersItems.forEach(function (item) {
      othersExpBlock.push(item);
    });
    var othersExpSubVals = new Array(7).fill(0);
    expOthersItems.forEach(function (item) {
      item.vals.forEach(function (v, i) {
        if (typeof v === "number") othersExpSubVals[i] += v;
      });
    });
    othersExpBlock.push({
      label: "TOTAL OTHERS",
      isSubtotal: true,
      vals: othersExpSubVals,
    });
    if (expTotalIdx >= 0) {
      expRows.splice.apply(expRows, [expTotalIdx, 0].concat(othersExpBlock));
    } else {
      expRows = expRows.concat(othersExpBlock);
    }
  }

  // Compute NOI, Debt, CF, DSCR
  var revTotal = _projectRow([totalRevY1, totalRevY2], 7, rentRate);
  var expTotal = _projectRow([totalExpY1, totalExpY2], 7, opexRate);
  var noi = revTotal.map(function (v, i) {
    return Math.round((v - expTotal[i]) * 100) / 100;
  });

  var debtArr = [];
  var curDebt =
    debt && debt.current ? debt.current.annualMortgagePayments || 0 : 0;
  var refiDebt = 0;
  if (debt && debt.refi) {
    refiDebt =
      debt.refi.principal && debt.refi.interestPerAnnum
        ? Math.round(debt.refi.principal * debt.refi.interestPerAnnum * 100) /
          100 // I/O
        : debt.refi.annualMortgagePayments || 0;
  }
  for (var i = 0; i < 7; i++) debtArr.push(i < 3 ? curDebt : refiDebt);

  var adj = _projectRow([adjustmentY1, adjustmentY2], 7, opexRate);
  var cf = noi.map(function (v, i) {
    return Math.round((v - adj[i] - debtArr[i]) * 100) / 100;
  });
  var dscr = noi.map(function (v, i) {
    return debtArr[i] ? Math.round((v / debtArr[i]) * 1000) / 1000 : null;
  });

  // Build year labels
  var period = (t12.meta && t12.meta.period) || "";
  var startYear = 2024; // default
  var m = period.match(/(\d{4})/);
  if (m) startYear = parseInt(m[1]);
  var cols = [];
  for (var y = 0; y < 7; y++) {
    var yr = startYear + y;
    cols.push(y === 2 ? yr + " (Stab)" : String(yr));
  }

  var pfData = {
    cols: cols,
    revenue: revRows,
    expenses: expRows,
    noi: noi,
    debt: debtArr,
    cf: cf,
    dscr: dscr,
    adjustment: adj,
  };

  _saveProjectPFData(pid, pfData);
  return pfData;
}

// Helper: project 2 years of data to 7 columns using growth rate
function _projectRow(twoYears, nCols, rate) {
  var v = twoYears.slice();
  // Col 2 (Stabilized) = average or extrapolation
  if (v.length === 2) {
    v.push(
      v[1]
        ? Math.round(v[1] * rate * 100) / 100
        : v[0]
          ? Math.round(v[0] * rate * rate * 100) / 100
          : 0,
    );
  }
  while (v.length < nCols) {
    var last = v[v.length - 1];
    v.push(last ? Math.round(last * rate * 100) / 100 : 0);
  }
  return v;
}

// Parse all sheets from a single underwriting xlsx (T12 + RR + Debt)
function _parseUnderwritingXlsx(buf, pid) {
  var wb = XLSX.read(buf, { type: "array" });
  var hasT12 = wb.SheetNames.some(function (n) {
    return n.toLowerCase().indexOf("t12") !== -1;
  });
  var hasRR = wb.SheetNames.some(function (n) {
    return (
      n.toUpperCase() === "RR" || n.toLowerCase().indexOf("rent roll") !== -1
    );
  });
  var hasDebt = wb.SheetNames.some(function (n) {
    return n.toLowerCase().indexOf("debt") !== -1;
  });

  if (hasT12) _parseT12FromXlsx(buf, pid);
  if (hasRR) _parseRRFromXlsx(buf, pid);
  if (hasDebt) _parseDebtFromXlsx(buf, pid);
  if (hasT12) _t12ToPFData(pid);

  return { t12: hasT12, rr: hasRR, debt: hasDebt };
}
window._parseUnderwritingXlsx = _parseUnderwritingXlsx;

var _pfLoaded = false;
var _pfManualEdits = {};
var _pfEditMode = false;

// Returns a PF_DATA-shaped object with all numeric values set to null
function _emptyPFData() {
  return {
    cols: PF_DATA.cols,
    revenue: PF_DATA.revenue.map(function (r) {
      return Object.assign({}, r, {
        vals: r.vals
          ? r.vals.map(function () {
              return null;
            })
          : undefined,
      });
    }),
    expenses: PF_DATA.expenses.map(function (r) {
      return Object.assign({}, r, {
        vals: r.vals
          ? r.vals.map(function () {
              return null;
            })
          : undefined,
      });
    }),
    noi: PF_DATA.noi.map(function () {
      return null;
    }),
    debt: PF_DATA.debt.map(function () {
      return null;
    }),
    cf: PF_DATA.cf.map(function () {
      return null;
    }),
    dscr: PF_DATA.dscr.map(function () {
      return null;
    }),
    adjustment: PF_DATA.adjustment.map(function () {
      return null;
    }),
  };
}
var _globalEditMode = false;
var _ctxTargetRow = null;

const I18N = {
  en: {
    // Sidebar nav
    workspace: "Workspace",
    analysis: "Analysis",
    market: "Market",
    admin: "Admin",
    nav_dashboard: "Dashboard",
    nav_projects: "Projects",
    nav_proforma: "Pro Forma",
    nav_rentroll: "Rent Roll",
    nav_debt: "Debt Analysis",
    nav_market: "Market Data",
    nav_comps: "Comparables",
    nav_submissions: "Completed",
    nav_users: "Users",
    nav_settings: "Settings",
    // Auth
    sign_in: "Sign In",
    register: "Register",
    email: "Email Address",
    password: "Password",
    first_name: "First Name",
    last_name: "Last Name",
    role: "Role",
    create_account: "Create Account",
    demo_hint:
      "Demo: admin@glcapital.com / admin123\nor: analyst@glcapital.com / analyst123",
    role_underwriter: "Underwriter",
    role_admin: "Admin",
    // Dashboard
    dashboard_title: "Dashboard",
    dashboard_sub: "Portfolio overview",
    new_project: "New Project",
    offer_price: "Offer Price",
    cap_rate: "Cap Rate (Stab.)",
    dscr: "DSCR (Refi)",
    irr: "IRR (5-Year)",
    rev_vs_exp: "Revenue vs. Expenses",
    active_projects: "Active Projects",
    view_all: "View All",
    // Projects
    projects_title: "Projects",
    projects_sub: "Your portfolio of active analyses",
    projects_sub_admin: "All team projects",
    col_project: "Project",
    col_price: "Offer Price",
    col_units: "Units",
    col_status: "Status",
    col_updated: "Last Updated",
    col_analyst: "Analyst",
    btn_open: "Open",
    btn_files: "Files",
    // Pro Forma
    proforma_title: "Pro Forma",
    proforma_sub: "Multi-source underwriting analysis",
    fetch_apis: "Fetch APIs",
    btn_export: "Export",
    btn_save: "Save",
    btn_publish: "Publish",
    published_msg:
      "Published — This analysis has been submitted for admin review.",
    source_docs: "Source Documents",
    uploaded_files: "Uploaded broker files",
    upload_hint: "Click to upload or drag files",
    upload_types: "T12 · Rent Roll · Debt Current · Debt Refinance",
    source_legend: "Source legend",
    proj_summary: "Project Summary",
    stab_note:
      "Stabilized year = AVG(Year 1, Year 2) · Growth: Rent 4% · OpEx 3% · Tax 3%",
    col_lineitem: "Line Item",
    col_sources: "Sources",
    col_perunit: "Per Unit",
    col_stab: "Stabilized",
    rev_section: "Revenue",
    exp_section: "Operating Expenses",
    total_rev: "Total Revenue (EGI)",
    total_exp: "Total Expenses",
    pct_rev: "% of Revenue",
    noi: "Net Operating Income (NOI)",
    debt_svc: "Debt Service",
    cf_ds: "Cash Flow after Debt Service",
    // Rent Roll
    rentroll_title: "Rent Roll",
    rentroll_sub: "Unit-level lease analysis",
    col_unit: "Unit",
    col_sqft: "SqFt",
    col_tenant: "Tenant",
    col_rent: "Actual Rent",
    col_psf: "$/SqFt",
    col_deposit: "Security Dep.",
    col_movein: "Move In",
    col_lease: "Lease Exp.",
    col_mkt: "Mkt Est.",
    col_upside: "Upside",
    col_status2: "Status",
    occupied: "Occupied",
    vacant: "Vacant",
    // Debt
    debt_title: "Debt Analysis",
    debt_sub: "Existing vs. refinance scenario comparison",
    current_debt: "Current Debt",
    refi_scenario: "Refinance Scenario",
    dscr_table: "Year-by-Year DSCR Coverage",
    col_period: "Period",
    col_noi: "NOI",
    col_ds: "Debt Service",
    col_dscr: "DSCR",
    col_debttype: "Debt Type",
    col_cfads: "Cash Flow After DS",
    // Market
    market_title: "Market Data",
    market_sub: "Regional multifamily benchmarks",
    btn_refresh: "Refresh",
    mkt_vacancy: "Market Vacancy",
    avg_1br: "Avg 1BR Rent",
    avg_2br: "Avg 2BR Rent",
    yoy_rent: "YoY Rent Growth",
    rent_benchmark: "Rent Benchmark",
    market_indicators: "Market Indicators",
    // Comps
    comps_title: "Comparables",
    comps_sub: "Multifamily sales & rental comp analysis",
    tab_sales: "Sales Comps",
    tab_rental: "Rental Comps",
    tab_expense: "Expense Comps",
    btn_search: "Search Comps",
    // Submissions
    submissions_title: "Completed Projects",
    submissions_sub: "Projects marked as completed analyses awaiting review",
    btn_open_analysis: "Open Analysis",
    btn_approve: "Approve",
    btn_reject: "Reject",
    // Users
    users_title: "Users",
    users_sub: "Team member accounts",
    btn_add_user: "Add User",
    col_name: "Name",
    col_email: "Email",
    btn_disable: "Disable",
    btn_enable: "Enable",
    // Settings
    settings_title: "Settings",
    settings_sub: "API configuration",
    api_integrations: "API Integrations",
    btn_save_keys: "Save Keys",
    btn_save_defaults: "Save Defaults",
    // KPI labels
    kpi_equity_mult: "Equity Multiple",
    kpi_coc: "Cash-on-Cash Yr5",
    kpi_ppu: "Price / Unit",
    kpi_equity_req: "Equity Required",
    // User badge
    role_administrator: "Administrator",
    signout: "Sign out",
    // Modal
    new_project_title: "New Project",
    proj_name: "Project Name",
    proj_address: "Property Address",
    proj_price: "Offer Price ($)",
    proj_units: "Total Units",
    btn_cancel: "Cancel",
    btn_create: "Create Project",
    // Toast
    toast_saved: "Pro forma saved",
    toast_keys_saved: "API keys saved",
    toast_defaults_saved: "Defaults saved",
    toast_published: "Analysis published — admin notified",
    lang_label: "中文",
  },
  zh: {
    workspace: "工作台",
    analysis: "分析",
    market: "市场",
    admin: "管理",
    nav_dashboard: "仪表盘",
    nav_projects: "项目",
    nav_proforma: "预期收益表",
    nav_rentroll: "租金花名册",
    nav_debt: "债务分析",
    nav_market: "市场数据",
    nav_comps: "可比物业",
    nav_submissions: "提交审核",
    nav_users: "用户管理",
    nav_settings: "系统设置",
    sign_in: "登录",
    register: "注册",
    email: "电子邮箱",
    password: "密码",
    first_name: "名",
    last_name: "姓",
    role: "角色",
    create_account: "创建账号",
    demo_hint:
      "演示账号: admin@glcapital.com / admin123\n或: analyst@glcapital.com / analyst123",
    role_underwriter: "承销分析师",
    role_admin: "管理员",
    dashboard_title: "仪表盘",
    dashboard_sub: "投资组合概览",
    new_project: "新建项目",
    offer_price: "报价",
    cap_rate: "资本化率（稳定）",
    dscr: "DSCR（再融资）",
    irr: "IRR（5年期）",
    rev_vs_exp: "收入与支出",
    active_projects: "活跃项目",
    view_all: "查看全部",
    projects_title: "项目",
    projects_sub: "您的投资分析项目组合",
    projects_sub_admin: "全部团队项目",
    col_project: "项目",
    col_price: "报价",
    col_units: "套数",
    col_status: "状态",
    col_updated: "最后更新",
    col_analyst: "分析师",
    btn_open: "打开",
    btn_files: "文件",
    proforma_title: "预期收益表",
    proforma_sub: "多数据源承销分析",
    fetch_apis: "拉取API数据",
    btn_export: "导出",
    btn_save: "保存",
    btn_publish: "发布",
    published_msg: "已发布 — 分析结果已提交管理员审核。",
    source_docs: "原始文件",
    uploaded_files: "已上传的经纪人文件",
    upload_hint: "点击上传或拖拽文件",
    upload_types: "T12 · 租金花名册 · 现有债务 · 再融资方案",
    source_legend: "数据来源说明",
    proj_summary: "项目概要",
    stab_note:
      "稳定年 = AVG(第1年, 第2年) · 增长：租金4% · 运营成本3% · 税费3%",
    col_lineitem: "科目",
    col_sources: "数据来源",
    col_perunit: "每套均值",
    col_stab: "稳定年",
    rev_section: "收入",
    exp_section: "运营支出",
    total_rev: "总收入（EGI）",
    total_exp: "总支出",
    pct_rev: "占收入比",
    noi: "净营业收入（NOI）",
    debt_svc: "还款额",
    cf_ds: "还款后现金流",
    rentroll_title: "租金花名册",
    rentroll_sub: "单元级租约分析",
    col_unit: "房间",
    col_sqft: "面积",
    col_tenant: "租客",
    col_rent: "实际租金",
    col_psf: "元/平方英尺",
    col_deposit: "保证金",
    col_movein: "入住日期",
    col_lease: "到期日",
    col_mkt: "市场估价",
    col_upside: "上涨空间",
    col_status2: "状态",
    occupied: "已出租",
    vacant: "空置",
    debt_title: "债务分析",
    debt_sub: "现有债务 vs. 再融资方案对比",
    current_debt: "现有债务",
    refi_scenario: "再融资方案",
    dscr_table: "逐年DSCR覆盖率",
    col_period: "期间",
    col_noi: "NOI",
    col_ds: "还款额",
    col_dscr: "DSCR",
    col_debttype: "债务类型",
    col_cfads: "还款后现金流",
    market_title: "市场数据",
    market_sub: "区域多户住宅基准指标",
    btn_refresh: "刷新",
    mkt_vacancy: "市场空置率",
    avg_1br: "1居室均价",
    avg_2br: "2居室均价",
    yoy_rent: "同比租金增长",
    rent_benchmark: "租金基准",
    market_indicators: "市场指标",
    comps_title: "可比物业",
    comps_sub: "多户住宅销售及租金可比分析",
    tab_sales: "销售可比",
    tab_rental: "租金可比",
    tab_expense: "费用可比",
    btn_search: "搜索可比",
    submissions_title: "提交审核",
    submissions_sub: "待审核的承销分析结果",
    btn_open_analysis: "查看分析",
    btn_approve: "批准",
    btn_reject: "驳回",
    users_title: "用户管理",
    users_sub: "团队成员账号",
    btn_add_user: "添加用户",
    col_name: "姓名",
    col_email: "邮箱",
    btn_disable: "禁用",
    btn_enable: "启用",
    settings_title: "系统设置",
    settings_sub: "API配置与承销默认参数",
    api_integrations: "API集成",
    uw_defaults: "承销默认参数",
    btn_save_keys: "保存密钥",
    btn_save_defaults: "保存默认值",
    kpi_equity_mult: "权益倍数",
    kpi_coc: "第5年现金回报率",
    kpi_ppu: "每套均价",
    kpi_equity_req: "所需权益资金",
    role_administrator: "管理员",
    signout: "退出登录",
    new_project_title: "新建项目",
    proj_name: "项目名称",
    proj_address: "物业地址",
    proj_price: "报价（$）",
    proj_units: "总套数",
    btn_cancel: "取消",
    btn_create: "创建项目",
    toast_saved: "预期收益表已保存",
    toast_keys_saved: "API密钥已保存",
    toast_defaults_saved: "默认参数已保存",
    toast_published: "分析已发布 — 管理员已收到通知",
    lang_label: "English",
  },
};

function initUsers() {
  if (!_lsGet(USERS_KEY)) {
    _lsSet(
      USERS_KEY,
      JSON.stringify([
        {
          id: "u1",
          firstName: "Admin",
          lastName: "User",
          email: "admin@glcapital.com",
          password: "admin123",
          role: "admin",
          status: "active",
        },
        {
          id: "u2",
          firstName: "Sarah",
          lastName: "Chen",
          email: "analyst@glcapital.com",
          password: "analyst123",
          role: "underwriter",
          status: "active",
        },
        {
          id: "u3",
          firstName: "Michael",
          lastName: "Torres",
          email: "m.torres@glcapital.com",
          password: "analyst123",
          role: "underwriter",
          status: "active",
        },
        {
          id: "u4",
          firstName: "Jennifer",
          lastName: "Park",
          email: "j.park@glcapital.com",
          password: "analyst123",
          role: "underwriter",
          status: "active",
        },
      ]),
    );
  }
}
function getUsers() {
  var arr = JSON.parse(_lsGet(USERS_KEY) || "[]");
  return Array.isArray(arr)
    ? arr.filter(function (u) {
        return u && typeof u === "object" && u.id;
      })
    : [];
}
function saveUsers(u) {
  _lsSet(USERS_KEY, JSON.stringify(u));
}
function getSession() {
  return JSON.parse(_ssGet(SESSION_KEY) || "null");
}
function setSession(u) {
  _ssSet(SESSION_KEY, JSON.stringify(u));
}
function clearSession() {
  _ssClear();
}

// ── Data version for migration ──
var DATA_VERSION = 13;

function migrateData() {
  var stored = parseInt(_lsGet("glc_data_ver") || "0");
  if (stored < DATA_VERSION) {
    // Clear old data and re-seed fresh
    _lsRm(PROJECTS_KEY);
    _lsRm(USERS_KEY);
    _lsRm("glc_data_ver");
    _lsRm("glc_submissions");
    _lsRm(SUBMISSIONS_KEY);
  }
}

function initProjects() {
  if (!_lsGet(PROJECTS_KEY)) {
    _lsSet(PROJECTS_KEY, JSON.stringify([]));
  }
}

// Seed project data by fetching xlsx files from /data/ and parsing them
function _seedProjectData() {
  // No longer seeding demo data — projects are created by the user
}
window._seedProjectData = _seedProjectData;
// Safe storage wrappers (handles SecurityError in sandboxed iframes)
var _memStore = {};
function _lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return _memStore[k] || null;
  }
}
function _lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {
    _memStore[k] = v;
  }
}
function _lsRm(k) {
  try {
    localStorage.removeItem(k);
  } catch (e) {
    delete _memStore[k];
  }
}
var _ssStore = {};
function _ssGet(k) {
  try {
    return sessionStorage.getItem(k);
  } catch (e) {
    return _ssStore[k] || null;
  }
}
function _ssSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch (e) {
    _ssStore[k] = v;
  }
}
function _ssClear() {
  try {
    sessionStorage.clear();
  } catch (e) {
    _ssStore = {};
  }
}
function getProjects() {
  var arr = JSON.parse(_lsGet(PROJECTS_KEY) || "[]");
  return Array.isArray(arr)
    ? arr.filter(function (p) {
        return p && typeof p === "object" && p.id;
      })
    : [];
}
function saveProjects(p) {
  _lsSet(PROJECTS_KEY, JSON.stringify(p));
}
function getSubmissions() {
  var arr = JSON.parse(_lsGet(SUBMISSIONS_KEY) || "[]");
  return Array.isArray(arr)
    ? arr.filter(function (s) {
        return s && typeof s === "object" && s.id;
      })
    : [];
}
function saveSubmissions(s) {
  _lsSet(SUBMISSIONS_KEY, JSON.stringify(s));
}
function initSubmissions() {
  if (!_lsGet(SUBMISSIONS_KEY)) {
    _lsSet(SUBMISSIONS_KEY, JSON.stringify([]));
  }
}

var _projFilter = "all";
function setProjectFilter(f, btn) {
  _projFilter = f;
  document
    .querySelectorAll(".proj-filter-btn")
    .forEach((b) => b.classList.remove("active-filter"));
  if (btn) btn.classList.add("active-filter");
  renderProjects();
}

var currentProjectId = null;
var currentMarketRegion = "";
var currentCompTab = "sales";

function switchAuthTab(tab, btn) {
  document
    .querySelectorAll(".auth-tab-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("loginForm").style.display =
    tab === "login" ? "" : "none";
  document.getElementById("registerForm").style.display =
    tab === "register" ? "" : "none";
}

function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const users = getUsers();
  const user = users.find(
    (u) => u.email === email && u.password === pass && u.status === "active",
  );
  if (!user) {
    toast("Invalid credentials or account disabled", "error");
    return;
  }
  setSession(user);
  loadApp(user);
}

function doRegister() {
  const first = document.getElementById("regFirst").value.trim();
  const last = document.getElementById("regLast").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("regPassword").value;
  const role = document.getElementById("regRole").value;
  if (!first || !last || !email || !pass) {
    toast("Please fill all fields", "error");
    return;
  }
  if (pass.length < 8) {
    toast("Password must be 8+ characters", "error");
    return;
  }
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    toast("Email already registered", "error");
    return;
  }
  const newUser = {
    id: "u" + Date.now(),
    firstName: first,
    lastName: last,
    email,
    password: pass,
    role,
    status: "active",
  };
  users.push(newUser);
  saveUsers(users);
  setSession(newUser);
  loadApp(newUser);
}

function doLogout() {
  clearSession();
  document.getElementById("authPage").style.display = "flex";
  document.getElementById("appShell").style.display = "none";
  toast("Signed out successfully");
}

function loadApp(user) {
  document.getElementById("authPage").style.display = "none";
  document.getElementById("appShell").style.display = "flex";
  document.getElementById("userAvatar").textContent =
    user.firstName[0] + user.lastName[0];
  document.getElementById("sidebarUserName").textContent =
    user.firstName + " " + user.lastName;
  document.getElementById("sidebarUserRole").textContent =
    user.role === "admin" ? "Administrator" : "Underwriter";
  const adminNav = document.getElementById("adminNav");
  if (user.role === "admin") {
    adminNav.style.display = "";
  } else {
    adminNav.style.display = "none";
  }
  // Update avatar color by role
  var av = document.getElementById("userAvatar");
  if (av) {
    av.style.background =
      user.role === "admin" ? "rgba(139,115,85,0.2)" : "rgba(74,101,133,0.15)";
    av.style.color = user.role === "admin" ? "var(--accent)" : "var(--blue)";
  }
  // My projects label
  document.getElementById("myProjectsLabel").textContent =
    user.role === "admin"
      ? "All team projects"
      : "Your active underwriting projects";
  renderProjects();
  renderUsersTable();
  renderSubmissions();
  buildProjectDropdowns();
  navTo("projects", document.getElementById("nav-projects"));
}
// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function navTo(page, el) {
  // Role-gate: block non-admin users from admin-only pages
  var adminPages = ["users", "settings"];
  if (adminPages.indexOf(page) !== -1) {
    var sess = getSession();
    if (!sess || sess.role !== "admin") {
      toast(
        currentLang === "zh"
          ? "权限不足，无法访问该页面"
          : "Access denied: insufficient permissions",
        "error",
      );
      return;
    }
  }
  // Explicitly hide ALL pages (belt+suspenders: CSS class + inline style)
  document.querySelectorAll(".page").forEach(function (p) {
    p.classList.remove("active");
    p.style.display = "none";
  });
  document.querySelectorAll(".nav-item").forEach(function (n) {
    n.classList.remove("active");
  });
  // Show target page
  const p = document.getElementById("page-" + page);
  if (p) {
    p.classList.add("active");
    p.style.display = "block";
  }
  if (el) el.classList.add("active");
  // Scroll to top
  window.scrollTo(0, 0);
  const mainEl = document.querySelector("main");
  if (mainEl) mainEl.scrollTop = 0;
  // Page-specific render hooks
  if (page === "uw-dashboard" || page === "dashboard") renderDashboard();
  if (page === "projects") renderProjects();
  if (page === "submissions") renderSubmissions();
  if (page === "users") renderUsersTable();
}

// ─── PROJECT SWITCHER ─────────────────────────────────────────────────────────
function buildProjectDropdowns() {
  const projs = getFilteredProjects();
  ["pf", "rr", "debt"].forEach((id) => {
    const dd = document.getElementById("dropdown-" + id);
    if (!dd) return;
    dd.innerHTML = projs
      .map(
        (
          p,
        ) => `<div class="project-dropdown-item${p.id === currentProjectId ? " active" : ""}" onclick="switchProject('${p.id}','${id}')">
      <div class="project-dot" style="background:${p.status === "complete" || p.status === "completed" || p.status === "active" ? "var(--green)" : "var(--amber)"}"></div>
      <div><div style="font-size:13px;font-weight:500;color:var(--header)">${p.name}</div><div style="font-size:11px;color:var(--muted)">${p.address}</div></div>
    </div>`,
      )
      .join("");
  });
}

function toggleProjectDropdown(id) {
  const dd = document.getElementById("dropdown-" + id);
  const isOpen = dd.classList.contains("open");
  document
    .querySelectorAll(".project-dropdown")
    .forEach((d) => d.classList.remove("open"));
  if (!isOpen) dd.classList.add("open");
}
document.addEventListener("click", function (e) {
  if (!e.target.closest(".project-switcher-wrap"))
    document
      .querySelectorAll(".project-dropdown")
      .forEach((d) => d.classList.remove("open"));
});

function switchProject(pid, context) {
  currentProjectId = pid;
  const p = getProjects().find((x) => x.id === pid);
  if (!p) return;
  ["pf", "rr", "debt"].forEach((id) => {
    const el =
      document.getElementById(id + "ProjectName") ||
      document.getElementById(
        id === "pf"
          ? "pfProjectName"
          : id === "rr"
            ? "rrProjectName"
            : "debtProjectName",
      );
    if (el) el.textContent = p.name;
  });
  document
    .querySelectorAll(".project-dropdown")
    .forEach((d) => d.classList.remove("open"));
  buildProjectDropdowns();
  renderRentRoll();
  buildPFTable();
  updateTabDots();
  updateSummKpis();
  toast(`Switched to ${p.name}`);
}

function getFilteredProjects() {
  const sess = getSession();
  if (!sess) return [];
  const projs = getProjects();
  if (sess.role === "admin") return projs;
  return projs.filter((p) => p.ownerId === sess.id);
}

// ─── PROJECTS SUMMARY BANNER ─────────────────────────────────────────────────
function calcAIScore(p) {
  if (!p.capRate && !p.dscr && !p.irr) return null;
  var cr = p.capRate || 0,
    ds = p.dscr || 0,
    ir = p.irr || 0;
  var s =
    Math.min((cr / 8) * 40, 40) +
    Math.min((Math.max(ds - 1, 0) / 0.8) * 30, 30) +
    Math.min((ir / 25) * 30, 30);
  return Math.round(Math.min(s, 100));
}
function renderProjectsBanner() {
  var el = document.getElementById("projSummaryBanner");
  if (!el) return;
  var all = getFilteredProjects();
  var total = all.length;
  var draft = all.filter(function (p) {
    return p.status === "draft";
  }).length;
  var complete = all.filter(function (p) {
    return p.status === "complete" || p.status === "completed";
  }).length;
  var totalOffer = all.reduce(function (s, p) {
    return s + (p.offerPrice || 0);
  }, 0);
  var scores = all.map(calcAIScore).filter(function (s) {
    return s !== null;
  });
  var avgScore = scores.length
    ? Math.round(
        scores.reduce(function (a, b) {
          return a + b;
        }, 0) / scores.length,
      )
    : null;

  function card(value, label, color, bg) {
    return (
      '<div style="background:' +
      bg +
      ';border:1px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:4px">' +
      '<div style="font-size:22px;font-weight:900;color:' +
      color +
      '">' +
      value +
      "</div>" +
      '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600">' +
      label +
      "</div>" +
      "</div>"
    );
  }
  var offerStr =
    totalOffer >= 1e9
      ? "$" + (totalOffer / 1e9).toFixed(1) + "B"
      : "$" + (totalOffer / 1e6).toFixed(1) + "M";
  var scoreColor =
    avgScore === null
      ? "var(--muted)"
      : avgScore >= 75
        ? "var(--green)"
        : avgScore >= 55
          ? "var(--amber)"
          : "#c0392b";
  el.innerHTML =
    card(total, "Total Projects", "var(--header)", "rgba(255,255,255,0.9)") +
    card(draft, "Draft", "var(--amber)", "rgba(139,106,46,0.06)") +
    card(complete, "Complete", "var(--green)", "rgba(74,124,89,0.07)") +
    card(
      avgScore !== null ? avgScore + "" : "—",
      "Avg AI Score",
      scoreColor,
      "rgba(74,101,133,0.06)",
    ) +
    card(
      offerStr,
      "Total Offer Price",
      "var(--accent)",
      "rgba(139,115,85,0.07)",
    );
}

// ─── PROJECTS PAGE ───────────────────────────────────────────────────────────
function renderProjects() {
  const sess = getSession();
  if (!sess) return;
  renderProjectsBanner();
  const allProjs = getFilteredProjects();
  const container = document.getElementById("projectsList");
  if (!container) return;
  const zh = currentLang === "zh";

  const q = (document.getElementById("projSearchInput")?.value || "")
    .toLowerCase()
    .trim();
  const projs = allProjs.filter((p) => {
    if (!p || !p.id) return false;
    const matchQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.address || "").toLowerCase().includes(q);
    const matchF = _projFilter === "all" || p.status === _projFilter;
    return matchQ && matchF;
  });

  const lbl = document.getElementById("myProjectsLabel");
  if (lbl)
    lbl.textContent =
      sess.role === "admin"
        ? zh
          ? "全部项目 · " + allProjs.length + " 个"
          : "All projects · " + allProjs.length + " total"
        : zh
          ? "我的项目 · " + allProjs.length + " 个"
          : "My projects · " + allProjs.length + " total";

  if (!projs.length) {
    container.innerHTML =
      '<div class="card" style="text-align:center;padding:56px 40px">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.2" style="width:48px;height:48px;margin:0 auto 16px;display:block"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' +
      '<div style="font-size:15px;font-weight:600;color:var(--header);margin-bottom:8px">' +
      (zh ? "暂无项目" : "No projects found") +
      "</div>" +
      '<div style="font-size:13px;color:var(--muted)">' +
      (q
        ? zh
          ? "尝试其他搜索词"
          : "Try a different search"
        : zh
          ? "点击右上角新建项目"
          : 'Click "New Project" to get started') +
      "</div>" +
      "</div>";
    return;
  }

  container.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    projs
      .map(function (p) {
        if (!p || !p.id) return "";
        const allUsers = getUsers();
        const owner = allUsers.find(function (u) {
          return u.id === p.ownerId;
        });
        const ownerName = owner ? owner.firstName + " " + owner.lastName : "—";
        const cr = p.id === "p1" ? 6.46 : p.capRate || null;
        const noi = p.id === "p1" ? 331934 : p.noi || null;
        const dscr = p.id === "p1" ? 1.51 : p.dscr || null;
        const irr = p.id === "p1" ? 17.5 : p.irr || null;
        const files = p.files || [];
        const hasT12 = files.some(function (f) {
          return (
            f.type === "T12" ||
            f.parsedAs === "T12" ||
            f.type === "Selling Model" ||
            f.parsedAs === "Selling Model"
          );
        });
        const hasRR = files.some(function (f) {
          return f.type === "Rent Roll" || f.parsedAs === "Rent Roll";
        });
        const hasDebt = files.some(function (f) {
          return (
            (f.type || "").indexOf("Debt") > -1 ||
            (f.parsedAs || "").indexOf("Debt") > -1
          );
        });

        var isDone =
          p.status === "complete" ||
          p.status === "completed" ||
          p.status === "active";
        var sc = isDone ? "var(--green)" : "var(--amber)";
        var sb = isDone ? "rgba(74,124,89,0.12)" : "rgba(139,106,46,0.08)";
        var sl = isDone ? (zh ? "已完成" : "Complete") : zh ? "草稿" : "Draft";
        var si = isDone ? "✓" : "○";

        function pill(label, has) {
          return (
            '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;' +
            "background:" +
            (has ? "rgba(74,124,89,0.12)" : "rgba(0,0,0,0.05)") +
            ";color:" +
            (has ? "var(--green)" : "rgba(0,0,0,0.25)") +
            ';">' +
            (has
              ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
              : '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>') +
            "&nbsp;" +
            label +
            "</span>"
          );
        }
        function kpi(label, val, color, big) {
          if (!val && val !== 0) return "";
          return (
            '<div style="text-align:center;padding:10px 16px;background:rgba(255,255,255,0.7);border-radius:10px;border:1px solid rgba(0,0,0,0.06);min-width:72px">' +
            '<div style="font-size:' +
            (big ? "16" : "15") +
            "px;font-weight:800;color:" +
            (color || "var(--header)") +
            '">' +
            val +
            "</div>" +
            '<div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">' +
            label +
            "</div>" +
            "</div>"
          );
        }

        var priceStr = p.offerPrice
          ? "$" + (p.offerPrice / 1e6).toFixed(1) + "M"
          : "—";
        var noiFmt = noi ? "$" + (noi / 1000).toFixed(0) + "K" : null;

        return (
          '<div class="proj-list-card" onclick="openProjectAnalysis(\'' +
          p.id +
          "')\" onmouseenter=\"this.style.boxShadow='0 8px 32px rgba(0,0,0,0.12)';this.style.transform='translateY(-2px)'\" onmouseleave=\"this.style.boxShadow='0 2px 12px rgba(0,0,0,0.05)';this.style.transform=''\"  style=\"cursor:pointer;position:relative;overflow:hidden;border:1.5px solid var(--border2);border-radius:16px;background:rgba(255,255,255,0.88);box-shadow:0 2px 12px rgba(0,0,0,0.05);transition:all .2s cubic-bezier(.34,1.56,.64,1);padding:0;display:flex;align-items:stretch\">" + // Left color stripe
          '<div style="width:5px;flex-shrink:0;background:' +
          sc +
          ';border-radius:16px 0 0 16px"></div>' +
          '<div style="flex:1;padding:18px 20px 16px;display:flex;flex-direction:column;gap:0">' + // Row 1: Name + Status + Actions
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">' +
          '<div style="min-width:0;flex:1">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<span style="font-size:16px;font-weight:800;color:var(--header);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          p.name +
          "</span>" +
          "</div>" +
          '<div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">' +
          (p.address || "—") +
          "</div>" +
          '<div style="font-size:11px;color:var(--muted)">' +
          (zh ? "负责人：" : "UW: ") +
          '<strong style="color:var(--header)">' +
          ownerName +
          "</strong>" +
          (p.lastUpdated
            ? '&nbsp;<span style="color:var(--border)">·</span>&nbsp;' +
              p.lastUpdated
            : "") +
          "</div>" +
          "</div>" +
          '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0" onclick="event.stopPropagation()">' +
          '<span style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;background:' +
          sb +
          ";color:" +
          sc +
          ';white-space:nowrap">' +
          sl +
          "</span>" +
          '<button class="btn btn-primary btn-sm" onclick="openProjectAnalysis(\'' +
          p.id +
          "')\">" +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>' +
          "</button>" +
          "</div>" +
          "</div>" + // Row 2: Key metrics strip + doc pills
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + // Offer price - prominent
          (p.offerPrice
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(139,115,85,0.07);border:1px solid rgba(139,115,85,0.15);text-align:center;min-width:80px">' +
              '<div style="font-size:17px;font-weight:800;color:var(--accent)">$' +
              (p.offerPrice / 1e6).toFixed(1) +
              "M</div>" +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">' +
              (zh ? "报价" : "Offer Price") +
              "</div>" +
              "</div>"
            : "") +
          // Units
          (p.units
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(74,101,133,0.07);border:1px solid rgba(74,101,133,0.15);text-align:center;min-width:60px">' +
              '<div style="font-size:17px;font-weight:800;color:var(--blue)">' +
              p.units +
              "</div>" +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">' +
              (zh ? "套数" : "Units") +
              "</div>" +
              "</div>"
            : "") +
          // Cap Rate - very prominent
          (cr
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(74,124,89,0.1);border:1.5px solid rgba(74,124,89,0.2);text-align:center;min-width:72px">' +
              '<div style="font-size:18px;font-weight:900;color:var(--green)">' +
              cr +
              "%</div>" +
              '<div style="font-size:9px;color:var(--green);margin-top:2px;text-transform:uppercase;letter-spacing:.06em;opacity:.7">Cap Rate</div>' +
              "</div>"
            : "") +
          // NOI
          (noi
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(74,124,89,0.06);border:1px solid rgba(74,124,89,0.14);text-align:center;min-width:72px">' +
              '<div style="font-size:17px;font-weight:800;color:var(--header)">$' +
              (noi / 1000).toFixed(0) +
              "K</div>" +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">NOI</div>' +
              "</div>"
            : "") +
          // DSCR
          (dscr
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(74,101,133,0.07);border:1px solid rgba(74,101,133,0.15);text-align:center;min-width:68px">' +
              '<div style="font-size:17px;font-weight:800;color:var(--blue)">' +
              dscr +
              "×</div>" +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">DSCR</div>' +
              "</div>"
            : "") +
          // IRR
          (irr
            ? '<div style="padding:10px 14px;border-radius:10px;background:rgba(74,124,89,0.07);border:1px solid rgba(74,124,89,0.14);text-align:center;min-width:68px">' +
              '<div style="font-size:17px;font-weight:800;color:var(--green)">' +
              irr +
              "%</div>" +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">IRR</div>' +
              "</div>"
            : "") +
          // AI Score + Doc pills (right-aligned, separated)
          '<div style="margin-left:auto;display:flex;gap:14px;align-items:center">' +
          '<div style="padding:0 10px;border-left:1.5px solid var(--border2)">' +
          renderAIScoreBadge(p.id, "sm") +
          "</div>" +
          '<div style="display:flex;gap:4px;align-items:center">' +
          pill("T12", hasT12) +
          pill("RR", hasRR) +
          pill("Debt", hasDebt) +
          "</div></div>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>";
}

function deleteProject(pid) {
  if (!confirm("Delete this project? This cannot be undone.")) return;
  const projs = getProjects().filter((p) => p.id !== pid);
  saveProjects(projs);
  renderProjects();
  toast("Project deleted");
}

function openEditProjectModal(pid) {
  const projs = getProjects();
  const p = projs.find((x) => x.id === pid);
  if (!p) return;
  const zh = currentLang === "zh";
  openModal(
    zh ? "编辑项目" : "Edit Project",
    `
    <div class="form-group"><label class="form-label">${zh ? "项目名称" : "Project Name"}</label><input class="form-input" id="editProjName" value="${p.name || ""}"></div>
    <div class="form-group"><label class="form-label">${zh ? "地址" : "Address"}</label><input class="form-input" id="editProjAddr" value="${p.address || ""}"></div>
    <div class="bento bento-2" style="gap:12px">
      <div class="form-group"><label class="form-label">${zh ? "报价" : "Offer Price ($)"}</label><input class="form-input" id="editProjPrice" type="number" value="${p.offerPrice || ""}"></div>
      <div class="form-group"><label class="form-label">${zh ? "套数" : "Total Units"}</label><input class="form-input" id="editProjUnits" type="number" value="${p.units || ""}"></div>
    </div>
    <div class="bento bento-2" style="gap:12px">
      <div class="form-group"><label class="form-label">${zh ? "净营业收入 NOI" : "NOI ($)"}</label><input class="form-input" id="editProjNOI" type="number" value="${p.noi || ""}"></div>
      <div class="form-group"><label class="form-label">${zh ? "资本化率" : "Cap Rate (%)"}</label><input class="form-input" id="editProjCapRate" type="number" step="0.01" value="${p.capRate || ""}"></div>
    </div>
    <div class="bento bento-2" style="gap:12px">
      <div class="form-group"><label class="form-label">DSCR</label><input class="form-input" id="editProjDSCR" type="number" step="0.01" value="${p.dscr || ""}"></div>
      <div class="form-group"><label class="form-label">IRR (%)</label><input class="form-input" id="editProjIRR" type="number" step="0.1" value="${p.irr || ""}"></div>
    </div>
    <div class="form-group"><label class="form-label">${zh ? "状态" : "Status"}</label>
      <select class="form-select" id="editProjStatus">
        <option value="draft" \${p.status==='draft'?'selected':''}>Draft</option>
        <option value="complete" \${p.status==='complete'||p.status==='active'||p.status==='completed'?'selected':''}>Complete</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost" onclick="closeModal()">${zh ? "取消" : "Cancel"}</button>
      <button class="btn btn-primary" onclick="saveProjectEdit('${pid}')">${zh ? "保存" : "Save Changes"}</button>
    </div>
  `,
  );
}

function saveProjectEdit(pid) {
  const projs = getProjects();
  const idx = projs.findIndex((x) => x.id === pid);
  if (idx < 0) return;
  const p = projs[idx];
  p.name = document.getElementById("editProjName").value.trim() || p.name;
  p.address = document.getElementById("editProjAddr").value.trim();
  p.offerPrice =
    parseFloat(document.getElementById("editProjPrice").value) || p.offerPrice;
  p.units = parseInt(document.getElementById("editProjUnits").value) || p.units;
  const noi = parseFloat(document.getElementById("editProjNOI").value);
  const capRate = parseFloat(document.getElementById("editProjCapRate").value);
  const dscr = parseFloat(document.getElementById("editProjDSCR").value);
  const irr = parseFloat(document.getElementById("editProjIRR").value);
  if (!isNaN(noi)) p.noi = noi;
  if (!isNaN(capRate)) p.capRate = capRate;
  if (!isNaN(dscr)) p.dscr = dscr;
  if (!isNaN(irr)) p.irr = irr;
  p.status = document.getElementById("editProjStatus").value;
  p.lastUpdated = new Date().toISOString().slice(0, 10);
  projs[idx] = p;
  saveProjects(projs);
  closeModal();
  renderProjects();
  buildProjectDropdowns();
  toast(currentLang === "zh" ? "项目已更新" : "Project updated", "success");
}

function openViewFilesModal(pid) {
  const p = getProjects().find((x) => x.id === pid);
  if (!p) return;
  const files = p.files || [];
  openModal(
    `Source Files — ${p.name}`,
    `
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Uploaded broker documents for this project.</p>
    ${
      files.length
        ? files
            .map(
              (f) => `<div class="file-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div class="file-name">${f.name}</div>
      <div class="file-status">${f.type} · ${f.date}</div>
      <span class="badge badge-t12" style="font-size:10px">${f.parsedAs || f.type}</span>
    </div>`,
            )
            .join("")
        : '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No files uploaded yet for this project.<br>Upload via the Pro Forma page.</div>'
    }
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <p style="font-size:11px;color:var(--muted)">Supported: T12 · Rent Roll · Debt Current · Debt Refinance · .xlsx .xls .csv .pdf</p>
    </div>
  `,
  );
}

function openNewProjectModal() {
  openModal(
    "New Project",
    `
    <div class="form-group"><label class="form-label">Project Name</label><input class="form-input" id="newProjName" placeholder="e.g. Maple Heights"></div>
    <div class="form-group"><label class="form-label">Property Address</label><input class="form-input" id="newProjAddr" placeholder="1234 Main St, City, State ZIP"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createProject()">Create Project</button>
    </div>
  `,
  );
}

function createProject() {
  const name = document.getElementById("newProjName").value.trim();
  const addr = document.getElementById("newProjAddr").value.trim();
  if (!name) {
    toast("Project name is required", "error");
    return;
  }
  const sess = getSession();
  const newP = {
    id: "p" + Date.now(),
    name,
    address: addr,
    offerPrice: 0,
    units: 0,
    status: "draft",
    ownerId: sess.id,
    published: false,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
  const projs = getProjects();
  projs.push(newP);
  saveProjects(projs);
  closeModal();
  renderProjects();
  buildProjectDropdowns();
  toast(currentLang === "zh" ? "项目已创建" : "Project created", "success");
}

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (!proj) return;
  if (!proj.files) proj.files = [];
  const zh = currentLang === "zh";
  // File types that are limited to 1 upload (replace on re-upload)
  const SINGLE_FILE_TYPES = ["T12", "Selling Model", "Rent Roll"];
  files.forEach((file) => {
    const fileType = guessFileType(file.name);
    const fileId = "f" + Date.now() + Math.random().toString(36).slice(2, 6);
    // If this type is single-file: remove any existing file of that category
    if (SINGLE_FILE_TYPES.includes(fileType)) {
      const sameGroup =
        fileType === "T12" || fileType === "Selling Model"
          ? ["T12", "Selling Model"]
          : ["Rent Roll"];
      proj.files = (proj.files || []).filter(
        (f) => !sameGroup.includes(f.parsedAs || f.type),
      );
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const idx = proj.files.findIndex((f) => f.id === fileId);
      if (idx > -1) {
        proj.files[idx].dataUrl = e.target.result;
        proj.files[idx].mimeType = file.type || "application/octet-stream";
        proj.files[idx].rawData = e.target.result;
        saveProjects(getProjects().map((p) => (p.id === proj.id ? proj : p)));
      }
    };
    reader.readAsDataURL(file);
    proj.files.push({
      id: fileId,
      name: file.name,
      type: fileType,
      parsedAs: fileType,
      size: file.size,
      date: new Date().toLocaleDateString(),
      status: "parsing",
    });
    renderUploadedFiles(proj);
    renderDocCategoryPanels(proj);
    setTimeout(() => {
      const p2 = getProjects().find((p) => p.id === currentProjectId);
      if (!p2) return;
      const f = (p2.files || []).find((f) => f.id === fileId);
      if (f) {
        f.status = "parsed";
      }
      saveProjects(getProjects().map((p) => (p.id === p2.id ? p2 : p)));
      renderUploadedFiles(p2);
      renderDocCategoryPanels(p2);
      // Re-render parsed tables for T12/RR
      if (fileType === "T12" || fileType === "Selling Model") {
        renderParsedT12Table(p2);
      }
      if (fileType === "Rent Roll") {
        renderParsedRRTable(p2);
      }
      const n = countFieldsForType(fileType);
      toast(
        zh
          ? file.name + " 解析完成 — 已自动填充" + n + "个字段"
          : file.name + " parsed — " + n + " fields auto-filled",
        "success",
      );
    }, 1400);
  });
  saveProjects(projs);
  renderProjects();
  var _fi = document.getElementById("fileInput");
  if (_fi) _fi.value = "";
}
// ─── PARSED FILE PREVIEW TABLES ─────────────────────────────────────────────
function renderParsedT12Table(proj) {
  _updateT12UI(proj);
  var el = document.getElementById("t12ParsedContent");
  if (!el) return;
  var zh = currentLang === "zh";
  var f =
    proj &&
    (proj.files || []).find(function (f) {
      return ["T12", "Selling Model"].includes(f.parsedAs || f.type);
    });
  if (!f) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "";

  // ── T12 data from uploaded Excel ──────────────────────
  // 24 month columns: Nov-23 through Oct-25
  var MTHS = [
    "Nov'23",
    "Dec'23",
    "Jan'24",
    "Feb'24",
    "Mar'24",
    "Apr'24",
    "May'24",
    "Jun'24",
    "Jul'24",
    "Aug'24",
    "Sep'24",
    "Oct'24",
    "Nov'24",
    "Dec'24",
    "Jan'25",
    "Feb'25",
    "Mar'25",
    "Apr'25",
    "May'25",
    "Jun'25",
    "Jul'25",
    "Aug'25",
    "Sep'25",
    "Oct'25",
  ];

  var T12 = [
    { s: "INCOME" },
    { s: "REVENUE" },
    { s: "RENTS" },
    {
      l: "Rent Income",
      v: [
        537471.3, -12228.5, 50194.83, 51857.75, 44591, 52882.13, 46652, 40199,
        28967.22, 38029.72, 40731.5, 44850.25, 42684.25, 54771.89, 48759.5,
        43993.25, 44925, 48759.25, 42258.39, 44938.5, 51607.03, 26576.94,
        41964.04, 45059.78,
      ],
      t: 1500496.02,
    },
    {
      l: "Other Rental Income",
      v: [
        500, 2054.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, -200, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 2554.75,
    },
    {
      l: "Application Fee Income",
      v: [
        0, 0, 70, 385, 175, 140, 0, 140, 105, 0, 0, 0, 35, 35, 0, 140, 175, 35,
        210, 245, 105, 0, 0, 0,
      ],
      t: 1995,
    },
    {
      l: "NSF Fees Collected",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, -35, 35, 0, 0, 35, 0, 0, 0,
        0,
      ],
      t: 40,
    },
    {
      l: "Late Fee",
      v: [
        48.02, -48.02, 245.79, 50, 659.15, 480.25, 448.3, 454, 489.3, 275, 380,
        72.5, 190, 242.5, 322.5, 195, 220, 290, 92.5, 392.5, 152.5, 0, 175.5,
        185,
      ],
      t: 6012.29,
    },
    {
      l: "Pet Fee",
      v: [
        585, -40, 40, 40, 40, 40, 40, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 825,
    },
    {
      l: "Furniture Charge",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100,
        100, 100, 100, 100, 0, 0, 0,
      ],
      t: 1300,
    },
    {
      l: "Laundry Income",
      v: [
        1147.5, 360.74, 156.96, 46.98, 186.57, 175.15, 217.25, 175.85, 0, 0,
        86.45, 192.38, 294.97, 202.85, 0, 288.46, 127.48, 0, 0, 152.61, 43.74,
        0, 107.81, 236.35,
      ],
      t: 4200.1,
    },
    {
      l: "Insurance Services",
      v: [
        181, -48, 76, 47.5, 66.5, 66.5, 57, 57, 38, 28.96, 19, 19, 9.5, 9.5,
        9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 0, 316.45, 251.24,
      ],
      t: 1261.65,
    },
    {
      l: "Utility Reimbursement Fee",
      v: [
        352.33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 352.33,
    },
    {
      l: "Concessions",
      v: [
        -7277.11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: -7277.11,
    },
    {
      l: "TOTAL RENTS",
      v: [
        533008.04, -9949.03, 50783.58, 52427.23, 45718.22, 53784.03, 47414.55,
        41065.85, 29739.52, 38433.68, 41316.95, 45239.13, 43513.72, 55161.74,
        49191.5, 44691.21, 45591.98, 49193.75, 42670.39, 45873.11, 52017.77,
        26576.94, 42563.8, 45732.37,
      ],
      t: 1511760.03,
      b: true,
    },
    { s: "MANAGEMENT INCOME" },
    {
      l: "Maintenance Labor Fee Income and Materials Reimbursement",
      v: [
        100, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 0,
    },
    {
      l: "Prepaid Rent",
      v: [
        14622.75, -14622.75, -5912.5, 3363.5, -657, -515, -70, -3434.5, -3995,
        1630, 875, 450, -1325, 1905, -1905, -820.25, 929.75, 1029, 50, -1768.5,
        1007.25, 369.75, 392.25, 0,
      ],
      t: -8401.25,
    },
    {
      l: "TOTAL MANAGEMENT INCOME",
      v: [
        14722.75, -14722.75, -5912.5, 3363.5, -657, -515, -70, -3434.5, -3995,
        1630, 875, 450, -1325, 1905, -1905, -820.25, 929.75, 1029, 50, -1768.5,
        1007.25, 369.75, 392.25, 0,
      ],
      t: -8401.25,
      b: true,
    },
    { s: "FEES" },
    {
      l: "Miscellaneous Income",
      v: [
        0.23, -26468.13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: -26467.9,
    },
    {
      l: "TOTAL FEES",
      v: [
        0.23, -26468.13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: -26467.9,
      b: true,
    },
    {
      l: "TOTAL REVENUE",
      v: [
        547731.02, -51139.91, 44871.08, 55790.73, 45061.22, 53269.03, 47344.55,
        37631.35, 25744.52, 40063.68, 42191.95, 45689.13, 42188.72, 57066.74,
        47286.5, 43870.96, 46521.73, 50222.75, 42720.39, 44104.61, 53025.02,
        26946.69, 42956.05, 45732.37,
      ],
      t: 1476890.88,
      b: true,
      g: true,
    },
    { s: "EXPENSES" },
    { s: "CLEANING AND JANITORIAL EXPENSE" },
    {
      l: "Cleaning and Janitorial Expense",
      v: [
        1075, 0, 200, 0, 0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        2862, 0, 0,
      ],
      t: 4337,
    },
    {
      l: "Maintenance Labor Expense",
      v: [
        185, -150, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, -55, 0, 55, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 90,
    },
    {
      l: "Garbage and Recycling",
      v: [
        4433.98, 0, 948.65, 0, -1013.76, 0, 2111.69, 2125.68, 527.94, 489.5,
        1753.94, 97.4, 621.66, 0, 1243.32, 621.66, 621.66, 621.66, 621.66,
        621.66, 621.66, 621.66, 621.66, 1027.08,
      ],
      t: 19340.36,
    },
    {
      l: "Pest control",
      v: [
        2359.8, 0, 988.2, 0, 0, 378, 189, 567, 0, 0, 0, 0, 0, 0, 0, 3213, 0, 0,
        0, 0, 0, 0, 1323, 189,
      ],
      t: 9207,
    },
    {
      l: "TOTAL CLEANING AND JANITORIAL EXPENSE",
      v: [
        8053.78, -150, 2136.85, 0, -1013.76, 378, 2300.69, 2947.68, 527.94,
        489.5, 1753.94, 97.4, 566.66, 0, 1298.32, 3834.66, 621.66, 621.66,
        621.66, 621.66, 621.66, 3483.66, 1944.66, 1216.08,
      ],
      t: 32974.36,
      b: true,
    },
    { s: "INSURANCE" },
    {
      l: "Property Insurance",
      v: [
        19020, -1585, 0, 0, 0, 0, 5183.82, 1587, 0, 0, 0, 0, 0, 6911.76, 0, 0,
        0, 0, 0, 36362.63, 0, 0, 0, 0,
      ],
      t: 67480.21,
    },
    {
      l: "Insurance - Other",
      v: [
        0, 0, 0, 0, 6911.76, 0, 0, 0, 0, 0, 0, 0, 0, -6911.76, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "TOTAL INSURANCE",
      v: [
        19020, -1585, 0, 0, 6911.76, 0, 5183.82, 1587, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 36362.63, 0, 0, 0, 0,
      ],
      t: 67480.21,
      b: true,
    },
    { s: "LEGAL AND OTHER PROFESSIONAL FEES" },
    {
      l: "Accounting",
      v: [
        1605, 0, 2425.41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2658, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 471, 0,
      ],
      t: 7159.41,
    },
    {
      l: "Appfolio",
      v: [
        1080, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 1080,
    },
    {
      l: "TOTAL LEGAL AND OTHER PROFESSIONAL FEES",
      v: [
        2685, 0, 2425.41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2658, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 471, 0,
      ],
      t: 8239.41,
      b: true,
    },
    { s: "MANAGEMENT FEES EXPENSE" },
    {
      l: "Management Fee Expense",
      v: [
        22157.13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6698.71, 0, 0, 0, 0, 0,
        0, 0, 1369.1, 0,
      ],
      t: 30224.94,
    },
    {
      l: "Commissions/Placement Fee Expense",
      v: [
        1750, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 1750,
    },
    {
      l: "TOTAL MANAGEMENT FEES EXPENSE",
      v: [
        23907.13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6698.71, 0, 0, 0, 0, 0,
        0, 0, 1369.1, 0,
      ],
      t: 31974.94,
      b: true,
    },
    { s: "MORTGAGE" },
    {
      l: "Mortgage Interest",
      v: [
        0, 132145.09, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 129666.79, 0, 18070.49,
        18070.49, 18070.49, 18070.49, 18070.49, 18070.49, 18070.49, 18070.49,
        18070.49,
      ],
      t: 424446.29,
    },
    {
      l: "Mortgage - Other",
      v: [
        0, 0, 0, 0, 0, 18070.49, 18070.49, 18070.49, 0, 0, 0, 0, 0, -54211.47,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Other interest",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 107926.89, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 107926.89,
    },
    {
      l: "TOTAL MORTGAGE",
      v: [
        0, 132145.09, 0, 0, 0, 18070.49, 18070.49, 18070.49, 0, 0, 0, 0, 0,
        183382.21, 0, 18070.49, 18070.49, 18070.49, 18070.49, 18070.49,
        18070.49, 18070.49, 18070.49, 18070.49,
      ],
      t: 532373.18,
      b: true,
    },
    { s: "REPAIRS AND MAINTENANCE" },
    {
      l: "Painting",
      v: [
        -150, 150, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 0,
    },
    {
      l: "Plumbing",
      v: [
        550, 499.59, 0, 0, 0, 500, 0, 0, 0, 0, 0, 260, 0, 3000, 0, 0, 945, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 5754.59,
    },
    {
      l: "Flooring",
      v: [
        -670, 670, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 0,
    },
    {
      l: "HVAC (Heat Ventilation Air)",
      v: [
        21403.22, -17317, 0, 575, 0, 0, 0, 764.6, 0, 0, 764.6, 0, 3403.75, 0, 0,
        175, 2775.22, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 12544.39,
    },
    {
      l: "Sub Contractor",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23900, 0, 5800, 11600, 5800, 0,
        0, 0, 0, 0, 0,
      ],
      t: 47100,
    },
    {
      l: "Key/Lock Replacement",
      v: [
        -31, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 0,
    },
    {
      l: "Security Service",
      v: [
        2851.6, 2425, 386.7, 0, 0, 501.7, 0, 2926.7, 0, 0, 1261.7, 0, 602.7,
        290, 0, 0, 0, 0, 0, 0, 0, 0, 875, 492.37,
      ],
      t: 12613.47,
    },
    {
      l: "Roof Repair",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1890, 1890, 1890, 0, 0, 0, 0, 0, 0, 2500,
        0, 0, 0, 0,
      ],
      t: 8170,
    },
    {
      l: "Elevator Contract",
      v: [
        7919.57, 0, 956.29, 0, 0, 0, 0, 1912.58, 102.6, 956.29, 956.29, 0,
        1032.78, 3383.2, 0, 386.7, 1032.78, 0, 135, 1419.48, 0, 230, 386.7, 0,
      ],
      t: 20810.26,
    },
    {
      l: "Elevator Repair Expense",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1032.78,
        0, 0,
      ],
      t: 1032.78,
    },
    {
      l: "Appliance Repair",
      v: [
        0, 611.74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 611.74,
    },
    {
      l: "Repairs - Other",
      v: [
        -1353.75, 1353.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 577.5, 577.5, 2290.4, 0,
        0, 0, 0, 0, 0, 0, 0, 412.64, 0,
      ],
      t: 3858.04,
    },
    {
      l: "Supplies",
      v: [
        1239.01, 130.41, 0, 164.91, 26.97, 230, 0, 0, 0, 0, 29.65, 0, 0, 787.3,
        0, 0, 230, 0, 0, 0, 500, 0, 0, 0,
      ],
      t: 3338.25,
    },
    {
      l: "TOTAL REPAIRS AND MAINTENANCE",
      v: [
        31758.65, -11445.51, 1342.99, 739.91, 26.97, 1231.7, 0, 5603.88, 102.6,
        956.29, 4902.24, 2727.5, 7506.73, 33650.9, 0, 6361.7, 16583, 5800, 135,
        3919.48, 500, 1262.78, 1674.34, 492.37,
      ],
      t: 115833.52,
      b: true,
    },
    { s: "TAXES" },
    {
      l: "Property Tax",
      v: [
        84946.44, -84946.44, 0, 47156.06, 0, 0, 0, 0, 10000, 0, 0, 0, 0, 82.18,
        0, 0, 11000, 0, 6000, 6000, 0, 1150, 1000, 0,
      ],
      t: 82388.24,
    },
    {
      l: "Taxes - Other",
      v: [
        1480, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 1480,
    },
    {
      l: "Licenses and Registration Fees",
      v: [
        303, 1701, 0, 0, 0, 0, 0, 0, 0, 0, 303, 1701, 0, 5617, 0, 0, 0, 309, 0,
        0, 0, 0, 618, 0,
      ],
      t: 10552,
    },
    {
      l: "TOTAL TAXES",
      v: [
        86729.44, -83245.44, 0, 47156.06, 0, 0, 0, 0, 10000, 0, 303, 1701, 0,
        5699.18, 0, 0, 11000, 309, 6000, 6000, 0, 1150, 1618, 0,
      ],
      t: 94420.24,
      b: true,
    },
    { s: "UTILITIES" },
    {
      l: "Electricity",
      v: [
        35902.96, 6597.35, 4226.99, 4989.7, 0, 0, 0, 319.56, 0, 0, 9074.82,
        106.92, 3117.83, 17331.96, 678.81, 13750.02, 2335.48, 10094.04, 2853.76,
        7011.94, 3104.7, 3923.45, 3638.58, 2569.11,
      ],
      t: 131627.98,
    },
    {
      l: "Gas",
      v: [
        4566.48, 399.63, 504.61, 0, 0, 611.12, 0, 1310.73, 571.78, 245.81,
        2190.66, 1345.89, 1532.52, -1144.9, 0, 0, 584.64, 583.88, 1138.62, 0, 0,
        2022.03, 600.82, 0,
      ],
      t: 17064.32,
    },
    {
      l: "Water",
      v: [
        1633.98, 589.28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 328.72, 109.48,
        0, 0, 0, 0, 0, 4788.08, 255.15,
      ],
      t: 7704.69,
    },
    {
      l: "Telephone",
      v: [
        5053.7, 791.59, 159.78, 159.78, 159.78, 159.78, 159.78, 988.34, 1538.98,
        500.29, 482.66, 481.61, 481.58, 480.99, 483.36, 562.92, 562.74, 602.97,
        602.17, 602.11, 602.2, 602.6, 602.28, 602.42,
      ],
      t: 17424.41,
    },
    {
      l: "TOTAL UTILITIES",
      v: [
        47157.12, 8377.85, 4891.38, 5149.48, 159.78, 770.9, 159.78, 2618.63,
        2110.76, 746.1, 11748.14, 1934.42, 5131.93, 16668.05, 1162.17, 14641.66,
        3592.34, 11280.89, 4594.55, 7614.05, 3706.9, 6548.08, 9629.76, 3426.68,
      ],
      t: 173821.4,
      b: true,
    },
    { s: "ADMINISTRATIVE EXPENSES" },
    {
      l: "Office Expense",
      v: [
        0, 68.95, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 68.95,
    },
    {
      l: "Salary Expense",
      v: [
        42300, 0, 0, 3800, 1900, 0, 8600, 0, 0, 11600, 0, 0, -11600, -14300,
        11600, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 53900,
    },
    {
      l: "Bank Fees",
      v: [
        289.99, 1550.05, 71, 53, 41, 41, 0, 16, 0, 76, 10, 25, 10, 16, 16, 10,
        85.79, 52, 51, 41, 31, 16, 16, 2.42,
      ],
      t: 2520.25,
    },
    {
      l: "TOTAL ADMINISTRATIVE EXPENSES",
      v: [
        42589.99, 1619, 71, 3853, 1941, 41, 8600, 16, 0, 11676, 10, 25, -11590,
        -14284, 11616, 10, 85.79, 52, 51, 41, 31, 16, 16, 2.42,
      ],
      t: 56489.2,
      b: true,
    },
    {
      l: "Marketing Expense",
      v: [
        4344.81, -1215, 0, 0, 0, 0, 7835.82, 0, 60.82, 0, 45, 0, 0, 4000, 0, 0,
        0, 0, 0, 4548.39, 0, 0, 0, 0,
      ],
      t: 19619.84,
    },
    {
      l: "Advertising",
      v: [
        750, 1650, 0, 0, 7775, 500, 0, 0, -250, 0, 2220.87, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: 12645.87,
    },
    {
      l: "Meetings and Events",
      v: [
        1220.73, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 1220.73,
    },
    {
      l: "TOTAL MARKETING EXPENSES",
      v: [
        6315.54, 435, 0, 0, 7775, 500, 7835.82, 0, -189.18, 0, 2265.87, 0, 0,
        4000, 0, 0, 0, 0, 0, 4548.39, 0, 0, 0, 0,
      ],
      t: 33486.44,
      b: true,
    },
    { s: "BUILDING EXPENSES" },
    {
      l: "Inspection Costs",
      v: [
        895, 0, 0, 0, 0, 0, 0, 0, 0, 0, 895, 0, 0, 0, 1600, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 3390,
    },
    {
      l: "Depreciation expense",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55642, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 55642,
    },
    {
      l: "Amortization Expense",
      v: [
        0, 30857, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30857, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 61714,
    },
    {
      l: "Refinance Fee Expense",
      v: [
        0, -642.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: -642.25,
    },
    {
      l: "Miscellaneous Expense",
      v: [
        0, 0.07, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 0.07,
    },
    {
      l: "TOTAL BUILDING EXPENSES",
      v: [
        895, 30214.82, 0, 0, 0, 0, 0, 0, 0, 0, 895, 0, 0, 86499, 1600, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: 120103.82,
      b: true,
    },
    {
      l: "Depreciation Expense (Unused)",
      v: [
        0, 69335, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: 69335,
    },
    { s: "PREFERRED RETURNS" },
    {
      l: "Guaranteed Payments",
      v: [
        0, 84077.22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 84077.22,
    },
    {
      l: "Pref - Int - Ho Ruiming",
      v: [
        0, 4643.46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 4643.46,
    },
    {
      l: "TOTAL PREFERRED PAYMENTS",
      v: [
        0, 88720.68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 88720.68,
      b: true,
    },
    {
      l: "Ask My Accountant",
      v: [
        -17213.74, 17213.74, 0, 0, 0, 0, 0, 0, 631.47, 0, 5617, 0, -3880,
        -2368.47, 0, 0, 0, 0, 0, 0, 0, 3546.66, 0, 0,
      ],
      t: 3546.66,
    },
    {
      l: "TOTAL EXPENSES",
      v: [
        251897.91, 251635.23, 10867.63, 56898.45, 15800.75, 20992.09, 42150.6,
        30843.68, 13183.59, 13867.89, 27495.19, 6485.32, 393.32, 313246.87,
        22375.2, 42918.51, 49953.28, 36134.04, 29472.7, 77177.7, 22930.05,
        34077.67, 34793.35, 23208.04,
      ],
      t: 1428799.06,
      b: true,
      g: true,
    },
    {
      l: "NET INCOME",
      v: [
        295833.11, -302775.14, 34003.45, -1107.72, 29260.47, 32276.94, 5193.95,
        6787.67, 12560.93, 26195.79, 14696.76, 39203.81, 41795.4, -256180.13,
        24911.3, 952.45, -3431.55, 14088.71, 13247.69, -33073.09, 30094.97,
        -7130.98, 8162.7, 22524.33,
      ],
      t: 48091.82,
      b: true,
      g: true,
    },
    { s: "ADJUSTMENTS" },
    {
      l: "Secondary Checking",
      v: [
        5586.51, -7112.77, 76.86, -30.98, 229.43, -5334.15, 3646.91, -3484.46,
        0, 20.09, 1739.42, -2119.38, 5600.4, -4296.35, 3130.21, 2665.54,
        -2364.54, -1562.76, -697.81, 2187.55, -8.84, 795, -1066.06, -1472.57,
      ],
      t: -3872.75,
    },
    {
      l: "Escrow - Prepaid Property Taxes",
      v: [
        -63000, 63000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Escrow - Capex Reserves",
      v: [
        0, -11000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: -11000,
    },
    {
      l: "Reserves",
      v: [
        -11000, 11000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Investment in GLC Penn",
      v: [
        -1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      t: 0,
    },
    {
      l: "TOTAL CASH",
      v: [
        -69413.49, 56887.23, 76.86, -30.98, 229.43, -5334.15, 3646.91, -3484.46,
        0, 20.09, 1739.42, -2119.38, 5600.4, -4296.35, 3130.21, 2665.54,
        -2364.54, -1562.76, -697.81, 2187.55, -8.84, 795, -1066.06, -1472.57,
      ],
      t: -14872.75,
      b: true,
    },
    {
      l: "Buildings",
      v: [
        -2476816, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11000, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: -2465816,
    },
    {
      l: "Building Improvements",
      v: [
        -938228.43, -283771.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -3403.75, 0, -11208,
        0, 0, -4500, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: -1241111.28,
    },
    {
      l: "Building Depreciation",
      v: [
        1090130, 69335, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55642, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 1215107,
    },
    {
      l: "5 Year Property",
      v: [
        -11208, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11208, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Deferred Loan Costs",
      v: [
        -154284.51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: -154284.51,
    },
    {
      l: "Accumulated Amortization",
      v: [
        64285, 30857, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30857, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 125999,
    },
    {
      l: "Intercompany Loan - Yu Dai",
      v: [
        -2412, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
      t: -2412,
    },
    {
      l: "Intercompany Loan - GL Capital",
      v: [
        -105568.26, -436667.52, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 582235.78, 0,
        -3200, 0, 0, 0, 36362.63, 0, 0, 0, 0,
      ],
      t: 73162.63,
    },
    {
      l: "Intercompany Loan - Global Leaders Capital",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 47238.24, 0, 0, 0, 0, 0,
        14772.73, 0, 0, 0, 0,
      ],
      t: 62010.97,
    },
    {
      l: "Intercompany Loan - GLC Penn",
      v: [
        2422.94, -2422.94, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Owner Held Security Deposits",
      v: [
        -2065, 50715, 0, 0, 0, 0, 1600, 1850, 8125, -4880, -7252.5, -1930,
        -1150, 33516.5, -800, 0, 0, -290, 925, 4650, 3550, 19350, -6436.36, 0,
      ],
      t: 99477.64,
    },
    {
      l: "Clearing Account",
      v: [
        3408.61, -475, 0, 0, 0, 0, 0, 0, 0, 5995, -5995, 0, 1950, -4883.61, 0,
        0, 0, 0, 0, 0, 0, 1375, 0, 0,
      ],
      t: 1375,
    },
    {
      l: "Prepaid Rent",
      v: [
        -23417.82, -187, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23604.82, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Bank of America Credit Card",
      v: [
        -6300, -5100, -1000, 0, -400, 0, -3803.34, 0, 0, -4.09, 0, 0, -179.87,
        16787.3, 0, 0, 0, -1519.88, 0, 0, 0, 0, 0, -147.78,
      ],
      t: -1667.66,
    },
    {
      l: "Mortgage Payable",
      v: [
        3847495.35, 111978.81, -18070.49, -18070.49, -18070.49, -36353.77,
        -18070.49, -18070.49, 212.79, -18070.49, -18070.49, -18070.49,
        -18070.49, 111596.3, -18070.49, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 3854224.58,
    },
    {
      l: "TOTAL ACCOUNTS PAYABLE",
      v: [
        1218028.39, -408850.52, -18993.63, -18101.47, -18241.06, -41687.92,
        -16626.92, -19704.95, 8337.79, -16939.49, -29578.57, -25523.62,
        -11849.96, 903297.98, -15740.28, -534.46, -6864.54, -3372.64, 227.19,
        57972.91, 3541.16, 21520, -7502.42, -1620.35,
      ],
      t: 1551192.62,
      b: true,
    },
    {
      l: "Member Contribution - Ruiming Ho",
      v: [
        163605.35, -30000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -3464.73, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      t: 130140.62,
    },
    {
      l: "Member Contribution - Richard Kind",
      v: [
        100000, -20000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -454.55, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 79545.45,
    },
    {
      l: "Member Contribution - GL Capital",
      v: [
        149600, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 51583.24, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: 191183.24,
    },
    {
      l: "Member Contribution - Yu Dai",
      v: [
        10000, 66000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6795.45, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 82795.45,
    },
    {
      l: "Member Contribution - Wenhao Kelvin Fu",
      v: [
        14000, -2500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -363.64, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 11136.36,
    },
    {
      l: "Member Contribution - Zijian Zhang",
      v: [
        87000, -87000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Member Contribution - Howell and Abbe Bichefsky",
      v: [
        100000, -20000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -454.55, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 79545.45,
    },
    {
      l: "Member Contribution - Josh Hinton",
      v: [
        15000, -3000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -68.18, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 11931.82,
    },
    {
      l: "Member Contribution Michael Kesselman",
      v: [
        70000, -14000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -318.18, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 55681.82,
    },
    {
      l: "Member Contribution - Amber Yue Dai",
      v: [
        10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5909.09, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ],
      t: 15909.09,
    },
    {
      l: "Member Contribution - Steven Lichter",
      v: [
        166666.67, -30000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4090.91, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      t: 132575.76,
    },
    {
      l: "Member Contribution - Jeffrey Lichter",
      v: [
        166666.67, -30000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4090.91, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      t: 132575.76,
    },
    {
      l: "Member Contribution - Jay Weinstein",
      v: [
        166666.66, -30000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4090.91, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      t: 132575.75,
    },
    {
      l: "Member Contribution - Kacy young and Lin Chen",
      v: [
        50000, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -227.27, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 39772.73,
    },
    {
      l: "Member Contribution - Cimone and Alex Isaard",
      v: [
        50000, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -20334.59, 0, 0, 0, 0,
        0, -14772.73, 0, 0, 0, 0,
      ],
      t: 4892.68,
    },
    {
      l: "Member Contribution - Money Monkey Investments",
      v: [
        378211.98, -24000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 43515.29, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      t: 397727.27,
    },
    {
      l: "Member Contribution - Jieren Wang (Jiang Hong)",
      v: [
        50000, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -227.27, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 39772.73,
    },
    {
      l: "Member Contribution - Long Qian",
      v: [
        50000, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -227.27, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 39772.73,
    },
    {
      l: "Member Contribution - Dongqing Zhang",
      v: [
        30000, -14000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -16000, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Member Contribution - Qing House LLC",
      v: [
        0, 80000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -16363.63, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 63636.37,
    },
    {
      l: "Member Contribution - Ran Tian",
      v: [
        50000, -10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -227.27, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ],
      t: 39772.73,
    },
    {
      l: "Owner Distribution",
      v: [
        -457296.46, 457296.46, -2167.57, -1354.73, -12457.66, -15772.82,
        -3914.25, -17633.28, -16691.76, -14664.36, -1522.87, -7340.47, 0,
        95945.18, -11625.79, -15970.58, 0, -6661.54, -15206.51, -2970.43,
        -9123.17, 0, -15494.15, -6863.38,
      ],
      t: -81490.14,
    },
    {
      l: "Member Distribution - Ho Ruiming",
      v: [
        -37817.41, 30000, 0, 0, 0, 0, 0, -4845.23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: -12662.64,
    },
    {
      l: "Member Distribution - Richard Ke",
      v: [
        -100000, 100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "Retained Earnings",
      v: [
        89746.11, -182107.38, 34003.45, -1107.72, 29260.47, 32276.94, 5193.95,
        6787.67, 14617.55, 26195.79, 14696.76, 39203.81, 41795.4, -357547.66,
        24911.3, 952.45, -3431.55, 14088.71, 13247.69, -33073.09, 30094.97,
        -7130.98, 8162.7, 22524.33,
      ],
      t: -136638.33,
    },
    {
      l: "Prior Years Retained Earnings",
      v: [
        -997411.79, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -605164.23, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: -1602576.02,
    },
    {
      l: "TOTAL ADJUSTMENTS",
      v: [
        1592666.17, -222161.44, 12842.25, -20563.92, -1438.25, -25183.8,
        -15347.22, -35395.79, 6263.58, -5408.06, -16404.68, 6339.72, 29945.44,
        73330.48, -2454.77, -15552.59, -10296.09, 4054.53, -1731.63, 7156.66,
        24512.96, 14389.02, -14833.87, 14040.6,
      ],
      t: 1398769.3,
      b: true,
    },
    {
      l: "CASH FLOW",
      v: [
        1888499.28, -524936.58, 46845.7, -21671.64, 27822.22, 7093.14,
        -10153.27, -28608.12, 18824.51, 20787.73, -1707.92, 45543.53, 71740.84,
        -182849.65, 22456.53, -14600.14, -13727.64, 18143.24, 11516.06,
        -25916.43, 54607.93, 7258.04, -6671.17, 36564.93,
      ],
      t: 1446861.12,
      b: true,
      g: true,
    },
    { s: "OPERATING CASH" },
    {
      l: "  Beginning Balance",
      v: [
        1302.5, -38019.04, 10553.23, 7155.85, 19481.37, 20321.59, 4861.32,
        -17866.69, -38595.36, -38656.18, -39612.47, -41833.34, -43723.34,
        -43723.34, 230, 230, 230, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 1302.5,
    },
    {
      l: "  Ending Balance",
      v: [
        -38019.04, 10553.23, 7155.85, 19481.37, 20321.59, 4861.32, -17866.69,
        -38595.36, -38656.18, -39612.47, -41833.34, -43723.34, -43723.34, 230,
        230, 230, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "  Difference",
      v: [
        -39321.54, 48572.27, -3397.38, 12325.52, 840.22, -15460.27, -22728.01,
        -20728.67, -60.82, -956.29, -2220.87, -1890, 0, 43953.34, 0, 0, -230, 0,
        0, 0, 0, 0, 0, 0,
      ],
      t: -1302.5,
    },
    { s: "SECONDARY CHECKING" },
    {
      l: "  Beginning Balance",
      v: [
        0, -5586.51, 1526.26, 1449.4, 1480.38, 1250.95, 6585.1, 2938.19,
        6422.65, 6422.65, 6402.56, 4663.14, 6782.52, 1182.12, 5478.47, 2348.26,
        -317.28, 2047.26, 3610.02, 4307.83, 2120.28, 2129.12, 1334.12, 2400.18,
      ],
      t: 0,
    },
    {
      l: "  Ending Balance",
      v: [
        -5586.51, 1526.26, 1449.4, 1480.38, 1250.95, 6585.1, 2938.19, 6422.65,
        6422.65, 6402.56, 4663.14, 6782.52, 1182.12, 5478.47, 2348.26, -317.28,
        2047.26, 3610.02, 4307.83, 2120.28, 2129.12, 1334.12, 2400.18, 3872.75,
      ],
      t: 3872.75,
    },
    {
      l: "  Difference",
      v: [
        -5586.51, 7112.77, -76.86, 30.98, -229.43, 5334.15, -3646.91, 3484.46,
        0, -20.09, -1739.42, 2119.38, -5600.4, 4296.35, -3130.21, -2665.54,
        2364.54, 1562.76, 697.81, -2187.55, 8.84, -795, 1066.06, 1472.57,
      ],
      t: 3872.75,
    },
    { s: "OTHER CHECKING" },
    {
      l: "  Beginning Balance",
      v: [
        0, 1020, 1045.5, 17285.13, 14962.14, 16283.67, 7935.14, 15315.93,
        4913.41, 11237.81, 8586.04, -5597.77, 2631.95, 24777.39, 31592.65,
        30247.38, 14694.79, 6847.7, 8683.23, 6951.6, 14108.26, 39571.22,
        22860.24, 8026.37,
      ],
      t: 0,
    },
    {
      l: "  Ending Balance",
      v: [
        1020, 1045.5, 17285.13, 14962.14, 16283.67, 7935.14, 15315.93, 4913.41,
        11237.81, 8586.04, -5597.77, 2631.95, 24777.39, 31592.65, 30247.38,
        14694.79, 6847.7, 8683.23, 6951.6, 14108.26, 39571.22, 22860.24,
        8026.37, 22066.97,
      ],
      t: 22066.97,
    },
    {
      l: "  Difference",
      v: [
        1020, 25.5, 16239.63, -2322.99, 1321.53, -8348.53, 7380.79, -10402.52,
        6324.4, -2651.77, -14183.81, 8229.72, 22145.44, 6815.26, -1345.27,
        -15552.59, -7847.09, 1835.53, -1731.63, 7156.66, 25462.96, -16710.98,
        -14833.87, 14040.6,
      ],
      t: 22066.97,
    },
    { s: "CASH — SECURITY DEPOSIT" },
    {
      l: "  Beginning Balance",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "  Ending Balance",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
    {
      l: "  Difference",
      v: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      t: 0,
    },
  ];

  // Calculate Y1 (months 1-12) and Y2 (months 13-24) subtotals
  T12.forEach(function (r) {
    if (!r.v) return;
    r.y1 = r.v.slice(0, 12).reduce(function (a, b) {
      return a + b;
    }, 0);
    r.y2 = r.v.slice(12, 24).reduce(function (a, b) {
      return a + b;
    }, 0);
  });

  function fv(v) {
    if (v === 0) return '<span style="color:#ccc">—</span>';
    var neg = v < 0;
    var abs = Math.abs(v);
    var s =
      abs >= 1000
        ? "$" + Math.round(abs).toLocaleString()
        : "$" + abs.toFixed(0);
    return neg ? '<span style="color:#c0392b">(' + s + ")</span>" : s;
  }

  // Build compact view: show Y1 subtotal / Y2 subtotal / Total
  // Plus option to expand to full 24-month view
  var compact = true; // default compact
  var kpiHtml =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:10px 10px 0 0;overflow:hidden;border:1px solid var(--border)">' +
    [
      {
        l: "Y1 Revenue",
        sub: "NOV'23–OCT'24",
        v: "$934,248",
        c: "var(--header)",
      },
      {
        l: "Y1 Expenses",
        sub: "NOV'23–OCT'24",
        v: "$742,118",
        c: "var(--accent)",
      },
      {
        l: "Y1 Net Income",
        sub: "NOV'23–OCT'24",
        v: "$192,130",
        c: "var(--green)",
      },
      {
        l: "Period",
        sub: "Book = Cash",
        v: "Nov'23–Oct'25",
        c: "var(--muted)",
      },
      {
        l: "Y2 Revenue",
        sub: "NOV'24–OCT'25",
        v: "$542,643",
        c: "var(--header)",
      },
      {
        l: "Y2 Expenses",
        sub: "NOV'24–OCT'25",
        v: "$686,681",
        c: "var(--accent)",
      },
      {
        l: "Y2 Net Income",
        sub: "NOV'24–OCT'25",
        v: "$(144,038)",
        c: "#c0392b",
      },
      {
        l: "24-Mo Net Income",
        sub: "Total Period",
        v: "$48,092",
        c: "var(--blue)",
      },
    ]
      .map(function (k, i, a) {
        var col =
          i % 4 === 3
            ? "border-right:none"
            : "border-right:1px solid var(--border)";
        var bot = i < 4 ? "border-bottom:1px solid var(--border)" : "";
        return (
          '<div style="padding:10px 14px;' +
          col +
          ";" +
          bot +
          '">' +
          '<div style="font-size:15px;font-weight:800;color:' +
          k.c +
          '">' +
          k.v +
          "</div>" +
          '<div style="font-size:11px;font-weight:600;color:var(--header);margin-top:1px">' +
          k.l +
          "</div>" +
          '<div style="font-size:10px;color:var(--muted)">' +
          k.sub +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>";

  var viewToggle =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px">' +
    '<span style="font-size:12px;font-weight:700;color:var(--header)">12 Months Cash Flow Statement &nbsp;·&nbsp; <span style="color:var(--muted);font-weight:400">' +
    ((
      getProjects().find(function (p) {
        return p.id === currentProjectId;
      }) || {}
    ).name || "") +
    " · Cash Basis</span></span>" +
    '<div style="display:flex;gap:6px">' +
    '<button onclick="t12SetView(\'compact\')" id="t12BtnCompact" class="btn btn-xs" style="font-size:10px;padding:3px 10px">Y1 / Y2 / Total</button>' +
    '<button onclick="t12SetView(\'full\')" id="t12BtnFull" class="btn btn-xs btn-ghost" style="font-size:10px;padding:3px 10px">All 24 Months</button>' +
    "</div>" +
    "</div>";

  // Table header
  function buildT12Header(full) {
    if (full) {
      return (
        '<tr style="background:rgba(139,115,85,0.05)">' +
        '<th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--header);min-width:220px;position:sticky;left:0;background:rgba(248,246,242,0.97);z-index:2;border-bottom:1px solid var(--border)">ACCOUNT</th>' +
        MTHS.map(function (m) {
          return (
            '<th style="padding:7px 6px;text-align:right;font-size:9px;font-weight:600;color:var(--muted);white-space:nowrap;min-width:68px;border-bottom:1px solid var(--border)">' +
            m +
            "</th>"
          );
        }).join("") +
        '<th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:800;color:var(--header);white-space:nowrap;border-left:2px solid var(--border);border-bottom:1px solid var(--border);background:rgba(139,115,85,0.04)">Total</th>' +
        "</tr>"
      );
    } else {
      return (
        '<tr style="background:rgba(139,115,85,0.05)">' +
        '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--header);min-width:260px;border-bottom:1px solid var(--border)">ACCOUNT</th>' +
        "<th style=\"padding:8px 10px;text-align:right;font-size:11px;font-weight:700;color:var(--accent);white-space:nowrap;border-bottom:1px solid var(--border)\">NOV'23–OCT'24 (Y1)</th>" +
        "<th style=\"padding:8px 10px;text-align:right;font-size:11px;font-weight:700;color:var(--accent);white-space:nowrap;border-bottom:1px solid var(--border)\">NOV'24–OCT'25 (Y2)</th>" +
        '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:800;color:var(--header);white-space:nowrap;border-left:1px solid var(--border);border-bottom:1px solid var(--border);background:rgba(139,115,85,0.04)">Total</th>' +
        "</tr>"
      );
    }
  }

  function buildT12Body(full) {
    return T12.map(function (r, ri) {
      if (r.s) {
        return (
          '<tr style="background:rgba(139,115,85,0.04)"><td colspan="' +
          (full ? 26 : 4) +
          '" style="padding:6px 10px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)">' +
          r.s +
          "</td></tr>"
        );
      }
      var bg = r.g
        ? "rgba(74,124,89,0.07)"
        : r.b
          ? "rgba(0,0,0,0.025)"
          : ri % 2 === 0
            ? ""
            : "rgba(0,0,0,0.012)";
      var fw = r.b || r.g ? "700" : "400";
      var tc = r.g ? "var(--green)" : r.b ? "var(--header)" : "var(--muted)";
      var bt = r.b || r.g ? "border-top:1px solid var(--border);" : "";
      if (full) {
        var cells = (r.v || [])
          .map(function (v, ci) {
            return (
              '<td style="padding:5px 6px;text-align:right;font-size:9.5px;font-weight:' +
              fw +
              ";" +
              bt +
              '">' +
              fv(v) +
              "</td>"
            );
          })
          .join("");
        return (
          '<tr style="background:' +
          bg +
          '">' +
          '<td style="padding:6px 10px;font-size:10px;font-weight:' +
          fw +
          ";color:" +
          tc +
          ";position:sticky;left:0;background:inherit;" +
          bt +
          '">' +
          r.l +
          "</td>" +
          cells +
          '<td style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;border-left:2px solid var(--border);background:rgba(139,115,85,0.03);' +
          bt +
          '">' +
          fv(r.t) +
          "</td>" +
          "</tr>"
        );
      } else {
        return (
          '<tr style="background:' +
          bg +
          '">' +
          '<td style="padding:7px 12px;font-size:11px;font-weight:' +
          fw +
          ";color:" +
          tc +
          ";" +
          bt +
          '">' +
          r.l +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-size:11px;font-weight:' +
          fw +
          ";" +
          bt +
          '">' +
          fv(r.y1) +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-size:11px;font-weight:' +
          fw +
          ";" +
          bt +
          '">' +
          fv(r.y2) +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-size:11px;font-weight:700;border-left:1px solid var(--border);background:rgba(139,115,85,0.03);' +
          bt +
          '">' +
          fv(r.t) +
          "</td>" +
          "</tr>"
        );
      }
    }).join("");
  }

  window._t12Full = false;
  window.t12SetView = function (mode) {
    var full = mode === "full";
    window._t12Full = full;
    document.getElementById("t12BtnCompact").className =
      "btn btn-xs" + (full ? " btn-ghost" : "");
    document.getElementById("t12BtnFull").className =
      "btn btn-xs" + (full ? "" : " btn-ghost");
    var thead = document.getElementById("t12THead");
    var tbody = document.getElementById("t12TBody");
    if (thead) thead.innerHTML = buildT12Header(full);
    if (tbody) tbody.innerHTML = buildT12Body(full);
  };

  el.innerHTML =
    '<div class="card">' +
    kpiHtml +
    viewToggle +
    '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:0 0 8px 8px">' +
    '<table style="width:100%;border-collapse:collapse;' +
    (compact ? "" : "min-width:1800px") +
    '">' +
    '<thead id="t12THead">' +
    buildT12Header(false) +
    "</thead>" +
    '<tbody id="t12TBody">' +
    buildT12Body(false) +
    "</tbody>" +
    "</table>" +
    "</div>" +
    "</div>";
  var legEl = document.getElementById("parsedT12Preview");
  if (legEl) legEl.innerHTML = "";
}

function renderParsedRRTable(proj) {
  _updateRRUI(proj);
  var el = document.getElementById("rrParsedContent");
  if (!el) return;
  var zh = currentLang === "zh";
  var f =
    proj &&
    (proj.files || []).find(function (fx) {
      return ["RR", "Rent Roll"].includes(fx.parsedAs || fx.type);
    });
  var _rrRows = _getRRData(currentProjectId) || RR_DATA || [];
  var hasRRData = f || _rrRows.length > 0;
  if (!hasRRData) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "";

  // Derive unit type groups dynamically from RR_DATA sqft values
  var rows = _rrRows;
  var groups = {};
  var vacantUnits = [];
  rows.forEach(function (r) {
    var sqft = r.sqft || 0;
    var key = sqft + " sqft";
    if (!groups[key]) groups[key] = { sqft: sqft, units: [] };
    groups[key].units.push(r);
    if (r.tenant === "VACANT") vacantUnits.push(r);
  });
  // Sort groups by sqft ascending
  var sortedGroupKeys = Object.keys(groups).sort(function (a, b) {
    return groups[a].sqft - groups[b].sqft;
  });

  var totalRent = rows.reduce(function (s, r) {
    return s + (r.tenant !== "VACANT" ? r.actual_rent : 0);
  }, 0);
  var totalSqft = rows.reduce(function (s, r) {
    return s + r.sqft;
  }, 0);
  var occupied = rows.filter(function (r) {
    return r.tenant !== "VACANT";
  }).length;
  var occPct = ((occupied / rows.length) * 100).toFixed(1);

  // Status bar
  var statusHtml =
    '<div class="parse-status-bar" style="background:rgba(74,101,133,0.06);border-color:rgba(74,101,133,0.2)">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.5" style="width:15px;height:15px"><polyline points="20 6 9 17 4 12"/></svg>' +
    '<span class="parse-stat-item"><strong>' +
    rows.length +
    "</strong>&nbsp;" +
    (zh ? "套房已解析" : "units parsed") +
    "</span>" +
    '<div class="parse-stat-sep"></div>' +
    '<span class="parse-stat-item" style="color:var(--green)"><strong>' +
    occupied +
    "</strong>&nbsp;" +
    (zh ? "已出租" : "occupied") +
    "&nbsp;(" +
    occPct +
    "%)</span>" +
    '<div class="parse-stat-sep"></div>' +
    '<span class="parse-stat-item" style="color:var(--red,#c0392b)"><strong>' +
    vacantUnits.length +
    "</strong>&nbsp;" +
    (zh ? "空置" : "vacant") +
    "</span>" +
    '<div style="flex:1"></div>' +
    '<span style="font-size:11px;color:var(--muted)">As of 11/12/2025</span>' +
    "</div>";

  // Unit type summary table
  var typeTableHtml =
    '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">' +
    '<div style="padding:12px 16px;background:rgba(74,101,133,0.05);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8" style="width:15px;height:15px"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>' +
    '<span style="font-size:13px;font-weight:700;color:var(--header)">' +
    (zh ? "单元类型汇总" : "Unit Type Summary") +
    "</span>" +
    '<span style="font-size:11px;color:var(--muted);margin-left:auto">' +
    (zh
      ? "将应用至 Pro-forma 租金假设"
      : "Will populate Pro-forma rent assumptions") +
    "</span>" +
    "</div>" +
    '<div style="overflow-x:auto"><table class="rr-type-table">' +
    "<thead><tr>" +
    '<th style="text-align:left">' +
    (zh ? "类型" : "Type") +
    "</th>" +
    "<th>" +
    (zh ? "套数" : "Units") +
    "</th>" +
    "<th>" +
    (zh ? "面积(sqft)" : "SqFt") +
    "</th>" +
    "<th>" +
    (zh ? "均租/月" : "Avg Rent/mo") +
    "</th>" +
    "<th>" +
    (zh ? "月租合计" : "Total/mo") +
    "</th>" +
    "<th>" +
    (zh ? "年化收入" : "Annual") +
    "</th>" +
    "<th>" +
    (zh ? "出租率" : "Occ%") +
    "</th>" +
    "</tr></thead><tbody>";

  sortedGroupKeys.forEach(function (key) {
    var g = groups[key];
    // Only average units that actually have a price (actual_rent > 0)
    var priced = g.units.filter(function (u) {
      return (u.actual_rent || 0) > 0;
    });
    var rents = priced.map(function (u) {
      return u.actual_rent;
    });
    var avgRent = rents.length
      ? Math.round(
          rents.reduce(function (a, b) {
            return a + b;
          }, 0) / rents.length,
        )
      : 0;
    var totalMo = rents.reduce(function (a, b) {
      return a + b;
    }, 0);
    var occPctG = g.units.length
      ? ((priced.length / g.units.length) * 100).toFixed(0) + "%"
      : "—";
    typeTableHtml +=
      "<tr>" +
      "<td>" +
      key +
      "</td>" +
      "<td>" +
      g.units.length +
      "</td>" +
      '<td data-rr-edit="sqft" data-rr-raw="' +
      g.sqft +
      '" data-rr-type="num" data-rr-edit-click="1">' +
      g.sqft +
      "</td>" +
      '<td style="color:var(--header)" data-rr-edit="avgRent" data-rr-raw="' +
      avgRent +
      '" data-rr-type="num" data-rr-edit-click="1">$' +
      avgRent.toLocaleString() +
      "</td>" +
      '<td style="color:var(--header)" data-rr-edit="totalMo" data-rr-raw="' +
      totalMo +
      '" data-rr-type="num" data-rr-edit-click="1">$' +
      totalMo.toLocaleString() +
      "</td>" +
      '<td style="color:var(--blue)">$' +
      (totalMo * 12).toLocaleString() +
      "</td>" +
      "<td>" +
      occPctG +
      "</td>" +
      "</tr>";
  });

  // Total row
  typeTableHtml +=
    '<tr class="rr-total-row">' +
    "<td>" +
    (zh ? "合计" : "Total") +
    "</td>" +
    "<td>" +
    rows.length +
    "</td>" +
    "<td>" +
    totalSqft.toLocaleString() +
    "</td>" +
    "<td>—</td>" +
    "<td>$" +
    totalRent.toLocaleString() +
    "</td>" +
    '<td style="color:var(--blue)">$' +
    (totalRent * 12).toLocaleString() +
    "</td>" +
    '<td style="color:var(--green);font-weight:700">' +
    occPct +
    "%</td>" +
    "</tr></tbody></table></div>";

  // Lease expiry notice
  var leaseHtml =
    '<div class="card card-sm" style="margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--amber,#8b6a2e)" stroke-width="1.8" style="width:20px;height:20px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
    '<div style="flex:1">' +
    '<div style="font-size:13px;font-weight:700;color:var(--header)">' +
    (zh ? "租约到期集中风险" : "Lease Expiry Concentration Risk") +
    "</div>" +
    '<div style="font-size:12px;color:var(--muted);margin-top:2px">' +
    (zh
      ? "27 份租约同步于 2026年7月31日 到期 — 集中换租风险较高，建议 Pro-forma 中体现翻新空置期假设"
      : "27 leases expire on Jul 31, 2026 — high rollover concentration; recommend including renovation vacancy in Pro-forma assumptions") +
    "</div>" +
    "</div>" +
    '<span class="rr-lease-tag" style="background:rgba(139,106,46,0.1);color:var(--amber,#8b6a2e)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>' +
    (zh ? "留意" : "Note") +
    "</span>" +
    "</div>";

  // Apply bar
  var applyHtml =
    '<div class="map-apply-bar" style="border-top:2px solid var(--border);background:rgba(0,0,0,0.015);border-radius:0 0 16px 16px">' +
    '<span style="font-size:12px;color:var(--muted)">' +
    (zh
      ? "应用后将更新 Pro-forma 的租金假设和占用率"
      : "Applying will update Pro-forma rent assumptions and occupancy rate") +
    "</span>" +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn btn-ghost btn-sm" onclick="downloadOriginalFile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ' +
    (zh ? "下载原始文件" : "Download Original") +
    "</button>" +
    '<button class="btn btn-primary btn-sm" style="background:var(--blue);border-color:var(--blue)" onclick="applyRRToProForma()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ' +
    (zh ? "应用到 Pro-forma" : "Apply to Pro-forma") +
    "</button>" +
    "</div>" +
    "</div>";

  el.innerHTML =
    statusHtml +
    typeTableHtml +
    leaseHtml +
    '<div class="card" style="padding:0;overflow:hidden">' +
    applyHtml +
    "</div>";
}

function applyRRToProForma() {
  var zh = currentLang === "zh";
  loadDemoProForma();
  switchProjTab("proforma", document.getElementById("ptab-proforma"));
  toast(
    zh
      ? "Rent Roll 数据已应用至 Pro-forma 租金假设"
      : "Rent Roll applied to Pro-forma rent assumptions",
  );
}

// renderAllParsedPreviews — defined later (line ~18563)

// ─── DOC CATEGORY HELPERS ───────────────────────────────────────────────────

// triggerDocUpload — defined later (line ~6903)

function renderDocCategoryPanels(proj) {
  const files = (proj && proj.files) || [];
  const SINGLE = { T12: true, RentRoll: true };
  const categories = {
    T12: {
      key: "T12",
      el: "docFiles-T12",
      types: ["T12", "Selling Model"],
      single: true,
      docType: "T12",
    },
    RentRoll: {
      key: "RentRoll",
      el: "docFiles-RentRoll",
      types: ["Rent Roll"],
      single: true,
      docType: "Rent Roll",
    },
    Debt: {
      key: "Debt",
      el: "docFiles-Debt",
      types: ["Debt Current", "Debt Refinance"],
      single: false,
      docType: "Debt Current",
    },
  };
  const zh = currentLang === "zh";

  Object.values(categories).forEach((cat) => {
    const container = document.getElementById(cat.el);
    if (!container) return;
    const catFiles = files.filter((f) =>
      cat.types.some((t) => (f.type || "") === t || (f.parsedAs || "") === t),
    );
    const card = document.getElementById("docCard-" + cat.key);
    if (card) {
      card.style.borderColor = catFiles.length
        ? "rgba(74,124,89,0.4)"
        : "var(--border)";
      card.style.background = catFiles.length
        ? "rgba(74,124,89,0.03)"
        : "var(--surface)";
    }
    // Update upload button: hide if single-file and already has file, show "Replace"
    const uploadBtn = card ? card.querySelector(".doc-upload-btn") : null;
    if (uploadBtn && cat.single) {
      if (catFiles.length) {
        uploadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${zh ? "替换文件" : "Replace File"}`;
        uploadBtn.style.color = "var(--amber)";
      } else {
        uploadBtn.style.color = "";
      }
    }
    if (!catFiles.length) {
      // Period hint based on Acquisition Year
      var ay =
        (getProjectAssumptions && getProjectAssumptions().acquisitionYear) ||
        2026;
      var hint = "";
      if (cat.key === "T12") {
        hint = `<div style="font-size:10.5px;color:#1565C0;padding:4px 2px;background:rgba(21,101,192,0.06);border-left:2px solid rgba(21,101,192,0.4);border-radius:0 4px 4px 0;padding-left:8px;margin-bottom:4px">
          <strong>${zh ? "期望期间" : "Expected period"}:</strong> ${zh ? "最近 24 个月，覆盖收购年 (AY=" : "24 months ending close to acquisition (AY="}${ay}) → ${ay - 2}–${ay - 1}.
        </div>`;
      } else if (cat.key === "RentRoll") {
        hint = `<div style="font-size:10.5px;color:#1565C0;padding:4px 2px;background:rgba(21,101,192,0.06);border-left:2px solid rgba(21,101,192,0.4);border-radius:0 4px 4px 0;padding-left:8px;margin-bottom:4px">
          <strong>${zh ? "期望期间" : "Expected period"}:</strong> ${zh ? "AY 前一年（" : "AY−1 ("}${ay - 1}${zh ? "）的当前快照" : ") current snapshot"}.
        </div>`;
      }
      container.innerHTML =
        hint +
        `<div style="font-size:11px;color:var(--muted);padding:6px 2px;font-style:italic">${zh ? "未上传" : "Not uploaded"}</div>`;
      return;
    }
    container.innerHTML = catFiles
      .map((f) => {
        const ext = (f.name.split(".").pop() || "").toUpperCase();
        const extColor =
          { XLSX: "#4a7c59", XLS: "#4a7c59", CSV: "#4a6585", PDF: "#c0392b" }[
            ext
          ] || "var(--accent)";
        const isParsed = f.status === "parsed" || !f.status;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;background:rgba(255,255,255,0.7);border:1px solid var(--border2);margin-bottom:5px">
        <div style="width:28px;height:28px;border-radius:5px;background:${extColor}18;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:700;color:${extColor};flex-shrink:0">${ext}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11.5px;font-weight:600;color:var(--header);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
          <div style="font-size:10px;color:var(--muted)">${isParsed ? "✓ " + (zh ? "已解析" : "Parsed") : zh ? "解析中…" : "Parsing…"} · ${f.date || ""}</div>
        </div>
        <div style="display:flex;gap:3px;flex-shrink:0">
          ${
            isParsed
              ? `<button class="btn btn-ghost btn-sm" style="padding:3px 6px" onclick="previewUploadedFile('${f.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>`
              : ""
          }
          <button class="btn btn-ghost btn-sm" style="padding:3px 6px;color:var(--red,#c0392b)" onclick="deleteUploadedFile('${f.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
      })
      .join("");
  });
}

function guessFileType(name) {
  const n = name.toLowerCase();
  if (n.includes("t12") || n.includes("trailing")) return "T12";
  if (n.includes("rent") || n.includes("rr") || n.includes("roll"))
    return "Rent Roll";
  if (n.includes("refi") || n.includes("refinance")) return "Debt Refinance";
  if (n.includes("debt") || n.includes("loan") || n.includes("mortgage"))
    return "Debt Current";
  if (n.includes("sell") || n.includes("model") || n.includes("om"))
    return "Selling Model";
  return "Document";
}
function countFieldsForType(t) {
  return (
    {
      T12: 48,
      "Rent Roll": 28,
      "Debt Current": 12,
      "Debt Refinance": 12,
      "Selling Model": 22,
    }[t] || 8
  );
}

// renderUploadedFiles — defined later (line ~18211)

// ─── FILE PREVIEW CARD (used in T12/RR/HD tabs after upload) ────────────────
function _buildFilePreviewCard(fileObj, opts) {
  opts = opts || {};
  var zh = currentLang === "zh";
  var sizeFmt = fileObj.size
    ? fileObj.size > 1024 * 1024
      ? (fileObj.size / 1024 / 1024).toFixed(1) + " MB"
      : (fileObj.size / 1024).toFixed(0) + " KB"
    : "";
  var typeColors = {
    T12: "var(--green)",
    "Selling Model": "var(--green)",
    "Rent Roll": "#3b82f6",
    HelloData: "#a67c52",
  };
  var tc = typeColors[fileObj.parsedAs || fileObj.type] || "var(--accent)";
  var typeName = fileObj.parsedAs || fileObj.type || "Document";
  var previewBtnId = opts.previewBtnId || "previewBtn_" + (fileObj.id || "hd");
  var previewAction =
    opts.previewAction || "previewUploadedFile('" + fileObj.id + "')";

  return (
    '<div class="card" style="padding:0;overflow:hidden;max-width:600px">' +
    '<div style="padding:18px 20px;display:flex;align-items:center;gap:14px">' +
    // File icon
    '<div style="width:48px;height:48px;border-radius:12px;background:' +
    tc +
    '14;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="' +
    tc +
    '" stroke-width="1.5" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>' +
    "</div>" +
    // File info
    '<div style="flex:1;min-width:0">' +
    '<div style="font-size:14px;font-weight:700;color:var(--header);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
    fileObj.name +
    "</div>" +
    '<div style="font-size:11px;color:var(--muted);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
    '<span style="color:' +
    tc +
    ';font-weight:600">' +
    typeName +
    "</span>" +
    (sizeFmt ? "<span>" + sizeFmt + "</span>" : "") +
    (fileObj.date ? "<span>" + fileObj.date + "</span>" : "") +
    '<span style="color:var(--green);font-weight:600">✓ ' +
    (zh ? "已解析" : "Parsed") +
    "</span>" +
    "</div>" +
    "</div>" +
    "</div>" +
    // Preview button
    '<div style="padding:0 20px 18px;display:flex;gap:10px">' +
    '<button class="btn btn-primary btn-sm" onclick="' +
    previewAction +
    '" id="' +
    previewBtnId +
    '" style="display:flex;align-items:center;gap:6px">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
    (zh ? "预览原文件" : "Preview Original") +
    "</button>" +
    "</div>" +
    "</div>"
  );
}
window._buildFilePreviewCard = _buildFilePreviewCard;

// ─── PREVIEW FILE IN NEW TAB (renders xlsx as HTML tables) ──────────────────
function _previewFileInNewTab(dataUrl, fileName) {
  if (!dataUrl) {
    var zh = currentLang === "zh";
    toast(zh ? "文件不可用" : "File not available", "info");
    return;
  }
  try {
    var base64 = dataUrl.split(",")[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var wb = XLSX.read(bytes.buffer, { type: "array" });

    var sheetNames = wb.SheetNames;
    // Build tab buttons + sheet HTML
    var tabBtns = sheetNames
      .map(function (name, idx) {
        return (
          '<button onclick="switchSheet(' +
          idx +
          ')" data-idx="' +
          idx +
          '" style="' +
          "padding:8px 20px;border:none;cursor:pointer;font-size:13px;font-weight:600;" +
          "border-bottom:2px solid " +
          (idx === 0 ? "#4a7c59" : "transparent") +
          ";" +
          "background:" +
          (idx === 0 ? "rgba(74,124,89,0.08)" : "transparent") +
          ";" +
          "color:" +
          (idx === 0 ? "#4a7c59" : "#666") +
          '">' +
          name +
          "</button>"
        );
      })
      .join("");

    var sheetPanels = sheetNames
      .map(function (name, idx) {
        var ws = wb.Sheets[name];
        var html = XLSX.utils.sheet_to_html(ws, { editable: false });
        html = html.replace(
          /<table/,
          '<table style="width:100%;border-collapse:collapse;font-size:13px"',
        );
        return (
          '<div data-sheet="' +
          idx +
          '" style="' +
          (idx === 0 ? "" : "display:none;") +
          'overflow:auto;padding:16px">' +
          html +
          "</div>"
        );
      })
      .join("");

    var pageHtml =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      (fileName || "Preview") +
      "</title>" +
      "<style>" +
      'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5}' +
      ".header{background:#fff;border-bottom:1px solid #e0e0e0;padding:12px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}" +
      ".header h1{font-size:16px;font-weight:700;color:#333;margin:0}" +
      ".tabs{display:flex;gap:0;background:#fff;border-bottom:1px solid #e0e0e0;padding:0 24px;position:sticky;top:49px;z-index:9}" +
      ".content{background:#fff;margin:16px 24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}" +
      "table{border-collapse:collapse;width:100%}" +
      "td,th{border:1px solid #e8e8e8;padding:6px 10px;text-align:left;white-space:nowrap;font-size:12px}" +
      "th{background:#f8f9fa;font-weight:600;position:sticky;top:0}" +
      "tr:nth-child(even){background:#fafafa}" +
      "tr:hover{background:#f0f7f2}" +
      "</style></head><body>" +
      '<div class="header"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a7c59" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h1>' +
      (fileName || "Preview") +
      "</h1></div>" +
      '<div class="tabs">' +
      tabBtns +
      "</div>" +
      '<div class="content">' +
      sheetPanels +
      "</div>" +
      '<script>function switchSheet(idx){document.querySelectorAll("[data-sheet]").forEach(function(el){el.style.display=parseInt(el.getAttribute("data-sheet"))===idx?"":"none"});document.querySelectorAll("[data-idx]").forEach(function(btn){var active=parseInt(btn.getAttribute("data-idx"))===idx;btn.style.borderBottom="2px solid "+(active?"#4a7c59":"transparent");btn.style.background=active?"rgba(74,124,89,0.08)":"transparent";btn.style.color=active?"#4a7c59":"#666"})}<\/script>' +
      "</body></html>";

    var newTab = window.open("", "_blank");
    if (newTab) {
      newTab.document.write(pageHtml);
      newTab.document.close();
    } else {
      toast(
        currentLang === "zh" ? "请允许弹出窗口" : "Please allow popups",
        "info",
      );
    }
  } catch (err) {
    toast(
      (currentLang === "zh" ? "预览失败: " : "Preview failed: ") + err.message,
      "error",
    );
  }
}
window._previewFileInNewTab = _previewFileInNewTab;

// ─── ENHANCED EXCEL PREVIEW IN MODAL ─────────────────────────────────────────
function _previewExcelFromDataUrl(dataUrl, fileName) {
  var zh = currentLang === "zh";
  if (!dataUrl) {
    toast(zh ? "预览文件不可用" : "Preview file not available", "info");
    return;
  }
  try {
    // Convert dataUrl to ArrayBuffer
    var base64 = dataUrl.split(",")[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var wb = XLSX.read(bytes.buffer, { type: "array" });

    // Build tab navigation + tables for each sheet
    var sheetNames = wb.SheetNames;
    var tabsHtml =
      '<div style="display:flex;gap:4px;padding:8px 16px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:nowrap">';
    sheetNames.forEach(function (name, idx) {
      tabsHtml +=
        '<button class="btn btn-sm ' +
        (idx === 0 ? "btn-primary" : "btn-ghost") +
        '" onclick="window._switchPreviewSheet(' +
        idx +
        ')" data-sheet-tab="' +
        idx +
        '" style="white-space:nowrap;flex-shrink:0">' +
        name +
        "</button>";
    });
    tabsHtml += "</div>";

    var sheetsHtml = "";
    sheetNames.forEach(function (name, idx) {
      var ws = wb.Sheets[name];
      var html = XLSX.utils.sheet_to_html(ws, { editable: false });
      // Style the generated table
      html = html.replace(
        /<table/,
        '<table class="data-table" style="width:100%;font-size:11px;border-collapse:collapse"',
      );
      sheetsHtml +=
        '<div data-sheet-panel="' +
        idx +
        '" style="' +
        (idx === 0 ? "" : "display:none;") +
        'overflow:auto;max-height:500px;padding:8px">' +
        html +
        "</div>";
    });

    var modalBody = tabsHtml + sheetsHtml;
    openModal(
      '<div class="modal-header"><div class="modal-title" style="display:flex;align-items:center;gap:8px">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        fileName +
        '</div><button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
        '<div class="modal-body" style="padding:0">' +
        modalBody +
        "</div>",
    );
  } catch (err) {
    toast((zh ? "预览失败: " : "Preview failed: ") + err.message, "error");
  }
}
window._previewExcelFromDataUrl = _previewExcelFromDataUrl;

window._switchPreviewSheet = function (idx) {
  document.querySelectorAll("[data-sheet-tab]").forEach(function (btn) {
    btn.className =
      "btn btn-sm " +
      (parseInt(btn.getAttribute("data-sheet-tab")) === idx
        ? "btn-primary"
        : "btn-ghost");
  });
  document.querySelectorAll("[data-sheet-panel]").forEach(function (panel) {
    panel.style.display =
      parseInt(panel.getAttribute("data-sheet-panel")) === idx ? "" : "none";
  });
};

// Preview HD file — download the original xlsx so user can open it natively
function _previewHDFile() {
  var pid = currentProjectId;
  var dataUrl = localStorage.getItem("hd_file_" + pid);
  var meta = getHDMeta(pid);
  var fileName = (meta && meta.fileName) || "HelloData.xlsx";
  if (dataUrl) {
    _previewFileInNewTab(dataUrl, fileName);
  } else {
    toast(
      currentLang === "zh" ? "预览文件不可用" : "Preview file not available",
      "info",
    );
  }
}
window._previewHDFile = _previewHDFile;

function previewUploadedFile(fileId) {
  const proj = getProjects().find((p) => p.id === currentProjectId);
  if (!proj || !proj.files) return;
  const f = proj.files.find((x) => x.id === fileId);
  if (!f) return;
  // Resolve dataUrl: from file object (legacy) or separate storage
  var dataUrl =
    f.dataUrl || localStorage.getItem("file_data_" + fileId) || null;
  const zh = currentLang === "zh";
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  let previewHtml = "";
  if (dataUrl && ext === "pdf") {
    previewHtml = `<iframe src="${dataUrl}" style="width:100%;height:520px;border:none;border-radius:8px"></iframe>`;
  } else if (dataUrl && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    previewHtml = `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;display:block;margin:0 auto">`;
  } else if (["xlsx", "xls", "csv"].includes(ext) && dataUrl) {
    _previewFileInNewTab(dataUrl, f.name);
    return;
  } else if (["xlsx", "xls", "csv"].includes(ext) && !dataUrl) {
    // Try to fetch from /data/ for seeded projects, then download
    var _proj = proj;
    var _dataFile = _proj.dataFile || _proj.hdFile;
    if (_dataFile) {
      toast(zh ? "正在加载文件..." : "Loading file...", "info");
      fetch("/data/" + _dataFile)
        .then(function (r) {
          return r.arrayBuffer();
        })
        .then(function (buf) {
          var blob = new Blob([buf]);
          var reader = new FileReader();
          reader.onload = function (e) {
            // Cache for next time
            var p2 = getProjects().find(function (p) {
              return p.id === currentProjectId;
            });
            if (p2) {
              var fObj = (p2.files || []).find(function (x) {
                return x.id === fileId;
              });
              if (fObj) {
                fObj.dataUrl = e.target.result;
                saveProjects(
                  getProjects().map(function (p) {
                    return p.id === p2.id ? p2 : p;
                  }),
                );
              }
            }
            _previewFileInNewTab(e.target.result, f.name);
          };
          reader.readAsDataURL(blob);
        })
        .catch(function () {
          toast(zh ? "文件不可用" : "File not available", "error");
        });
      return;
    }
    toast(zh ? "文件不可用" : "File not available", "info");
    return;
  } else if (["xlsx", "xls", "csv"].includes(ext)) {
    // Fallback: show parsed field summary if no dataUrl
    const ftype = f.parsedAs || f.type || "Document";
    const sizeFmt = f.size
      ? f.size > 1024 * 1024
        ? (f.size / 1024 / 1024).toFixed(1) + "MB"
        : (f.size / 1024).toFixed(0) + "KB"
      : "";
    const fieldCount = countFieldsForType(ftype);
    const typeColors = {
      T12: "var(--green)",
      "Selling Model": "var(--green)",
      "Rent Roll": "var(--blue)",
      "Debt Current": "var(--amber)",
      "Debt Refinance": "var(--amber)",
    };
    const tc = typeColors[ftype] || "var(--accent)";
    const fieldMap = {
      T12: [
        "Gross Potential Rent",
        "Vacancy Loss",
        "EGI",
        "Total OpEx",
        "NOI",
        "Property Tax",
        "Insurance",
        "Repairs & Maintenance",
        "Management Fee",
        "Utilities",
        "Total Revenue",
      ],
      "Selling Model": [
        "Purchase Price",
        "Equity Required",
        "NOI (Stab)",
        "Cap Rate",
        "DSCR",
        "IRR",
        "Equity Multiple",
        "Cash-on-Cash Y1",
        "Cash-on-Cash Stab",
        "Exit Cap",
        "Gross Sale Proceeds",
      ],
      "Rent Roll": [
        "Unit #",
        "Sq Ft",
        "Tenant Name",
        "Current Rent",
        "$/Sq Ft",
        "Lease Expiry",
        "Move-in Date",
        "Market Rent Est.",
      ],
      "Debt Current": [
        "Loan Balance",
        "Interest Rate",
        "Mortgage Constant",
        "Annual Debt Service",
        "Maturity Date",
        "Lender",
        "LTV",
        "DSCR",
      ],
      "Debt Refinance": [
        "Refi Amount",
        "New Rate",
        "New Debt Service",
        "Projected LTV",
        "Refi DSCR",
        "Exit Proceeds",
        "Equity Return",
        "Refi Date",
      ],
    };
    const fields = (fieldMap[ftype] || []).slice(0, 8);
    previewHtml = `
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div style="width:44px;height:44px;border-radius:10px;background:${tc}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="${tc}" stroke-width="1.5" style="width:22px;height:22px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--header)">${f.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">
              <span style="color:${tc};font-weight:600">${ftype}</span>
              ${sizeFmt ? " · " + sizeFmt : ""} · ${f.date || ""}
              · <span style="color:var(--green)">✓ ${zh ? "已解析" : "Parsed"}</span>
            </div>
          </div>
        </div>
        <div style="padding:14px;background:rgba(74,124,89,0.05);border-radius:10px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:${tc};text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
            ${zh ? "已解析字段 (" + fieldCount + "个)" : "Parsed Fields (" + fieldCount + " total)"}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
            ${fields.map((f) => `<div style="font-size:11px;color:var(--body);display:flex;align-items:center;gap:5px"><span style="color:var(--green);font-size:9px">✓</span>${f}</div>`).join("")}
            ${fieldCount > 8 ? `<div style="font-size:10px;color:var(--muted);grid-column:span 2;margin-top:4px">+ ${fieldCount - 8} ${zh ? "更多字段已导入" : "more fields imported"}</div>` : ""}
          </div>
        </div>
        ${f.dataUrl ? `<div style="text-align:center"><a href="${f.dataUrl}" download="${f.name}" class="btn btn-primary btn-sm">${zh ? "下载原始文件" : "⬇ Download Original"}</a></div>` : `<div style="font-size:11px;color:var(--muted);text-align:center;padding:8px">${zh ? "演示数据 · 实际文件上传后可在此下载" : "Demo data · Upload actual file to enable download"}</div>`}
      </div>`;
  } else {
    previewHtml = `<div style="text-align:center;padding:48px 16px;color:var(--muted)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;margin:0 auto 12px;display:block"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div style="font-size:13px">${zh ? "该文件类型不支持预览" : "Preview not available for this file type"}</div>
      ${f.dataUrl ? `<a href="${f.dataUrl}" download="${f.name}" class="btn btn-ghost btn-sm" style="margin-top:12px">${zh ? "下载文件" : "Download"}</a>` : ""}
    </div>`;
  }
  openModal(`<div class="modal-header"><div class="modal-title" style="display:flex;align-items:center;gap:8px">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    ${f.name}
  </div><button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
  <div class="modal-body" style="padding:16px">${previewHtml}</div>`);
}

function deleteUploadedFile(fileId) {
  const zh = currentLang === "zh";
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (!proj || !proj.files) return;
  const f = proj.files.find((x) => x.id === fileId);
  if (!f) return;
  // Show confirmation with option to re-parse
  openModal(`<div class="modal-header"><div class="modal-title" style="color:var(--red,#c0392b)">${zh ? "删除文件" : "Delete File"}</div><button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
  <div class="modal-body">
    <p style="font-size:13px;margin-bottom:16px">${zh ? "确认删除文件：" : "Delete file:"} <strong>${f.name}</strong></p>
    <div style="background:rgba(192,57,43,0.06);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--muted)">
      ${zh ? "删除后，该文件解析的字段将恢复为系统默认值，且需重新上传才能再次解析。" : "After deletion, fields parsed from this file will revert to system defaults. You will need to re-upload to parse again."}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">${zh ? "取消" : "Cancel"}</button>
      <button class="btn btn-sm" style="background:var(--red,#c0392b);color:#fff;border-color:var(--red,#c0392b)" onclick="confirmDeleteFile('${fileId}')">${zh ? "确认删除" : "Delete & Re-parse"}</button>
    </div>
  </div>`);
}

function confirmDeleteFile(fileId) {
  const zh = currentLang === "zh";
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (!proj || !proj.files) return;
  const fname = proj.files.find((x) => x.id === fileId)?.name || "file";
  proj.files = (proj.files || []).filter((x) => x.id !== fileId);
  saveProjects(projs);
  if (proj) renderUploadedFiles(proj);
  renderProjects();
  closeModal();
  toast(
    zh
      ? "已删除 " + fname + " — 请重新上传并解析"
      : "Deleted " + fname + " — re-upload to re-parse",
    "",
  );
}

// Init upload for current project
function initUploadUI() {
  const proj = getProjects().find((p) => p.id === currentProjectId) || null;
  if (proj) renderUploadedFiles(proj);
}

// ─── PRO FORMA TABLE ──────────────────────────────────────────────────────────

// ─── T12 TAB ─────────────────────────────────────────────────────────────────

function triggerDocUpload(type) {
  var inp;
  if (type === "Rent Roll") inp = document.getElementById("rrInput");
  else inp = document.getElementById("t12Input");
  if (inp) {
    inp.setAttribute("data-doctype", type);
    inp.click();
  }
}

function renderParsedT12Full(proj, file, container) {
  var zh = currentLang === "zh";
  var pf = proj.parsedT12 || {};
  var egi = pf.egi || (proj.egi ? proj.egi : null);
  var noi = pf.noi || (proj.noi ? proj.noi : null);
  var opex = pf.opex || (proj.opex ? proj.opex : null);
  var vac = pf.vacancy != null ? pf.vacancy : proj.vacancyRate || null;
  var units = proj.units || 0;

  function fmtMoney(v) {
    if (!v && v !== 0) return "—";
    return "$" + Number(v).toLocaleString();
  }
  function fmtPct(v) {
    if (!v && v !== 0) return "—";
    return (+v).toFixed(1) + "%";
  }

  container.innerHTML = [
    '<div style="margin-top:14px">',
    "<!-- Parsed summary cards -->",
    '<div class="bento bento-4" style="margin-bottom:16px">',
    kpiCard(
      "EGI",
      fmtMoney(egi),
      zh ? "有效总收入" : "Effective Gross Income",
      "var(--green)",
    ),
    kpiCard(
      "NOI",
      fmtMoney(noi),
      zh ? "净营业收入" : "Net Operating Income",
      "var(--accent)",
    ),
    kpiCard(
      zh ? "总运营费用" : "Total OpEx",
      fmtMoney(opex),
      zh ? "年度运营支出" : "Annual Operating Expense",
      "var(--blue)",
    ),
    kpiCard(
      zh ? "空置率" : "Vacancy",
      fmtPct(vac),
      zh ? "当前空置率" : "Current Vacancy Rate",
      "var(--muted)",
    ),
    "</div>",
    "<!-- Full income/expense table -->",
    '<div class="card" style="padding:0;overflow:hidden">',
    '<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">',
    '<div style="width:8px;height:8px;border-radius:2px;background:var(--green)"></div>',
    '<strong style="font-size:13px;color:var(--header)">' +
      (zh ? "T12 收入与支出明细" : "T12 Income & Expense Detail") +
      "</strong>",
    '<span class="badge badge-t12" style="margin-left:auto">T12</span>',
    '<span style="font-size:11px;color:var(--muted)">' + file.name + "</span>",
    "</div>",
    '<div style="overflow-x:auto"><table class="data-table" style="width:100%">',
    "<thead><tr>",
    '<th style="text-align:left">' + (zh ? "项目" : "Item") + "</th>",
    '<th style="text-align:right">' +
      (zh ? "年度金额" : "Annual Amount") +
      "</th>",
    '<th style="text-align:right">' + (zh ? "每套" : "Per Unit") + "</th>",
    '<th style="text-align:right">' + (zh ? "占EGI比" : "% of EGI") + "</th>",
    "</tr></thead>",
    "<tbody>",
    t12Row(
      zh ? "租金收入" : "Rental Income",
      proj.rentalIncome || (egi ? Math.round(egi * 0.92) : null),
      egi,
      units,
      "revenue",
      true,
    ),
    t12Row(
      zh ? "其他收入" : "Other Income",
      proj.otherIncome || (egi ? Math.round(egi * 0.08) : null),
      egi,
      units,
      "revenue",
      false,
    ),
    '<tr class="pf-section"><td colspan="4" style="padding:8px 0 2px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">' +
      (zh ? "有效总收入" : "Effective Gross Income") +
      "</td></tr>",
    t12Row("EGI", egi, egi, units, "total", true),
    '<tr class="pf-section"><td colspan="4" style="padding:8px 0 2px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">' +
      (zh ? "运营费用" : "Operating Expenses") +
      "</td></tr>",
    t12Row(
      zh ? "物业税" : "Property Tax",
      opex ? Math.round(opex * 0.31) : null,
      egi,
      units,
      "expense",
      false,
    ),
    t12Row(
      zh ? "保险" : "Insurance",
      opex ? Math.round(opex * 0.08) : null,
      egi,
      units,
      "expense",
      false,
    ),
    t12Row(
      zh ? "水电费" : "Utilities",
      opex ? Math.round(opex * 0.16) : null,
      egi,
      units,
      "expense",
      false,
    ),
    t12Row(
      zh ? "维护修缮" : "Repairs & Maint.",
      opex ? Math.round(opex * 0.18) : null,
      egi,
      units,
      "expense",
      false,
    ),
    t12Row(
      zh ? "物业管理" : "Mgmt Fee (8%)",
      opex ? Math.round(opex * 0.18) : null,
      egi,
      units,
      "expense",
      false,
    ),
    t12Row(
      zh ? "其他费用" : "Other Expenses",
      opex ? Math.round(opex * 0.09) : null,
      egi,
      units,
      "expense",
      false,
    ),
    '<tr class="pf-section"><td colspan="4" style="padding:8px 0 2px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">' +
      (zh ? "净营业收入" : "Net Operating Income") +
      "</td></tr>",
    t12Row("NOI", noi, egi, units, "total", true),
    "</tbody>",
    "</table></div>",
    "</div>",
    "</div>",
  ].join("");
}

function kpiCard(label, value, sub, color) {
  return (
    '<div class="kpi-card" style="min-width:120px">' +
    '<div class="kpi-accent" style="background:' +
    (color || "var(--accent)") +
    '"></div>' +
    '<div class="kpi-value" style="font-size:15px">' +
    value +
    "</div>" +
    '<div class="kpi-label">' +
    label +
    "</div>" +
    (sub
      ? '<div class="kpi-change" style="color:var(--muted);font-size:9px;text-transform:none;margin-top:2px">' +
        sub +
        "</div>"
      : "") +
    "</div>"
  );
}

function t12Row(label, value, egi, units, type, bold) {
  var zh = currentLang === "zh";
  var perUnit = value && units ? Math.round(value / units) : null;
  var pctEGI =
    value && egi && egi > 0 ? ((value / egi) * 100).toFixed(1) + "%" : "—";
  var color =
    type === "total"
      ? "var(--header)"
      : type === "revenue"
        ? "var(--green)"
        : type === "expense"
          ? "var(--red,#c0392b)"
          : "var(--header)";
  var bg =
    type === "total" ? "background:rgba(139,115,85,0.05);font-weight:700" : "";
  return (
    '<tr style="' +
    bg +
    '"><td style="font-size:12px;color:var(--header)' +
    (bold ? ";font-weight:600" : "") +
    '">' +
    label +
    "</td>" +
    '<td style="text-align:right;font-size:12px;color:' +
    color +
    '">' +
    (value ? "$" + Number(value).toLocaleString() : "—") +
    "</td>" +
    '<td style="text-align:right;font-size:12px;color:var(--muted)">' +
    (perUnit ? "$" + Number(perUnit).toLocaleString() : "—") +
    "</td>" +
    '<td style="text-align:right;font-size:12px;color:var(--muted)">' +
    pctEGI +
    "</td>" +
    "</tr>"
  );
}

function deleteT12File() {
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  if (!proj) return;
  proj.files = (proj.files || []).filter(function (f) {
    return (
      f.parsedAs !== "T12" && f.type !== "T12" && f.type !== "Selling Model"
    );
  });
  proj.t12File = null;
  proj.parsedT12 = null;
  saveProjects(
    getProjects().map(function (p) {
      return p.id === proj.id ? proj : p;
    }),
  );
  renderT12Tab(proj);
  toast(currentLang === "zh" ? "T12文件已删除" : "T12 file removed");
}

function handleCategoryUpload(event, type) {
  var files =
    event && event.dataTransfer
      ? event.dataTransfer.files
      : event && event.target
        ? event.target.files
        : null;
  if (!files || !files.length) return;
  var fakeEvt = { target: { files: files } };
  if (type === "T12") handleT12Upload(fakeEvt);
  else if (type === "Rent Roll") handleRRUpload(fakeEvt);
}

function loadSamplePFData() {
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  if (!proj) return;
  proj.parsedT12 = { egi: 603232, noi: 331934, opex: 271298, vacancy: 3.6 };
  proj.pfDataLoaded = true;
  proj.rentalIncome = 556440;
  proj.otherIncome = 46792;
  saveProjects(
    getProjects().map(function (p) {
      return p.id === proj.id ? proj : p;
    }),
  );
  switchProjTab("proforma", document.getElementById("ptab-proforma"));
  toast(currentLang === "zh" ? "示例数据已加载" : "Sample data loaded ✓");
}

// ─── RENT ROLL TAB ────────────────────────────────────────────────────────────

function triggerRRUpload() {
  var inp = document.getElementById("rrFileInput");
  if (inp) inp.click();
}

function renderParsedRRFull(proj, file, container) {
  var zh = currentLang === "zh";
  var rrData = proj.parsedRR || _getRRData(currentProjectId) || RR_DATA || [];
  var totalRent = 0,
    totalMkt = 0,
    occupied = 0;
  rrData.forEach(function (r) {
    totalRent += r.rent || 0;
    totalMkt += r.mktEst || r.rent || 0;
    if (r.status === "occupied") occupied++;
  });
  var upside = totalMkt - totalRent;
  var occ =
    rrData.length > 0
      ? ((occupied / rrData.length) * 100).toFixed(1) + "%"
      : "—";
  var units = proj.units || rrData.length || 28;

  container.innerHTML = [
    '<div style="margin-top:14px">',
    '<div class="bento bento-4" style="margin-bottom:16px">',
    kpiCard(zh ? "总套数" : "Total Units", units, null, "var(--header)"),
    kpiCard(
      zh ? "出租率" : "Occupancy",
      occ,
      occupied + " " + zh ? "套已出租" : "occupied",
      "var(--green)",
    ),
    kpiCard(
      zh ? "月租金" : "Monthly Rent",
      "$" + totalRent.toLocaleString(),
      "$" + (totalRent * 12).toLocaleString() + "/yr",
      "var(--accent)",
    ),
    kpiCard(
      zh ? "潜在增长" : "Rent Upside",
      upside > 0 ? "+$" + upside.toLocaleString() : "-",
      zh ? "市场租金潜力" : "vs Market Est.",
      "var(--blue)",
    ),
    "</div>",
    '<div class="card" style="padding:0;overflow:hidden">',
    '<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">',
    '<div style="width:8px;height:8px;border-radius:2px;background:var(--blue)"></div>',
    '<strong style="font-size:13px;color:var(--header)">' +
      (zh ? "逐套租约清单" : "Unit Rent Roll") +
      "</strong>",
    '<span class="badge badge-rr" style="margin-left:auto">Rent Roll</span>',
    '<span style="font-size:11px;color:var(--muted)">' + file.name + "</span>",
    "</div>",
    '<div style="overflow-x:auto"><table class="data-table" style="width:100%">',
    "<thead><tr>",
    "<th>" + (zh ? "房间" : "Unit") + "</th>",
    "<th>" + (zh ? "面积(sqft)" : "SqFt") + "</th>",
    "<th>" + (zh ? "租户" : "Tenant") + "</th>",
    '<th style="text-align:right">' +
      (zh ? "实际租金" : "Actual Rent") +
      "</th>",
    '<th style="text-align:right">' +
      (zh ? "市场估价" : "Market Est.") +
      "</th>",
    '<th style="text-align:right">' + (zh ? "增长空间" : "Upside") + "</th>",
    "<th>" + (zh ? "租约到期" : "Lease Exp.") + "</th>",
    "<th>" + (zh ? "状态" : "Status") + "</th>",
    "</tr></thead>",
    "<tbody>",
    rrData
      .slice(0, 30)
      .map(function (r) {
        var upside = (r.mktEst || r.rent) - r.rent;
        var uColor =
          upside > 50
            ? "var(--green)"
            : upside < 0
              ? "var(--red,#c0392b)"
              : "var(--muted)";
        var sBg =
          r.status === "occupied"
            ? "rgba(74,124,89,0.1)"
            : "rgba(192,112,0,0.1)";
        var sTxt =
          r.status === "occupied" ? "var(--green)" : "var(--amber,#8b6a2e)";
        return (
          "<tr>" +
          '<td style="font-weight:600">' +
          r.unit +
          "</td>" +
          '<td style="color:var(--muted)">' +
          (r.sqft || "—") +
          "</td>" +
          '<td style="color:var(--muted);font-size:11px">' +
          (r.tenant || "Vacant") +
          "</td>" +
          '<td style="text-align:right;font-weight:600">$' +
          r.rent.toLocaleString() +
          "</td>" +
          '<td style="text-align:right;color:var(--muted)">$' +
          (r.mktEst || r.rent).toLocaleString() +
          "</td>" +
          '<td style="text-align:right;color:' +
          uColor +
          ';font-weight:600">' +
          (upside > 0 ? "+" : "") +
          "$" +
          upside.toLocaleString() +
          "</td>" +
          '<td style="color:var(--muted);font-size:11px">' +
          (r.leaseExp || "—") +
          "</td>" +
          '<td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:' +
          sBg +
          ";color:" +
          sTxt +
          ';font-weight:600">' +
          (r.status || "occupied") +
          "</span></td>" +
          "</tr>"
        );
      })
      .join(""),
    "</tbody>",
    "</table></div>",
    rrData.length > 0
      ? '<div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px">' +
        '<span><strong style="color:var(--header)">' +
        (zh ? "年租金总额" : "Total Annual") +
        ":</strong> $" +
        (totalRent * 12).toLocaleString() +
        "</span>" +
        (upside > 0
          ? '<span style="color:var(--green)"><strong>' +
            (zh ? "潜在增长" : "Upside") +
            ":</strong> +$" +
            (upside * 12).toLocaleString() +
            "/yr</span>"
          : "") +
        "</div>"
      : "",
    "</div>",
    "</div>",
  ].join("");
}

function deleteRRFile() {
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  if (!proj) return;
  proj.files = (proj.files || []).filter(function (f) {
    return f.parsedAs !== "RentRoll" && f.type !== "Rent Roll";
  });
  proj.parsedRR = null;
  saveProjects(
    getProjects().map(function (p) {
      return p.id === proj.id ? proj : p;
    }),
  );
  renderRRTab(proj);
  toast(currentLang === "zh" ? "租户清单已删除" : "Rent Roll removed");
}

// ─── PRO FORMA EDIT + OVERRIDE LOG ───────────────────────────────────────────

function clearAllOverrides() {
  if (!confirm("Clear all manual overrides?")) return;
  pfOverrides = {};
  buildPFTable();
  renderPFOverrideLog();
  toast(currentLang === "zh" ? "已清除所有手动修改" : "All overrides cleared");
}

function renderPFOverrideLog() {
  var logEl = document.getElementById("pfOverrideLog");
  var card = document.getElementById("pfOverrideLogCard");
  if (!logEl) return;
  var keys = Object.keys(pfOverrides);
  if (card) card.style.display = keys.length ? "" : "none";
  if (!keys.length) {
    logEl.innerHTML =
      '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">No overrides yet</div>';
    return;
  }
  var zh = currentLang === "zh";
  logEl.innerHTML =
    '<table style="width:100%;border-collapse:collapse">' +
    '<thead><tr style="border-bottom:1px solid var(--border)">' +
    '<th style="text-align:left;padding:4px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">' +
    zh
      ? "字段"
      : "Field" +
          "</th>" +
          '<th style="text-align:right;padding:4px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">' +
          zh
        ? "原值"
        : "Original" +
            "</th>" +
            '<th style="text-align:right;padding:4px 8px;font-size:10px;color:var(--amber,#8b6a2e);text-transform:uppercase">' +
            zh
          ? "修改值"
          : "Overridden" +
              "</th>" +
              '<th style="text-align:left;padding:4px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">' +
              zh
            ? "时间"
            : "Time" +
              "</th>" +
              "</tr></thead><tbody>" +
              keys
                .map(function (k) {
                  var ov = pfOverrides[k];
                  var parts = k.split("|");
                  return (
                    '<tr style="border-bottom:1px solid rgba(0,0,0,0.04)">' +
                    '<td style="padding:5px 8px;font-size:11px;color:var(--header)">' +
                    parts[0] +
                    " (" +
                    parts[1] +
                    ")</td>" +
                    '<td style="text-align:right;padding:5px 8px;font-size:11px;color:var(--muted)">$' +
                    (ov.original || 0).toLocaleString() +
                    "</td>" +
                    '<td style="text-align:right;padding:5px 8px;font-size:11px;color:var(--amber,#8b6a2e);font-weight:700">◆ $' +
                    (ov.value || 0).toLocaleString() +
                    "</td>" +
                    '<td style="padding:5px 8px;font-size:10px;color:var(--muted)">' +
                    ov.timestamp +
                    "</td>" +
                    "</tr>"
                  );
                })
                .join("") +
              "</tbody></table>";
}

_domReady(function () {
  migrateData();
  initUsers();
  initProjects();
  initSubmissions();
  // Auto-login: no auth page needed — load default admin account
  const users = getUsers();
  const defaultUser =
    users.find((u) => u.role === "admin" && u.status === "active") || users[0];
  if (defaultUser) {
    setSession(defaultUser);
    loadApp(defaultUser);
  }
});

function fmt(n) {
  if (!n && n !== 0) return "—";
  const abs = Math.abs(n);
  const s =
    abs >= 1000
      ? "$" + abs.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : "$" + abs.toFixed(0);
  return n < 0 ? "(" + s + ")" : s;
}
function fmtPU(n) {
  if (!n && n !== 0) return "—";
  return (
    "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
  );
}

function srcBadge(s) {
  const m = {
    T12: "badge-t12",
    RR: "badge-rr",
    RentCast: "badge-rentcast",
    ATTOM: "badge-attom",
    HelloData: "badge-hellodata",
    Manual: "badge-manual",
  };
  return `<span class="badge ${m[s] || "badge-manual"}" style="margin:1px;font-size:10px">${s}</span>`;
}

// ─── HELLODATA FINANCIAL ANALYSIS INTEGRATION ─────────────────────────────────
// Maps PF accordion secId → HD Financial Analysis row label (null=T12only, 'locked'=mismatch, 'excluded'=not in ProForma)
var HD_SEC_MAP = {
  "rev-rents": "Gross Potential Rent", // approx: HD GPR ≈ T12 Total Rents
  "rev-mgmt": null, // no HD equivalent
  "rev-fees": null, // no HD equivalent
  "exp-clean": null, // T12 only — HD has no Cleaning category
  "exp-ins": "Property Insurance",
  "exp-legal": "Professional Fees",
  "exp-mgmt": "Management Fees",
  "exp-rm": "Repair & Maintenance",
  "exp-tax": "Real Estate Taxes",
  "exp-util": "Utilities",
  "exp-admin": "locked", // HD "Payroll & Benefits" ≠ T12 "Administrative/Salary"
  "exp-mktg": "Marketing",
  "exp-bldg": "excluded", // Depreciation/Amortization — excluded from ProForma
};

// HD row labels for module-level source selection
var HD_INCOME_LABELS = [
  "Gross Potential Rent",
  "Vacancy Loss",
  "Parking Income",
  "Other Income",
];
var HD_EXPENSE_LABELS = [
  "Real Estate Taxes",
  "Property Insurance",
  "Utilities",
  "Repair & Maintenance",
  "Management Fees",
  "Marketing",
  "Professional Fees",
  "Payroll & Benefits",
];

var _hdTier = "median"; // 'low' | 'median' | 'high'

function getHDData(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_fa_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function _saveHDData(pid, d) {
  localStorage.setItem("hd_fa_" + pid, JSON.stringify(d));
}
function getHDMeta(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_meta_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function _saveHDMeta(pid, m) {
  localStorage.setItem("hd_meta_" + pid, JSON.stringify(m));
}

// Parse Financial Analysis sheet from HelloData xlsx ArrayBuffer → {rowLabel: {low,median,high}}
function _parseHelloDataFA(arrayBuffer) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS not loaded");
  var wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  var ws = wb.Sheets["Financial Analysis"];
  if (!ws) throw new Error('Sheet "Financial Analysis" not found');
  var rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  var result = {};
  var headerPassed = false;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r) continue;
    if (!headerPassed) {
      // Header row: first col contains "Income/Expense Item" or similar
      if (
        r[0] &&
        typeof r[0] === "string" &&
        /income|expense|item/i.test(r[0])
      ) {
        headerPassed = true;
        continue;
      }
      continue;
    }
    var label = r[0];
    if (!label || typeof label !== "string" || !label.trim()) continue;
    label = label.trim();
    var low = typeof r[1] === "number" ? r[1] : parseFloat(r[1]) || 0;
    var median = typeof r[2] === "number" ? r[2] : parseFloat(r[2]) || 0;
    var high = typeof r[3] === "number" ? r[3] : parseFloat(r[3]) || 0;
    if (Math.abs(median) < 1 && Math.abs(low) < 1) continue;
    result[label] = { low: low, median: median, high: high };
  }
  return Object.keys(result).length ? result : null;
}

// ── HelloData Unit Mix Parser ─────────────────────────────────────
function getHDUnitMix(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_umix_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function _saveHDUnitMix(pid, d) {
  // Save _allRows separately (array property not serialized by JSON.stringify)
  if (d && d._allRows) {
    localStorage.setItem("hd_umix_all_" + pid, JSON.stringify(d._allRows));
  }
  localStorage.setItem("hd_umix_" + pid, JSON.stringify(d));
}
function getHDUnitMixAll(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_umix_all_" + (pid || currentProjectId)) ||
        "null",
    );
  } catch (e) {
    return null;
  }
}
function isHDUmixHidden(pid) {
  return (
    localStorage.getItem("hd_umix_hidden_" + (pid || currentProjectId)) === "1"
  );
}
function setHDUmixHidden(pid, v) {
  localStorage.setItem(
    "hd_umix_hidden_" + (pid || currentProjectId),
    v ? "1" : "0",
  );
}

function _extractSubjectName(fileName) {
  // "Cedar Run Apartments-05-08-2025.xlsx" → "Cedar Run Apartments"
  var base = fileName.replace(/\.\w+$/, ""); // remove extension
  // Remove trailing date patterns: -MM-DD-YYYY or -YYYY-MM-DD
  base = base.replace(/-\d{2}-\d{2}-\d{4}$/, "");
  base = base.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return base.trim();
}

function _parseHelloDataUnitMix(arrayBuffer, fileName) {
  if (typeof XLSX === "undefined") return null;
  var wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  var ws = wb.Sheets["Unit Mix"];
  if (!ws) return null;
  var rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!rows || rows.length < 7) return null;

  // Find header row (usually row 6, index 5) — look for "Beds" in columns
  var headerIdx = -1;
  for (var h = 0; h < Math.min(rows.length, 10); h++) {
    var row = rows[h];
    if (!row) continue;
    for (var c = 0; c < row.length; c++) {
      if (
        row[c] &&
        typeof row[c] === "string" &&
        /^beds$/i.test(row[c].trim())
      ) {
        headerIdx = h;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (headerIdx < 0) return null;

  // Map column indices
  var hdr = rows[headerIdx];
  var colMap = {};
  var colNames = {
    "property name": "propName",
    property: "propName",
    "floorplan name": "floorplan",
    floorplan: "floorplan",
    beds: "beds",
    baths: "baths",
    "# units": "units",
    units: "units",
    sqft: "sqft",
    "sq ft": "sqft",
    "rent (leased)": "leasedRent",
    rent: "leasedRent",
    psf: "psf",
    ner: "ner",
    "ner psf": "nerPsf",
    "# active listings": "activeListings",
    "active listings": "activeListings",
    "active listing rent": "activeRent",
    "active ner": "activeNer",
    "days on mkt": "dom",
    "days on market": "dom",
  };
  // First pass: map named columns (first occurrence only to avoid duplicates)
  for (var ci = 0; ci < hdr.length; ci++) {
    if (!hdr[ci] || typeof hdr[ci] !== "string") continue;
    var normalized = hdr[ci].trim().toLowerCase();
    if (colNames[normalized] && colMap[colNames[normalized]] === undefined)
      colMap[colNames[normalized]] = ci;
  }
  // Second pass: use sub-header row (headerIdx - 1) to identify 30/60/90 day Rent columns
  var subHdrRow = headerIdx > 0 ? rows[headerIdx - 1] : null;
  if (subHdrRow) {
    for (var si = 0; si < subHdrRow.length; si++) {
      var sh = String(subHdrRow[si] || "")
        .trim()
        .toLowerCase();
      // Match "30" / "60" / "90" followed by "Day Leased Rents" in adjacent cell
      var shNext =
        si + 1 < subHdrRow.length
          ? String(subHdrRow[si + 1] || "")
              .trim()
              .toLowerCase()
          : "";
      if (
        sh === "30" ||
        /30.*day.*leased/i.test(sh) ||
        /30.*day.*leased/i.test(sh + " " + shNext)
      ) {
        // The "Rent" column at this position is rent30
        if (
          colMap.rent30 === undefined &&
          hdr[si] &&
          /rent/i.test(String(hdr[si]))
        )
          colMap.rent30 = si;
      }
      if (
        sh === "60" ||
        /60.*day.*leased/i.test(sh) ||
        /60.*day.*leased/i.test(sh + " " + shNext)
      ) {
        if (
          colMap.rent60 === undefined &&
          hdr[si] &&
          /rent/i.test(String(hdr[si]))
        )
          colMap.rent60 = si;
      }
      if (
        sh === "90" ||
        /90.*day.*leased/i.test(sh) ||
        /90.*day.*leased/i.test(sh + " " + shNext)
      ) {
        if (
          colMap.rent90 === undefined &&
          hdr[si] &&
          /rent/i.test(String(hdr[si]))
        )
          colMap.rent90 = si;
      }
      if (/active.listing/i.test(sh)) {
        if (
          colMap.activeRent === undefined &&
          hdr[si] &&
          /rent/i.test(String(hdr[si]))
        )
          colMap.activeRent = si;
      }
    }
  }
  // Fallback: pattern match in header row itself
  for (var ci2 = 0; ci2 < hdr.length; ci2++) {
    if (!hdr[ci2] || typeof hdr[ci2] !== "string") continue;
    var nm = hdr[ci2].trim().toLowerCase();
    if (/30.day.*leased.*rent/i.test(nm) && colMap.rent30 === undefined)
      colMap.rent30 = ci2;
    if (/60.day.*leased.*rent/i.test(nm) && colMap.rent60 === undefined)
      colMap.rent60 = ci2;
    if (/90.day.*leased.*rent/i.test(nm) && colMap.rent90 === undefined)
      colMap.rent90 = ci2;
  }
  if (colMap.beds === undefined) return null;

  // Extract subject property name from filename
  var subjectName = _extractSubjectName(fileName || "");

  // Parse data rows — filter for subject property
  var dataRows = [];
  for (var di = headerIdx + 1; di < rows.length; di++) {
    var dr = rows[di];
    if (!dr) continue;
    // Filter by property name if we have the column and a subject name
    if (colMap.propName !== undefined && subjectName) {
      var pName = dr[colMap.propName];
      if (!pName || typeof pName !== "string") continue;
      // Fuzzy match: check if subject name is contained in property name or vice versa
      var pLower = pName.trim().toLowerCase();
      var sLower = subjectName.toLowerCase();
      if (pLower.indexOf(sLower) < 0 && sLower.indexOf(pLower) < 0) continue;
    }
    var beds = dr[colMap.beds];
    if (beds === null || beds === undefined || beds === "") continue;
    beds = parseInt(beds, 10);
    if (isNaN(beds)) continue;

    function _pf(col) {
      return col !== undefined ? parseFloat(dr[col]) || 0 : 0;
    }
    function _pi(col) {
      return col !== undefined ? parseInt(dr[col], 10) || 0 : 0;
    }
    dataRows.push({
      beds: beds,
      floorplan:
        colMap.floorplan !== undefined ? dr[colMap.floorplan] || "" : "",
      units: _pi(colMap.units),
      sqft: _pi(colMap.sqft),
      leasedRent: _pf(colMap.leasedRent),
      ner: _pf(colMap.ner),
      activeRent: _pf(colMap.activeRent),
      activeNer: _pf(colMap.activeNer),
      rent30: _pf(colMap.rent30),
      ner30: _pf(colMap.ner30),
      rent60: _pf(colMap.rent60),
      ner60: _pf(colMap.ner60),
      rent90: _pf(colMap.rent90),
      ner90: _pf(colMap.ner90),
      psf: _pf(colMap.psf),
      activeListings: _pi(colMap.activeListings),
      dom: _pf(colMap.dom),
    });
  }
  // Also collect ALL rows (unfiltered) for sqft→beds/floorplan mapping
  var allRows = [];
  for (var ai = headerIdx + 1; ai < rows.length; ai++) {
    var ar = rows[ai];
    if (!ar) continue;
    var aBeds = ar[colMap.beds];
    if (aBeds === null || aBeds === undefined || aBeds === "") continue;
    aBeds = parseInt(aBeds, 10);
    if (isNaN(aBeds)) continue;
    var aSqft =
      colMap.sqft !== undefined ? parseInt(ar[colMap.sqft], 10) || 0 : 0;
    if (!aSqft) continue;
    allRows.push({
      beds: aBeds,
      sqft: aSqft,
      floorplan:
        colMap.floorplan !== undefined ? ar[colMap.floorplan] || "" : "",
    });
  }

  if (!dataRows.length) return null;

  // Attach allRows for broader sqft matching (naming/beds lookup)
  dataRows._allRows = allRows;
  return dataRows;
}

// ── HelloData Rent Comps Parser — extract subject property data ──────────
function _parseHelloDataRentComps(arrayBuffer) {
  if (typeof XLSX === "undefined") return null;
  var wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  var ws = wb.Sheets["Rent Comps"];
  if (!ws) return null;
  var rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  // Find header row — look for "# Units" column
  var headerIdx = -1;
  var colMap = {};
  for (var h = 0; h < Math.min(rows.length, 10); h++) {
    var row = rows[h];
    if (!row) continue;
    for (var c = 0; c < row.length; c++) {
      if (row[c] && typeof row[c] === "string" && /# *units/i.test(row[c])) {
        headerIdx = h;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (headerIdx < 0) return null;
  // Map all header columns
  var hdr = rows[headerIdx];
  for (var ci = 0; ci < hdr.length; ci++) {
    if (!hdr[ci] || typeof hdr[ci] !== "string") continue;
    var norm = hdr[ci].trim().toLowerCase();
    if (/^property$/i.test(norm) || /property *name/i.test(norm))
      colMap.property = ci;
    if (/^address$/i.test(norm)) colMap.address = ci;
    if (/# *units/i.test(norm)) colMap.units = ci;
    if (/yr *built/i.test(norm) || /year *built/i.test(norm))
      colMap.yrBuilt = ci;
    if (
      /leased *%/i.test(norm) ||
      /^leased$/i.test(norm) ||
      /occupancy/i.test(norm)
    )
      colMap.leasedPct = ci;
  }
  if (colMap.units === undefined) return null;
  // Subject property is the first data row (row after header)
  var subjectRow = rows[headerIdx + 1];
  if (!subjectRow) return null;
  var units = parseInt(subjectRow[colMap.units], 10);
  if (isNaN(units) || units <= 0) return null;
  var result = {
    units: units,
    propertyName:
      colMap.property !== undefined
        ? subjectRow[colMap.property] || ""
        : subjectRow[0] || "",
  };
  if (colMap.address !== undefined && subjectRow[colMap.address]) {
    result.address = String(subjectRow[colMap.address]).trim();
  }
  if (colMap.yrBuilt !== undefined && subjectRow[colMap.yrBuilt]) {
    var yb = parseInt(subjectRow[colMap.yrBuilt], 10);
    if (!isNaN(yb) && yb > 1800) result.yrBuilt = yb;
  }
  if (colMap.leasedPct !== undefined && subjectRow[colMap.leasedPct] != null) {
    var lp = parseFloat(subjectRow[colMap.leasedPct]);
    if (!isNaN(lp)) {
      // If value > 1, treat as percentage already; else multiply by 100
      result.leasedPct = lp > 1 ? lp : lp * 100;
    }
  }
  return result;
}
function getHDRentComps(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_rc_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function _saveHDRentComps(pid, d) {
  localStorage.setItem("hd_rc_" + (pid || currentProjectId), JSON.stringify(d));
}

// ── HelloData Pro Forma Model: Deal Assumptions parser ──────────
function _parseHelloDataDealAssumptions(arrayBuffer) {
  if (typeof XLSX === "undefined") return null;
  var wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  var ws = wb.Sheets["Pro Forma Model"];
  if (!ws) return null;
  var rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  var result = {};
  var inDealSection = false;
  for (var i = 0; i < Math.min(rows.length, 30); i++) {
    var r = rows[i];
    if (!r) continue;
    var label = String(r[0] || "").trim();
    if (/deal.assumption/i.test(label)) {
      inDealSection = true;
      continue;
    }
    if (/capital.improvement/i.test(label)) break; // end of Deal Assumptions
    if (!inDealSection || !label) continue;
    // Value is in col 1-4 (Deal Assumptions area, before Financing at col 5+)
    var val = null;
    for (var c = 1; c <= 4 && c < r.length; c++) {
      if (r[c] != null && typeof r[c] === "number") {
        val = r[c];
        break;
      }
    }
    if (val != null) result[label] = val;
  }
  // Also parse Financing Assumptions (col 5=label, col 7=Financing, col 8=Refi Loan)
  var financing = {};
  for (var fi = 0; fi < Math.min(rows.length, 25); fi++) {
    var fr = rows[fi];
    if (!fr) continue;
    if (fr[5] == null || typeof fr[5] !== "string") continue;
    var fLabel = fr[5].trim();
    if (!fLabel || /financing.assumption/i.test(fLabel)) continue;
    if (/sources|uses|capital.improvement/i.test(String(fr[0] || ""))) continue;
    var fVal = fr[7] != null && typeof fr[7] === "number" ? fr[7] : null;
    var rVal = fr[8] != null && typeof fr[8] === "number" ? fr[8] : null;
    if (fVal != null || rVal != null) {
      financing[fLabel] = { financing: fVal, refiLoan: rVal };
    }
  }
  if (Object.keys(financing).length > 0) result._financing = financing;

  return Object.keys(result).length > 0 ? result : null;
}
function getHDDealAssumptions(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_deal_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function _saveHDDealAssumptions(pid, d) {
  localStorage.setItem(
    "hd_deal_" + (pid || currentProjectId),
    JSON.stringify(d),
  );
}

// Find HD value by partial label match → returns number or null
function _hdVal(data, searchLabel) {
  if (!data || !searchLabel) return null;
  var sl = searchLabel.toLowerCase();
  // Exact match
  if (data[searchLabel]) return data[searchLabel][_hdTier];
  // Partial match: search label starts with first word(s) of searchLabel
  var words = sl.split(" ").slice(0, 2).join(" ");
  var found = null;
  Object.keys(data).forEach(function (k) {
    if (!found && k.toLowerCase().includes(words)) found = data[k][_hdTier];
  });
  return found;
}

// Build hdLookupFn for buildAccordion — returns {status, val} or null
function _buildHDLookup(pid) {
  var data = getHDData(pid);
  if (!data) return null;
  return function (secId) {
    var hdLabel = HD_SEC_MAP[secId];
    if (hdLabel === undefined) return null; // secId not in map
    if (hdLabel === null) return { status: "t12only" }; // T12 only
    if (hdLabel === "locked") return { status: "locked" };
    if (hdLabel === "excluded") return { status: "excluded" };
    var val = _hdVal(data, hdLabel);
    if (val === null) return { status: "nodata" };
    return { status: "ok", val: val };
  };
}

// Upload handler
// Extract report date from HD filename: "Cedar Run Apartments-05-08-2025.xlsx" → "2025-05-08"
function _extractHDReportDate(fileName) {
  // Match MM-DD-YYYY at end of filename (before extension)
  var m = fileName.match(/(\d{2})-(\d{2})-(\d{4})\.\w+$/);
  if (m) return m[3] + "-" + m[1] + "-" + m[2]; // → YYYY-MM-DD
  // Match YYYY-MM-DD
  var m2 = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  return null;
}

function handleHDUpload(evt) {
  var file = evt.target && evt.target.files && evt.target.files[0];
  if (!file) return;
  var pid = currentProjectId;

  // Store original file as dataUrl for preview
  var previewReader = new FileReader();
  previewReader.onload = function (e) {
    try {
      // Clean up old file data to free space
      _cleanupOldFileData(pid);
      localStorage.setItem("hd_file_" + pid, e.target.result);
    } catch (ex) {
      console.warn("[HD preview] localStorage quota exceeded");
    }
  };
  previewReader.readAsDataURL(file);

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var parsed = _parseHelloDataFA(e.target.result);
      var umix = _parseHelloDataUnitMix(e.target.result, file.name);
      var rc = _parseHelloDataRentComps(e.target.result);
      var deal = _parseHelloDataDealAssumptions(e.target.result);
      if (!parsed && !umix) {
        toast("No Financial Analysis or Unit Mix sheet found", "error");
        return;
      }
      var reportDate =
        _extractHDReportDate(file.name) ||
        new Date().toISOString().slice(0, 10);
      if (parsed) _saveHDData(pid, parsed);
      if (umix) {
        _saveHDUnitMix(pid, umix);
        setHDUmixHidden(pid, false); // reset hidden on new upload
      }
      if (rc) _saveHDRentComps(pid, rc);
      if (deal) _saveHDDealAssumptions(pid, deal);
      _saveHDMeta(pid, {
        fileName: file.name,
        date: new Date().toISOString().slice(0, 10),
        reportDate: reportDate,
        rows: parsed ? Object.keys(parsed).length : 0,
        umixRows: umix ? umix.length : 0,
        units: rc ? rc.units : null,
      });
      _refreshHDUploadUI();
      _renderHDParsedContent();
      buildPFTable();
      buildPFUnitMix();
      if (typeof populateSummary === "function") populateSummary();
      var parts = [];
      if (parsed) parts.push(Object.keys(parsed).length + " FA rows");
      if (umix) parts.push(umix.length + " unit types");
      toast(
        "HelloData loaded · " + parts.join(" · ") + " · Report: " + reportDate,
        "success",
      );
    } catch (err) {
      toast("Parse error: " + err.message, "error");
    }
    var hdInputEl = document.getElementById("hdFileInput");
    if (hdInputEl) hdInputEl.value = "";
  };
  reader.readAsArrayBuffer(file);
}
window.handleHDUpload = handleHDUpload;

function clearHDData() {
  var pid = currentProjectId;
  localStorage.removeItem("hd_fa_" + pid);
  localStorage.removeItem("hd_meta_" + pid);
  localStorage.removeItem("hd_sel_" + pid);
  localStorage.removeItem("hd_modsrc_" + pid);
  localStorage.removeItem("hd_umix_" + pid);
  localStorage.removeItem("hd_umix_all_" + pid);
  localStorage.removeItem("hd_umix_hidden_" + pid);
  localStorage.removeItem("hd_file_" + pid);
  localStorage.removeItem("hd_rc_" + pid);
  localStorage.removeItem("hd_deal_" + pid);
  _refreshHDUploadUI();
  _renderHDParsedContent();
  buildPFTable();
  buildPFUnitMix();
  _helloDataMock = {};
  if (typeof populateSummary === "function") populateSummary();
  toast(currentLang === "zh" ? "HelloData 数据已移除" : "HelloData removed");
}
window.clearHDData = clearHDData;

function _refreshHDUploadUI() {
  var pid = currentProjectId;
  var meta = getHDMeta(pid);
  var btn = document.getElementById("hdUploadBtn");
  var delBtn = document.getElementById("hdDeleteBtn");
  var dropZone = document.getElementById("hdDropZone");
  var info = document.getElementById("hdFileInfo");
  var dot = document.getElementById("tabdot-hd");
  if (meta) {
    if (btn) btn.style.display = "none";
    if (delBtn) delBtn.style.display = "";
    if (dropZone) dropZone.style.display = "none";
    if (info)
      info.innerHTML =
        '<span style="color:var(--green);font-weight:600">' +
        meta.fileName +
        "</span>" +
        " · <span>Report: " +
        (meta.reportDate || meta.date) +
        "</span>" +
        " · <span>" +
        meta.rows +
        " rows parsed</span>";
    if (dot) dot.style.display = "inline-block";
  } else {
    if (btn) btn.style.display = "";
    if (delBtn) delBtn.style.display = "none";
    if (dropZone) dropZone.style.display = "";
    if (info) {
      info.textContent =
        currentLang === "zh"
          ? "未上传文件 · 异步导出数据集(.xlsx)"
          : "No file uploaded · Async export (.xlsx)";
    }
    if (dot) dot.style.display = "none";
  }
}
window._refreshHDUploadUI = _refreshHDUploadUI;

function handleHDDrop(evt) {
  var files = evt.dataTransfer ? evt.dataTransfer.files : null;
  if (!files || !files.length) return;
  handleHDUpload({ target: { files: files } });
}
window.handleHDDrop = handleHDDrop;

function _renderHDParsedContent() {
  var container = document.getElementById("hdParsedContent");
  if (!container) return;
  var pid = currentProjectId;
  var meta = getHDMeta(pid);
  if (!meta) {
    container.style.display = "none";
    return;
  }
  container.style.display = "";
  // Show preview card instead of parsed table
  var hdFileObj = {
    id: "hd_" + pid,
    name: meta.fileName || "HelloData.xlsx",
    size: null,
    type: "HelloData",
    parsedAs: "HelloData",
    date: meta.date || "",
    status: "parsed",
  };
  container.innerHTML = _buildFilePreviewCard(hdFileObj, {
    previewAction: "_previewHDFile()",
    previewBtnId: "hdPreviewBtn",
  });
}

// HD toggles are now inline per section — this just cleans up any legacy HD header cells
function _updateHDTableHeaders() {
  ["pfRevColHdrRow", "pfExpColHdrRow"].forEach(function (id) {
    var row = document.getElementById(id);
    if (row)
      row.querySelectorAll(".hd-th").forEach(function (el) {
        el.remove();
      });
  });
}
// Module-level source selection: {rev:'t12'|'hd', exp:'t12'|'hd'}
function getModuleSrc(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("hd_modsrc_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}
function saveModuleSrc(pid, obj) {
  localStorage.setItem("hd_modsrc_" + pid, JSON.stringify(obj));
}
function setModuleSrc(mod, src) {
  var pid = currentProjectId;
  var sel = getModuleSrc(pid) || {};
  sel[mod] = src; // mod='rev'|'exp', src='t12'|'hd'
  saveModuleSrc(pid, sel);
  buildPFTable();
}
window.setModuleSrc = setModuleSrc;

// Build HD line items from parsed HD data
// Returns array of {label, vals[], isHD:true} + a total row with isTotal:true
function _buildHDItems(hdData, type, nCols, growthRate) {
  var labels = type === "rev" ? HD_INCOME_LABELS : HD_EXPENSE_LABELS;
  var items = [];
  labels.forEach(function (label) {
    var val = _hdVal(hdData, label);
    if (val === null || val === undefined) return;
    var vals = new Array(nCols).fill(null);
    vals[2] = val; // Stab column
    for (var i = 3; i < nCols; i++) {
      vals[i] = Math.round(vals[i - 1] * growthRate * 100) / 100;
    }
    items.push({ label: label, vals: vals, isHD: true });
  });
  // Total row
  var totalLabel = type === "rev" ? "Effective Gross Income" : "Total Expenses";
  var totalFromHD = _hdVal(hdData, totalLabel);
  // If no explicit HD total, sum from line items
  var stabTotal = totalFromHD;
  if (!stabTotal) {
    stabTotal = 0;
    items.forEach(function (it) {
      stabTotal += it.vals[2] || 0;
    });
  }
  var totVals = new Array(nCols).fill(null);
  totVals[2] = stabTotal;
  for (var j = 3; j < nCols; j++) {
    totVals[j] = Math.round(totVals[j - 1] * growthRate * 100) / 100;
  }
  var totRowLabel = type === "rev" ? "Total Revenue (EGI)" : "Total Expenses";
  items.push({ label: totRowLabel, vals: totVals, isTotal: true, isHD: true });
  return items;
}

// Legacy compat — keep old functions as no-ops
function getHDSel(pid) {
  return null;
}
function saveHDSel(pid, sel) {}
function _getSecSrc(hdSel, secId) {
  return { src: "t12", val: null };
}
// ─── END HELLODATA INTEGRATION ────────────────────────────────────────────────

// ─── GL Capital: KPI Dashboard ───────────────────────────────────────────────
var PF_COLS_FULL = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];

// ─── Chart of Accounts: HD L1 (aggregation) × T12 L2 (detail) ─────────────
// Source: .claude/chart_of_accounts.md (2026-05-12 finalized)
// Structure: HD field labels at L1 (boss view), T12 line items at L2 (analyst view).
// reclass=true marks items moved from their original section per industry standard.
var PF_COA = {
  revenue: [
    {
      id: "gpr",
      label: "Gross Potential Rent",
      defaultSrc: "hd",
      notes: "HD GPR primary; T12 Rent Income shown as reference",
      children: [
        { label: "Rent Income", t12: true, role: "reference" }, // shown as supplemental, not summed
      ],
    },
    {
      id: "vc",
      label: "Vacancy & Concessions",
      defaultSrc: "mixed",
      sign: -1,
      children: [
        { label: "Concessions", t12: true }, // HD Vacancy data joined at render time
      ],
    },
    {
      id: "parking",
      label: "Parking Income",
      defaultSrc: "hd",
      notes: "No Parking income for this property",
      children: [],
    },
    {
      id: "other",
      label: "Other Income",
      defaultSrc: "t12",
      children: [
        { label: "Other Rental Income", t12: true },
        { label: "Application Fee Income", t12: true },
        { label: "NSF Fees Collected", t12: true },
        { label: "Late Fee", t12: true },
        { label: "Pet Fee", t12: true },
        { label: "Furniture Charge", t12: true },
        { label: "Laundry Income", t12: true },
        { label: "Insurance Services", t12: true },
        { label: "Utility Reimbursement Fee", t12: true },
      ],
    },
    {
      id: "egi",
      label: "Effective Gross Income (EGI)",
      computed: true,
      formula: "gpr - vc + parking + other",
    },
  ],
  opex: [
    {
      id: "tax",
      label: "Real Estate Taxes",
      defaultSrc: "t12",
      growthKey: "tax",
      children: [{ label: "Property Tax", t12: true }],
    },
    {
      id: "ins",
      label: "Property Insurance",
      defaultSrc: "t12",
      children: [
        { label: "Property Insurance", t12: true },
        { label: "Insurance - Other", t12: true },
      ],
    },
    {
      id: "util",
      label: "Utilities",
      defaultSrc: "t12",
      children: [
        { label: "Electricity", t12: true },
        { label: "Gas", t12: true },
        { label: "Water", t12: true },
        // No separate Sewer / Trash Removal line in default COA
        {
          label: "Garbage & Recycling",
          t12: true,
          reclass: "Moved from Cleaning & Janitorial per industry standard",
        },
      ],
    },
    {
      id: "rm",
      label: "Repair and Maintenance",
      defaultSrc: "t12",
      children: [
        { label: "Cleaning & Janitorial", t12: true },
        { label: "Maintenance Labor", t12: true },
        { label: "Pest Control", t12: true },
        { label: "Plumbing", t12: true },
        { label: "HVAC", t12: true },
        { label: "Sub Contractor", t12: true },
        { label: "Security Service", t12: true },
        { label: "Roof / Exterior", t12: true },
        { label: "Elevator Contract", t12: true },
        { label: "Elevator Repair", t12: true },
        { label: "Appliance Repair", t12: true },
        { label: "Repairs - Other", t12: true },
      ],
    },
    {
      id: "mgmt",
      label: "Management Fees",
      defaultSrc: "t12",
      children: [
        { label: "Management Fee", t12: true },
        { label: "Commissions / Placement", t12: true },
      ],
    },
    {
      id: "payroll",
      label: "Payroll and Benefits",
      defaultSrc: "t12",
      children: [
        {
          label: "Salary Expense",
          t12: true,
          reclass: "Moved from Administrative per HD framework alignment",
        },
      ],
    },
    {
      id: "mktg",
      label: "Marketing",
      defaultSrc: "t12",
      children: [
        { label: "Advertising", t12: true },
        { label: "Meetings & Events", t12: true },
      ],
    },
    {
      id: "prof",
      label: "Professional Fees",
      defaultSrc: "t12",
      children: [
        { label: "Accounting", t12: true },
        { label: "Appfolio / Yardi", t12: true },
      ],
    },
    {
      id: "ga",
      label: "General and Administrative",
      defaultSrc: "t12",
      children: [
        { label: "Office Expense", t12: true },
        { label: "Bank Fees", t12: true },
        { label: "Telephone / WiFi", t12: true },
        { label: "Supplies", t12: true },
        { label: "Inspection Costs", t12: true },
        { label: "Licenses & Registration", t12: true },
        { label: "Taxes - Other", t12: true },
      ],
    },
    {
      id: "other_exp",
      label: "Other Expenses",
      defaultSrc: "t12",
      notes: "Catchall for future expansion",
      children: [],
    },
    {
      id: "total_opex",
      label: "Total Operating Expenses",
      computed: true,
      formula: "sum(L1 OpEx)",
    },
  ],
  // Below the line — moved out of OpEx, displayed under NOI
  belowLine: [
    {
      id: "mortgage",
      label: "Mortgage Interest",
      target: "Debt Service tab",
      note: "See Debt Analysis",
    },
    {
      id: "depreciation",
      label: "Depreciation",
      hidden: "default",
      note: "Non-cash, hidden by default",
    },
    {
      id: "amortization",
      label: "Amortization",
      hidden: "default",
      note: "Non-cash, hidden by default",
    },
  ],
};

// Reverse lookup: T12 label → L1 id (for routing T12 data into chart of accounts buckets)
var PF_T12_TO_L1 = (function () {
  var m = {};
  ["revenue", "opex"].forEach(function (grp) {
    PF_COA[grp].forEach(function (l1) {
      (l1.children || []).forEach(function (c) {
        if (c.t12) m[c.label] = l1.id;
      });
    });
  });
  return m;
})();

// L1 → display order index (for sorting children into chart of accounts order)
var PF_L1_ORDER = (function () {
  var o = {};
  ["revenue", "opex"].forEach(function (grp) {
    PF_COA[grp].forEach(function (l1, idx) {
      o[l1.id] = idx;
    });
  });
  return o;
})();

// L1 → display label
var PF_L1_LABEL = (function () {
  var l = {};
  ["revenue", "opex"].forEach(function (grp) {
    PF_COA[grp].forEach(function (l1) {
      l[l1.id] = l1.label;
    });
  });
  return l;
})();

// L1 fold state — persisted per project in localStorage
function _getL1Fold(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("pf_l1_fold_" + (pid || currentProjectId)) || "{}",
    );
  } catch (e) {
    return {};
  }
}
function _setL1Fold(pid, state) {
  localStorage.setItem(
    "pf_l1_fold_" + (pid || currentProjectId),
    JSON.stringify(state || {}),
  );
}
function toggleL1Fold(l1id) {
  var pid = currentProjectId;
  var s = _getL1Fold(pid);
  s[l1id] = !s[l1id];
  _setL1Fold(pid, s);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.toggleL1Fold = toggleL1Fold;

// L2 fold state — per project, keyed by T12 section name (controls L3 leaf visibility)
function _getL2Fold(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("pf_l2_fold_" + (pid || currentProjectId)) || "{}",
    );
  } catch (e) {
    return {};
  }
}
function _setL2Fold(pid, s) {
  localStorage.setItem(
    "pf_l2_fold_" + (pid || currentProjectId),
    JSON.stringify(s || {}),
  );
}
function toggleL2Fold(secName) {
  var pid = currentProjectId;
  var s = _getL2Fold(pid);
  s[secName] = !s[secName];
  _setL2Fold(pid, s);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.toggleL2Fold = toggleL2Fold;

// Origination Fee = % × New Loan Size (from Refinance Event tab)
// ─── Closing Costs: row & total recalculation ────────────────────────────
function _ccGetPurchasePrice() {
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  return (proj && proj.offerPrice) || 0;
}
function _ccGetNewLoanSize() {
  var el = document.getElementById("refiNewLoanSize");
  if (!el) return 0;
  return parseFloat((el.textContent || "").replace(/[\$,\s\u00a0]/g, "")) || 0;
}

function recalcClosingCostRow(inputEl) {
  if (!inputEl) return;
  var ccType = inputEl.getAttribute("data-cc-type");
  var ccId = inputEl.getAttribute("data-cc-id");
  if (!ccId) return;
  var pctRaw = (inputEl.value || "").trim().replace("%", "").replace(/,/g, "");
  var pct = parseFloat(pctRaw);
  if (isNaN(pct)) return;
  var base =
    ccType === "pct-loan" ? _ccGetNewLoanSize() : _ccGetPurchasePrice();
  var amtEl = document.getElementById(ccId + "Amt");
  if (!amtEl || base <= 0) return;
  var amt = (pct / 100) * base;
  amtEl.textContent = "$\u00a0" + Math.round(amt).toLocaleString();
  recalcClosingCostTotals();
}
window.recalcClosingCostRow = recalcClosingCostRow;

// Legacy alias
function recalcOriginationFee() {
  var el = document.getElementById("ccOrigFeePct");
  if (el) recalcClosingCostRow(el);
}
window.recalcOriginationFee = recalcOriginationFee;

function recalcClosingCostTotals() {
  // Re-compute all pct rows with current Purchase Price / Loan Size
  document
    .querySelectorAll("#pfsp-pf-closing .cc-pct-input")
    .forEach(function (inp) {
      var val = (inp.value || "").trim();
      if (val) recalcClosingCostRow(inp);
    });
  var total = 0;
  document
    .querySelectorAll("#pfsp-pf-closing .cc-row .amount-col")
    .forEach(function (td) {
      var txt = (td.textContent || "").replace(/[\$,\s\u00a0]/g, "");
      var v = parseFloat(txt);
      if (!isNaN(v)) total += v;
    });
  var totalEl = document.getElementById("ccTotalAmt");
  var pctEl = document.getElementById("ccTotalPct");
  if (totalEl)
    totalEl.textContent =
      total > 0 ? "$\u00a0" + Math.round(total).toLocaleString() : "—";
  var purchase = _ccGetPurchasePrice();
  if (pctEl) {
    // Computed: Total / Purchase Price
    var computedPct = total > 0 && purchase > 0 ? (total / purchase) * 100 : 0;
    // HD source: Pro Forma Model → Deal Assumptions → Closing Costs
    var deal = getHDDealAssumptions(currentProjectId);
    var hdPct =
      deal && deal["Closing Costs"] != null ? deal["Closing Costs"] : null;
    if (hdPct != null) hdPct = hdPct <= 1 ? hdPct * 100 : hdPct; // normalize to %

    if (computedPct > 0) {
      pctEl.textContent = computedPct.toFixed(2) + "%";
      // Show HD comparison if available and different
      if (hdPct != null && Math.abs(hdPct - computedPct) > 0.01) {
        pctEl.title =
          "Computed: " +
          computedPct.toFixed(2) +
          "% · HD Deal Assumptions: " +
          hdPct.toFixed(2) +
          "%";
      }
    } else if (hdPct != null && hdPct > 0) {
      pctEl.textContent = hdPct.toFixed(2) + "%";
      pctEl.title = "From HD Pro Forma Model: Deal Assumptions";
    } else {
      pctEl.textContent = "—";
    }
  }
}
window.recalcClosingCostTotals = recalcClosingCostTotals;

// ─── Purchase Price: auto-populate computed fields ───────────────────────
function buildPurchasePrice() {
  var pid = window._currentProjectId || currentProjectId || "default";
  var proj = getProjects().find(function (p) {
    return p.id === pid;
  });
  var deal = getHDDealAssumptions(pid);

  function _set(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function fmtM(v) {
    return v ? "$\u00a0" + Math.round(v).toLocaleString() : "—";
  }

  // 1. Purchase Price (As-is value): from project offerPrice or HD Deal Assumptions
  var ppEl = document.getElementById("ppAsIsValue");
  var pp = 0;
  if (ppEl) {
    var existing = parseFloat(
      (ppEl.textContent || "").replace(/[\$,\s\u00a0—]/g, ""),
    );
    if (!isNaN(existing) && existing > 0) {
      pp = existing;
    } else if (proj && proj.offerPrice) {
      pp = proj.offerPrice;
      ppEl.textContent = fmtM(pp);
    } else if (
      deal &&
      deal["Purchase Price"] &&
      deal["Purchase Price"] > 1000
    ) {
      pp = deal["Purchase Price"];
      ppEl.textContent = fmtM(pp);
    }
  }

  // 2. Per Unit: Purchase Price ÷ units
  var units = 0;
  var rrRows = _getRRData(pid) || RR_DATA || [];
  units = rrRows.length;
  if (!units) {
    var rc = getHDRentComps(pid);
    if (rc && rc.units) units = rc.units;
  }
  _set("ppPerUnit", pp && units ? fmtM(pp / units) : "—");

  // 3. NOI for Year 1: from acquisition year's NOI
  var asmt =
    typeof getProjectAssumptions === "function" ? getProjectAssumptions() : {};
  var ay = asmt.acquisitionYear || 2026;
  var rrMeta = typeof _getRRMeta === "function" ? _getRRMeta(pid) : null;
  var y1 = rrMeta && rrMeta.reportYear ? rrMeta.reportYear : ay - 1;
  var noiY1 = 0;
  // Try from NOI cache
  if (window._noiTotals && window._noiTotals.length > 0) {
    noiY1 = window._noiTotals[0] || 0;
  }
  _set("ppNOIY1", noiY1 ? fmtM(noiY1) : "—");

  // 4. Cap Rate: NOI ÷ Purchase Price
  _set("ppCapRateYearLabel", "Year 1");
  _set("ppCapRate", noiY1 && pp ? ((noiY1 / pp) * 100).toFixed(2) + "%" : "—");

  // 5. Closing Cost Percentage: Total Closing Costs ÷ Purchase Price
  var ccTotalEl = document.getElementById("ccTotalAmt");
  var ccTotal = ccTotalEl
    ? parseFloat((ccTotalEl.textContent || "").replace(/[\$,\s\u00a0—]/g, ""))
    : 0;
  if (isNaN(ccTotal)) ccTotal = 0;
  _set(
    "ppClosingPct",
    ccTotal && pp ? ((ccTotal / pp) * 100).toFixed(2) + "%" : "—",
  );

  // 6. Closing Costs: from Closing Costs tab total
  _set("ppClosingCosts", ccTotal ? fmtM(ccTotal) : "—");

  // 7. Total Acquisition Cost: Closing Costs + Purchase Price
  var totalAcq = pp + ccTotal;
  _set("ppTotalAcqCost", totalAcq > 0 ? fmtM(totalAcq) : "—");

  // 8. Total Cost (excludes capex): same as Total Acquisition Cost
  _set("ppTotalCost", totalAcq > 0 ? fmtM(totalAcq) : "—");
}
window.buildPurchasePrice = buildPurchasePrice;

// Project-level units override (used by all rows in Revenue & Expenses tables)
// Units source for Revenue & Expenses: 'hd' | 'rr-total' | 'rr-occupied' | 'manual'
function _getUnitsSrc(pid) {
  return (
    localStorage.getItem("pf_units_src_" + (pid || currentProjectId)) || "auto"
  );
}
function setUnitsSrc(src) {
  localStorage.setItem("pf_units_src_" + currentProjectId, src);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.setUnitsSrc = setUnitsSrc;

function _getRROccupiedUnits(pid) {
  var rows = _getRRData(pid || currentProjectId);
  if (!rows || !rows.length) return 0;
  return rows.filter(function (r) {
    return r.status === "Occupied";
  }).length;
}

function _getRRTotalUnits(pid) {
  var rows = _getRRData(pid || currentProjectId);
  return rows ? rows.length : 0;
}

function _resolveUnits(pid) {
  // Units source follows Summary's Total Apartment Units selection
  var summSrc = (window._pfSourceSel && window._pfSourceSel.units) || "rr";
  if (
    summSrc === "manual" &&
    window._pfManualVals &&
    window._pfManualVals.units
  ) {
    return parseInt(window._pfManualVals.units, 10) || 0;
  }
  if (summSrc === "api") {
    return _getHDUnits(pid) || 0;
  }
  if (summSrc === "rr") {
    var rr = _getRRTotalUnits(pid);
    if (rr) return rr;
    // No RR data — fallback to HD if available
    var hdFb = _getHDUnits(pid);
    if (hdFb) return hdFb;
  }
  // Last resort: try any available source
  var rrAny = _getRRTotalUnits(pid);
  if (rrAny) return rrAny;
  var hdAny = _getHDUnits(pid);
  if (hdAny) return hdAny;
  return 0;
}

function changeProjUnits(val) {
  var n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return;
  localStorage.setItem("pf_units_src_" + currentProjectId, "manual");
  var projs = getProjects();
  var idx = projs.findIndex(function (p) {
    return p.id === currentProjectId;
  });
  if (idx === -1) return;
  if (!projs[idx].assumptions) projs[idx].assumptions = {};
  projs[idx].assumptions.units = n;
  saveProjects(projs);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.changeProjUnits = changeProjUnits;

// EGI source state — 'hd' | 'computed' | 'manual' (default: hd if HD has data, else computed)
function _getEgiSrc(pid) {
  var stored = localStorage.getItem("pf_egi_src_" + (pid || currentProjectId));
  if (stored) return stored;
  return HD_L1_AGGREGATE_PER_UNIT_MONTHLY &&
    HD_L1_AGGREGATE_PER_UNIT_MONTHLY.egi
    ? "hd"
    : "computed";
}
function setEgiSrc(src) {
  localStorage.setItem("pf_egi_src_" + currentProjectId, src);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.setEgiSrc = setEgiSrc;

// ─── T12 Sections Parser ────────────────────────────────────────────────────
// Walks a flat PF_DATA.revenue/expenses array and groups leaves under their section header.
// Returns { sectionName: { leaves: [{label,vals}], total: [vals] } }
function _parseT12Sections(arr) {
  var sections = {};
  var current = null;
  (arr || []).forEach(function (item) {
    if (item.isSectionHdr) {
      current = item.label;
      sections[current] = { leaves: [], total: null };
      return;
    }
    if (item.isTotal || item.isPct) return; // skip overall totals
    if (!current) return;
    sections[current].leaves.push({ label: item.label, vals: item.vals });
  });
  Object.keys(sections).forEach(function (name) {
    var sec = sections[name];
    if (!sec.leaves.length) return;
    var n = sec.leaves[0].vals.length;
    sec.total = new Array(n).fill(0);
    sec.leaves.forEach(function (l) {
      l.vals.forEach(function (v, i) {
        if (typeof v === "number") sec.total[i] += v;
      });
    });
  });
  return sections;
}
// T12 section lookups — read from project-specific localStorage, fallback to global PF_DATA
function _t12RevSections() {
  var pf = _getProjectPFData(currentProjectId) || PF_DATA || {};
  return _parseT12Sections(pf.revenue);
}
function _t12ExpSections() {
  var pf = _getProjectPFData(currentProjectId) || PF_DATA || {};
  return _parseT12Sections(pf.expenses);
}
// Find which section a T12 leaf label belongs to (returns section name or null)
function _t12SectionOfLeaf(label, group) {
  var secs = group === "opex" ? _t12ExpSections() : _t12RevSections();
  for (var name in secs) {
    if (
      (secs[name].leaves || []).some(function (l) {
        return l.label === label;
      })
    )
      return name;
  }
  return null;
}

// ─── L1 Children Mapping (User-selected T12 fields linked to HD L1) ─────────
// State shape: { l1id: [{kind:'leaf', t12label:'X'} | {kind:'section', t12section:'Y'}] }
// Old format (string array) is auto-migrated to {kind:'leaf', t12label}.
function _getL1Children(pid) {
  try {
    var raw = JSON.parse(
      localStorage.getItem("pf_l1_children_" + (pid || currentProjectId)) ||
        "{}",
    );
    var out = {};
    Object.keys(raw).forEach(function (k) {
      var arr = raw[k];
      if (!Array.isArray(arr)) {
        out[k] = [];
        return;
      }
      out[k] = arr
        .map(function (x) {
          if (typeof x === "string") return { kind: "leaf", t12label: x };
          if (
            x &&
            (x.kind === "leaf" ||
              x.kind === "section" ||
              x.kind === "hd-default")
          )
            return x;
          return null;
        })
        .filter(Boolean);
    });
    // Auto-init: any L1 not yet in state gets a default HD-default L2 row.
    // Note: EGI, total_opex are computed rows (not user-curated) — they have source switch instead.
    var _autoInitL1s = [
      "gpr",
      "vc",
      "parking",
      "other", // Revenue (4 user-curated)
      "tax",
      "ins",
      "util",
      "rm",
      "mgmt",
      "payroll",
      "mktg",
      "prof",
      "ga",
      "other_exp",
    ]; // Expenses (10 user-curated)
    _autoInitL1s.forEach(function (id) {
      if (!(id in out)) out[id] = [{ kind: "hd-default" }];
    });
    return out;
  } catch (e) {
    return {};
  }
}
function _setL1Children(pid, map) {
  localStorage.setItem(
    "pf_l1_children_" + (pid || currentProjectId),
    JSON.stringify(map || {}),
  );
}
// Find which L1 a given T12 leaf label is linked under (as standalone leaf OR inside a section)
// Returns { l1, kind:'leaf'|'section', section?:name } or null
function _findL1ForLabel(label, map, group) {
  map = map || _getL1Children();
  for (var k in map) {
    var arr = map[k] || [];
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i];
      if (x.kind === "leaf" && x.t12label === label)
        return { l1: k, kind: "leaf" };
      if (x.kind === "section") {
        var sec = (group === "opex" ? _t12ExpSections() : _t12RevSections())[
          x.t12section
        ];
        if (
          sec &&
          (sec.leaves || []).some(function (l) {
            return l.label === label;
          })
        ) {
          return { l1: k, kind: "section", section: x.t12section };
        }
      }
    }
  }
  return null;
}
// Find which L1 a section is currently linked under
function _findL1ForSection(sectionName, map) {
  map = map || _getL1Children();
  for (var k in map) {
    var arr = map[k] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].kind === "section" && arr[i].t12section === sectionName)
        return k;
    }
  }
  return null;
}
function addL1Child(l1id, child) {
  // child = {kind:'leaf', t12label} or {kind:'section', t12section}
  var pid = currentProjectId;
  var m = _getL1Children(pid);
  // Remove existing identical entries first
  Object.keys(m).forEach(function (k) {
    m[k] = (m[k] || []).filter(function (x) {
      if (child.kind === "leaf")
        return !(x.kind === "leaf" && x.t12label === child.t12label);
      if (child.kind === "section")
        return !(x.kind === "section" && x.t12section === child.t12section);
      return true;
    });
  });
  if (!m[l1id]) m[l1id] = [];
  m[l1id].push(child);
  _setL1Children(pid, m);
}
function removeL1Child(l1id, key, kind) {
  // key = label (leaf) | section name (section) | l1id (hd-default)
  var pid = currentProjectId;
  var m = _getL1Children(pid);
  if (m[l1id])
    m[l1id] = m[l1id].filter(function (x) {
      if (kind === "leaf") return !(x.kind === "leaf" && x.t12label === key);
      if (kind === "section")
        return !(x.kind === "section" && x.t12section === key);
      if (kind === "hd-default") return !(x.kind === "hd-default");
      return true;
    });
  _setL1Children(pid, m);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.removeL1Child = removeL1Child;

// Apply industry-default mapping (one-click "Auto-map") — adds T12 leaves per chart_of_accounts.md
function autoMapL1Children(group) {
  // group: 'revenue' | 'opex' | 'all'
  var pid = currentProjectId;
  var m = _getL1Children(pid);
  var groups = group === "all" ? ["revenue", "opex"] : [group];
  groups.forEach(function (g) {
    PF_COA[g].forEach(function (l1def) {
      if (l1def.computed) return;
      (l1def.children || []).forEach(function (c) {
        if (!c.t12) return;
        if (_findL1ForLabel(c.label, m, g)) return; // skip if already linked
        if (!m[l1def.id]) m[l1def.id] = [];
        m[l1def.id].push({ kind: "leaf", t12label: c.label });
      });
    });
    // Auto-map OTHERS section items to other (revenue) or other_exp (expenses)
    var othersTarget = g === "revenue" ? "other" : "other_exp";
    var secs = g === "revenue" ? _t12RevSections() : _t12ExpSections();
    if (secs["OTHERS"]) {
      (secs["OTHERS"].leaves || []).forEach(function (leaf) {
        if (_findL1ForLabel(leaf.label, m, g)) return;
        if (!m[othersTarget]) m[othersTarget] = [];
        m[othersTarget].push({ kind: "leaf", t12label: leaf.label });
      });
    }
  });
  _setL1Children(pid, m);
  if (typeof buildPFTable === "function") buildPFTable();
  if (typeof toast === "function")
    toast("Auto-mapped industry-default T12 fields");
}
window.autoMapL1Children = autoMapL1Children;

// Resolve linked children into renderable row objects (with vals + display label).
// Needs context (units, nCols, rentRate) for HD-default rendering — passed via arg.
function _resolveL1Children(l1id, group, ctx) {
  var map = _getL1Children();
  var linked = map[l1id] || [];
  var t12Lookup = {};
  var pf = _getProjectPFData(currentProjectId) || PF_DATA || {};
  var arr = group === "opex" ? pf.expenses : pf.revenue;
  (arr || []).forEach(function (it) {
    if (it.isSectionHdr || it.isTotal || it.isPct) return;
    t12Lookup[it.label] = it;
  });
  var secs = group === "opex" ? _t12ExpSections() : _t12RevSections();
  var units = (ctx && ctx.units) || 27;
  var nCols = (ctx && ctx.nCols) || 7;
  var rentRate = (ctx && ctx.rentRate) || 1.04;
  return linked
    .map(function (c) {
      if (c.kind === "leaf") {
        var item = t12Lookup[c.t12label];
        if (!item) return null;
        return {
          kind: "leaf",
          label: c.t12label,
          displayLabel: c.t12label,
          vals: item.vals.slice(),
          src: "t12",
        };
      }
      if (c.kind === "section") {
        var sec = secs[c.t12section];
        if (!sec || !sec.total) return null;
        return {
          kind: "section",
          label: c.t12section,
          displayLabel: "[" + c.t12section + "]",
          vals: sec.total.slice(),
          leafCount: sec.leaves.length,
          leaves: sec.leaves.map(function (l) {
            return { label: l.label, vals: l.vals.slice() };
          }),
          src: "t12",
        };
      }
      if (c.kind === "hd-default") {
        var annual = HD_L1_ANNUAL[l1id];
        if (annual == null) return null;
        // Y1, Y2: HD has no historical data — leave as null
        // FA median = annual total for 2026 (Stab year, column index 2)
        var vals = [null, null, annual];
        // Pick growth rate: tax → taxGrowth, other OpEx → opexGrowth, Revenue → rentGrowth
        var growthRate = (ctx && ctx.rentRate) || 1.04;
        if (group === "opex") {
          growthRate =
            l1id === "tax"
              ? (ctx && ctx.taxRate) || 1.03
              : (ctx && ctx.opexRate) || 1.03;
        }
        for (var i = 3; i < nCols; i++)
          vals.push(Math.round(vals[i - 1] * growthRate * 100) / 100);
        var hdUnits = _getHDUnits() || units;
        var perUnit = Math.round((annual / hdUnits / 12) * 100) / 100;
        var displayName = (PF_L1_LABEL[l1id] || l1id) + " (HD)";
        return {
          kind: "hd-default",
          label: l1id,
          displayLabel: displayName,
          vals: vals,
          src: "hd",
          perUnit: perUnit,
        };
      }
      return null;
    })
    .filter(Boolean);
}

// ─── Add Field Modal ─────────────────────────────────────────────────────────
var _addFieldL1Context = null; // The L1 id we're adding fields to

function openL1AddFieldModal(l1id) {
  _addFieldL1Context = l1id;
  var pid = currentProjectId;
  var pf =
    _getProjectPFData(pid) || (typeof PF_DATA !== "undefined" ? PF_DATA : null);
  if (!pf) return;
  var currentMap = _getL1Children(pid);
  var l1Label = PF_L1_LABEL[l1id] || l1id;

  // Find which group (revenue/opex) this L1 belongs to
  var group = null;
  ["revenue", "opex"].forEach(function (g) {
    if (
      PF_COA[g].some(function (x) {
        return x.id === l1id;
      })
    )
      group = g;
  });
  if (!group) return;
  var sourceArr = group === "revenue" ? pf.revenue : pf.expenses;
  if (!sourceArr) return;
  var sections = _parseT12Sections(sourceArr);

  // MVP: no recommendation logic — let user decide freely
  var recommendedSet = {};

  function _fmtAmt(v) {
    if (v == null || v === 0)
      return '<span style="color:var(--muted);font-size:10.5px">—</span>';
    if (v < 0)
      return (
        '<span style="color:#c0392b;font-size:10.5px">($' +
        Math.abs(Math.round(v)).toLocaleString() +
        ")</span>"
      );
    return (
      '<span style="color:var(--muted);font-size:10.5px">$' +
      Math.round(v).toLocaleString() +
      "</span>"
    );
  }

  // Build tree HTML: HD Default block first, then T12 sections
  var html = "";

  // HD Default block — single checkbox controlling whether L1 keeps its hd-default child
  var hdAggregate = HD_L1_AGGREGATE_PER_UNIT_MONTHLY[l1id];
  if (hdAggregate != null) {
    var hdChecked = (currentMap[l1id] || []).some(function (c) {
      return c.kind === "hd-default";
    });
    var hdAnnual =
      hdAggregate *
      12 *
      (PF_DATA.unitMix
        ? PF_DATA.unitMix.find(function (u) {
            return u.isTotal;
          }).units
        : 27);
    html += '<div style="border-bottom:2px solid rgba(21,101,192,0.2)">';
    html +=
      '<div style="padding:10px 14px;background:rgba(21,101,192,0.06);font-weight:700;font-size:11.5px;color:var(--header)">HelloData Default Aggregate</div>';
    html +=
      '<label style="display:flex;align-items:center;gap:10px;padding:8px 14px 8px 28px;cursor:pointer;font-size:12px;color:var(--body)" onmouseenter="this.style.background=\'rgba(21,101,192,0.04)\'" onmouseleave="this.style.background=\'\'">' +
      '<input type="checkbox" class="hd-default-checkbox"' +
      (hdChecked ? " checked" : "") +
      ' style="width:14px;height:14px;cursor:pointer;accent-color:#1565C0">' +
      '<span style="flex:1">' +
      l1Label +
      ' <span style="color:var(--muted);font-size:10.5px;font-weight:400;margin-left:6px">(HD aggregate)</span></span>' +
      '<span style="font-size:10px;color:var(--muted);min-width:54px;text-align:right">stab:</span>' +
      '<span style="min-width:80px;text-align:right">' +
      _fmtAmt(hdAnnual) +
      "</span>" +
      "</label>";
    html += "</div>";
  }

  Object.keys(sections).forEach(function (secName) {
    var sec = sections[secName];
    if (!sec.leaves.length) return;
    var secLatest = (sec.total || [])[1] || (sec.total || [])[0] || 0;
    var secLinkedHere = (currentMap[l1id] || []).some(function (c) {
      return c.kind === "section" && c.t12section === secName;
    });
    var secLinkedAt = _findL1ForSection(secName, currentMap);
    var secInOther = secLinkedAt && secLinkedAt !== l1id;

    var recCount = sec.leaves.filter(function (l) {
      return recommendedSet[l.label];
    }).length;
    var allRec = recCount === sec.leaves.length;

    html += '<div style="border-bottom:1px solid var(--border)">';
    html +=
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(74,124,89,0.06);font-weight:700;font-size:11.5px;color:var(--header);cursor:pointer"' +
      " onmouseenter=\"this.querySelectorAll('.hover-badge').forEach(function(b){b.style.opacity=1;})\"" +
      " onmouseleave=\"this.querySelectorAll('.hover-badge').forEach(function(b){b.style.opacity=0;})\"" +
      " onclick=\"(function(el){var box=el.parentElement.querySelector('.sec-leaves');var c=el.querySelector('.caret');if(box.style.display==='none'){box.style.display='block';c.textContent='▼';}else{box.style.display='none';c.textContent='▶';}})(this)\">";
    html +=
      '<span class="caret" style="display:inline-block;width:12px;color:#4a7c59">▼</span>';
    html +=
      '<input type="checkbox" class="sec-checkbox" data-section="' +
      secName.replace(/"/g, "&quot;") +
      '"' +
      (secLinkedHere ? " checked" : "") +
      (secInOther ? " disabled" : "") +
      ' onclick="event.stopPropagation();_l1ModalToggleSection(this)"' +
      ' style="width:16px;height:16px;cursor:pointer;accent-color:#4a7c59">';
    html +=
      '<span style="flex:1">[' +
      secName +
      '] <span style="color:var(--muted);font-weight:400;font-size:10.5px">' +
      sec.leaves.length +
      " items</span>";
    if (secInOther)
      html +=
        ' <span class="hover-badge" style="font-size:9px;padding:1px 6px;background:rgba(217,119,6,0.12);color:#d97706;border-radius:8px;font-weight:700;letter-spacing:.03em;margin-left:6px;opacity:0;transition:opacity .15s">SECTION IN ' +
        (PF_L1_LABEL[secLinkedAt] || "OTHER").toUpperCase() +
        "</span>";
    html += "</span>";
    html +=
      '<span style="font-size:10px;color:var(--muted);min-width:54px;text-align:right">total:</span>';
    html +=
      '<span style="min-width:80px;text-align:right">' +
      _fmtAmt(secLatest) +
      "</span>";
    html += "</div>";

    html += '<div class="sec-leaves" style="display:block;padding:4px 0">';
    sec.leaves.forEach(function (leaf) {
      var leafLatest = (leaf.vals || [])[1] || (leaf.vals || [])[0] || 0;
      var leafLinkedHere = (currentMap[l1id] || []).some(function (c) {
        return c.kind === "leaf" && c.t12label === leaf.label;
      });
      var link = _findL1ForLabel(leaf.label, currentMap, group);
      var leafInOther = link && link.l1 !== l1id;
      // Step B: if leaf is part of a section elsewhere, allow checking — Apply will split the section
      var leafIsInSectionElsewhere = leafInOther && link.kind === "section";
      var leafIsLeafElsewhere = leafInOther && link.kind === "leaf";
      var badges = "";
      if (typeof recommendedSet[leaf.label] === "string")
        badges +=
          ' <span title="' +
          String(recommendedSet[leaf.label]).replace(/"/g, "&quot;") +
          '" style="color:#d97706;font-size:11px;cursor:help">⚠</span>';
      if (leafInOther) {
        var lbl = leafIsInSectionElsewhere
          ? "PART OF [" +
            (link.section || "").toUpperCase() +
            "] @ " +
            (PF_L1_LABEL[link.l1] || "").toUpperCase()
          : "IN " + (PF_L1_LABEL[link.l1] || "").toUpperCase();
        var tooltip = leafIsInSectionElsewhere
          ? "Checking will split the section into individual leaves at " +
            (PF_L1_LABEL[link.l1] || "") +
            ", then move this leaf here."
          : "Currently linked at another L1 — checking will move it here.";
        badges +=
          '<span class="hover-badge" title="' +
          tooltip.replace(/"/g, "&quot;") +
          '" style="font-size:9px;padding:1px 6px;background:rgba(217,119,6,0.12);color:#d97706;border-radius:8px;font-weight:700;letter-spacing:.03em;margin-left:6px;cursor:help;opacity:0;transition:opacity .15s">' +
          lbl +
          "</span>";
      }
      // In Step B: leaves in a section elsewhere are CHECKABLE (no longer disabled)
      var disableLeaf = false; // (was: leafInOther) — keep enabled so user can move via apply
      html +=
        '<label style="display:flex;align-items:center;gap:10px;padding:6px 14px 6px 40px;cursor:pointer;font-size:12px;color:var(--body)"' +
        " onmouseenter=\"this.style.background='rgba(74,124,89,0.03)';this.querySelectorAll('.hover-badge').forEach(function(b){b.style.opacity=1;})\"" +
        " onmouseleave=\"this.style.background='';this.querySelectorAll('.hover-badge').forEach(function(b){b.style.opacity=0;})\">" +
        '<input type="checkbox" class="leaf-checkbox" data-label="' +
        leaf.label.replace(/"/g, "&quot;") +
        '" data-section="' +
        secName.replace(/"/g, "&quot;") +
        '"' +
        (leafLinkedHere ? " checked" : "") +
        (disableLeaf ? " disabled" : "") +
        ' onclick="event.stopPropagation();_l1ModalToggleLeaf(this)"' +
        ' style="width:14px;height:14px;cursor:pointer;accent-color:#4a7c59">' +
        '<span style="flex:1">' +
        leaf.label +
        badges +
        "</span>" +
        '<span style="font-size:10px;color:var(--muted);min-width:54px;text-align:right">latest:</span>' +
        '<span style="min-width:80px;text-align:right">' +
        _fmtAmt(leafLatest) +
        "</span>" +
        "</label>";
    });
    html += "</div></div>";
  });

  var modal = document.getElementById("addFieldOverlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "addFieldOverlay";
    modal.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center";
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div style="background:#fff;border-radius:12px;width:720px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden">' +
    '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">' +
    '<div style="width:32px;height:32px;border-radius:8px;background:rgba(74,124,89,0.12);color:#4a7c59;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">+</div>' +
    '<div><div style="font-size:14px;font-weight:700;color:var(--header)">Adjust Fields → ' +
    l1Label +
    "</div>" +
    '<div style="font-size:11px;color:var(--muted)">Toggle HD aggregate and T12 fields. L1 total = sum of all checked items.</div></div>' +
    '<button onclick="closeL1AddFieldModal()" style="margin-left:auto;background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;padding:4px 8px">×</button>' +
    "</div>" +
    '<div id="addFieldList" style="flex:1;overflow-y:auto;max-height:55vh">' +
    html +
    "</div>" +
    '<div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">' +
    '<span style="font-size:11px;color:var(--muted)">Linking a field moves it from any other L1.</span>' +
    '<button onclick="closeL1AddFieldModal()" style="margin-left:auto;padding:8px 16px;border:1px solid var(--border);background:#fff;border-radius:7px;font-size:12px;color:var(--body);cursor:pointer">Cancel</button>' +
    '<button onclick="confirmL1AddFields()" style="padding:8px 16px;border:none;background:#8b7355;color:#fff;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">Apply</button>' +
    "</div>" +
    "</div>";
  modal.style.display = "flex";
}
// Modal interactions: section checkbox toggles all its leaves (Step A: atomic)
function _l1ModalToggleSection(cb) {
  var sec = cb.getAttribute("data-section");
  var esc = (sec || "").replace(/"/g, '\\"');
  var leaves = document.querySelectorAll(
    '#addFieldList .leaf-checkbox[data-section="' + esc + '"]',
  );
  leaves.forEach(function (l) {
    if (!l.disabled) l.checked = cb.checked;
  });
}
function _l1ModalToggleLeaf(cb) {
  var sec = cb.getAttribute("data-section");
  var esc = (sec || "").replace(/"/g, '\\"');
  var secCb = document.querySelector(
    '#addFieldList .sec-checkbox[data-section="' + esc + '"]',
  );
  if (!secCb) return;
  var leaves = document.querySelectorAll(
    '#addFieldList .leaf-checkbox[data-section="' + esc + '"]',
  );
  var any = false,
    all = leaves.length > 0;
  leaves.forEach(function (l) {
    if (l.checked) any = true;
    else all = false;
  });
  secCb.checked = all;
  secCb.indeterminate = any && !all;
}
window._l1ModalToggleSection = _l1ModalToggleSection;
window._l1ModalToggleLeaf = _l1ModalToggleLeaf;
function closeL1AddFieldModal() {
  var m = document.getElementById("addFieldOverlay");
  if (m) m.style.display = "none";
  _addFieldL1Context = null;
}
function confirmL1AddFields() {
  if (!_addFieldL1Context) return closeL1AddFieldModal();
  var l1id = _addFieldL1Context;
  var pid = currentProjectId;
  var m = _getL1Children(pid);

  // Group lookup for accessing T12 section data
  var group = null;
  ["revenue", "opex"].forEach(function (g) {
    if (
      PF_COA[g].some(function (x) {
        return x.id === l1id;
      })
    )
      group = g;
  });
  if (!group) {
    closeL1AddFieldModal();
    return;
  }
  var allSections = group === "revenue" ? _t12RevSections() : _t12ExpSections();

  // 1) Read modal state — decide current L1's desired children
  var newChildren = [];

  // HD-default checkbox at top of modal
  var hdCb = document.querySelector("#addFieldList .hd-default-checkbox");
  if (hdCb && hdCb.checked) newChildren.push({ kind: "hd-default" });

  var addedLeaves = {}; // leaf label → true (will be added as standalone leaf at current L1)
  var addedSections = {}; // section name → true (will be added as whole-section at current L1)
  var secCbs = document.querySelectorAll("#addFieldList .sec-checkbox");
  secCbs.forEach(function (secCb) {
    var secName = secCb.getAttribute("data-section");
    if (!secName) return;
    var esc = secName.replace(/"/g, '\\"');
    var leaves = document.querySelectorAll(
      '#addFieldList .leaf-checkbox[data-section="' + esc + '"]',
    );
    var allChecked = leaves.length > 0;
    var anyChecked = false;
    leaves.forEach(function (l) {
      if (l.checked) anyChecked = true;
      else allChecked = false;
    });
    if (allChecked) {
      newChildren.push({ kind: "section", t12section: secName });
      addedSections[secName] = true;
    } else if (anyChecked) {
      leaves.forEach(function (l) {
        if (l.checked) {
          var lbl = l.getAttribute("data-label");
          newChildren.push({ kind: "leaf", t12label: lbl });
          addedLeaves[lbl] = true;
        }
      });
    }
  });

  // 2) Conflict resolution: for each leaf we're adding, if it lives inside a section at another L1,
  //    split that section there (replace section entry with its remaining leaves as individual leaves).
  Object.keys(addedLeaves).forEach(function (leafLabel) {
    Object.keys(m).forEach(function (otherL1) {
      if (otherL1 === l1id) return;
      var arr = m[otherL1] || [];
      var rebuilt = [];
      arr.forEach(function (x) {
        if (x.kind === "section") {
          var sec = allSections[x.t12section];
          if (
            sec &&
            sec.leaves.some(function (l) {
              return l.label === leafLabel;
            })
          ) {
            // Split: emit each non-moved leaf as standalone
            sec.leaves.forEach(function (l) {
              if (l.label !== leafLabel)
                rebuilt.push({ kind: "leaf", t12label: l.label });
            });
            return;
          }
        }
        if (x.kind === "leaf" && x.t12label === leafLabel) return; // remove duplicate
        rebuilt.push(x);
      });
      m[otherL1] = rebuilt;
    });
  });

  // 3) When adding a section wholesale, purge overlapping leaves/sections from other L1s
  Object.keys(addedSections).forEach(function (secName) {
    var sec = allSections[secName];
    if (!sec) return;
    var leafSet = {};
    sec.leaves.forEach(function (l) {
      leafSet[l.label] = true;
    });
    Object.keys(m).forEach(function (otherL1) {
      if (otherL1 === l1id) return;
      m[otherL1] = (m[otherL1] || []).filter(function (x) {
        if (x.kind === "section" && x.t12section === secName) return false;
        if (x.kind === "leaf" && leafSet[x.t12label]) return false;
        return true;
      });
    });
  });

  // 4) Replace current L1's children with the new list
  m[l1id] = newChildren;

  _setL1Children(pid, m);
  closeL1AddFieldModal();
  if (typeof buildPFTable === "function") buildPFTable();
  if (typeof toast === "function") toast("T12 fields linked");
}
window.openL1AddFieldModal = openL1AddFieldModal;
window.closeL1AddFieldModal = closeL1AddFieldModal;
window.confirmL1AddFields = confirmL1AddFields;

// Render the "Adjust Fields" button row that lives at the end of each L1 group
function _addFieldButtonRowHtml(l1id, nCols) {
  var totalCells = 4 + nCols;
  return (
    '<tr style="background:rgba(0,0,0,0.01)"><td colspan="' +
    totalCells +
    '" style="padding:6px 10px 6px 28px">' +
    "<button onclick=\"openL1AddFieldModal('" +
    l1id +
    '\')" style="background:transparent;border:1px dashed rgba(74,124,89,0.4);border-radius:6px;padding:4px 10px;font-size:11px;color:#4a7c59;cursor:pointer;font-weight:600;letter-spacing:.02em" ' +
    "onmouseenter=\"this.style.background='rgba(74,124,89,0.06)';this.style.borderStyle='solid'\" " +
    "onmouseleave=\"this.style.background='transparent';this.style.borderStyle='dashed'\">" +
    "Adjust Fields</button>" +
    "</td></tr>"
  );
}

// Render an L1 header row as a value-bearing row matching the table column structure.
// l1info = { id, perUnitMonthly, units, vals[nCols], src, folded, reclassNote, note }
function _l1HeaderRowHtml(l1info, nCols) {
  var label = PF_L1_LABEL[l1info.id] || l1info.id;
  var caret = l1info.folded ? "▶" : "▼";
  var warnIcon = l1info.reclassNote
    ? ' <span title="' +
      l1info.reclassNote +
      '" style="color:#d97706;font-size:11px;cursor:help">⚠</span>'
    : "";
  var noteIcon = l1info.note
    ? ' <span title="' +
      l1info.note +
      '" style="color:var(--muted);font-size:10px;cursor:help">ⓘ</span>'
    : "";
  var c =
    typeof DS_COLORS !== "undefined" && l1info.src
      ? DS_COLORS[l1info.src]
      : null;
  var srcLabel = c ? c.label : "";
  var srcTag = c ? c.tag : "#666";
  var srcBg = c ? c.tagBg : "transparent";

  // Per-unit cell
  var puCell;
  if (l1info.perUnitMonthly != null && c) {
    var pu = Math.round(l1info.perUnitMonthly);
    if (pu === 0) {
      puCell = '<span style="color:var(--muted);font-size:11px">—</span>';
    } else if (pu < 0) {
      puCell =
        '<span style="color:var(--body);font-size:11px">($' +
        Math.abs(pu).toLocaleString() +
        ')<span style="font-size:9px;color:var(--muted)">/mo</span></span>';
    } else {
      puCell =
        '<span style="color:var(--body);font-size:11px;font-weight:700">$' +
        pu.toLocaleString() +
        '<span style="font-size:9px;color:var(--muted)">/mo</span></span>';
    }
  } else {
    puCell = '<span style="color:var(--muted);font-size:11px">—</span>';
  }

  // Source pill
  var srcPill = c
    ? '<span style="font-size:9px;padding:3px 10px;border:1px solid ' +
      srcTag +
      ";border-radius:11px;color:" +
      srcTag +
      ";background:" +
      srcBg +
      ';font-weight:700;letter-spacing:.05em;text-transform:uppercase">' +
      srcLabel +
      "</span>"
    : "";

  // Year value cells
  var yearHtml = "";
  for (var i = 0; i < nCols; i++) {
    var v = l1info.vals ? l1info.vals[i] : null;
    var borderL = i === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
    var bg = i >= 3 ? "background:rgba(74,124,89,0.04);" : "";
    var disp;
    if (v == null || (typeof v === "number" && v === 0)) {
      disp = '<span style="color:var(--muted)">—</span>';
    } else if (v < 0) {
      disp =
        '<span style="color:var(--header)">(' +
        Math.abs(Math.round(v)).toLocaleString() +
        ")</span>";
    } else {
      disp =
        '<span style="color:var(--header)">' +
        Math.round(v).toLocaleString() +
        "</span>";
    }
    yearHtml +=
      '<td style="padding:8px 8px;text-align:right;font-size:12px;font-weight:700;' +
      bg +
      borderL +
      '">' +
      disp +
      "</td>";
  }

  return (
    '<tr style="background:rgba(74,124,89,0.06);border-top:1px solid rgba(74,124,89,0.2);border-bottom:1px solid rgba(74,124,89,0.15);cursor:pointer" onclick="toggleL1Fold(\'' +
    l1info.id +
    "')\">" +
    '<td style="padding:8px 10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--header);white-space:nowrap">' +
    '<span style="display:inline-block;width:14px;color:var(--green)">' +
    caret +
    "</span> " +
    label +
    warnIcon +
    noteIcon +
    "</td>" +
    '<td style="padding:8px 8px;text-align:right">' +
    puCell +
    "</td>" +
    '<td style="display:none">' +
    srcPill +
    "</td>" +
    '<td style="padding:8px 8px;text-align:center;font-size:11px;color:var(--body)">' +
    (l1info.units != null ? l1info.units : "") +
    "</td>" +
    yearHtml +
    "</tr>"
  );
}

// Deal-level constants (would come from Selling Model upload in future)
var DEAL_CONSTANTS = {};

function buildNoiStrip() {
  var strip = document.getElementById("pfNoiStrip");
  if (!strip) return;
  // Show empty strip when no data
  if (!_pfLoaded) {
    strip.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;grid-column:1/-1">—</div>';
    return;
  }

  var _pfd = _getProjectPFData(currentProjectId);
  if (!_pfd || !_pfLoaded) {
    strip.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;grid-column:1/-1">—</div>';
    return;
  }
  // Compute revTot and expTot from _pfd.revenue and _pfd.expenses
  var revTot = [];
  var expTot = [];
  if (_pfd.revenue) {
    var revTotal = _pfd.revenue.find(function (r) {
      return r.isTotal && r.label && r.label.indexOf("Total Revenue") !== -1;
    });
    if (revTotal && revTotal.vals) revTot = revTotal.vals.slice();
  }
  if (_pfd.expenses) {
    var expTotal = _pfd.expenses.find(function (r) {
      return r.isTotal && r.label && r.label.indexOf("Total Expenses") !== -1;
    });
    if (expTotal && expTotal.vals) expTot = expTotal.vals.slice();
  }
  if (!revTot.length || !expTot.length) {
    strip.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;grid-column:1/-1">—</div>';
    return;
  }

  var asmt = getProjectAssumptions();
  var rentRate = 1 + asmt.rentGrowth / 100;
  var opexRate = 1 + asmt.opexGrowth / 100;

  // Extend to 7 cols using assumptions
  while (revTot.length < 7) {
    var lr = revTot[revTot.length - 1];
    revTot.push(Math.round(lr * rentRate));
  }
  while (expTot.length < 7) {
    var le = expTot[expTot.length - 1];
    expTot.push(Math.round(le * opexRate));
  }

  var noi = revTot.map(function (r, i) {
    return Math.round(r - expTot[i]);
  });
  var maxNoi = Math.max.apply(null, noi);

  var dc = DEAL_CONSTANTS[currentProjectId] || {};
  var ds = dc.debtService || 0;

  strip.innerHTML = noi
    .map(function (v, i) {
      var isProj = i >= 3;
      var isStab = i === 2; // 2025 (Stab)
      var bar = Math.round((v / maxNoi) * 100);
      var dscr = ds ? (v / ds).toFixed(2) : null;
      var borderL = i > 0 ? "border-left:1px solid var(--border);" : "";
      var bg = isProj ? "background:rgba(74,124,89,0.03);" : "";
      var borderTop =
        isProj && i === 3
          ? "border-top:3px solid rgba(74,124,89,0.5);"
          : isStab
            ? "border-top:3px solid var(--green);"
            : "border-top:3px solid transparent;";

      return (
        '<div style="padding:12px 10px 10px;' +
        bg +
        borderL +
        borderTop +
        '">' +
        // Year label
        '<div style="font-size:9.5px;font-weight:700;color:' +
        (isProj ? "var(--green)" : "var(--muted)") +
        ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px">' +
        PF_COLS_FULL[i] +
        (isProj ? ' <span style="font-size:8px;opacity:.6">proj</span>' : "") +
        (isStab
          ? ' <span style="font-size:8px;background:rgba(74,124,89,0.15);color:var(--green);padding:1px 4px;border-radius:3px;font-weight:800">STAB</span>'
          : "") +
        "</div>" +
        // NOI value
        '<div style="font-size:16px;font-weight:800;color:' +
        (isProj ? "var(--green)" : "var(--header)") +
        ';margin-bottom:5px">' +
        "$" +
        Math.abs(v).toLocaleString() +
        "</div>" +
        // Mini bar
        '<div style="height:4px;border-radius:2px;background:var(--border);margin-bottom:5px">' +
        '<div style="height:4px;border-radius:2px;width:' +
        bar +
        "%;background:" +
        (isProj ? "rgba(74,124,89,0.5)" : "rgba(74,124,89,0.35)") +
        '"></div>' +
        "</div>" +
        // DSCR sub-label
        '<div style="font-size:9px;color:var(--muted)">DSCR&nbsp;' +
        (dscr ? dscr + "×" : "—") +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  // Update summary stat cards
  var deal = DEAL_CONSTANTS[currentProjectId] || DEAL_CONSTANTS["p1"];
  var proj =
    getProjects().find(function (p) {
      return p.id === currentProjectId;
    }) || {};
  var offerPrice = proj.offerPrice || 0;
  var closingCosts =
    deal.closingCosts || (offerPrice ? Math.round(offerPrice * 0.05) : 0);
  var capex = deal.capex || 0;
  var totalCost = offerPrice + closingCosts;
  var dscrStab = deal.dscrStab || 0;

  var kpiCC = document.getElementById("kpiClosingCosts");
  var kpiTC = document.getElementById("kpiTotalCost");
  var kpiCX = document.getElementById("kpiCapex");
  var kpiDS = document.getElementById("kpiDscr");
  if (kpiCC) kpiCC.textContent = "$" + closingCosts.toLocaleString();
  if (kpiTC) kpiTC.textContent = "$" + totalCost.toLocaleString();
  if (kpiCX) kpiCX.textContent = "$" + capex.toLocaleString();
  if (kpiDS) kpiDS.textContent = dscrStab + "×";
}

// ─── GL Capital: Growth Assumptions ──────────────────────────────────────────
function getProjectAssumptions() {
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  var a = (proj && proj.assumptions) || {};
  return {
    acquisitionYear: a.acquisitionYear != null ? a.acquisitionYear : 2026,
    rentGrowth: a.rentGrowth != null ? a.rentGrowth : 3.0,
    opexGrowth: a.opexGrowth != null ? a.opexGrowth : 3.0,
    taxGrowth: a.taxGrowth != null ? a.taxGrowth : 3.0,
  };
}

function openAssumptionsModal() {
  var a = getProjectAssumptions();
  var ayEl = document.getElementById("asmtAcquisitionYear");
  if (ayEl) ayEl.value = a.acquisitionYear;
  document.getElementById("asmtRentGrowth").value = a.rentGrowth;
  document.getElementById("asmtOpexGrowth").value = a.opexGrowth;
  document.getElementById("asmtTaxGrowth").value = a.taxGrowth;
  var ov = document.getElementById("assumptionsOverlay");
  ov.style.display = "flex";
  setTimeout(function () {
    ov.style.opacity = "1";
  }, 10);
}

function closeAssumptionsModal() {
  document.getElementById("assumptionsOverlay").style.display = "none";
}

function saveAssumptions() {
  var ayEl = document.getElementById("asmtAcquisitionYear");
  var existing = getProjectAssumptions();
  var acquisitionYear = ayEl
    ? parseInt(ayEl.value, 10) || existing.acquisitionYear
    : existing.acquisitionYear;
  var rentGrowth =
    parseFloat(document.getElementById("asmtRentGrowth").value) || 3.0;
  var opexGrowth =
    parseFloat(document.getElementById("asmtOpexGrowth").value) || 3.0;
  var taxGrowth =
    parseFloat(document.getElementById("asmtTaxGrowth").value) || 3.0;
  // Clamp to reasonable range
  acquisitionYear = Math.min(2050, Math.max(2000, acquisitionYear));
  rentGrowth = Math.min(50, Math.max(0, rentGrowth));
  opexGrowth = Math.min(50, Math.max(0, opexGrowth));
  taxGrowth = Math.min(50, Math.max(0, taxGrowth));

  var projs = getProjects();
  var idx = projs.findIndex(function (p) {
    return p.id === currentProjectId;
  });
  if (idx !== -1) {
    var prev = projs[idx].assumptions || {};
    projs[idx].assumptions = Object.assign({}, prev, {
      acquisitionYear: acquisitionYear,
      rentGrowth: rentGrowth,
      opexGrowth: opexGrowth,
      taxGrowth: taxGrowth,
      units: prev.units,
    });
    saveProjects(projs);
  }
  closeAssumptionsModal();
  if (typeof _refreshYearHeaders === "function") _refreshYearHeaders();
  if (typeof buildPFUnitMix === "function") buildPFUnitMix(); // refresh Rent Roll year-labeled columns
  buildPFTable();
  if (typeof populateSummary === "function") populateSummary();
  toast("Assumptions saved — projections updated");
}

// Compute the 7-year calendar year array based on acquisition year.
// AY-2, AY-1, AY (Stab), AY+1, AY+2, AY+3, AY+4
function _getProjectYears() {
  var a = getProjectAssumptions();
  var ay = a.acquisitionYear || 2026;
  return [ay - 2, ay - 1, ay, ay + 1, ay + 2, ay + 3, ay + 4].map(String);
}

// Dynamically update all year column headers (<th>) in Pro Forma tables.
// Walks header rows that contain 7 consecutive year-like cells.
function _refreshYearHeaders() {
  var years = _getProjectYears();
  // Find <tr> rows that look like year header rows (have ≥7 <th>s with 4-digit year text)
  document.querySelectorAll("tr").forEach(function (tr) {
    var ths = tr.querySelectorAll("th");
    // Collect indices of cells with 4-digit year-only text
    var yearCells = [];
    ths.forEach(function (th) {
      var t = (th.textContent || "").trim();
      if (/^\d{4}$/.test(t)) yearCells.push(th);
    });
    // If exactly 7 (our standard PF year column count), update
    if (yearCells.length === 7) {
      yearCells.forEach(function (th, i) {
        th.textContent = years[i];
      });
    }
  });
  // Update HD upload period hint with current AY
  var hdHint = document.getElementById("hdPeriodHint");
  if (hdHint) {
    var a = getProjectAssumptions();
    var ay = a.acquisitionYear || 2026;
    hdHint.innerHTML =
      "<strong>Expected period:</strong> Current market snapshot, ideally from AY−1 (" +
      (ay - 1) +
      ") — the year before acquisition (AY=" +
      ay +
      "). HD reports market benchmarks as-of the export date.";
  }
}
window._refreshYearHeaders = _refreshYearHeaders;

// Render module-level source selector (T12/HD pill toggle) on Revenue/Expenses header
function _renderModuleSrcBadge(cellId, sectionLabel, mod, currentSrc, hasHD) {
  var cell = document.getElementById(cellId);
  if (!cell) return;
  if (!hasHD) {
    cell.innerHTML = sectionLabel;
    return;
  }
  var t12Active = currentSrc === "t12";
  var hdActive = currentSrc === "hd";
  var pills =
    '<span style="display:inline-flex;margin-left:12px;border-radius:5px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);vertical-align:middle">' +
    "<button onclick=\"event.stopPropagation();setModuleSrc('" +
    mod +
    "','t12')\" style=\"border:none;padding:2px 10px;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.03em;" +
    (t12Active
      ? "background:#8b7355;color:#fff;"
      : "background:rgba(0,0,0,0.03);color:#999;") +
    '">T12</button>' +
    "<button onclick=\"event.stopPropagation();setModuleSrc('" +
    mod +
    "','hd')\" style=\"border:none;border-left:1px solid rgba(0,0,0,0.08);padding:2px 10px;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.03em;" +
    (hdActive
      ? "background:#1a3a5c;color:#fff;"
      : "background:rgba(0,0,0,0.03);color:#999;") +
    '">HD</button>' +
    "</span>";
  cell.innerHTML = sectionLabel + pills;
}

// ── DATA SOURCE COLOR SYSTEM ───────────────────────────────────────
var DS_COLORS = {
  t12: {
    tag: "#2E7D32",
    tagBg: "rgba(46,125,50,0.08)",
    cell: "rgba(46,125,50,0.04)",
    label: "T12",
  },
  hd: {
    tag: "#1565C0",
    tagBg: "rgba(21,101,192,0.08)",
    cell: "rgba(21,101,192,0.04)",
    label: "HelloData",
  },
  rr: {
    tag: "#6A1B9A",
    tagBg: "rgba(106,27,154,0.08)",
    cell: "rgba(106,27,154,0.04)",
    label: "Rent Roll",
  },
  rc: {
    tag: "#0891B2",
    tagBg: "rgba(8,145,178,0.10)",
    cell: "rgba(8,145,178,0.04)",
    label: "RentCast",
  },
  rentcast: {
    tag: "#0891B2",
    tagBg: "rgba(8,145,178,0.10)",
    cell: "rgba(8,145,178,0.04)",
    label: "RentCast",
  },
  attom: {
    tag: "#37474F",
    tagBg: "rgba(55,71,79,0.08)",
    cell: "rgba(55,71,79,0.04)",
    label: "ATTOM",
  },
  manual: {
    tag: "#8B6F47",
    tagBg: "rgba(139,111,71,0.10)",
    cell: "rgba(139,111,71,0.04)",
    label: "Manual",
  },
};

function _dsTag(src) {
  var c = DS_COLORS[src] || DS_COLORS.t12;
  return (
    '<span style="display:inline-block;min-width:62px;text-align:center;font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:' +
    c.tag +
    ";background:" +
    c.tagBg +
    '">' +
    c.label +
    "</span>"
  );
}

// Calculate explicit px width for a select showing UPPERCASE label — chevron included
function _srcSelectWidth(labelText) {
  // Uppercase 9px bold + letter-spacing .05em: each char ~7.2px
  // Plus: left padding 10 + right padding 18 (includes 8px chevron area) + 4px safety = 32px
  var len = String(labelText || "").length;
  return Math.max(Math.ceil(len * 7.2) + 32, 56);
}

function _dsDropdown(rowId, currentSrc, availableSrcs) {
  var html =
    "<select onchange=\"changeRowSource('" +
    rowId +
    '\',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--card-bg,#fff);cursor:pointer;min-width:60px">';
  availableSrcs.forEach(function (s) {
    var c = DS_COLORS[s];
    html +=
      '<option value="' +
      s +
      '"' +
      (s === currentSrc ? " selected" : "") +
      ">" +
      c.label +
      "</option>";
  });
  html += "</select>";
  return html;
}

// ── INCOME TABLE (Per-Unit + Other) ───────────────────────────────
// Classifies PF_DATA.revenue items into upper (per-unit) vs lower (other)
var UPPER_TABLE_LABELS = [
  "Rent Income",
  "Other Rental Income",
  "Application Fee Income",
  "NSF Fees Collected",
  "Late Fee",
  "Pet Fee",
  "Furniture Charge",
  "Laundry Income",
  "Insurance Services",
  "Utility Reimbursement Fee",
  "Concessions",
];

// Fields available for Add Field modal
var ADDABLE_FIELDS = [
  {
    id: "hd-gpr",
    label: "Gross Potential Rent (GPR)",
    src: "hd",
    defaultTable: "upper",
  },
  { id: "hd-vacancy", label: "Vacancy Loss", src: "hd", defaultTable: "upper" },
  {
    id: "hd-parking",
    label: "Parking Income",
    src: "hd",
    defaultTable: "lower",
  },
  {
    id: "hd-other-inc",
    label: "Other Income",
    src: "hd",
    defaultTable: "lower",
  },
  {
    id: "hd-egi",
    label: "Effective Gross Income (EGI)",
    src: "hd",
    defaultTable: "lower",
    warn: "egi",
  },
];

// ── EXPENSES TABLE CONSTANTS ───────────────────────────────
var EXP_UPPER_TABLE_LABELS = [
  "Property Tax",
  "Property Insurance",
  "Management Fee",
  "Electricity",
  "Gas",
  "Water",
  "Telephone / WiFi",
  "Cleaning & Janitorial",
  "Garbage & Recycling",
  "Pest Control",
  "Plumbing",
  "HVAC",
  "Appliance Repair",
  "Repairs - Other",
  "Supplies",
  "Salary Expense",
  "Office Expense",
  "Bank Fees",
];

var EXP_DUAL_SOURCE = {
  "Property Tax": { hdLabel: "Real Estate Taxes" },
  "Property Insurance": { hdLabel: "Property Insurance" },
  "Management Fee": { hdLabel: "Management Fees" },
};

var EXP_ADDABLE_FIELDS = [
  {
    id: "t12-mortgage-interest",
    label: "Mortgage Interest",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-mortgage-other",
    label: "Mortgage - Other",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-other-interest",
    label: "Other Interest",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-depreciation",
    label: "Depreciation Expense",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-amortization",
    label: "Amortization Expense",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-refinance-fee",
    label: "Refinance Fee Expense",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-misc-expense",
    label: "Miscellaneous Expense",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-guaranteed-pay",
    label: "Guaranteed Payments",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-pref-int",
    label: "Pref - Int",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-ask-accountant",
    label: "Ask My Accountant",
    src: "t12",
    defaultTable: "lower",
  },
  {
    id: "t12-marketing-expense",
    label: "Marketing Expense",
    src: "t12",
    defaultTable: "lower",
  },
  { id: "hd-utilities", label: "Utilities", src: "hd", defaultTable: "upper" },
  {
    id: "hd-repair-maintenance",
    label: "Repair and Maintenance",
    src: "hd",
    defaultTable: "upper",
  },
  {
    id: "hd-payroll-benefits",
    label: "Payroll and Benefits",
    src: "hd",
    defaultTable: "upper",
  },
  { id: "hd-marketing", label: "Marketing", src: "hd", defaultTable: "lower" },
  {
    id: "hd-professional-fees",
    label: "Professional Fees",
    src: "hd",
    defaultTable: "lower",
  },
  {
    id: "hd-gen-admin",
    label: "General and Administrative",
    src: "hd",
    defaultTable: "lower",
  },
  {
    id: "hd-other-expenses",
    label: "Other Expenses",
    src: "hd",
    defaultTable: "lower",
  },
  {
    id: "hd-total-opex",
    label: "Total Operating Expenses",
    src: "hd",
    defaultTable: "lower",
  },
];

// Expense row sources (per-row T12/HD selection for dual-source fields)
function _getExpRowSources(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("expense_row_sources_" + pid) || "{}",
    );
  } catch (e) {
    return {};
  }
}
function _saveExpRowSources(pid, obj) {
  localStorage.setItem("expense_row_sources_" + pid, JSON.stringify(obj));
}

// Expense added fields tracking
function _getExpAddedFields(pid) {
  try {
    return JSON.parse(localStorage.getItem("expense_added_" + pid) || "[]");
  } catch (e) {
    return [];
  }
}
function _saveExpAddedFields(pid, arr) {
  localStorage.setItem("expense_added_" + pid, JSON.stringify(arr));
}

// Track which addable fields have been added (per project)
function _getAddedFields(pid) {
  try {
    return JSON.parse(localStorage.getItem("income_added_" + pid) || "[]");
  } catch (e) {
    return [];
  }
}
function _saveAddedFields(pid, arr) {
  localStorage.setItem("income_added_" + pid, JSON.stringify(arr));
}

function openAddFieldModal(type) {
  var modal = document.getElementById("addFieldModal");
  if (!modal) return;
  var pid = window._currentProjectId || "default";
  var added = _getAddedFields(pid);
  var list = document.getElementById("addFieldList");
  if (!list) return;
  var html = "";
  ADDABLE_FIELDS.forEach(function (f) {
    var isAdded = added.indexOf(f.id) !== -1;
    var c = DS_COLORS[f.src];
    html +=
      '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:' +
      (isAdded ? "not-allowed" : "pointer") +
      ";" +
      (isAdded ? "opacity:0.4;" : "") +
      'background:rgba(0,0,0,0.02)">' +
      '<input type="checkbox" name="addField" value="' +
      f.id +
      '"' +
      (isAdded ? " disabled" : "") +
      ' onchange="checkAddFieldWarning()" style="accent-color:' +
      c.tag +
      '">' +
      '<span style="flex:1;font-size:12px;color:var(--body)">' +
      f.label +
      "</span>" +
      '<span style="font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:' +
      c.tag +
      ";background:" +
      c.tagBg +
      '">' +
      c.label +
      "</span>" +
      "</label>";
  });
  list.innerHTML = html;
  document.getElementById("addFieldWarning").style.display = "none";
  modal.style.display = "";
}

function closeAddFieldModal() {
  var modal = document.getElementById("addFieldModal");
  if (modal) modal.style.display = "none";
}

function checkAddFieldWarning() {
  var warn = document.getElementById("addFieldWarning");
  if (!warn) return;
  var checked = document.querySelectorAll(
    '#addFieldList input[name="addField"]:checked',
  );
  var hasEgi = false;
  var hasComponents = false;
  var pid = window._currentProjectId || "default";
  var added = _getAddedFields(pid);
  checked.forEach(function (cb) {
    if (cb.value === "hd-egi") hasEgi = true;
    if (["hd-gpr", "hd-vacancy", "hd-other-inc"].indexOf(cb.value) !== -1)
      hasComponents = true;
  });
  // Also check already added
  if (added.indexOf("hd-egi") !== -1) hasEgi = true;
  ["hd-gpr", "hd-vacancy", "hd-other-inc"].forEach(function (id) {
    if (added.indexOf(id) !== -1) hasComponents = true;
  });
  warn.style.display = hasEgi && hasComponents ? "" : "none";
}

function confirmAddField() {
  var pid = window._currentProjectId || "default";
  var added = _getAddedFields(pid);
  var target = document.querySelector('input[name="addFieldTarget"]:checked');
  var targetTable = target ? target.value : "upper";
  var checked = document.querySelectorAll(
    '#addFieldList input[name="addField"]:checked',
  );
  checked.forEach(function (cb) {
    if (added.indexOf(cb.value) === -1) {
      added.push(cb.value);
    }
  });
  _saveAddedFields(pid, added);
  closeL1AddFieldModal();
  buildIncomeTable();
}

// Per-row source selection storage
function _getRowSources(pid) {
  try {
    return JSON.parse(localStorage.getItem("income_src_" + pid) || "{}");
  } catch (e) {
    return {};
  }
}
function _saveRowSources(pid, obj) {
  localStorage.setItem("income_src_" + pid, JSON.stringify(obj));
}

function changeRowSource(rowId, newSrc) {
  var pid = window._currentProjectId || "default";
  var sources = _getRowSources(pid);
  sources[rowId] = newSrc;
  _saveRowSources(pid, sources);
  buildIncomeTable();
}

// Called when user edits Per Unit, Units, or Stab value in edit mode → tag becomes Manual
function onIncomeFieldEdit(rowLabel, field, value) {
  var pid = window._currentProjectId || "default";
  // Store override in pfOverrides
  var sanitized = (rowLabel || "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  var key = sanitized + "_manual_" + field;
  var pfOverrides = {};
  try {
    pfOverrides = JSON.parse(
      localStorage.getItem("glcapital_pf_overrides_" + pid) || "{}",
    );
  } catch (e) {}
  pfOverrides[key] = { value: value, source: "manual", timestamp: Date.now() };
  localStorage.setItem(
    "glcapital_pf_overrides_" + pid,
    JSON.stringify(pfOverrides),
  );
  // Mark row source as manual
  var sources = _getRowSources(pid);
  sources[rowLabel] = "manual";
  _saveRowSources(pid, sources);
  // Don't rebuild immediately — let user keep editing
  // Just update the tag visually
  var tr = event && event.target ? event.target.closest("tr") : null;
  if (tr) {
    var tagEl = tr.querySelector('span[style*="font-size:8px"]');
    if (tagEl) {
      var mc = DS_COLORS.manual;
      tagEl.style.color = mc.tag;
      tagEl.style.background = mc.tagBg;
      tagEl.textContent = mc.label;
    }
  }
}

// HD demo data — Per Unit monthly values (mocked from HD Expense Benchmarks / Property fees)
var HD_PER_UNIT_MONTHLY = {};
// HD Financial Analysis annual totals per L1 (median tier).
// FA median column = total annual value for stabilized year (2026).
// Per-unit-monthly = annual / units / 12 (units from Rent Comps sheet).
var HD_L1_AGGREGATE_PER_UNIT_MONTHLY = {};
// HD annual totals (raw FA median values) — used for 2026 Stab column
var HD_L1_ANNUAL = {};
// RC demo data — rent estimates (RentCast typically only provides Rent Income)
var RC_PER_UNIT_MONTHLY = {};

// Populate HD_L1_AGGREGATE_PER_UNIT_MONTHLY from parsed HD Financial Analysis data.
// Maps HD row labels → L1 IDs with per-unit monthly values (median tier).
// Must be called before buildIncomeTable / buildExpenseTable so hd-default children resolve.
var _HD_LABEL_TO_L1 = {
  "Gross Potential Rent": "gpr",
  "Vacancy Loss": "vc",
  "Parking Income": "parking",
  "Other Income": "other",
  "Effective Gross Income": "egi",
  "Real Estate Taxes": "tax",
  "Property Insurance": "ins",
  Utilities: "util",
  "Repair & Maintenance": "rm",
  "Management Fees": "mgmt",
  Marketing: "mktg",
  "Professional Fees": "prof",
  "Payroll & Benefits": "payroll",
  "General and Administrative": "ga",
  "Other Expenses": "other_exp",
  "Total Operating Expenses": "total_opex",
  "Net Operating Income": "noi",
};

function _getHDUnits(pid) {
  var _pid = pid || currentProjectId;
  var rc = getHDRentComps(_pid);
  if (rc && rc.units > 0) return rc.units;
  var meta = getHDMeta(_pid);
  if (meta && meta.units > 0) return meta.units;
  // Sum from HD Unit Mix subject rows
  var umix = getHDUnitMix(_pid);
  if (umix && umix.length > 0) {
    var total = 0;
    umix.forEach(function (u) {
      total += u.units || 0;
    });
    if (total > 0) return total;
  }
  return 0;
}

function _populateHDL1Aggregates(hdData) {
  // Reset
  HD_L1_AGGREGATE_PER_UNIT_MONTHLY = {};
  HD_L1_ANNUAL = {};
  HD_PER_UNIT_MONTHLY = {};
  if (!hdData) return;
  var units = _getHDUnits() || 1; // fallback 1 to avoid division by zero
  // FA median = annual total. Per-unit-monthly = annual / units / 12.
  Object.keys(_HD_LABEL_TO_L1).forEach(function (hdLabel) {
    var annual = _hdVal(hdData, hdLabel);
    if (annual != null) {
      var l1 = _HD_LABEL_TO_L1[hdLabel];
      HD_L1_ANNUAL[l1] = annual;
      HD_L1_AGGREGATE_PER_UNIT_MONTHLY[l1] =
        Math.round((annual / units / 12) * 100) / 100;
    }
  });
  // Also populate HD_PER_UNIT_MONTHLY for individual line item lookups
  Object.keys(hdData).forEach(function (label) {
    var val = hdData[label] && hdData[label][_hdTier];
    if (val != null) HD_PER_UNIT_MONTHLY[label] = val;
  });
}

function buildIncomeTable() {
  var upperBody = document.getElementById("pfRevUpperBody");
  var upperSub = document.getElementById("pfRevUpperSubtotal");
  var lowerBody = document.getElementById("pfRevLowerBody");
  var lowerSub = document.getElementById("pfRevLowerSubtotal");
  var totalBody = document.getElementById("pfRevTotalBody");
  if (!upperBody) return;

  // Ensure HD aggregates are populated (may be called standalone, not only via buildPFTable)
  var _hdForPopulate = getHDData(currentProjectId);
  if (_hdForPopulate && !HD_L1_AGGREGATE_PER_UNIT_MONTHLY.gpr) {
    _populateHDL1Aggregates(_hdForPopulate);
  }

  // If no data uploaded at all (no HD and no T12), show empty state
  var _hdMeta = getHDMeta(currentProjectId);
  var _colHdrRow = document.getElementById("pfRevColHdrRow");
  if (_colHdrRow) _colHdrRow.style.display = "";
  if (!_hdMeta && !_pfLoaded) {
    var zh = currentLang === "zh";
    upperBody.innerHTML =
      '<tr><td colspan="11" style="padding:40px 14px;text-align:center;color:var(--muted);font-size:13px">' +
      (zh
        ? "请先上传 T12 或 HelloData 文件以填充收入数据"
        : "Upload a T12 or HelloData file to populate income data") +
      "</td></tr>";
    if (upperSub) upperSub.innerHTML = "";
    if (lowerBody) lowerBody.innerHTML = "";
    if (lowerSub) lowerSub.innerHTML = "";
    if (totalBody) totalBody.innerHTML = "";
    window._pfEgiCache = new Array(7).fill(0);
    return;
  }

  var pf = _pfLoaded
    ? _getProjectPFData(currentProjectId) || PF_DATA
    : _emptyPFData();
  var nCols = 7;
  var asmt = getProjectAssumptions();
  var rentRate = 1 + asmt.rentGrowth / 100;
  var _proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  var units = _resolveUnits(currentProjectId);
  var pid = window._currentProjectId || "default";
  var rowSources = _getRowSources(pid);
  var isEditMode =
    !!document.querySelector(".edit-mode") ||
    (typeof _globalEditMode !== "undefined" && _globalEditMode);

  // Check for manual overrides
  var pfOverrides = {};
  try {
    pfOverrides = JSON.parse(
      localStorage.getItem("glcapital_pf_overrides_" + pid) || "{}",
    );
  } catch (e) {}
  function _getRowOverrides(label) {
    var sanitized = (label || "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "");
    var overrides = {};
    var hasAny = false;
    for (var i = 0; i < nCols; i++) {
      var ov = pfOverrides[sanitized + "_" + i];
      if (ov) {
        overrides[i] = ov.value;
        hasAny = true;
      }
    }
    // Also check manual_ prefixed keys from onIncomeFieldEdit
    ["perunit", "units", "stab"].forEach(function (f) {
      var mk = sanitized + "_manual_" + f;
      if (pfOverrides[mk]) hasAny = true;
    });
    return hasAny ? overrides : null;
  }

  function projectFrom(baseVal, startIdx) {
    var v = new Array(nCols).fill(0);
    v[startIdx] = baseVal;
    for (var i = startIdx + 1; i < nCols; i++) {
      v[i] = Math.round(v[i - 1] * rentRate * 100) / 100;
    }
    return v;
  }

  function projectVals(vals) {
    var v = (vals || []).slice();
    while (v.length < nCols) {
      var last = v[v.length - 1];
      v.push(last ? Math.round(last * rentRate * 100) / 100 : 0);
    }
    return v;
  }

  function fmtNum(v, src) {
    if (v === null || v === undefined)
      return '<span style="color:var(--muted)">—</span>';
    var n = parseFloat(v);
    if (isNaN(n) || n === 0) return '<span style="color:var(--muted)">—</span>';
    if (n < 0)
      return (
        '<span style="color:var(--body)">(' +
        Math.abs(Math.round(n)).toLocaleString() +
        ")</span>"
      );
    return (
      '<span style="color:var(--body)">' +
      Math.round(n).toLocaleString() +
      "</span>"
    );
  }

  function fmtNumPlain(v) {
    if (v === null || v === undefined)
      return '<span style="color:var(--muted)">—</span>';
    var n = parseFloat(v);
    if (isNaN(n) || n === 0) return '<span style="color:var(--muted)">—</span>';
    if (n < 0)
      return (
        '<span style="color:var(--body)">(' +
        Math.abs(Math.round(n)).toLocaleString() +
        ")</span>"
      );
    return Math.round(n).toLocaleString();
  }

  function fmtPerUnit(v, src) {
    if (v === null || v === undefined || isNaN(v) || v === 0)
      return '<span style="color:var(--muted)">—</span>';
    if (v < 0)
      return (
        '<span style="color:var(--body)">($' +
        Math.abs(Math.round(v)).toLocaleString() +
        ")</span>"
      );
    return (
      '<span style="color:var(--body)">$' +
      Math.round(v).toLocaleString() +
      "</span>"
    );
  }

  // Separate PF_DATA.revenue into upper (per-unit) and lower (other)
  var upperItems = [];
  var lowerItems = [];
  var currentSection = null;

  // User's L1 → linked children mapping (leaves and sections)
  var _l1ChildrenMap = _getL1Children(currentProjectId);

  // Build upperItems from resolved children — walks 4 user-curated L1s (skip EGI; EGI is computed)
  var _resolveCtx = { units: units, nCols: nCols, rentRate: rentRate };
  PF_COA.revenue.forEach(function (l1def) {
    if (l1def.computed) return;
    var resolved = _resolveL1Children(l1def.id, "revenue", _resolveCtx);
    resolved.forEach(function (r) {
      // Source: hd-default carries 'hd'; user-set override applies for t12 leaves; section→t12
      var rowSrc = r.src || rowSources[r.label] || "t12";
      upperItems.push({
        label: r.label,
        displayLabel: r.displayLabel,
        vals: projectVals(r.vals),
        src: rowSrc,
        l1: l1def.id,
        kind: r.kind,
        leafCount: r.leafCount || null,
        leaves: r.leaves || null,
      });
    });
  });

  // L2 fold state (section expand/collapse)
  var _l2Fold = _getL2Fold(currentProjectId);

  // Helper: render an L3 leaf row (under an expanded section)
  function _renderL3LeafRowHtml(leaf, parentSrc, units, rentRate, nCols) {
    var vals = (leaf.vals || []).slice();
    while (vals.length < nCols) {
      var last = vals[vals.length - 1];
      vals.push(last ? Math.round(last * rentRate * 100) / 100 : 0);
    }
    var perUnitMonthly =
      ((vals[0] || 0) + (vals[1] || 0)) / 2 / (units || 1) / 12;
    var c = DS_COLORS[parentSrc || "t12"];
    var puCell =
      perUnitMonthly === 0 || isNaN(perUnitMonthly)
        ? '<span style="color:var(--muted)">—</span>'
        : perUnitMonthly < 0
          ? '<span style="color:var(--body);font-size:11px">($' +
            Math.abs(Math.round(perUnitMonthly)).toLocaleString() +
            ")</span>"
          : '<span style="color:var(--body);font-size:11px">$' +
            Math.round(perUnitMonthly).toLocaleString() +
            "</span>";
    var yearHtml = "";
    for (var i = 0; i < nCols; i++) {
      var v = vals[i];
      var borderL = i === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = i >= 3 ? "background:rgba(74,124,89,0.03);" : "";
      var disp;
      if (v == null || v === 0)
        disp = '<span style="color:var(--muted)">—</span>';
      else if (v < 0)
        disp =
          '<span style="color:var(--body)">(' +
          Math.abs(Math.round(v)).toLocaleString() +
          ")</span>";
      else
        disp =
          '<span style="color:var(--body)">' +
          Math.round(v).toLocaleString() +
          "</span>";
      yearHtml +=
        '<td style="padding:5px 8px;text-align:right;font-size:11px;' +
        bg +
        borderL +
        '">' +
        disp +
        "</td>";
    }
    return (
      '<tr style="background:rgba(0,0,0,0.015);border-bottom:1px solid rgba(0,0,0,0.04)">' +
      '<td style="padding:5px 8px 5px 56px;font-size:11px;color:var(--muted);white-space:nowrap"><span style="color:var(--muted);margin-right:6px">└</span>' +
      leaf.label +
      "</td>" +
      '<td style="padding:5px 8px;text-align:right">' +
      puCell +
      '<span style="font-size:9px;color:var(--muted)">/mo</span></td>' +
      '<td style="display:none"><span style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">inherits</span></td>' +
      '<td style="padding:5px 8px;text-align:center;font-size:11px;color:var(--muted)">' +
      units +
      "</td>" +
      yearHtml +
      "</tr>"
    );
  }

  // Build upper table rows
  var upperHtml = "";
  var upperTotals = new Array(nCols).fill(0);

  // Shared cell style constants
  var _cellPad = "padding:7px 8px;";
  var _cellRight = "text-align:right;";
  var _cellFont = "font-size:12px;";
  var _editInputBase =
    "text-align:right;font-size:11px;padding:3px 6px;border-radius:3px;box-sizing:content-box;outline:none;";

  // Build tooltip for Y3 (Stab) cell explaining the calculation
  function _stabTooltip(src, perUnitMonthly, units, y1, y2) {
    if (src === "hd")
      return (
        "HD: $" +
        Math.round(perUnitMonthly).toLocaleString() +
        "/mo × 12 × " +
        units +
        " units = $" +
        Math.round(perUnitMonthly * 12 * units).toLocaleString()
      );
    if (src === "rc")
      return (
        "RC: $" +
        Math.round(perUnitMonthly).toLocaleString() +
        "/mo × 12 × " +
        units +
        " units = $" +
        Math.round(perUnitMonthly * 12 * units).toLocaleString()
      );
    return (
      "T12: Avg(" +
      Math.round(y1).toLocaleString() +
      ", " +
      Math.round(y2).toLocaleString() +
      ") = $" +
      Math.round((y1 + y2) / 2).toLocaleString()
    );
  }

  // Build tooltip for projected years
  function _projTooltip(prevVal, growthPct, ci) {
    return (
      "Y" +
      (ci + 1) +
      " = " +
      Math.round(prevVal).toLocaleString() +
      " × " +
      (1 + growthPct / 100).toFixed(2) +
      " (" +
      growthPct +
      "% growth)"
    );
  }

  // L1 fold state (per project)
  var _l1Fold = _getL1Fold(currentProjectId);
  var _prevL1 = null;

  // Pre-pass: compute L1 group subtotals (per year) from children, and identify primary source
  var _l1Subtotals = {};
  upperItems.forEach(function (item) {
    var id = item.l1;
    if (!_l1Subtotals[id]) _l1Subtotals[id] = new Array(nCols).fill(0);
    item.vals.forEach(function (v, ci) {
      if (typeof v === "number") _l1Subtotals[id][ci] += v;
    });
  });

  // L1 source pill: derived from the mix of children's sources
  // (all hd → 'hd', all t12 → 't12', mixed → 'mixed' indicator)
  var _l1SrcMix = {};
  upperItems.forEach(function (item) {
    var id = item.l1;
    var s = item.src || "t12";
    if (!_l1SrcMix[id]) _l1SrcMix[id] = {};
    _l1SrcMix[id][s] = true;
  });

  // Compute L1 header display values — UNIFIED rule: L1 = Σ children (no special cases).
  // Source is determined by which sources its children use.
  function _l1DisplayInfo(l1id, folded) {
    var srcSet = Object.keys(_l1SrcMix[l1id] || {});
    var src = "t12";
    if (srcSet.length === 1) src = srcSet[0];
    else if (srcSet.length > 1) src = "manual"; // mixed sources → curated → Manual
    var info = {
      id: l1id,
      folded: folded,
      units: units,
      src: src,
      perUnitMonthly: null,
      vals: _l1Subtotals[l1id] || new Array(nCols).fill(0),
      mixed: srcSet.length > 1,
    };
    // Per-unit: avg(Y1,Y2) / units / 12
    var y1 = info.vals[0] || 0,
      y2 = info.vals[1] || 0;
    info.perUnitMonthly = (y1 + y2) / 2 / (units || 1) / 12;
    return info;
  }

  // Track which L1s have been rendered (header emitted) and closed (Add Field emitted)
  var _l1RenderedSet = {};
  var _l1ClosedSet = {};
  var _l1ValsCache = {}; // captures L1 vals for EGI computation

  function _emitL1Header(l1id) {
    var info = _l1DisplayInfo(l1id, !!_l1Fold[l1id]);
    _l1ValsCache[l1id] = info.vals || new Array(nCols).fill(0);
    upperHtml += _l1HeaderRowHtml(info, nCols);
  }

  function _closeL1Group(l1id) {
    if (_l1ClosedSet[l1id]) return;
    if (!_l1Fold[l1id]) {
      upperHtml += _addFieldButtonRowHtml(l1id, nCols);
    }
    _l1ClosedSet[l1id] = true;
  }

  function _emitL1IfNeeded(currentL1) {
    if (currentL1 === _prevL1) return;
    // Close the previous L1 group with its Add Field button
    if (_prevL1 != null) _closeL1Group(_prevL1);
    // Emit any missing L1 groups (in chart-of-accounts order) up to currentL1
    PF_COA.revenue.forEach(function (l1def) {
      if (l1def.computed) return;
      if (_l1RenderedSet[l1def.id]) return;
      var defIdx = PF_L1_ORDER[l1def.id];
      var curIdx = PF_L1_ORDER[currentL1];
      if (defIdx <= curIdx) {
        _emitL1Header(l1def.id);
        _l1RenderedSet[l1def.id] = true;
        // Empty intermediate L1 (no children in upperItems) → close immediately
        if (defIdx < curIdx) _closeL1Group(l1def.id);
      }
    });
    _prevL1 = currentL1;
  }

  upperItems.forEach(function (item, idx) {
    // Emit L1 header(s) up to and including this item's L1
    _emitL1IfNeeded(item.l1);
    // Skip rendering children when L1 is folded
    if (_l1Fold[item.l1]) return;

    var src = item.src;
    var t12Vals = item.vals; // original values
    var vals, perUnitMonthly, availSrcs;

    // hd-default rows already have HD values + projection baked in — preserve as-is
    if (item.kind === "hd-default") {
      vals = t12Vals;
      perUnitMonthly = HD_L1_AGGREGATE_PER_UNIT_MONTHLY[item.l1] || 0;
      availSrcs = ["hd"]; // single-source pill, no dropdown
    } else {
      // Available sources for Revenue & Expenses: T12 / HD / Manual only
      availSrcs =
        HD_PER_UNIT_MONTHLY[item.label] != null
          ? ["t12", "hd", "manual"]
          : ["t12", "manual"];
      if (src === "hd" && HD_PER_UNIT_MONTHLY[item.label]) {
        perUnitMonthly = HD_PER_UNIT_MONTHLY[item.label];
        var annualHD = perUnitMonthly * 12 * units;
        vals = [t12Vals[0], t12Vals[1], annualHD];
        for (var i = 3; i < nCols; i++)
          vals.push(Math.round(vals[i - 1] * rentRate * 100) / 100);
      } else {
        src = "t12";
        vals = t12Vals;
        var perUnitAnnual = (vals[0] + vals[1]) / 2;
        perUnitMonthly = perUnitAnnual / units / 12;
      }
    }

    // Check for manual overrides
    var manualOverrides = _getRowOverrides(item.label);
    if (manualOverrides) src = "manual";

    // Accumulate totals
    vals.forEach(function (v, ci) {
      upperTotals[ci] += v || 0;
    });

    var c = DS_COLORS[src];
    var stripe = idx % 2 === 1 ? "background:rgba(0,0,0,0.02);" : "";
    upperHtml +=
      '<tr style="' + stripe + 'border-bottom:1px solid var(--border)">';

    // Line Item + colored tag (section kind shows [SECTION NAME] + leaf count + ▶/▼ for L2 fold)
    var _displayLabel = item.displayLabel || item.label;
    var _isSection = item.kind === "section";
    var _l2folded = _isSection && !!_l2Fold[item.label];
    var _caret = _isSection
      ? "<span onclick=\"event.stopPropagation();toggleL2Fold('" +
        item.label.replace(/'/g, "\\'") +
        '\')" style="display:inline-block;width:14px;color:#4a7c59;cursor:pointer;margin-right:4px" title="Show/hide section items">' +
        (_l2folded ? "▶" : "▼") +
        "</span>"
      : "";
    var _leafSuffix =
      _isSection && item.leafCount
        ? ' <span style="color:var(--muted);font-size:10px;font-weight:400">(' +
          item.leafCount +
          " items)</span>"
        : "";
    upperHtml +=
      '<td style="' +
      _cellPad +
      'padding-left:28px;font-size:12px;color:var(--body);white-space:nowrap">' +
      _caret +
      _dsTag(src) +
      " " +
      _displayLabel +
      _leafSuffix +
      "</td>";

    // Per Unit — consistent sizing in both modes
    var puDisplay = fmtPerUnit(perUnitMonthly, src);
    if (isEditMode) {
      var puVal = Math.round(perUnitMonthly);
      var puW = Math.max(String(puVal).length * 7 + 16, 40);
      upperHtml +=
        '<td style="' +
        _cellPad +
        _cellRight +
        '">' +
        '<input type="text" value="' +
        puVal +
        '"' +
        " onchange=\"onIncomeFieldEdit('" +
        item.label.replace(/'/g, "\\'") +
        "','perunit',this.value)\"" +
        ' style="' +
        _editInputBase +
        "width:" +
        puW +
        "px;border:1px solid " +
        c.tag +
        ";color:" +
        c.tag +
        ";background:" +
        c.tagBg +
        '">' +
        "</td>";
    } else {
      upperHtml +=
        '<td style="' +
        _cellPad +
        _cellRight +
        'font-size:11px" title="Per Unit/mo from ' +
        c.label +
        '">' +
        puDisplay +
        '<span style="font-size:9px;color:var(--muted)">/mo</span></td>';
    }

    // Source dropdown — width fits current selected label exactly
    var selHtml;
    if (availSrcs.length > 1) {
      var w = _srcSelectWidth(c.label);
      var selStyle =
        "font-size:9px;padding:3px 18px 3px 10px;border:1px solid " +
        c.tag +
        ";border-radius:11px;color:" +
        c.tag +
        ";background:" +
        c.tagBg +
        ";cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;transition:all .15s;text-align:center;text-align-last:center;width:" +
        w +
        "px;background-image:url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='" +
        encodeURIComponent(c.tag) +
        "' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 6px center";
      selHtml =
        "<select onchange=\"changeRowSource('" +
        item.label.replace(/'/g, "\\'") +
        "',this.value)\"" +
        " onmouseenter=\"this.style.boxShadow='0 0 0 3px " +
        c.tagBg +
        "'\"" +
        " onmouseleave=\"this.style.boxShadow=''\"" +
        ' style="' +
        selStyle +
        '" title="Change data source">';
      availSrcs.forEach(function (s) {
        selHtml +=
          '<option value="' +
          s +
          '"' +
          (s === src ? " selected" : "") +
          ' style="background:#fff;color:' +
          DS_COLORS[s].tag +
          ';text-align:center">' +
          DS_COLORS[s].label +
          "</option>";
      });
      selHtml += "</select>";
    } else {
      // Single source: static pill (no chevron, compact)
      selHtml =
        '<span style="font-size:9px;padding:3px 10px;border:1px solid ' +
        c.tag +
        ";border-radius:11px;color:" +
        c.tag +
        ";background:" +
        c.tagBg +
        ';font-weight:700;letter-spacing:.05em;text-transform:uppercase;display:inline-block;text-align:center">' +
        c.label +
        "</span>";
    }
    upperHtml += '<td style="display:none">' + selHtml + "</td>";

    // Units — always editable (project-level, all rows synced)
    var _uW = Math.max(String(units).length * 9 + 22, 48);
    upperHtml +=
      '<td style="' +
      _cellPad +
      'text-align:center">' +
      '<input type="number" min="1" value="' +
      units +
      '"' +
      ' onchange="changeProjUnits(this.value)"' +
      ' style="width:' +
      _uW +
      'px;text-align:center;font-size:11px;padding:3px 6px;border:1px solid transparent;border-radius:3px;background:transparent;color:var(--body);outline:none;cursor:pointer"' +
      " onfocus=\"this.style.border='1px solid var(--border)';this.style.background='#fff'\"" +
      " onblur=\"this.style.border='1px solid transparent';this.style.background='transparent'\"" +
      ' title="Project units (edits sync to all rows)">' +
      "</td>";

    // Y1-Y7 with source-colored values + tooltips
    vals.forEach(function (v, ci) {
      var isProj = ci >= 3;
      var isStab = ci === 2;
      var borderL =
        ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var cellBg = "";
      var cellSrc = ci >= 2 && src !== "t12" ? src : ci < 2 ? "t12" : src;

      if (isProj || (isStab && src !== "t12")) {
        cellBg =
          "background:" +
          (src !== "t12" ? DS_COLORS[src].cell : "rgba(74,124,89,0.03)") +
          ";";
      } else if (isProj) {
        cellBg = "background:rgba(74,124,89,0.03);";
      }

      // Build tooltip
      var tooltip = "";
      if (isStab)
        tooltip = _stabTooltip(
          src,
          perUnitMonthly,
          units,
          t12Vals[0],
          t12Vals[1],
        );
      else if (isProj)
        tooltip = _projTooltip(vals[ci - 1], asmt.rentGrowth, ci);
      else tooltip = "T12 Actual";

      // Y3 (Stab) editable in edit mode
      if (isEditMode && isStab) {
        var stabStr = Math.round(v).toLocaleString();
        var stabW = Math.max(stabStr.length * 7 + 16, 60);
        upperHtml +=
          '<td style="' +
          _cellPad +
          _cellRight +
          cellBg +
          borderL +
          '" title="' +
          tooltip +
          '">' +
          '<input type="text" value="' +
          stabStr +
          '"' +
          " onchange=\"onIncomeFieldEdit('" +
          item.label.replace(/'/g, "\\'") +
          "','stab',this.value)\"" +
          ' style="' +
          _editInputBase +
          "width:" +
          stabW +
          "px;border:1px solid " +
          (src !== "t12" ? DS_COLORS[src].tag : "var(--border)") +
          ";color:" +
          (src !== "t12" ? DS_COLORS[src].tag : "var(--body)") +
          ';background:transparent">' +
          "</td>";
      } else {
        var displayVal = ci < 2 ? fmtNumPlain(v) : fmtNum(v, cellSrc);
        upperHtml +=
          '<td style="' +
          _cellPad +
          _cellRight +
          _cellFont +
          cellBg +
          borderL +
          '" title="' +
          tooltip +
          '">' +
          displayVal +
          "</td>";
      }
    });
    upperHtml += "</tr>";
    // L3: emit leaf rows under expanded section L2
    if (_isSection && !_l2folded && item.leaves) {
      item.leaves.forEach(function (lf) {
        upperHtml += _renderL3LeafRowHtml(lf, src, units, rentRate, nCols);
      });
    }
  });
  // After-loop: close the last open L1 group + emit any L1s that had no linked children
  if (_prevL1 != null) _closeL1Group(_prevL1);
  PF_COA.revenue.forEach(function (l1def) {
    if (l1def.computed) return;
    if (_l1RenderedSet[l1def.id]) return;
    _emitL1Header(l1def.id);
    _l1RenderedSet[l1def.id] = true;
    _closeL1Group(l1def.id);
  });

  // EGI row: special — computed/HD source switch, no L2 children, no Adjust button
  (function _emitEGI() {
    var egiSrc = _getEgiSrc(currentProjectId);
    var hasHDEgi =
      HD_L1_AGGREGATE_PER_UNIT_MONTHLY &&
      HD_L1_AGGREGATE_PER_UNIT_MONTHLY.egi != null;

    // Computed = formula sum from L1 vals cache
    var gpr = _l1ValsCache["gpr"] || new Array(nCols).fill(0);
    var vc = _l1ValsCache["vc"] || new Array(nCols).fill(0);
    var park = _l1ValsCache["parking"] || new Array(nCols).fill(0);
    var oth = _l1ValsCache["other"] || new Array(nCols).fill(0);
    var computedEgi = new Array(nCols);
    for (var i = 0; i < nCols; i++) {
      computedEgi[i] =
        (gpr[i] || 0) - (vc[i] || 0) + (park[i] || 0) + (oth[i] || 0);
    }

    var egi, displaySrc;
    if (egiSrc === "hd" && hasHDEgi) {
      var hdStab = HD_L1_ANNUAL.egi || 0;
      egi = [computedEgi[0] || 0, computedEgi[1] || 0, hdStab];
      for (var k = 3; k < nCols; k++)
        egi.push(Math.round(egi[k - 1] * rentRate * 100) / 100);
      displaySrc = "hd";
    } else {
      egi = computedEgi;
      displaySrc = "computed";
    }
    // Cache for buildExpenseTable (% of Revenue calc)
    window._pfEgiCache = egi.slice();

    var puMonthly =
      displaySrc === "hd" && hasHDEgi
        ? HD_L1_AGGREGATE_PER_UNIT_MONTHLY.egi
        : ((egi[0] || 0) + (egi[1] || 0)) / 2 / (units || 1) / 12;
    var puCell =
      !puMonthly || isNaN(puMonthly)
        ? '<span style="color:var(--muted);font-size:11px">—</span>'
        : '<span style="color:var(--header);font-size:11px;font-weight:700">$' +
          Math.round(puMonthly).toLocaleString() +
          '<span style="font-size:9px;color:var(--muted)">/mo</span></span>';

    // Source dropdown
    var srcOpts = [{ val: "computed", label: "Computed" }];
    if (hasHDEgi) srcOpts.unshift({ val: "hd", label: "HelloData" });
    var pillColor = DS_COLORS[displaySrc === "hd" ? "hd" : "t12"];
    var srcSel =
      '<select onchange="setEgiSrc(this.value)" style="font-size:9px;padding:3px 18px 3px 10px;border:1px solid ' +
      pillColor.tag +
      ";border-radius:11px;background:" +
      pillColor.tagBg +
      ";color:" +
      pillColor.tag +
      ';cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;text-align:center;text-align-last:center" title="EGI source">';
    srcOpts.forEach(function (o) {
      srcSel +=
        '<option value="' +
        o.val +
        '"' +
        (o.val === egiSrc ? " selected" : "") +
        ">" +
        o.label +
        "</option>";
    });
    srcSel += "</select>";

    var yearHtml = "";
    for (var j = 0; j < nCols; j++) {
      var v = egi[j];
      var bL = j === 3 ? "border-left:2px solid rgba(74,124,89,0.4);" : "";
      var bg =
        j >= 3
          ? "background:rgba(74,124,89,0.08);"
          : "background:rgba(74,124,89,0.04);";
      var diffNote = "";
      if (displaySrc === "hd" && j === 2 && computedEgi[2]) {
        var diff = v - computedEgi[2];
        if (Math.abs(diff) > 1) {
          diffNote =
            '<div style="font-size:9px;color:var(--muted);font-weight:500;margin-top:1px">vs sum: ' +
            (diff > 0 ? "+" : "") +
            Math.round(diff).toLocaleString() +
            "</div>";
        }
      }
      var disp =
        !v || v === 0
          ? '<span style="color:var(--muted)">—</span>'
          : v < 0
            ? "(" + Math.abs(Math.round(v)).toLocaleString() + ")"
            : Math.round(v).toLocaleString();
      yearHtml +=
        '<td style="padding:9px 8px;text-align:right;font-size:12.5px;font-weight:800;color:var(--header);' +
        bg +
        bL +
        '">' +
        disp +
        diffNote +
        "</td>";
    }
    var tooltip =
      displaySrc === "hd"
        ? "HD-reported EGI (statistical, distinct from formula sum due to model co-variance)."
        : "EGI = GPR − Vacancy & Concessions + Parking + Other Income (formula sum from L1 totals).";
    upperHtml +=
      '<tr style="background:rgba(74,124,89,0.12);border-top:2px solid rgba(74,124,89,0.4);border-bottom:' +
      (displaySrc === "hd" ? "1px" : "2px") +
      ' solid rgba(74,124,89,0.4)">' +
      '<td style="padding:9px 14px;font-size:12.5px;font-weight:800;color:var(--header);letter-spacing:.04em">Σ EFFECTIVE GROSS INCOME (EGI) <span title="' +
      tooltip.replace(/"/g, "&quot;") +
      '" style="color:var(--muted);font-size:11px;cursor:help">ⓘ</span> <span style="margin-left:10px;vertical-align:middle">' +
      srcSel +
      "</span></td>" +
      '<td style="padding:9px 8px;text-align:right">' +
      puCell +
      "</td>" +
      '<td style="display:none"></td>' +
      '<td style="padding:9px 8px;text-align:center;font-size:11px;color:var(--muted)">—</td>' +
      yearHtml +
      "</tr>";
    // Banner row — explanation of current source
    if (displaySrc === "hd") {
      var diffStab = (egi[2] || 0) - (computedEgi[2] || 0);
      var diffStr =
        (diffStab > 0 ? "+$" : "−$") +
        Math.abs(Math.round(diffStab)).toLocaleString();
      upperHtml +=
        '<tr style="background:rgba(21,101,192,0.06);border-bottom:2px solid rgba(74,124,89,0.4)">' +
        '<td colspan="11" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
        '<span style="color:#1565C0;font-weight:700">ⓘ</span> ' +
        '<span style="font-weight:600">EGI uses HelloData\'s reported aggregate value.</span> ' +
        "It differs from the formula sum (GPR − V&C + Parking + Other) by " +
        '<span style="font-weight:700;color:#1565C0">' +
        diffStr +
        "</span> at Stab, " +
        "due to HD's statistical co-variance adjustment between line items. " +
        "The 4 income categories above remain curated from your field selections — " +
        "switch to <em>Computed</em> if you want the sum to drive EGI." +
        "</td></tr>";
    } else {
      upperHtml +=
        '<tr style="background:rgba(46,125,50,0.05);border-bottom:2px solid rgba(74,124,89,0.4)">' +
        '<td colspan="11" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
        '<span style="color:#2E7D32;font-weight:700">ⓘ</span> ' +
        '<span style="font-weight:600">EGI is computed from the 4 income categories above.</span> ' +
        'Formula: <code style="background:rgba(0,0,0,0.04);padding:1px 5px;border-radius:3px;font-size:10.5px">EGI = GPR − Vacancy & Concessions + Parking Income + Other Income</code>, ' +
        "applied year-by-year. Each category value is the sum of its line items (HD aggregate + any T12 fields you added). " +
        "Switch to <em>HelloData</em> to use HD's reported EGI aggregate instead." +
        "</td></tr>";
    }
  })();

  upperBody.innerHTML = upperHtml;

  // Upper subtotal
  upperSub.innerHTML =
    '<tr style="background:rgba(74,124,89,0.08);border-top:1px solid rgba(74,124,89,0.2);border-bottom:2px solid rgba(74,124,89,0.25)">' +
    '<td style="padding:7px 14px;font-size:12px;font-weight:700;color:var(--header)">Subtotal (Per-Unit Income)</td>' +
    "<td></td><td></td><td></td>" +
    upperTotals
      .map(function (v, ci) {
        var borderL =
          ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
        var bg = ci >= 3 ? "background:rgba(74,124,89,0.06);" : "";
        return (
          '<td style="padding:7px 8px;text-align:right;font-size:12px;font-weight:700;color:var(--header);' +
          bg +
          borderL +
          '">' +
          fmtNumPlain(v) +
          "</td>"
        );
      })
      .join("") +
    "</tr>";

  // Build lower table rows
  var lowerHtml = "";
  var lowerTotals = new Array(nCols).fill(0);

  lowerItems.forEach(function (item, idx) {
    var vals = item.vals;
    vals.forEach(function (v, ci) {
      lowerTotals[ci] += v || 0;
    });

    var stripe = idx % 2 === 1 ? "background:rgba(0,0,0,0.02);" : "";
    lowerHtml +=
      '<tr style="' + stripe + 'border-bottom:1px solid var(--border)">';
    lowerHtml +=
      '<td style="padding:7px 14px;font-size:12px;color:var(--body)">' +
      _dsTag("t12") +
      " " +
      item.label +
      "</td>";
    lowerHtml +=
      '<td style="padding:7px 8px;text-align:right;font-size:11px;color:var(--muted)">—</td>';
    lowerHtml +=
      '<td style="padding:7px 8px;text-align:center;font-size:10px;color:var(--muted)">—</td>';
    lowerHtml +=
      '<td style="padding:7px 8px;text-align:right;font-size:11px;color:var(--muted)">—</td>';
    vals.forEach(function (v, ci) {
      var isProj = ci >= 3;
      var borderL =
        ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = isProj ? "background:rgba(74,124,89,0.03);" : "";
      lowerHtml +=
        '<td style="padding:7px 8px;text-align:right;font-size:12px;color:var(--body);' +
        bg +
        borderL +
        '">' +
        fmtNumPlain(v) +
        "</td>";
    });
    lowerHtml += "</tr>";
  });

  if (lowerItems.length === 0) {
    lowerHtml =
      '<tr><td colspan="11" style="padding:7px 14px;font-size:11px;color:var(--muted);font-style:italic">No other income items</td></tr>';
  }
  lowerBody.innerHTML = lowerHtml;

  // Lower subtotal
  lowerSub.innerHTML =
    '<tr style="background:rgba(74,124,89,0.08);border-top:1px solid rgba(74,124,89,0.2);border-bottom:1px solid rgba(74,124,89,0.2)">' +
    '<td style="padding:7px 14px;font-size:12px;font-weight:700;color:var(--header)">Subtotal (Other Income)</td>' +
    "<td></td><td></td><td></td>" +
    lowerTotals
      .map(function (v, ci) {
        var borderL =
          ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
        var bg = ci >= 3 ? "background:rgba(74,124,89,0.06);" : "";
        return (
          '<td style="padding:7px 8px;text-align:right;font-size:12px;font-weight:700;color:var(--header);' +
          bg +
          borderL +
          '">' +
          fmtNumPlain(v) +
          "</td>"
        );
      })
      .join("") +
    "</tr>";

  // Total Revenue
  var totalVals = upperTotals.map(function (v, ci) {
    return v + lowerTotals[ci];
  });
  totalBody.innerHTML =
    '<tr style="background:rgba(74,124,89,0.16);border-top:2px solid rgba(74,124,89,0.35);border-bottom:2px solid rgba(74,124,89,0.35)">' +
    '<td style="padding:8px 14px;font-size:13px;font-weight:800;color:var(--green)">Total Revenue</td>' +
    "<td></td><td></td><td></td>" +
    totalVals
      .map(function (v, ci) {
        var borderL =
          ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
        var bg = ci >= 3 ? "background:rgba(74,124,89,0.08);" : "";
        return (
          '<td style="padding:8px 8px;text-align:right;font-size:13px;font-weight:800;color:var(--green);' +
          bg +
          borderL +
          '">' +
          fmtNumPlain(v) +
          "</td>"
        );
      })
      .join("") +
    "</tr>";
}

// ── EXPENSE TABLE (HD L1 + T12 L2 — mirrors Revenue) ───────────────────
function buildExpenseTable() {
  var upperBody = document.getElementById("pfExpUpperBody");
  if (!upperBody) return;

  // Ensure HD aggregates are populated
  var _hdForExpPopulate = getHDData(currentProjectId);
  if (_hdForExpPopulate && !HD_L1_AGGREGATE_PER_UNIT_MONTHLY.tax) {
    _populateHDL1Aggregates(_hdForExpPopulate);
  }

  // If no data uploaded at all (no HD and no T12), show empty state
  var _hdMetaExp = getHDMeta(currentProjectId);
  var _expColHdrRow = document.getElementById("pfExpColHdrRow");
  if (_expColHdrRow) _expColHdrRow.style.display = "";
  if (!_hdMetaExp && !_pfLoaded) {
    var zh = currentLang === "zh";
    upperBody.innerHTML =
      '<tr><td colspan="11" style="padding:40px 14px;text-align:center;color:var(--muted);font-size:13px">' +
      (zh
        ? "请先上传 T12 或 HelloData 文件以填充费用数据"
        : "Upload a T12 or HelloData file to populate expense data") +
      "</td></tr>";
    window._expenseTotals = new Array(7).fill(0);
    return;
  }

  var pf = _pfLoaded
    ? _getProjectPFData(currentProjectId) || PF_DATA
    : _emptyPFData();
  var nCols = 7;
  var asmt = getProjectAssumptions();
  var rentRate = 1 + asmt.rentGrowth / 100;
  var opexRate = 1 + asmt.opexGrowth / 100;
  var taxRate = 1 + asmt.taxGrowth / 100;
  var _projExp = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  var units = _resolveUnits(currentProjectId);

  var _cellPad = "padding:7px 8px;";
  var _cellRight = "text-align:right;";
  var _cellFont = "font-size:12px;";

  function fmtNumPlain(v) {
    if (v === null || v === undefined)
      return '<span style="color:var(--muted)">—</span>';
    var n = parseFloat(v);
    if (isNaN(n) || n === 0) return '<span style="color:var(--muted)">—</span>';
    if (n < 0)
      return (
        '<span style="color:var(--body)">(' +
        Math.abs(Math.round(n)).toLocaleString() +
        ")</span>"
      );
    return (
      '<span style="color:var(--body)">' +
      Math.round(n).toLocaleString() +
      "</span>"
    );
  }
  function fmtPerUnitPlain(v) {
    if (v === null || v === undefined || isNaN(v) || v === 0)
      return '<span style="color:var(--muted)">—</span>';
    if (v < 0)
      return (
        '<span style="color:var(--body)">($' +
        Math.abs(Math.round(v)).toLocaleString() +
        ")</span>"
      );
    return (
      '<span style="color:var(--body)">$' +
      Math.round(v).toLocaleString() +
      "</span>"
    );
  }
  function projectVals(vals, isTax) {
    var v = (vals || []).slice();
    var r = isTax ? taxRate : opexRate;
    while (v.length < nCols) {
      var last = v[v.length - 1];
      v.push(last ? Math.round(last * r * 100) / 100 : 0);
    }
    return v;
  }

  // Build upperItems via PF_COA.opex walk + _resolveL1Children
  var upperItems = [];
  var _resolveCtx = {
    units: units,
    nCols: nCols,
    rentRate: rentRate,
    opexRate: opexRate,
    taxRate: taxRate,
  };
  PF_COA.opex.forEach(function (l1def) {
    if (l1def.computed) return;
    var resolved = _resolveL1Children(l1def.id, "opex", _resolveCtx);
    resolved.forEach(function (r) {
      var rowSrc = r.src || "t12";
      upperItems.push({
        label: r.label,
        displayLabel: r.displayLabel,
        vals: projectVals(r.vals, l1def.id === "tax"),
        src: rowSrc,
        l1: l1def.id,
        kind: r.kind,
        leafCount: r.leafCount || null,
        leaves: r.leaves || null,
      });
    });
  });

  // L1 subtotals + source mix
  var _l1Subtotals = {};
  var _l1SrcMix = {};
  upperItems.forEach(function (item) {
    var id = item.l1;
    if (!_l1Subtotals[id]) _l1Subtotals[id] = new Array(nCols).fill(0);
    item.vals.forEach(function (v, ci) {
      if (typeof v === "number") _l1Subtotals[id][ci] += v;
    });
    if (!_l1SrcMix[id]) _l1SrcMix[id] = {};
    _l1SrcMix[id][item.src || "t12"] = true;
  });

  var _l1Fold = _getL1Fold(currentProjectId);
  var _l2Fold = _getL2Fold(currentProjectId);

  function _l1DisplayInfo(l1id, folded) {
    var srcSet = Object.keys(_l1SrcMix[l1id] || {});
    var src = "t12";
    if (srcSet.length === 1) src = srcSet[0];
    else if (srcSet.length > 1) src = "manual";
    var info = {
      id: l1id,
      folded: folded,
      units: units,
      src: src,
      perUnitMonthly: null,
      vals: _l1Subtotals[l1id] || new Array(nCols).fill(0),
      mixed: srcSet.length > 1,
    };
    var y1 = info.vals[0] || 0,
      y2 = info.vals[1] || 0;
    info.perUnitMonthly = (y1 + y2) / 2 / (units || 1) / 12;
    return info;
  }

  function _renderL3LeafRowHtml(leaf, parentSrc, isTaxL1) {
    var rate = isTaxL1 ? taxRate : opexRate;
    var vals = (leaf.vals || []).slice();
    while (vals.length < nCols) {
      var last = vals[vals.length - 1];
      vals.push(last ? Math.round(last * rate * 100) / 100 : 0);
    }
    var perUnitMonthly =
      ((vals[0] || 0) + (vals[1] || 0)) / 2 / (units || 1) / 12;
    var puCell =
      perUnitMonthly === 0 || isNaN(perUnitMonthly)
        ? '<span style="color:var(--muted)">—</span>'
        : perUnitMonthly < 0
          ? '<span style="color:var(--body);font-size:11px">($' +
            Math.abs(Math.round(perUnitMonthly)).toLocaleString() +
            ")</span>"
          : '<span style="color:var(--body);font-size:11px">$' +
            Math.round(perUnitMonthly).toLocaleString() +
            "</span>";
    var yearHtml = "";
    for (var i = 0; i < nCols; i++) {
      var v = vals[i];
      var borderL = i === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = i >= 3 ? "background:rgba(74,124,89,0.03);" : "";
      var disp;
      if (v == null || v === 0)
        disp = '<span style="color:var(--muted)">—</span>';
      else if (v < 0)
        disp =
          '<span style="color:var(--body)">(' +
          Math.abs(Math.round(v)).toLocaleString() +
          ")</span>";
      else
        disp =
          '<span style="color:var(--body)">' +
          Math.round(v).toLocaleString() +
          "</span>";
      yearHtml +=
        '<td style="padding:5px 8px;text-align:right;font-size:11px;' +
        bg +
        borderL +
        '">' +
        disp +
        "</td>";
    }
    return (
      '<tr style="background:rgba(0,0,0,0.015);border-bottom:1px solid rgba(0,0,0,0.04)">' +
      '<td style="padding:5px 8px 5px 56px;font-size:11px;color:var(--muted);white-space:nowrap"><span style="color:var(--muted);margin-right:6px">└</span>' +
      leaf.label +
      "</td>" +
      '<td style="padding:5px 8px;text-align:right">' +
      puCell +
      '<span style="font-size:9px;color:var(--muted)">/mo</span></td>' +
      '<td style="display:none"></td>' +
      '<td style="padding:5px 8px;text-align:center;font-size:11px;color:var(--muted)">' +
      units +
      "</td>" +
      yearHtml +
      "</tr>"
    );
  }

  // Render
  var upperHtml = "";
  var _l1RenderedSet = {},
    _l1ClosedSet = {},
    _prevL1 = null,
    _l1ValsCache = {};

  function _emitL1Header(l1id) {
    var info = _l1DisplayInfo(l1id, !!_l1Fold[l1id]);
    _l1ValsCache[l1id] = info.vals || new Array(nCols).fill(0);
    upperHtml += _l1HeaderRowHtml(info, nCols);
  }
  function _closeL1Group(l1id) {
    if (_l1ClosedSet[l1id]) return;
    if (!_l1Fold[l1id]) upperHtml += _addFieldButtonRowHtml(l1id, nCols);
    _l1ClosedSet[l1id] = true;
  }
  function _emitL1IfNeeded(currentL1) {
    if (currentL1 === _prevL1) return;
    if (_prevL1 != null) _closeL1Group(_prevL1);
    PF_COA.opex.forEach(function (l1def) {
      if (l1def.computed) return;
      if (_l1RenderedSet[l1def.id]) return;
      var defIdx = PF_L1_ORDER[l1def.id];
      var curIdx = PF_L1_ORDER[currentL1];
      if (defIdx <= curIdx) {
        _emitL1Header(l1def.id);
        _l1RenderedSet[l1def.id] = true;
        if (defIdx < curIdx) _closeL1Group(l1def.id);
      }
    });
    _prevL1 = currentL1;
  }

  upperItems.forEach(function (item) {
    _emitL1IfNeeded(item.l1);
    if (_l1Fold[item.l1]) return;

    var src = item.src || "t12";
    var vals = item.vals;
    var perUnitMonthly;
    if (item.kind === "hd-default") {
      perUnitMonthly = HD_L1_AGGREGATE_PER_UNIT_MONTHLY[item.l1] || 0;
    } else {
      perUnitMonthly =
        ((vals[0] || 0) + (vals[1] || 0)) / 2 / (units || 1) / 12;
    }

    upperHtml += '<tr style="border-bottom:1px solid rgba(0,0,0,0.04)">';

    var _displayLabel = item.displayLabel || item.label;
    var _isSection = item.kind === "section";
    var _l2folded = _isSection && !!_l2Fold[item.label];
    var _caret = _isSection
      ? "<span onclick=\"event.stopPropagation();toggleL2Fold('" +
        item.label.replace(/'/g, "\\'") +
        '\')" style="display:inline-block;width:14px;color:#4a7c59;cursor:pointer;margin-right:4px" title="Show/hide section items">' +
        (_l2folded ? "▶" : "▼") +
        "</span>"
      : "";
    var _leafSuffix =
      _isSection && item.leafCount
        ? ' <span style="color:var(--muted);font-size:10px;font-weight:400">(' +
          item.leafCount +
          " items)</span>"
        : "";
    upperHtml +=
      '<td style="' +
      _cellPad +
      'padding-left:28px;font-size:12px;color:var(--body);white-space:nowrap">' +
      _caret +
      _dsTag(src) +
      " " +
      _displayLabel +
      _leafSuffix +
      "</td>";
    upperHtml +=
      '<td style="' +
      _cellPad +
      _cellRight +
      'font-size:11px">' +
      fmtPerUnitPlain(perUnitMonthly) +
      '<span style="font-size:9px;color:var(--muted)">/mo</span></td>';
    upperHtml += '<td style="display:none"></td>';
    var _uW = Math.max(String(units).length * 9 + 22, 48);
    upperHtml +=
      '<td style="' +
      _cellPad +
      'text-align:center">' +
      '<input type="number" min="1" value="' +
      units +
      '"' +
      ' onchange="changeProjUnits(this.value)"' +
      ' style="width:' +
      _uW +
      'px;text-align:center;font-size:11px;padding:3px 6px;border:1px solid transparent;border-radius:3px;background:transparent;color:var(--body);outline:none;cursor:pointer"' +
      " onfocus=\"this.style.border='1px solid var(--border)';this.style.background='#fff'\"" +
      " onblur=\"this.style.border='1px solid transparent';this.style.background='transparent'\"" +
      "></td>";
    vals.forEach(function (v, ci) {
      var borderL =
        ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = ci >= 3 ? "background:rgba(74,124,89,0.03);" : "";
      upperHtml +=
        '<td style="' +
        _cellPad +
        _cellRight +
        _cellFont +
        bg +
        borderL +
        '">' +
        fmtNumPlain(v) +
        "</td>";
    });
    upperHtml += "</tr>";

    if (_isSection && !_l2folded && item.leaves) {
      item.leaves.forEach(function (lf) {
        upperHtml += _renderL3LeafRowHtml(lf, src, item.l1 === "tax");
      });
    }
  });

  if (_prevL1 != null) _closeL1Group(_prevL1);
  PF_COA.opex.forEach(function (l1def) {
    if (l1def.computed) return;
    if (_l1RenderedSet[l1def.id]) return;
    _emitL1Header(l1def.id);
    _l1RenderedSet[l1def.id] = true;
    _closeL1Group(l1def.id);
  });

  // ── Σ Total Operating Expenses (HD/Computed source switch) ──
  (function _emitTotalOpex() {
    var totSrc =
      localStorage.getItem("pf_total_opex_src_" + currentProjectId) ||
      "computed";
    var hasHD = HD_L1_AGGREGATE_PER_UNIT_MONTHLY.total_opex != null;
    var computedTot = new Array(nCols).fill(0);
    Object.keys(_l1ValsCache).forEach(function (k) {
      _l1ValsCache[k].forEach(function (v, ci) {
        computedTot[ci] += v || 0;
      });
    });
    var tot, displaySrc;
    if (totSrc === "hd" && hasHD) {
      var hdPU = HD_L1_AGGREGATE_PER_UNIT_MONTHLY.total_opex;
      var hdStab = hdPU * 12 * units;
      tot = [computedTot[0] || 0, computedTot[1] || 0, hdStab];
      for (var k = 3; k < nCols; k++)
        tot.push(Math.round(tot[k - 1] * opexRate * 100) / 100);
      displaySrc = "hd";
    } else {
      tot = computedTot;
      displaySrc = "computed";
    }
    var puMonthly =
      displaySrc === "hd" && hasHD
        ? HD_L1_AGGREGATE_PER_UNIT_MONTHLY.total_opex
        : ((tot[0] || 0) + (tot[1] || 0)) / 2 / (units || 1) / 12;
    var puCell =
      !puMonthly || isNaN(puMonthly)
        ? '<span style="color:var(--muted);font-size:11px">—</span>'
        : '<span style="color:var(--header);font-size:11px;font-weight:700">$' +
          Math.round(puMonthly).toLocaleString() +
          '<span style="font-size:9px;color:var(--muted)">/mo</span></span>';
    var srcOpts = [{ val: "computed", label: "Computed" }];
    if (hasHD) srcOpts.unshift({ val: "hd", label: "HelloData" });
    var pillColor = DS_COLORS[displaySrc === "hd" ? "hd" : "t12"];
    var srcSel =
      '<select onchange="setTotalOpexSrc(this.value)" style="font-size:9px;padding:3px 18px 3px 10px;border:1px solid ' +
      pillColor.tag +
      ";border-radius:11px;background:" +
      pillColor.tagBg +
      ";color:" +
      pillColor.tag +
      ';cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;text-align:center;text-align-last:center" title="Total OpEx source">';
    srcOpts.forEach(function (o) {
      srcSel +=
        '<option value="' +
        o.val +
        '"' +
        (o.val === totSrc ? " selected" : "") +
        ">" +
        o.label +
        "</option>";
    });
    srcSel += "</select>";
    var yearHtml = "";
    for (var j = 0; j < nCols; j++) {
      var v = tot[j];
      var bL = j === 3 ? "border-left:2px solid rgba(74,124,89,0.4);" : "";
      var bg =
        j >= 3
          ? "background:rgba(74,124,89,0.08);"
          : "background:rgba(74,124,89,0.04);";
      var diffNote = "";
      if (displaySrc === "hd" && j === 2 && computedTot[2]) {
        var diff = v - computedTot[2];
        if (Math.abs(diff) > 1) {
          diffNote =
            '<div style="font-size:9px;color:var(--muted);font-weight:500;margin-top:1px">vs sum: ' +
            (diff > 0 ? "+" : "") +
            Math.round(diff).toLocaleString() +
            "</div>";
        }
      }
      var disp =
        !v || v === 0
          ? '<span style="color:var(--muted)">—</span>'
          : v < 0
            ? "(" + Math.abs(Math.round(v)).toLocaleString() + ")"
            : Math.round(v).toLocaleString();
      yearHtml +=
        '<td style="padding:9px 8px;text-align:right;font-size:12.5px;font-weight:800;color:var(--header);' +
        bg +
        bL +
        '">' +
        disp +
        diffNote +
        "</td>";
    }
    upperHtml +=
      '<tr style="background:rgba(74,124,89,0.12);border-top:2px solid rgba(74,124,89,0.4);border-bottom:1px solid rgba(74,124,89,0.25)">' +
      '<td style="padding:9px 14px;font-size:12.5px;font-weight:800;color:var(--header);letter-spacing:.04em">Σ TOTAL OPERATING EXPENSES <span style="margin-left:10px;vertical-align:middle">' +
      srcSel +
      "</span></td>" +
      '<td style="padding:9px 8px;text-align:right">' +
      puCell +
      "</td>" +
      '<td style="display:none"></td>' +
      '<td style="padding:9px 8px;text-align:center;font-size:11px;color:var(--muted)">—</td>' +
      yearHtml +
      "</tr>";
    // Banner row — explanation of current source
    if (displaySrc === "hd") {
      var diffStabT = (tot[2] || 0) - (computedTot[2] || 0);
      var diffStrT =
        (diffStabT > 0 ? "+$" : "−$") +
        Math.abs(Math.round(diffStabT)).toLocaleString();
      upperHtml +=
        '<tr style="background:rgba(21,101,192,0.06);border-bottom:1px solid rgba(74,124,89,0.25)">' +
        '<td colspan="11" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
        '<span style="color:#1565C0;font-weight:700">ⓘ</span> ' +
        '<span style="font-weight:600">Total OpEx uses HelloData\'s reported aggregate value.</span> ' +
        "It differs from the sum of the 10 expense categories above by " +
        '<span style="font-weight:700;color:#1565C0">' +
        diffStrT +
        "</span> at Stab, " +
        "due to HD's statistical co-variance adjustment. " +
        "The 10 expense categories above remain curated from your field selections — " +
        "switch to <em>Computed</em> if you want the sum to drive Total OpEx." +
        "</td></tr>";
    } else {
      upperHtml +=
        '<tr style="background:rgba(46,125,50,0.05);border-bottom:1px solid rgba(74,124,89,0.25)">' +
        '<td colspan="11" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
        '<span style="color:#2E7D32;font-weight:700">ⓘ</span> ' +
        '<span style="font-weight:600">Total OpEx is computed by summing the 10 expense categories above.</span> ' +
        'Formula: <code style="background:rgba(0,0,0,0.04);padding:1px 5px;border-radius:3px;font-size:10.5px">Total OpEx = Σ (Real Estate Taxes + Property Insurance + … + Other Expenses)</code>, ' +
        "applied year-by-year. Each category value is the sum of its line items. " +
        "Switch to <em>HelloData</em> to use HD's reported Total OpEx aggregate instead." +
        "</td></tr>";
    }
    window._pfTotalOpexCache = tot.slice();
  })();

  // ── Opex Ratio (Total OpEx / EGI × 100%) — highlighted analytical KPI row ──
  (function _emitOpexRatio() {
    var egi = window._pfEgiCache || new Array(nCols).fill(0);
    var tot = window._pfTotalOpexCache || new Array(nCols).fill(0);
    var yearHtml = "";
    for (var j = 0; j < nCols; j++) {
      var pct = egi[j] && egi[j] > 0 ? (tot[j] / egi[j]) * 100 : null;
      var bL = j === 3 ? "border-left:2px solid rgba(139,111,71,0.35);" : "";
      var bg =
        j >= 3
          ? "background:rgba(139,111,71,0.10);"
          : "background:rgba(139,111,71,0.06);";
      var disp =
        pct == null || isNaN(pct)
          ? '<span style="color:var(--muted)">—</span>'
          : pct.toFixed(1) + "%";
      yearHtml +=
        '<td style="padding:8px 8px;text-align:right;font-size:11.5px;font-weight:700;color:#6B5435;' +
        bg +
        bL +
        '">' +
        disp +
        "</td>";
    }
    upperHtml +=
      '<tr style="background:rgba(139,111,71,0.06);border-top:1px solid rgba(139,111,71,0.25);border-bottom:2px solid rgba(139,111,71,0.25)">' +
      '<td style="padding:8px 14px;font-size:11.5px;font-weight:700;color:#6B5435;letter-spacing:.04em;text-transform:uppercase" title="Opex Ratio = Total Operating Expenses / EGI">Opex Ratio</td>' +
      '<td></td><td style="display:none"></td><td></td>' +
      yearHtml +
      "</tr>";
  })();

  upperBody.innerHTML = upperHtml;
  // Clear legacy expense sub-tables (replaced by L1 tree model)
  [
    "pfExpUpperSubtotal",
    "pfExpLowerBody",
    "pfExpLowerSubtotal",
    "pfExpTotalBody",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  window._expenseTotals = window._pfTotalOpexCache;
}

// Total OpEx source state ('hd' | 'computed') — persisted per project
function setTotalOpexSrc(src) {
  localStorage.setItem("pf_total_opex_src_" + currentProjectId, src);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.setTotalOpexSrc = setTotalOpexSrc;

// NOI source state ('hd' | 'computed') — default Computed
function _getNoiSrc(pid) {
  return (
    localStorage.getItem("pf_noi_src_" + (pid || currentProjectId)) ||
    "computed"
  );
}
function setNoiSrc(src) {
  localStorage.setItem("pf_noi_src_" + currentProjectId, src);
  if (typeof buildPFTable === "function") buildPFTable();
}
window.setNoiSrc = setNoiSrc;

// ── NOI rendered inside Revenue & Expenses tab (at the existing pfNoiBody) ──
function buildNoiTabTable() {
  var tbody = document.getElementById("pfNoiBody");
  if (!tbody) return;
  var nCols = 7;
  var pf = _pfLoaded
    ? _getProjectPFData(currentProjectId) || PF_DATA
    : _emptyPFData();
  var asmt = getProjectAssumptions();
  var rentRate = 1 + asmt.rentGrowth / 100;
  var opexRate = 1 + asmt.opexGrowth / 100;
  var _proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  var units = _resolveUnits(currentProjectId);

  var noiSrc = _getNoiSrc(currentProjectId);
  var hasHDNoi = HD_L1_AGGREGATE_PER_UNIT_MONTHLY.noi != null;

  // Pull cached values from buildIncomeTable / buildExpenseTable
  var egi = (window._pfEgiCache || new Array(nCols).fill(0)).slice();
  var totOpex = (window._pfTotalOpexCache || new Array(nCols).fill(0)).slice();
  var computedNoi = egi.map(function (e, i) {
    return Math.round((e - (totOpex[i] || 0)) * 100) / 100;
  });

  var noi, displaySrc;
  if (noiSrc === "hd" && hasHDNoi) {
    var hdStab = HD_L1_ANNUAL.noi || 0;
    // Y1, Y2: use computed (T12 historical via EGI - OpEx); Stab onward: HD
    noi = [computedNoi[0] || 0, computedNoi[1] || 0, hdStab];
    var noiGrowth = (rentRate + opexRate) / 2; // blended growth
    for (var k = 3; k < nCols; k++)
      noi.push(Math.round(noi[k - 1] * noiGrowth * 100) / 100);
    displaySrc = "hd";
  } else {
    noi = computedNoi;
    displaySrc = "computed";
  }

  var puMonthly =
    displaySrc === "hd" && hasHDNoi
      ? HD_L1_AGGREGATE_PER_UNIT_MONTHLY.noi
      : ((noi[0] || 0) + (noi[1] || 0)) / 2 / (units || 1) / 12;
  var puCell =
    !puMonthly || isNaN(puMonthly)
      ? '<span style="color:var(--muted);font-size:11px">—</span>'
      : '<span style="color:var(--header);font-size:11px;font-weight:700">$' +
        Math.round(puMonthly).toLocaleString() +
        '<span style="font-size:9px;color:var(--muted)">/mo</span></span>';

  var srcOpts = [{ val: "computed", label: "Computed" }];
  if (hasHDNoi) srcOpts.unshift({ val: "hd", label: "HelloData" });
  var pillColor = DS_COLORS[displaySrc === "hd" ? "hd" : "t12"];
  var srcSel =
    '<select onchange="setNoiSrc(this.value)" style="font-size:9px;padding:3px 18px 3px 10px;border:1px solid ' +
    pillColor.tag +
    ";border-radius:11px;background:" +
    pillColor.tagBg +
    ";color:" +
    pillColor.tag +
    ';cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;text-align:center;text-align-last:center" title="NOI source">';
  srcOpts.forEach(function (o) {
    srcSel +=
      '<option value="' +
      o.val +
      '"' +
      (o.val === noiSrc ? " selected" : "") +
      ">" +
      o.label +
      "</option>";
  });
  srcSel += "</select>";

  var yearHtml = "";
  for (var j = 0; j < nCols; j++) {
    var v = noi[j];
    var bL = j === 3 ? "border-left:2px solid rgba(74,124,89,0.4);" : "";
    var bg =
      j >= 3
        ? "background:rgba(74,124,89,0.08);"
        : "background:rgba(74,124,89,0.04);";
    var diffNote = "";
    if (displaySrc === "hd" && j === 2 && computedNoi[2]) {
      var diff = v - computedNoi[2];
      if (Math.abs(diff) > 1) {
        diffNote =
          '<div style="font-size:9px;color:var(--muted);font-weight:500;margin-top:1px">vs computed: ' +
          (diff > 0 ? "+" : "") +
          Math.round(diff).toLocaleString() +
          "</div>";
      }
    }
    var disp =
      !v || v === 0
        ? '<span style="color:var(--muted)">—</span>'
        : v < 0
          ? '<span style="color:var(--body)">(' +
            Math.abs(Math.round(v)).toLocaleString() +
            ")</span>"
          : '<span style="color:var(--body)">' +
            Math.round(v).toLocaleString() +
            "</span>";
    yearHtml +=
      '<td style="padding:11px 8px;text-align:right;font-size:13px;font-weight:800;color:var(--header);' +
      bg +
      bL +
      '">' +
      disp +
      diffNote +
      "</td>";
  }

  var html = "";
  html +=
    '<tr style="background:rgba(74,124,89,0.14);border-top:2px solid rgba(74,124,89,0.45);border-bottom:1px solid rgba(74,124,89,0.3)">' +
    '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:var(--header);letter-spacing:.04em">Σ NET OPERATING INCOME (NOI) <span style="margin-left:10px;vertical-align:middle">' +
    srcSel +
    "</span></td>" +
    '<td style="padding:11px 8px;text-align:right">' +
    puCell +
    "</td>" +
    yearHtml +
    "</tr>";

  // Banner explaining the source — existing pfNoiBody table has 9 columns total
  if (displaySrc === "hd") {
    var diffStabN = (noi[2] || 0) - (computedNoi[2] || 0);
    var diffStrN =
      (diffStabN > 0 ? "+$" : "−$") +
      Math.abs(Math.round(diffStabN)).toLocaleString();
    html +=
      '<tr style="background:rgba(21,101,192,0.06);border-bottom:2px solid rgba(74,124,89,0.3)">' +
      '<td colspan="9" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
      '<span style="color:#1565C0;font-weight:700">ⓘ</span> ' +
      '<span style="font-weight:600">NOI uses HelloData\'s reported aggregate value.</span> ' +
      "It differs from the computed value (EGI − Total OpEx) by " +
      '<span style="font-weight:700;color:#1565C0">' +
      diffStrN +
      "</span> at Stab, " +
      "due to HD's statistical co-variance adjustment between revenue and expense projections. " +
      "Switch to <em>Computed</em> if you want EGI − Total OpEx to drive NOI." +
      "</td></tr>";
  } else {
    html +=
      '<tr style="background:rgba(46,125,50,0.05);border-bottom:2px solid rgba(74,124,89,0.3)">' +
      '<td colspan="9" style="padding:8px 14px 10px 28px;font-size:11px;line-height:1.5;color:var(--body)">' +
      '<span style="color:#2E7D32;font-weight:700">ⓘ</span> ' +
      '<span style="font-weight:600">NOI is computed from the totals above.</span> ' +
      'Formula: <code style="background:rgba(0,0,0,0.04);padding:1px 5px;border-radius:3px;font-size:10.5px">NOI = EGI − Total Operating Expenses</code>, ' +
      "applied year-by-year. EGI and Total OpEx each have their own source switch above. " +
      "Switch to <em>HelloData</em> to use HD's reported NOI aggregate instead." +
      "</td></tr>";
  }

  tbody.innerHTML = html;
  window._pfNoiCache = noi.slice();
}

// ── Expense Add Field Modal ─────────────────────────────────
function openExpAddFieldModal() {
  var modal = document.getElementById("addExpFieldModal");
  if (!modal) return;
  var pid = window._currentProjectId || "default";
  var added = _getExpAddedFields(pid);
  var list = document.getElementById("addExpFieldList");
  if (!list) return;
  var html = "";
  EXP_ADDABLE_FIELDS.forEach(function (f) {
    var isAdded = added.indexOf(f.id) !== -1;
    var c = DS_COLORS[f.src];
    html +=
      '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:' +
      (isAdded ? "not-allowed" : "pointer") +
      ";" +
      (isAdded ? "opacity:0.4;" : "") +
      'background:rgba(0,0,0,0.02)">' +
      '<input type="checkbox" name="addExpField" value="' +
      f.id +
      '"' +
      (isAdded ? " disabled" : "") +
      ' style="accent-color:' +
      c.tag +
      '">' +
      '<span style="flex:1;font-size:12px;color:var(--body)">' +
      f.label +
      "</span>" +
      '<span style="font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:' +
      c.tag +
      ";background:" +
      c.tagBg +
      '">' +
      c.label +
      "</span>" +
      "</label>";
  });
  list.innerHTML = html;
  // Set default radio based on first checked item
  var radios = modal.querySelectorAll('input[name="addExpFieldTarget"]');
  if (radios.length) radios[0].checked = true;
  modal.style.display = "";
}

function closeExpAddFieldModal() {
  var modal = document.getElementById("addExpFieldModal");
  if (modal) modal.style.display = "none";
}

function confirmExpAddField() {
  var pid = window._currentProjectId || "default";
  var checked = document.querySelectorAll('input[name="addExpField"]:checked');
  if (!checked.length) {
    closeExpAddFieldModal();
    return;
  }
  var target = "upper";
  var radios = document.querySelectorAll('input[name="addExpFieldTarget"]');
  radios.forEach(function (r) {
    if (r.checked) target = r.value;
  });
  var added = _getExpAddedFields(pid);
  checked.forEach(function (cb) {
    if (added.indexOf(cb.value) === -1) added.push(cb.value);
  });
  _saveExpAddedFields(pid, added);
  closeExpAddFieldModal();
  buildExpenseTable();
}

// ── Expense field edit handler ──────────────────────────────
function onExpenseFieldEdit(label, field, value) {
  var pid = window._currentProjectId || "default";
  var pfOverrides = {};
  try {
    pfOverrides = JSON.parse(
      localStorage.getItem("glcapital_pf_overrides_" + pid) || "{}",
    );
  } catch (e) {}
  var sanitized = (label || "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
  pfOverrides[sanitized + "_manual_" + field] = {
    value: parseFloat(String(value).replace(/,/g, "")),
  };
  localStorage.setItem(
    "glcapital_pf_overrides_" + pid,
    JSON.stringify(pfOverrides),
  );
  buildExpenseTable();
}

function changeExpRowSource(label, newSrc) {
  var pid = window._currentProjectId || "default";
  var sources = _getExpRowSources(pid);
  sources[label] = newSrc;
  _saveExpRowSources(pid, sources);
  buildExpenseTable();
}

function buildPFTable() {
  // Sync calendar year column headers to the project's Acquisition Year
  if (typeof _refreshYearHeaders === "function") _refreshYearHeaders();
  var pfEmpty = document.getElementById("pfEmptyState");
  var pfRevUpperBody = document.getElementById("pfRevUpperBody");
  var pfNoiBody = document.getElementById("pfNoiBody");
  if (!pfRevUpperBody) return;

  var pf = _pfLoaded
    ? _getProjectPFData(currentProjectId) || PF_DATA
    : _emptyPFData();
  // 7 columns: 6 from PF_DATA + appended 2029 (extrapolated)
  var nCols = 7;

  // Read per-project assumptions (fallback to 3%)
  var asmt = getProjectAssumptions();
  var rentRate = 1 + asmt.rentGrowth / 100;
  var opexRate = 1 + asmt.opexGrowth / 100;
  var taxRate = 1 + asmt.taxGrowth / 100;

  // Project a revenue row (always uses rentRate)
  function projectRev(vals) {
    var v = (vals || []).slice();
    while (v.length < nCols) {
      var last = v[v.length - 1];
      v.push(last ? Math.round(last * rentRate * 100) / 100 : 0);
    }
    return v;
  }
  // Project an expense row; property tax uses taxRate, all others opexRate
  function projectExp(vals, label) {
    var rate =
      label && label.toLowerCase().indexOf("property tax") !== -1
        ? taxRate
        : opexRate;
    var v = (vals || []).slice();
    while (v.length < nCols) {
      var last = v[v.length - 1];
      v.push(last ? Math.round(last * rate * 100) / 100 : 0);
    }
    return v;
  }
  // Generic (legacy) fallback
  function project(vals) {
    return projectRev(vals);
  }

  function fmtNum(v) {
    if (v === null || v === undefined)
      return '<span style="color:var(--muted)">—</span>';
    var n = parseFloat(v);
    if (isNaN(n) || n === 0) return '<span style="color:var(--muted)">—</span>';
    if (n < 0) return "(" + Math.abs(Math.round(n)).toLocaleString() + ")";
    return Math.round(n).toLocaleString();
  }

  function fmtPct(v) {
    if (v === null || v === undefined) return "—";
    return (parseFloat(v) * 100).toFixed(1) + "%";
  }

  function makeCells(vals, isTotal, isPct, isGreen, rowLabel) {
    return vals
      .map(function (v, ci) {
        var isProjected = ci >= 3; // NOV2026+ is projection zone
        var borderL =
          ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
        var bg = isTotal
          ? "background:rgba(74,124,89,0.12);"
          : isProjected
            ? "background:rgba(74,124,89,0.03);"
            : "";
        var fw = isTotal ? "font-weight:700;" : "";
        var color = isGreen
          ? "color:var(--green);"
          : isTotal
            ? "color:var(--header);"
            : "color:var(--body);";
        var txt = isPct ? fmtPct(v) : fmtNum(v);
        var editAttr =
          !isTotal && !isPct && rowLabel
            ? ' class="pf-rev-cell" data-pf-label="' +
              rowLabel.replace(/"/g, "&quot;") +
              '" data-pf-ci="' +
              ci +
              '" data-pf-val="' +
              (v || 0) +
              '"'
            : "";
        return (
          "<td" +
          editAttr +
          ' style="padding:7px 8px;text-align:right;font-size:12px;' +
          fw +
          color +
          bg +
          borderL +
          '">' +
          txt +
          "</td>"
        );
      })
      .join("");
  }

  // ── SHARED ACCORDION RENDERER ────────────────────────────────────

  // Check if a row has manual overrides in pfOverrides
  // Returns map of {colIndex: overrideValue} or null if no overrides
  function _getRowOverrides(label) {
    var sanitized = (label || "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "");
    var overrides = {};
    var hasAny = false;
    for (var i = 0; i < nCols; i++) {
      var ov = pfOverrides[sanitized + "_" + i];
      if (ov) {
        overrides[i] = ov.value;
        hasAny = true;
      }
    }
    return hasAny ? overrides : null;
  }

  // Apply overrides to a vals array, returns new array
  function _applyOverrides(vals, overrides) {
    if (!overrides) return vals;
    var out = vals.slice();
    for (var ci in overrides) {
      out[parseInt(ci)] = overrides[ci];
    }
    return out;
  }

  // Generate source tag HTML for a row
  var _tagT12Style = "color:#8b7355;background:rgba(139,115,85,0.08);";
  var _tagHDStyle = "color:#1a3a5c;background:rgba(26,58,92,0.08);";
  var _tagManStyle = "color:#8b6a2e;background:rgba(139,106,46,0.10);";
  function _srcTag(label, style) {
    return (
      '<span style="font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:2px;padding:1px 4px;margin-right:6px;vertical-align:middle;' +
      style +
      '">' +
      label +
      "</span>"
    );
  }

  // buildAccordion: renders Revenue or Expenses table rows
  // items: array from PF_DATA (T12 mode) or from _buildHDItems (HD mode)
  // projectFn: function to project values forward
  // moduleSrc: 't12' or 'hd'
  // Returns {html: string, totals: array} — totals is the computed total vals
  function buildAccordion(items, projectFn, moduleSrc) {
    var rows = "";
    var totalRow = null;
    var pctRow = null;
    var isHDMode = moduleSrc === "hd";

    // Base tag for this mode
    var baseTag = isHDMode ? "HD" : "T12";
    var baseTagStyle = isHDMode ? _tagHDStyle : _tagT12Style;

    if (isHDMode) {
      // ── HD MODE: flat list, no accordion sections ──
      var hdLineItems = items.filter(function (r) {
        return !r.isTotal && !r.isPct;
      });
      totalRow = items.find(function (r) {
        return r.isTotal;
      });

      hdLineItems.forEach(function (item, idx) {
        var vals = item.vals;
        var ov = _getRowOverrides(item.label);
        var effectiveVals = _applyOverrides(vals, ov);
        var isManual = !!ov;
        var tag = isManual
          ? _srcTag("Manual", _tagManStyle)
          : _srcTag(baseTag, baseTagStyle);
        var bg = idx % 2 === 1 ? "background:rgba(0,0,0,0.014);" : "";
        rows +=
          '<tr style="' +
          bg +
          'border-bottom:1px solid rgba(0,0,0,0.04)">' +
          '<td style="padding:7px 14px;font-size:12px;color:var(--body)">' +
          tag +
          item.label +
          "</td>" +
          '<td style="padding:7px 8px"></td>' +
          makeCells(effectiveVals, false, false, false, item.label) +
          "</tr>";
      });
    } else {
      // ── T12 MODE: accordion with sections ──
      var sections = [];
      var currentSec = null;
      items.forEach(function (r) {
        if (r.isSectionHdr) {
          currentSec = {
            secId:
              r.secId || "sec-" + r.label.replace(/\W+/g, "-").toLowerCase(),
            label: r.label,
            items: [],
          };
          sections.push(currentSec);
        } else if (r.isTotal) {
          totalRow = r;
        } else if (r.isPct) {
          pctRow = r;
        } else if (!r.isSubtotal && currentSec) {
          currentSec.items.push(r);
        }
      });

      sections.forEach(function (sec) {
        // Section subtotals (with overrides applied)
        var sub = [];
        var secHasManual = false;
        sec.items.forEach(function (item) {
          var pv = projectFn(item.vals, item.label);
          var ov = _getRowOverrides(item.label);
          var ev = _applyOverrides(pv, ov);
          if (ov) secHasManual = true;
          ev.forEach(function (v, i) {
            sub[i] = (sub[i] || 0) + (v || 0);
          });
        });
        while (sub.length < nCols) sub.push(0);
        var hasData = sub.some(function (v) {
          return Math.abs(v) > 0.01;
        });
        var isOpen = hasData;

        // Section header tag: Manual if any row in section was manually edited
        var secTag = secHasManual ? _srcTag("Manual", _tagManStyle) : "";

        var subtotalCells = sub
          .map(function (v, ci) {
            var borderL =
              ci === 3 ? "border-left:2px solid rgba(74,124,89,0.2);" : "";
            var cellBg = ci >= 3 ? "background:rgba(74,124,89,0.04);" : "";
            return (
              '<td style="padding:8px 8px;text-align:right;font-size:11px;font-weight:600;color:var(--header);opacity:.8;' +
              cellBg +
              borderL +
              '">' +
              fmtNum(v) +
              "</td>"
            );
          })
          .join("");

        rows +=
          '<tr class="pf-sec-hdr' +
          (isOpen ? " open" : "") +
          '" data-secid="' +
          sec.secId +
          '" onclick="togglePFSec(\'' +
          sec.secId +
          "')\">" +
          '<td style="padding:8px 14px;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">' +
          '<span class="pf-chevron">&#9654;</span> ' +
          sec.label +
          secTag +
          "</td>" +
          '<td style="padding:8px 8px"></td>' +
          subtotalCells +
          "</tr>";

        // Sub-items
        sec.items.forEach(function (item, idx) {
          var vals = projectFn(item.vals, item.label);
          var ov = _getRowOverrides(item.label);
          var effectiveVals = _applyOverrides(vals, ov);
          var isManual = !!ov;
          var tag = isManual
            ? _srcTag("Manual", _tagManStyle)
            : _srcTag(baseTag, baseTagStyle);
          var bg = idx % 2 === 1 ? "background:rgba(0,0,0,0.014);" : "";
          rows +=
            '<tr class="pf-si pf-si-' +
            sec.secId +
            (isOpen ? "" : " pf-si-hidden") +
            '" style="' +
            bg +
            'border-bottom:1px solid rgba(0,0,0,0.04)">' +
            '<td style="padding:6px 14px 6px 28px;font-size:12px;color:var(--body);">' +
            tag +
            item.label +
            "</td>" +
            '<td style="padding:6px 8px"></td>' +
            makeCells(effectiveVals, false, false, false, item.label) +
            "</tr>";
        });
      });
    }

    // ── Total row ──
    var computedTotals = new Array(nCols).fill(0);
    if (totalRow) {
      if (isHDMode) {
        // HD: start from HD total, apply any overrides on line items
        var hdLines = items.filter(function (r) {
          return !r.isTotal && !r.isPct;
        });
        hdLines.forEach(function (item) {
          var ov = _getRowOverrides(item.label);
          var ev = _applyOverrides(item.vals, ov);
          ev.forEach(function (v, i) {
            computedTotals[i] += v || 0;
          });
        });
      } else {
        // T12: sum all line items with overrides
        var allItems = [];
        items.forEach(function (r) {
          if (!r.isSectionHdr && !r.isTotal && !r.isPct && !r.isSubtotal)
            allItems.push(r);
        });
        allItems.forEach(function (item) {
          var pv = projectFn(item.vals, item.label);
          var ov = _getRowOverrides(item.label);
          var ev = _applyOverrides(pv, ov);
          ev.forEach(function (v, i) {
            computedTotals[i] += v || 0;
          });
        });
      }
      rows +=
        '<tr style="background:rgba(74,124,89,0.12);border-top:2px solid rgba(74,124,89,0.3);border-bottom:1px solid var(--border)">' +
        '<td style="padding:9px 14px;font-size:12px;font-weight:800;color:var(--green)">' +
        totalRow.label +
        "</td>" +
        '<td style="padding:9px 8px"></td>' +
        makeCells(computedTotals, true, false, true) +
        "</tr>";
    }
    if (pctRow) {
      var pVals = projectFn(pctRow.vals, pctRow.label);
      rows +=
        '<tr style="background:rgba(0,0,0,0.022);border-bottom:1px solid var(--border)">' +
        '<td style="padding:5px 14px;font-size:11px;font-style:italic;color:var(--muted)">' +
        pctRow.label +
        "</td>" +
        '<td style="padding:5px 8px"></td>' +
        makeCells(pVals, false, true, false) +
        "</tr>";
    }
    return { html: rows, totals: computedTotals };
  }

  // ── LOAD OVERRIDES (must happen before buildAccordion) ──────────
  _loadPFOverrides();

  // ── HD / SOURCE SETUP ────────────────────────────────────────────
  _refreshHDUploadUI();
  var hdData = getHDData(currentProjectId);
  var hasHD = !!hdData;
  _populateHDL1Aggregates(hdData);
  var modSrc = getModuleSrc(currentProjectId) || {};
  var revSrc = modSrc.rev === "hd" && hasHD ? "hd" : "t12";
  // ── MODULE SOURCE BADGES on section headers ────────────────────
  // Revenue header — no T12/HD toggle (Revenue always uses HD L1 structure)
  var _pfRevLabelEl = document.getElementById("pfRevLabel");
  if (_pfRevLabelEl) _pfRevLabelEl.innerHTML = "INCOME";

  // ── REVENUE (new Income layout) ──────────────────────────────────
  buildIncomeTable();
  // Compute revenue totals for NOI from the Income table
  var revOut = { totals: new Array(nCols).fill(0) };
  // Sum from PF_DATA.revenue total row
  var revTotalRow = pf.revenue.filter(function (r) {
    return r.isTotal;
  })[0];
  if (revTotalRow) revOut.totals = projectRev(revTotalRow.vals);

  // ── EXPENSES (new Expense layout) ─────────────────────────────
  buildExpenseTable();

  // ── NOI sub-tab (new dedicated tab) ──────────────────────────
  if (typeof buildNoiTabTable === "function") buildNoiTabTable();

  // ── NET OPERATING INCOME (legacy inline NOI inside Revenue & Expenses) ─
  var revEffV = revOut.totals;
  var expEffV = window._expenseTotals || new Array(nCols).fill(0);
  var noiV = revEffV.map(function (rv, i) {
    return Math.round((rv - (expEffV[i] || 0)) * 100) / 100;
  });
  window._noiTotals = noiV;
  var anyHDActive = revSrc === "hd";

  var noiCells = noiV
    .map(function (v, ci) {
      var borderL =
        ci === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var isHDNoi = anyHDActive && ci >= 2;
      var bg = isHDNoi
        ? "background:rgba(26,58,92,0.10);"
        : "background:rgba(74,124,89,0.12);";
      var color = isHDNoi ? "color:#1a5a8a;" : "color:var(--green);";
      var n = Math.round(v);
      var txt =
        n < 0
          ? "(" + Math.abs(n).toLocaleString() + ")"
          : n === 0
            ? '<span style="color:var(--muted)">—</span>'
            : n.toLocaleString();
      return (
        '<td style="padding:10px 8px;text-align:right;font-size:12px;font-weight:700;' +
        color +
        bg +
        borderL +
        '">' +
        txt +
        "</td>"
      );
    })
    .join("");

  // (legacy NOI rendering disabled — pfNoiBody is now filled by buildNoiTabTable with source switch + banner)

  // ── CASH FLOW & DEBT COVERAGE ─────────────────────────────────────────────
  var pfCfBody = document.getElementById("pfCfBody");
  if (pfCfBody) {
    var asmt2 = getProjectAssumptions();
    var rentRate2 = 1 + asmt2.rentGrowth / 100;
    var opRate2 = 1 + asmt2.opexGrowth / 100;

    // ── Debt Service from Debt Analysis (localStorage or defaults) ──
    var _cfPid = window._currentProjectId || "default";
    var _cfDebtData = null;
    try {
      _cfDebtData = JSON.parse(
        localStorage.getItem("debt_data_" + _cfPid) || "null",
      );
    } catch (e) {}
    var _cfCurrent = (_cfDebtData && _cfDebtData.current) || {};
    var _cfRefi = (_cfDebtData && _cfDebtData.refi) || {};
    var dsY1to3 = _cfCurrent.annualMortgagePayments || 0;
    // I/O = Refinance Principal × Interest per annum
    var _refiPrincipal = _cfRefi.principal || 0;
    var _refiRate = _cfRefi.interestPerAnnum || 0;
    var dsIO = Math.round(_refiPrincipal * (_refiRate / 100));
    var dsV = [dsY1to3, dsY1to3, dsY1to3, dsIO, dsIO, dsIO];

    // ── Adjustment: Y1,Y2 from T12; Y3=Avg(Y1,Y2); Y4+ grow at opexGrowth ──
    var _adjSrc = pf.adjustment || [];
    var adjY1 = _adjSrc[0] || 0;
    var adjY2 = _adjSrc[1] || 0;
    var adjY3 = Math.round(((adjY1 + adjY2) / 2) * 100) / 100;
    var adjV = [adjY1, adjY2, adjY3];
    for (var _ai = 3; _ai < 6; _ai++) {
      adjV.push(Math.round(adjV[_ai - 1] * opRate2 * 100) / 100);
    }

    var cf6 = (pf.cf || []).slice(0, 6);
    var dscr6 = (pf.dscr || []).slice(0, 6);

    // 7th col (2029): recompute from assumptions for CF & DSCR
    var _pfdCF = _getProjectPFData(currentProjectId) || PF_DATA;
    var _cfRevTotal = (_pfdCF.revenue || []).find(function (r) {
      return r.isTotal && r.label && r.label.indexOf("Total Revenue") !== -1;
    });
    var _cfExpTotal = (_pfdCF.expenses || []).find(function (r) {
      return r.isTotal && r.label && r.label.indexOf("Total Expenses") !== -1;
    });
    var revTot7 =
      _cfRevTotal && _cfRevTotal.vals ? _cfRevTotal.vals.slice() : [];
    var expTot7 =
      _cfExpTotal && _cfExpTotal.vals ? _cfExpTotal.vals.slice() : [];
    while (revTot7.length < 7) {
      var lr7 = revTot7[revTot7.length - 1];
      revTot7.push(Math.round(lr7 * rentRate2));
    }
    while (expTot7.length < 7) {
      var le7 = expTot7[expTot7.length - 1];
      expTot7.push(Math.round(le7 * opRate2));
    }
    var noi7col = revTot7.map(function (r, i) {
      return Math.round(r - expTot7[i]);
    });

    // Build full 7-col arrays — first 6 from data, 7th computed
    var ds7last = dsV[5]; // I/O stays same for projected years
    var adj7last = Math.round(adjV[5] * opRate2 * 100) / 100;
    var cf7last = Math.round(noi7col[6] - ds7last);
    var dscr7last = (noi7col[6] / ds7last).toFixed(2);

    adjV.push(adj7last);
    dsV.push(ds7last);
    var cf7 = cf6.concat([cf7last]);
    var dscr7 = dscr6.concat([dscr7last]);

    function cfCell(v, i, opts) {
      opts = opts || {};
      var isProj = i >= 3;
      var bl = i === 3 ? "border-left:2px solid rgba(74,101,133,0.22);" : "";
      var bg = isProj ? "background:rgba(74,101,133,0.025);" : "";
      if (opts.isTot) bg = "background:rgba(74,101,133,0.1);";
      var fw = opts.isTot ? "font-weight:800;" : "";
      var col = opts.isTot ? "color:var(--blue);" : "color:var(--body);";
      var txt;
      if (
        v === null ||
        v === undefined ||
        (typeof v === "number" && isNaN(v))
      ) {
        txt = '<span style="color:var(--muted)">\u2014</span>';
      } else {
        var n = Math.round(parseFloat(v));
        if (isNaN(n)) {
          txt = '<span style="color:var(--muted)">\u2014</span>';
        } else {
          txt =
            n < 0
              ? "(" + Math.abs(n).toLocaleString() + ")"
              : n === 0
                ? '<span style="color:var(--muted)">\u2014</span>'
                : n.toLocaleString();
        }
      }
      return (
        '<td style="padding:7px 8px;text-align:right;font-size:12px;' +
        fw +
        col +
        bg +
        bl +
        '">' +
        txt +
        "</td>"
      );
    }

    function cfRow(label, vals, opts) {
      opts = opts || {};
      var rowBg = opts.isTot
        ? "background:rgba(74,101,133,0.1);border-top:2px solid rgba(74,101,133,0.25);"
        : "";
      var fw = opts.isTot
        ? "font-weight:800;"
        : opts.isSub
          ? "font-weight:400;"
          : "font-weight:600;";
      var col = opts.isTot
        ? "color:var(--blue);"
        : opts.isSub
          ? "color:var(--muted);"
          : "color:var(--body);";
      var indent = opts.isSub ? "padding-left:28px;" : "";
      var cells = vals
        .map(function (v, i) {
          return cfCell(v, i, opts);
        })
        .join("");
      return (
        '<tr style="' +
        rowBg +
        'border-bottom:1px solid var(--border)">' +
        '<td style="padding:7px 14px;font-size:12px;' +
        fw +
        col +
        indent +
        '">' +
        label +
        "</td>" +
        cells +
        "</tr>"
      );
    }

    var rows = "";
    rows += cfRow("Adjustment", adjV, {});
    rows += cfRow("Debt Service", dsV, {});
    rows += cfRow(
      "Capex Reserves",
      [null, null, null, null, null, null, null],
      {},
    );
    rows += cfRow("Cash Flow after Debt Service", cf7, { isTot: true });

    pfCfBody.innerHTML = rows;

    // ── DEBT COVERAGE (separate table) ──
    var pfDscrBody = document.getElementById("pfDscrBody");
    if (pfDscrBody) {
      var dcRows = "";
      // NOI row (read-only reference)
      dcRows += cfRow("Net Operating Income", noi7col, { isTot: true });
      // Debt Service row
      dcRows += cfRow("Debt Service", dsV, {});
      // DSCR row
      var dscrBg =
        "background:rgba(74,124,89,0.07);border-top:2px solid rgba(74,124,89,0.25);";
      var dscrCells = dscr7
        .map(function (v, i) {
          var isProj = i >= 3;
          var bl = i === 3 ? "border-left:2px solid rgba(74,124,89,0.22);" : "";
          var bg = isProj ? "background:rgba(74,124,89,0.05);" : "";
          var txt = v
            ? '<strong style="color:var(--green)">' +
              parseFloat(v).toFixed(2) +
              "×</strong>"
            : '<span style="color:var(--muted)">—</span>';
          return (
            '<td style="padding:8px 8px;text-align:right;font-size:12px;' +
            bg +
            bl +
            '">' +
            txt +
            "</td>"
          );
        })
        .join("");
      dcRows +=
        '<tr style="' +
        dscrBg +
        'border-bottom:2px solid rgba(74,124,89,0.25)">' +
        '<td style="padding:8px 14px;font-size:12px;font-weight:800;color:var(--green)">DSCR</td>' +
        dscrCells +
        "</tr>";
      pfDscrBody.innerHTML = dcRows;
    }
  }

  // Show/hide unit mix
  buildPFUnitMix();
  buildNoiStrip();

  if (pfEmpty) pfEmpty.style.display = "none";
  // pfTableWrap is just the revenue card now; keep it visible
  var pfTable = document.getElementById("pfTableWrap");
  if (pfTable) pfTable.style.display = "";

  // Rebuild Debt Analysis with fresh NOI values
  if (typeof buildDebtAnalysis === "function") buildDebtAnalysis();

  if (typeof buildConstructionEquityTab === "function")
    buildConstructionEquityTab();

  if (typeof initSeRegValueOfProperty === "function")
    initSeRegValueOfProperty();
  if (typeof initSeRefValueOfProperty === "function")
    initSeRefValueOfProperty();
  if (typeof buildEquityRequiredTab === "function") buildEquityRequiredTab();
  if (typeof buildRefinanceEventTab === "function") buildRefinanceEventTab();
  if (typeof initWfTemplate === "function") initWfTemplate();

  // Clear/restore hardcoded sub-tab values based on _pfLoaded
  _togglePFSubtabValues();
}

// ── Toggle PF sub-tab hardcoded values (empty when no data) ──────────────
function _togglePFSubtabValues() {
  // Target all PF sub-panels that contain hardcoded amounts
  var panelIds = [
    "pfsp-pf-summary",
    "pfsp-pf-closing",
    "pfsp-pf-purchase",
    "pfsp-pf-equity",
    "pfsp-pf-sale",
    "pfsp-pf-eqreq",
    "pfsp-pf-refi",
  ];
  panelIds.forEach(function (pid) {
    var panel = document.getElementById(pid);
    if (!panel) return;
    var cells = panel.querySelectorAll(
      ".amount-col, .skc-value, [data-pf-amount]",
    );
    cells.forEach(function (cell) {
      if (!_pfLoaded) {
        // Save original value if not already saved
        if (!cell.hasAttribute("data-pf-orig")) {
          cell.setAttribute("data-pf-orig", cell.textContent);
        }
        cell.textContent = "—";
        cell.style.color = "var(--muted)";
      } else {
        // Restore original value if it was saved
        if (cell.hasAttribute("data-pf-orig")) {
          cell.textContent = cell.getAttribute("data-pf-orig");
          cell.style.color = "";
          cell.removeAttribute("data-pf-orig");
        }
      }
    });
    // Also handle percentage input fields
    var pctCells = panel.querySelectorAll(".pct-col");
    pctCells.forEach(function (cell) {
      var input = cell.querySelector("input");
      if (input) {
        if (!_pfLoaded) {
          input.setAttribute("data-pf-orig-val", input.value);
          input.value = "";
          input.disabled = true;
        } else if (input.hasAttribute("data-pf-orig-val")) {
          input.value = input.getAttribute("data-pf-orig-val");
          input.disabled = false;
          input.removeAttribute("data-pf-orig-val");
        }
      }
    });
  });
}

// ── Waterfall Template Picker (Step 1: scaffold + persistence) ───────────
var WF_TEMPLATES = {
  straight: {
    label: "Straight Split (no pref)",
    desc: "All cash splits at a fixed ratio from $1, no preferred return.",
    params: [
      {
        id: "invSplit",
        label: "Investor Split",
        suffix: "%",
        default: 80,
        step: 0.5,
      },
    ],
  },
  simple: {
    label: "Simple Pref + Promote",
    desc: "Pref → Return of Capital → remainder split.",
    params: [
      {
        id: "prefRate",
        label: "Pref Rate",
        suffix: "%",
        default: 8,
        step: 0.25,
      },
      {
        id: "invSplit",
        label: "Investor Split above pref",
        suffix: "%",
        default: 80,
        step: 0.5,
      },
    ],
  },
  "two-tier": {
    label: "Two-Tier IRR Hurdle",
    desc: "Pref → ROC → Tier 1 until IRR hurdle → Tier 2 thereafter.",
    params: [
      {
        id: "prefRate",
        label: "Pref Rate",
        suffix: "%",
        default: 8,
        step: 0.25,
      },
      {
        id: "hurdle1",
        label: "Hurdle IRR",
        suffix: "%",
        default: 12,
        step: 0.5,
      },
      {
        id: "tier1Inv",
        label: "Tier 1 Inv Split",
        suffix: "%",
        default: 80,
        step: 0.5,
      },
      {
        id: "tier2Inv",
        label: "Tier 2 Inv Split",
        suffix: "%",
        default: 70,
        step: 0.5,
      },
    ],
  },
  "three-tier": {
    label: "Three-Tier IRR Hurdle",
    desc: "Pref → ROC → 3 IRR-hurdle tiers, each with its own promote split.",
    params: [
      {
        id: "prefRate",
        label: "Pref Rate",
        suffix: "%",
        default: 8,
        step: 0.25,
      },
      {
        id: "hurdle1",
        label: "Hurdle 1 IRR",
        suffix: "%",
        default: 12,
        step: 0.5,
      },
      {
        id: "hurdle2",
        label: "Hurdle 2 IRR",
        suffix: "%",
        default: 17,
        step: 0.5,
      },
      {
        id: "tier1Inv",
        label: "Tier 1 Inv Split",
        suffix: "%",
        default: 80,
        step: 0.5,
      },
      {
        id: "tier2Inv",
        label: "Tier 2 Inv Split",
        suffix: "%",
        default: 70,
        step: 0.5,
      },
      {
        id: "tier3Inv",
        label: "Tier 3 Inv Split",
        suffix: "%",
        default: 60,
        step: 0.5,
      },
    ],
  },
};
function _wfKey(pid) {
  return "wf_template_" + pid;
}
function getWfState() {
  var pid = window._currentProjectId || "default";
  try {
    return JSON.parse(localStorage.getItem(_wfKey(pid)) || "null") || {};
  } catch (e) {
    return {};
  }
}
function setWfState(s) {
  var pid = window._currentProjectId || "default";
  localStorage.setItem(_wfKey(pid), JSON.stringify(s));
}
function initWfTemplate() {
  var sel = document.getElementById("wfTemplate");
  if (!sel) return;
  var s = getWfState();
  if (s.template && WF_TEMPLATES[s.template]) sel.value = s.template;
  renderWfTemplate();
}
function renderWfTemplate() {
  var sel = document.getElementById("wfTemplate");
  if (!sel) return;
  var tmplKey = sel.value;
  var tmpl = WF_TEMPLATES[tmplKey];
  if (!tmpl) return;
  var descEl = document.getElementById("wfTemplateDesc");
  if (descEl) descEl.textContent = tmpl.desc;
  var badge = document.getElementById("wfActiveTemplateBadge");
  if (badge) badge.textContent = "Template: " + tmpl.label;

  var s = getWfState();
  if (s.template !== tmplKey) {
    s.template = tmplKey;
    s.params = s.params || {};
  }
  s.params[tmplKey] = s.params[tmplKey] || {};

  var box = document.getElementById("wfParams");
  if (!box) return;
  box.innerHTML = tmpl.params
    .map(function (p) {
      var saved = s.params[tmplKey][p.id];
      var val = saved != null ? saved : p.default;
      return (
        '<div style="display:flex;flex-direction:column;gap:3px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">' +
        p.label +
        "</label>" +
        '<div style="display:flex;align-items:center;gap:4px">' +
        '<input type="number" step="' +
        p.step +
        '" data-wf-param="' +
        p.id +
        '" value="' +
        val +
        '" class="pct-input" style="width:80px;text-align:right" onchange="onWfParamChange()">' +
        '<span style="font-size:11px;color:var(--muted);font-weight:600">' +
        p.suffix +
        "</span>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  setWfState(s);
  buildWaterfallTab();
}
function onWfParamChange() {
  var sel = document.getElementById("wfTemplate");
  if (!sel) return;
  var tmplKey = sel.value;
  var s = getWfState();
  s.template = tmplKey;
  s.params = s.params || {};
  s.params[tmplKey] = s.params[tmplKey] || {};
  var inputs = document.querySelectorAll("#wfParams input[data-wf-param]");
  inputs.forEach(function (inp) {
    var pid = inp.getAttribute("data-wf-param");
    var v = parseFloat(inp.value);
    if (!isNaN(v)) s.params[tmplKey][pid] = v;
  });
  setWfState(s);
  buildWaterfallTab();
}

// ── Waterfall: gather inputs + compute + render ──────────────────────────
function _wfParseMoney(s) {
  if (!s) return 0;
  var str = String(s).trim();
  var neg = /^\(.*\)$/.test(str) || /^-/.test(str);
  var n = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return 0;
  return neg ? -n : n;
}
function _wfFmt(n, opts) {
  opts = opts || {};
  if (n === null || n === undefined)
    return '<span style="color:var(--muted)">—</span>';
  if (opts.pct) return (n * 100).toFixed(opts.dec != null ? opts.dec : 1) + "%";
  var rounded = Math.round(n);
  if (rounded === 0 && !opts.keepZero)
    return '<span style="color:var(--muted)">—</span>';
  if (rounded < 0) return "(" + Math.abs(rounded).toLocaleString() + ")";
  return rounded.toLocaleString();
}
function _wfIrr(cashflows) {
  // Bisection method on NPV; cashflows[0] is t=0 (typically negative contribution)
  function npv(r) {
    var v = 0;
    for (var i = 0; i < cashflows.length; i++) {
      v += cashflows[i] / Math.pow(1 + r, i);
    }
    return v;
  }
  var hasPos = false,
    hasNeg = false;
  for (var i = 0; i < cashflows.length; i++) {
    if (cashflows[i] > 0) hasPos = true;
    if (cashflows[i] < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return null;
  var lo = -0.99,
    hi = 10;
  for (var k = 0; k < 100; k++) {
    var mid = (lo + hi) / 2;
    var v = npv(mid);
    if (Math.abs(v) < 0.5) return mid;
    if (npv(lo) * v < 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function _wfGatherInputs() {
  var asmt =
    typeof getProjectAssumptions === "function" ? getProjectAssumptions() : {};
  var ay = asmt.acquisitionYear || 2026;
  var years = [];
  for (var i = -2; i <= 4; i++) years.push(ay + i);

  // Operating CF — from R&E "Cash Flow after Debt Service" row (computed earlier in buildPFTable)
  // PF_DATA doesn't have this directly; pull from DOM (pfCfBody row labeled "Cash Flow after Debt Service")
  var operatingCF = [0, 0, 0, 0, 0, 0, 0];
  try {
    var rows = document.querySelectorAll("#pfCfBody tr");
    rows.forEach(function (tr) {
      var label = ((tr.children[0] && tr.children[0].textContent) || "").trim();
      if (/Cash Flow after Debt Service/i.test(label)) {
        for (var i = 0; i < 7; i++) {
          var c = tr.children[i + 1];
          if (c) operatingCF[i] = _wfParseMoney(c.textContent);
        }
      }
    });
  } catch (e) {}

  // Asset Mgmt Fee — $5k/yr from AY+1 onward
  var amf = [0, 0, 0, 5000, 5000, 5000, 5000];

  // Initial Equity — from Equity Required Regular Equity row
  var eqEl = document.getElementById("eqRegEqAmt");
  var initialEquity = eqEl ? _wfParseMoney(eqEl.textContent) : 1600000;
  if (!initialEquity) initialEquity = 1600000;

  // Refi: year + Total Distribution amount (from Refinance Event tab)
  var refiYearCell = document.querySelector(
    "#pfsp-pf-refi table.pf-data-table tr:nth-child(2) .amount-col",
  );
  var refiYear = refiYearCell
    ? parseInt(_wfParseMoney(refiYearCell.textContent))
    : ay + 1;
  // Total Distribution row is the .pf-tot
  var refiTotalEl = document.querySelector(
    "#pfsp-pf-refi tr.pf-tot .amount-col",
  );
  var refiAmount = refiTotalEl ? _wfParseMoney(refiTotalEl.textContent) : 0;

  // Sale: year + Final Proceeds from Sale (After Refinance subtab — exit at end of hold)
  var saleYearCell = document.querySelector(
    "#pfsp2-se-ref table.pf-data-table tr:nth-child(2) .amount-col",
  );
  var saleYear = saleYearCell
    ? parseInt(_wfParseMoney(saleYearCell.textContent))
    : ay + 4;
  var saleProceedsEl = document.querySelector(
    "#pfsp2-se-ref tr.pf-hi .amount-col",
  ); // Final Proceeds from Sale
  var saleAmount = saleProceedsEl
    ? _wfParseMoney(saleProceedsEl.textContent)
    : 0;

  return {
    years: years,
    ay: ay,
    operatingCF: operatingCF,
    amf: amf,
    initialEquity: initialEquity,
    refiYear: refiYear,
    refiAmount: refiAmount,
    saleYear: saleYear,
    saleAmount: saleAmount,
  };
}

function _wfCompute(template, params, inp) {
  var n = inp.years.length;
  var prefRate = (params.prefRate != null ? params.prefRate : 0) / 100;
  var contribIdx = 2; // AY index in [AY-2..AY+4]

  var rows = {
    operatingCF: inp.operatingCF.slice(),
    amf: inp.amf.slice(),
    distributableCF: [],
    beginCap: [],
    prefAccrued: [],
    prefPaid: [],
    accruedUnpaid: [],
    endCap: [],
    excessOp: [],
    invFromOp: [],
    gpFromOp: [],
    refiInflow: [],
    refiToPref: [],
    refiToCap: [],
    refiExcess: [],
    invFromRefi: [],
    gpFromRefi: [],
    saleGross: [],
    saleToPref: [],
    saleToCap: [],
    saleExcess: [],
    invFromSale: [],
    gpFromSale: [],
    invContrib: [],
    invCF: [],
    gpCF: [],
    coc: [],
    activeSplit: [], // per-year LP/GP split actually applied (for tier display)
  };

  var capBalance = inp.initialEquity;
  var unpaidPref = 0;
  var cumLpFlows = [];

  function splitFor(template, params, irr) {
    if (template === "straight") {
      var s = (params.invSplit != null ? params.invSplit : 80) / 100;
      return { inv: s, gp: 1 - s };
    }
    if (template === "simple") {
      var s2 = (params.invSplit != null ? params.invSplit : 80) / 100;
      return { inv: s2, gp: 1 - s2 };
    }
    var h1 = (params.hurdle1 != null ? params.hurdle1 : 12) / 100;
    var h2 = (params.hurdle2 != null ? params.hurdle2 : 17) / 100;
    var t1 = (params.tier1Inv != null ? params.tier1Inv : 80) / 100;
    var t2 = (params.tier2Inv != null ? params.tier2Inv : 70) / 100;
    var t3 = (params.tier3Inv != null ? params.tier3Inv : 60) / 100;
    if (template === "two-tier") {
      if (irr === null || irr < h1) return { inv: t1, gp: 1 - t1 };
      return { inv: t2, gp: 1 - t2 };
    }
    if (template === "three-tier") {
      if (irr === null || irr < h1) return { inv: t1, gp: 1 - t1 };
      if (irr < h2) return { inv: t2, gp: 1 - t2 };
      return { inv: t3, gp: 1 - t3 };
    }
    return { inv: 0.8, gp: 0.2 };
  }

  for (var i = 0; i < n; i++) {
    var distCF = rows.operatingCF[i] - rows.amf[i];
    rows.distributableCF.push(distCF);
    rows.beginCap.push(capBalance);

    // Contribution at AY
    var contrib = i === contribIdx ? -inp.initialEquity : 0;
    rows.invContrib.push(contrib);

    // Pref accrual on year-start capital (skip for straight template)
    var prefAccrual = template === "straight" ? 0 : capBalance * prefRate;
    unpaidPref += prefAccrual;
    rows.prefAccrued.push(prefAccrual);

    // Pre-acquisition years: no distributions, no pref accrual
    if (i < contribIdx) {
      rows.prefAccrued[i] = 0;
      unpaidPref = 0;
      rows.prefPaid.push(0);
      rows.accruedUnpaid.push(0);
      rows.endCap.push(capBalance);
      rows.excessOp.push(0);
      rows.invFromOp.push(0);
      rows.gpFromOp.push(0);
      rows.refiInflow.push(0);
      rows.refiToPref.push(0);
      rows.refiToCap.push(0);
      rows.refiExcess.push(0);
      rows.invFromRefi.push(0);
      rows.gpFromRefi.push(0);
      rows.saleGross.push(0);
      rows.saleToPref.push(0);
      rows.saleToCap.push(0);
      rows.saleExcess.push(0);
      rows.invFromSale.push(0);
      rows.gpFromSale.push(0);
      rows.invCF.push(0);
      rows.gpCF.push(0);
      rows.coc.push(0);
      rows.activeSplit.push({ inv: 0, gp: 0 });
      cumLpFlows.push(0);
      continue;
    }

    // Compute LP IRR from year-start (for tier split determination)
    var lpIrr = _wfIrr(cumLpFlows.concat([0])); // use history before this year's distribution

    var split = splitFor(template, params, lpIrr);
    rows.activeSplit.push(split);

    // 1) Pay pref from operating distributable CF
    var cash = distCF;
    var prefPaidOp = template === "straight" ? 0 : Math.min(cash, unpaidPref);
    unpaidPref -= prefPaidOp;
    cash -= prefPaidOp;
    // Operating excess
    var opExcess = cash;

    // 2) Refi inflow (if this year)
    var refiInflow = inp.refiYear === inp.years[i] ? inp.refiAmount : 0;
    rows.refiInflow.push(refiInflow);

    var refiToPref = 0,
      refiToCap = 0,
      refiExcess = 0;
    if (refiInflow > 0) {
      if (template === "straight") {
        refiExcess = refiInflow;
      } else {
        refiToPref = Math.min(refiInflow, unpaidPref);
        unpaidPref -= refiToPref;
        var afterPref = refiInflow - refiToPref;
        refiToCap = Math.min(afterPref, capBalance);
        capBalance -= refiToCap;
        refiExcess = afterPref - refiToCap;
      }
    }
    rows.refiToPref.push(refiToPref);
    rows.refiToCap.push(refiToCap);
    rows.refiExcess.push(refiExcess);

    // 3) Sale gross (if this year)
    var isSale = inp.saleYear === inp.years[i];
    var saleGross = isSale ? inp.saleAmount : 0;
    rows.saleGross.push(saleGross);
    var saleToPref = 0,
      saleToCap = 0,
      saleExcess = 0;
    if (saleGross > 0) {
      if (template === "straight") {
        saleExcess = saleGross;
      } else {
        saleToPref = Math.min(saleGross, unpaidPref);
        unpaidPref -= saleToPref;
        var afterPrefSale = saleGross - saleToPref;
        saleToCap = Math.min(afterPrefSale, capBalance);
        capBalance -= saleToCap;
        saleExcess = afterPrefSale - saleToCap;
      }
    }
    rows.saleToPref.push(saleToPref);
    rows.saleToCap.push(saleToCap);
    rows.saleExcess.push(saleExcess);

    // 4) Split excess buckets
    var invOp = opExcess * split.inv,
      gpOp = opExcess * split.gp;
    var invRefi = refiExcess * split.inv,
      gpRefi = refiExcess * split.gp;
    var invSale = saleExcess * split.inv,
      gpSale = saleExcess * split.gp;

    rows.excessOp.push(opExcess);
    rows.invFromOp.push(invOp);
    rows.gpFromOp.push(gpOp);
    rows.invFromRefi.push(invRefi);
    rows.gpFromRefi.push(gpRefi);
    rows.invFromSale.push(invSale);
    rows.gpFromSale.push(gpSale);

    rows.prefPaid.push(prefPaidOp + refiToPref + saleToPref);
    rows.accruedUnpaid.push(unpaidPref);
    rows.endCap.push(capBalance);

    var lpThisYear =
      prefPaidOp +
      refiToPref +
      refiToCap +
      saleToPref +
      saleToCap +
      invOp +
      invRefi +
      invSale;
    var gpThisYear = gpOp + gpRefi + gpSale;
    var totalInvFlow = contrib + lpThisYear;

    rows.invCF.push(totalInvFlow);
    rows.gpCF.push(gpThisYear);
    rows.coc.push(inp.initialEquity ? lpThisYear / inp.initialEquity : 0);

    cumLpFlows.push(totalInvFlow);
  }

  // Summary — distributions = sum(invCF) − sum(contributions)
  var totalContrib = 0,
    totalNet = 0;
  for (var j = 0; j < n; j++) {
    totalContrib += rows.invContrib[j] || 0;
    totalNet += rows.invCF[j] || 0;
  }
  var totalLpCash = totalNet - totalContrib; // gross distributions to LP
  var moic = inp.initialEquity ? totalLpCash / inp.initialEquity : 0;
  var lpIrrFinal = _wfIrr(rows.invCF);

  return { rows: rows, moic: moic, irr: lpIrrFinal, totalLpCash: totalLpCash };
}

function _wfRenderHead(years, ay) {
  var head = document.getElementById("wfHead");
  if (!head) return;
  var html =
    '<tr style="background:rgba(74,124,89,0.08);border-bottom:2px solid rgba(74,124,89,0.2)">' +
    '<th style="padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:280px">Year</th>';
  years.forEach(function (y, i) {
    var isProj = y > ay; // years after AY
    var color = isProj ? "var(--header)" : "var(--muted)";
    var bl = y === ay + 1 ? "border-left:2px solid rgba(74,101,133,0.25);" : "";
    html +=
      '<th style="padding:8px 8px;text-align:right;font-weight:700;color:' +
      color +
      ";white-space:nowrap;font-size:11px;" +
      bl +
      '">' +
      y +
      "</th>";
  });
  html += "</tr>";
  head.innerHTML = html;
}

function _wfRenderRow(label, vals, opts, ay) {
  opts = opts || {};
  var hasPref = !opts.noPref;
  var rowBg = "";
  if (opts.isTotal)
    rowBg =
      "background:rgba(74,101,133,0.1);border-top:2px solid rgba(74,101,133,0.25);border-bottom:2px solid rgba(74,101,133,0.25);";
  else if (opts.isLP) rowBg = "background:rgba(74,124,89,0.07);";
  else if (opts.isSub) rowBg = "background:rgba(0,0,0,0.015);";
  var labelStyle = "padding:7px 14px;color:var(--body);";
  if (opts.isTotal)
    labelStyle = "padding:8px 14px;font-weight:800;color:var(--blue);";
  if (opts.isLP)
    labelStyle = "padding:7px 14px;font-weight:700;color:var(--green);";
  if (opts.isItalic) labelStyle += "padding-left:24px;font-style:italic;";
  if (opts.indent) labelStyle += "padding-left:24px;";

  var cells = vals
    .map(function (v, i) {
      var isProj = ay + i - 2 > ay;
      var bl = i === 3 ? "border-left:2px solid rgba(74,101,133,0.25);" : "";
      var bg =
        isProj && !opts.isTotal && !opts.isLP
          ? "background:rgba(74,101,133,0.025);"
          : "";
      var color = "color:var(--body);";
      if (opts.isTotal) color = "color:var(--blue);font-weight:800;";
      if (opts.isLP) color = "color:var(--green);font-weight:700;";
      var txt = _wfFmt(v, opts);
      return (
        '<td style="padding:7px 8px;text-align:right;' +
        color +
        bg +
        bl +
        '">' +
        txt +
        "</td>"
      );
    })
    .join("");
  return (
    '<tr style="' +
    rowBg +
    'border-bottom:1px solid var(--border)"><td style="' +
    labelStyle +
    '">' +
    label +
    "</td>" +
    cells +
    "</tr>"
  );
}

function _wfRenderSection(label) {
  return (
    '<tr style="background:rgba(74,101,133,0.06);border-bottom:1px solid rgba(74,101,133,0.15)">' +
    '<td colspan="8" style="padding:7px 14px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--blue)">' +
    label +
    "</td></tr>"
  );
}

function _wfRenderSpacer() {
  return '<tr style="height:6px"><td colspan="8"></td></tr>';
}

function buildWaterfallTab() {
  var body = document.getElementById("wfBody");
  if (!body) return;
  var s = getWfState();
  var template = s.template || "simple";
  var params = (s.params || {})[template] || {};
  var inp = _wfGatherInputs();
  var result = _wfCompute(template, params, inp);
  var r = result.rows;
  var hasPref = template !== "straight";
  var ay = inp.ay;

  _wfRenderHead(inp.years, ay);

  var html = "";

  // === Operating Cash Flow ===
  html += _wfRenderSection("Operating Cash Flow");
  html += _wfRenderRow(
    "Cash Flow After Debt Service &amp; Capex Reserves",
    r.operatingCF,
    {},
    ay,
  );
  html += _wfRenderRow(
    "Asset Management Fee",
    r.amf.map(function (v) {
      return v ? -v : 0;
    }),
    { isSub: true },
    ay,
  );
  html += _wfRenderRow(
    "Cash Flow Available for Distribution",
    r.distributableCF,
    { isTotal: true },
    ay,
  );
  html += _wfRenderSpacer();

  // === Investor Equity Capital Account (only if pref) ===
  if (hasPref) {
    html += _wfRenderSection("Investor Equity Capital Account");
    html += _wfRenderRow("Beginning Investment Amount", r.beginCap, {}, ay);
    html += _wfRenderRow(
      'Preferred Return Earned on Unpaid Capital <span style="color:var(--amber);font-size:11px;font-weight:700">' +
        (params.prefRate || 0) +
        "%</span>",
      r.prefAccrued,
      { isItalic: true },
      ay,
    );
    html += _wfRenderRow(
      "Preferred Return Paid",
      r.prefPaid,
      { isLP: true },
      ay,
    );
    html += _wfRenderRow(
      "Accrued but Unpaid Preferred Return",
      r.accruedUnpaid,
      { isSub: true, isItalic: true },
      ay,
    );
    html += _wfRenderRow("Ending Investment Amount", r.endCap, {}, ay);
    html += _wfRenderSpacer();
  }

  // === Excess Cash Flow split (Operating) ===
  var invPctLbl = "";
  if (template === "straight" || template === "simple") {
    var pct = params.invSplit != null ? params.invSplit : 80;
    invPctLbl =
      ' <span style="color:var(--muted);font-size:11px;font-weight:400">' +
      pct +
      "%</span>";
  } else {
    invPctLbl =
      ' <span style="color:var(--muted);font-size:11px;font-weight:400">Tier-based</span>';
  }
  html += _wfRenderRow(
    hasPref ? "Excess Cash Flow" : "Distributable Cash Flow",
    hasPref ? r.excessOp : r.distributableCF,
    {},
    ay,
  );
  html += _wfRenderRow(
    "Investor Portion of " +
      (hasPref ? "Excess" : "Distributable") +
      " Cash Flow" +
      invPctLbl,
    r.invFromOp,
    { isLP: true },
    ay,
  );
  html += _wfRenderRow(
    "Sponsor",
    r.gpFromOp,
    { isSub: true, indent: true },
    ay,
  );
  html += _wfRenderSpacer();

  // === Refinance section (only if refi happens) ===
  var refiHappens = r.refiInflow.some(function (x) {
    return x > 0;
  });
  if (refiHappens) {
    html += _wfRenderSection("Refinance Proceeds");
    html += _wfRenderRow(
      "Cash Flow from Refinance",
      r.refiInflow,
      { isTotal: true },
      ay,
    );
    if (hasPref) {
      html += _wfRenderRow(
        "To Preferred Return",
        r.refiToPref,
        { isItalic: true },
        ay,
      );
      html += _wfRenderRow(
        "Return of Capital",
        r.refiToCap,
        { isItalic: true },
        ay,
      );
    }
    if (
      r.refiExcess.some(function (x) {
        return x > 0;
      })
    ) {
      html += _wfRenderRow(
        "Excess after Pref + ROC",
        r.refiExcess,
        { isSub: true },
        ay,
      );
      html += _wfRenderRow("Investor Share", r.invFromRefi, { isLP: true }, ay);
      html += _wfRenderRow(
        "Sponsor",
        r.gpFromRefi,
        { isSub: true, indent: true },
        ay,
      );
    }
    html += _wfRenderSpacer();
  }

  // === Sale Proceeds ===
  var saleHappens = r.saleGross.some(function (x) {
    return x > 0;
  });
  if (saleHappens) {
    var saleYear = inp.saleYear;
    html += _wfRenderSection("Sale Proceeds (" + saleYear + " Exit)");
    html += _wfRenderRow(
      "Cash Flow from Sale",
      r.saleGross,
      { isTotal: true },
      ay,
    );
    if (hasPref) {
      html += _wfRenderRow(
        "To Preferred Return",
        r.saleToPref,
        { isItalic: true },
        ay,
      );
      html += _wfRenderRow(
        "Return of Remaining Capital",
        r.saleToCap,
        { isItalic: true },
        ay,
      );
    }
    html += _wfRenderRow(
      "Excess after Pref + ROC",
      r.saleExcess,
      { isSub: true },
      ay,
    );
    html += _wfRenderRow(
      "Investor Profit from Sale",
      r.invFromSale,
      { isLP: true },
      ay,
    );
    html += _wfRenderRow(
      "Sponsor",
      r.gpFromSale,
      { isSub: true, indent: true },
      ay,
    );
    html += _wfRenderSpacer();
  }

  // === Summary ===
  html += _wfRenderSection("Investor Returns Summary");
  html += _wfRenderRow(
    "Investor Cash Flow",
    r.invCF,
    { isTotal: true, keepZero: false },
    ay,
  );
  html += _wfRenderRow("Sponsor Cash Flow", r.gpCF, { isSub: true }, ay);
  html += _wfRenderRow(
    "Annual Cash on Cash Return",
    r.coc,
    { pct: true, dec: 1, keepZero: false },
    ay,
  );

  // MOIC & IRR
  html +=
    '<tr style="background:rgba(74,124,89,0.1);border-top:2px solid rgba(74,124,89,0.25)"><td style="padding:9px 14px;font-weight:800;color:var(--green);font-size:13px">Multiple (MOIC)</td>' +
    '<td colspan="7" style="padding:9px 8px;text-align:right;font-size:13px;font-weight:800;color:var(--green)">' +
    (result.moic ? result.moic.toFixed(2) + "×" : "—") +
    "</td></tr>";
  html +=
    '<tr style="background:rgba(74,124,89,0.15);border-bottom:3px solid rgba(74,124,89,0.4)"><td style="padding:9px 14px;font-weight:800;color:var(--green);font-size:13px">IRR</td>' +
    '<td colspan="7" style="padding:9px 8px;text-align:right;font-size:14px;font-weight:800;color:var(--green)">' +
    (result.irr !== null ? (result.irr * 100).toFixed(1) + "%" : "—") +
    "</td></tr>";

  body.innerHTML = html;
}

// ── Refinance Event tab: auto-compute % columns ──────────────────────────
function buildRefinanceEventTab() {
  function parseMoney(s) {
    if (!s) return 0;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function pct(num, den) {
    return den ? ((num / den) * 100).toFixed(2) + "%" : "—";
  }
  function set(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  var vop = parseMoney(
    (document.getElementById("refiValueOfProperty") || {}).textContent,
  );
  var nls = parseMoney(
    (document.getElementById("refiNewLoanSize") || {}).textContent,
  );
  var cost = parseMoney(
    (document.getElementById("refiCostAmt") || {}).textContent,
  );
  var loanEnd = parseMoney(
    (document.getElementById("refiLoanEndYear") || {}).textContent,
  );
  var yld = parseMoney(
    (document.getElementById("refiYieldAmt") || {}).textContent,
  );

  set("refiNewLoanSizePct", pct(nls, vop));
  set("refiCostPct", pct(cost, vop));
  set("refiYieldPct", pct(yld, loanEnd));
}

// ── Equity Required tab: auto-compute % columns ──────────────────────────
function buildEquityRequiredTab() {
  function parseMoney(s) {
    if (!s) return 0;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function pct(num, den) {
    return den ? ((num / den) * 100).toFixed(2) + "%" : "—";
  }
  function set(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  var ppEl = document.getElementById("ppAsIsValue");
  var tcEl = document.getElementById("ppTotalCost");
  var pp = ppEl ? parseMoney(ppEl.textContent) : 0;
  var tc = tcEl ? parseMoney(tcEl.textContent) : 0;

  // Regular
  var regLtc = parseMoney(
    (document.getElementById("eqRegLtcAmt") || {}).textContent,
  );
  var regLtpp = parseMoney(
    (document.getElementById("eqRegLtppAmt") || {}).textContent,
  );
  set("eqRegLtcPct", pct(regLtc, tc));
  set("eqRegEqPct", tc ? (100 - (regLtc / tc) * 100).toFixed(2) + "%" : "—");
  set("eqRegLtppPct", pct(regLtpp, pp));

  // Refinance
  var refLtc = parseMoney(
    (document.getElementById("eqRefLtcAmt") || {}).textContent,
  );
  var refLtpp = parseMoney(
    (document.getElementById("eqRefLtppAmt") || {}).textContent,
  );
  set("eqRefLtcPct", pct(refLtc, tc));
  set("eqRefEqPct", tc ? (100 - (refLtc / tc) * 100).toFixed(2) + "%" : "—");
  set("eqRefLtppPct", pct(refLtpp, pp));
}

// ── Sale Event (Regular): Value of Property source toggle ────────────────
function initSeRegValueOfProperty() {
  var sel = document.getElementById("seRegVopSrc");
  if (!sel) return;
  var pid = window._currentProjectId || "default";
  var saved = localStorage.getItem("se_reg_vop_src_" + pid);
  if (saved) sel.value = saved;
  updateSeRegValueOfProperty();
}
function updateSeRegValueOfProperty() {
  var sel = document.getElementById("seRegVopSrc");
  if (!sel) return;
  var valEl = document.getElementById("seRegVopValue");
  var badge = document.getElementById("seRegVopBadge");
  var pid = window._currentProjectId || "default";
  localStorage.setItem("se_reg_vop_src_" + pid, sel.value);

  function parseMoney(s) {
    if (!s) return 0;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function parsePct(s) {
    if (!s) return 0;
    var m = String(s).match(/([\d.]+)\s*%/);
    return m ? parseFloat(m[1]) / 100 : 0;
  }

  if (sel.value === "computed") {
    var noi = parseMoney(document.getElementById("seRegNOI").textContent);
    var cap = parsePct(document.getElementById("seRegCapRate").textContent);
    var v = cap ? Math.round(noi / cap) : 0;
    if (valEl) valEl.textContent = "$" + v.toLocaleString();
    if (badge) {
      badge.textContent = "Computed";
      badge.style.color = "#3a5a7a";
      badge.style.background = "rgba(90,122,153,0.14)";
    }
  } else {
    if (valEl) valEl.textContent = "$6,035,162";
    if (badge) {
      badge.textContent = "HD";
      badge.style.color = "#1565C0";
      badge.style.background = "rgba(21,101,192,0.08)";
    }
  }
}

// ── Sale Event (After Refinance): Value of Property source toggle ────────
function initSeRefValueOfProperty() {
  var sel = document.getElementById("seRefVopSrc");
  if (!sel) return;
  var pid = window._currentProjectId || "default";
  var saved = localStorage.getItem("se_ref_vop_src_" + pid);
  if (saved) sel.value = saved;
  updateSeRefValueOfProperty();
}
function updateSeRefValueOfProperty() {
  var sel = document.getElementById("seRefVopSrc");
  if (!sel) return;
  var valEl = document.getElementById("seRefVopValue");
  var badge = document.getElementById("seRefVopBadge");
  var pid = window._currentProjectId || "default";
  localStorage.setItem("se_ref_vop_src_" + pid, sel.value);

  function parseMoney(s) {
    if (!s) return 0;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function parsePct(s) {
    if (!s) return 0;
    var m = String(s).match(/([\d.]+)\s*%/);
    return m ? parseFloat(m[1]) / 100 : 0;
  }

  if (sel.value === "computed") {
    var noi = parseMoney(document.getElementById("seRefNOI").textContent);
    var cap = parsePct(document.getElementById("seRefCapRate").textContent);
    var v = cap ? Math.round(noi / cap) : 0;
    if (valEl) valEl.textContent = "$" + v.toLocaleString();
    if (badge) {
      badge.textContent = "Computed";
      badge.style.color = "#3a5a7a";
      badge.style.background = "rgba(90,122,153,0.14)";
    }
  } else {
    if (valEl) valEl.textContent = "$6,490,595";
    if (badge) {
      badge.textContent = "HD";
      badge.style.color = "#1565C0";
      badge.style.background = "rgba(21,101,192,0.08)";
    }
  }
}

// ── Construction Equity tab: dynamic year labels + Total = Σ + 2,000,000 ──
function buildConstructionEquityTab() {
  var tbl = document.getElementById("ceTable");
  if (!tbl) return;
  var asmt =
    typeof getProjectAssumptions === "function" ? getProjectAssumptions() : {};
  var ay = asmt.acquisitionYear || 2026;
  var y1L = document.getElementById("ceY1Label");
  if (y1L) y1L.textContent = ay;
  var y5L = document.getElementById("ceY1Y5Label");
  if (y5L) y5L.textContent = ay + "–" + (ay + 4);

  function parseMoney(s) {
    if (!s) return 0;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  var src = document.getElementById("refiResUnitUpgrades");
  var upgrades = src ? parseMoney(src.textContent) : 0;
  var uEl = document.getElementById("ceUnitUpgrades");
  if (uEl) uEl.textContent = upgrades ? "$" + upgrades.toLocaleString() : "—";

  var sum =
    parseMoney(document.getElementById("ceAcqReserves").textContent) +
    parseMoney(document.getElementById("ceY1DistRes").textContent) +
    parseMoney(document.getElementById("ceRefiReserves").textContent) +
    upgrades +
    parseMoney(document.getElementById("ceY1Y5Res").textContent);
  var total = sum + 2000000;
  var tEl = document.getElementById("ceTotal");
  if (tEl) tEl.textContent = "$" + total.toLocaleString();
}

// HD metric options for the Market Ref dropdown
var HD_METRICS = [
  { key: "leasedRent", label: "Leased Rent", short: "Leased" },
  { key: "ner", label: "NER", short: "NER" },
  { key: "activeRent", label: "Active Listing Rent", short: "Active" },
  { key: "activeNer", label: "Active NER", short: "Act. NER" },
  { key: "rent30", label: "30-Day Leased", short: "30d" },
  { key: "rent60", label: "60-Day Leased", short: "60d" },
  { key: "rent90", label: "90-Day Leased", short: "90d" },
];

// Persisted selected metric per project
function _getHDMetricKey(pid) {
  return (
    localStorage.getItem("hd_umix_metric_" + (pid || currentProjectId)) ||
    "leasedRent"
  );
}
function _setHDMetricKey(pid, k) {
  localStorage.setItem("hd_umix_metric_" + (pid || currentProjectId), k);
}

function changeHDMetric(key) {
  var pid = window._currentProjectId || currentProjectId || "default";
  _setHDMetricKey(pid, key);
  buildPFUnitMix();
}

// Find closest HD row to a given sqft
function _findHDBySqft(hdUmix, targetSqft) {
  if (!hdUmix || !hdUmix.length || !targetSqft) return null;
  var best = null,
    bestDist = Infinity;
  hdUmix.forEach(function (row) {
    var dist = Math.abs((row.sqft || 0) - targetSqft);
    if (dist < bestDist) {
      bestDist = dist;
      best = row;
    }
  });
  // Only match if within 20% tolerance
  if (best && bestDist / targetSqft > 0.2) return null;
  return best;
}
// Broader match using ALL HD Unit Mix rows (all comps, not just subject)
// Returns {beds, floorplan} for naming; no tolerance limit
function _findHDInfoBySqft(pid, targetSqft) {
  var allRows = getHDUnitMixAll(pid);
  if (!allRows || !allRows.length || !targetSqft) return null;
  var best = null,
    bestDist = Infinity;
  allRows.forEach(function (row) {
    var dist = Math.abs((row.sqft || 0) - targetSqft);
    if (dist < bestDist) {
      bestDist = dist;
      best = row;
    }
  });
  // 30% tolerance for naming (more relaxed than rent matching)
  if (best && bestDist / targetSqft > 0.3) return null;
  return best;
}

// Unit Mix column-level rent source: 'rr' | 'hd-leasedRent' | 'hd-rent30' | 'hd-rent60' | 'hd-rent90'
function _getUmixColSrc(pid) {
  return localStorage.getItem("umix_col_src_" + (pid || "default")) || "rr";
}
function _setUmixColSrc(pid, src) {
  localStorage.setItem("umix_col_src_" + (pid || "default"), src);
}
function setUmixColSource(src) {
  var pid = window._currentProjectId || "default";
  _setUmixColSrc(pid, src);
  buildPFUnitMix();
}
// Manual per-row override (applies only when user edits a cell in Edit Mode)
function _getUmixManualRents(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("umix_manual_rents_" + (pid || "default")) || "{}",
    );
  } catch (e) {
    return {};
  }
}
function _getUmixManualRent(pid, rowIdx) {
  var obj = _getUmixManualRents(pid);
  return obj[rowIdx];
}
function setUmixManualRent(rowIdx, val) {
  var pid = window._currentProjectId || "default";
  var obj = _getUmixManualRents(pid);
  obj[rowIdx] = parseFloat(String(val).replace(/[^\d.-]/g, ""));
  localStorage.setItem("umix_manual_rents_" + pid, JSON.stringify(obj));
  buildPFUnitMix();
}
function clearUmixManualRent(rowIdx) {
  var pid = window._currentProjectId || "default";
  var obj = _getUmixManualRents(pid);
  delete obj[rowIdx];
  localStorage.setItem("umix_manual_rents_" + pid, JSON.stringify(obj));
  buildPFUnitMix();
}
window.setUmixColSource = setUmixColSource;
window.setUmixManualRent = setUmixManualRent;
window.clearUmixManualRent = clearUmixManualRent;

// Source options for As-is Rent column header
var UMIX_SRC_OPTIONS = [
  { value: "rr", label: "RR", color: DS_COLORS.rr },
  { value: "hd-leasedRent", label: "HD Leased", color: DS_COLORS.hd },
  { value: "hd-rent30", label: "HD 30D Leased", color: DS_COLORS.hd },
  { value: "hd-rent60", label: "HD 60D Leased", color: DS_COLORS.hd },
  { value: "hd-rent90", label: "HD 90D Leased", color: DS_COLORS.hd },
];

function buildPFUnitMix() {
  var headEl = document.getElementById("pfUnitMixHead");
  var bodyEl = document.getElementById("pfUnitMixBody");
  if (!headEl || !bodyEl) return;
  var pid = window._currentProjectId || currentProjectId || "default";
  var hdUmix = getHDUnitMix(pid);
  var hasRRData = (_getRRData(pid) || RR_DATA || []).length > 0;
  var hasHDUmix = hdUmix && hdUmix.length > 0;
  // Show empty table when no data uploaded
  if (!_pfLoaded && !hasRRData && !hasHDUmix) {
    headEl.innerHTML =
      "<tr><th>Unit Types</th><th># Units</th><th>Bedroom</th><th>SQF</th></tr>";
    bodyEl.innerHTML =
      '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">—</td></tr>';
    return;
  }
  var hdMeta = getHDMeta(pid);
  var showHD = hdUmix && hdUmix.length > 0 && !isHDUmixHidden(pid);

  // ── Build PF_DATA.unitMix from RR + HD data ──
  var rrRows = _getRRData(pid) || RR_DATA || [];
  if (rrRows.length > 0 || showHD) {
    // Group RR units by sqft
    var sqftGroups = {};
    rrRows.forEach(function (r) {
      var sqft = r.sqft || 0;
      if (!sqftGroups[sqft]) sqftGroups[sqft] = [];
      sqftGroups[sqft].push(r);
    });
    var sortedSqfts = Object.keys(sqftGroups)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });

    // Build unit mix rows
    var mixRows = [];
    if (sortedSqfts.length > 0) {
      // Resolve beds for each sqft group using HD (strict → broad) → RR fallback
      var sqftBeds = {}; // sqft → beds
      sortedSqfts.forEach(function (sqft) {
        var hdMatch = sqft ? _findHDBySqft(hdUmix, sqft) : null;
        var beds = hdMatch ? hdMatch.beds : null;
        // Broader match: use all HD comps for beds/naming info
        if (beds == null && showHD) {
          var hdInfo = _findHDInfoBySqft(pid, sqft);
          if (hdInfo) beds = hdInfo.beds;
        }
        // Fallback: RR data
        var rrGroup = sqftGroups[sqft];
        if (beds == null && rrGroup.length > 0 && rrGroup[0].beds != null) {
          beds = rrGroup[0].beds;
        }
        sqftBeds[sqft] = beds;
      });

      // Track beds→sqft groups for suffix logic
      var bedsSqftMap = {};
      sortedSqfts.forEach(function (sqft) {
        var beds = sqftBeds[sqft];
        if (beds != null) {
          if (!bedsSqftMap[beds]) bedsSqftMap[beds] = [];
          bedsSqftMap[beds].push(sqft);
        }
      });

      sortedSqfts.forEach(function (sqft) {
        var group = sqftGroups[sqft];
        var hdMatch = sqft ? _findHDBySqft(hdUmix, sqft) : null;
        var beds = sqftBeds[sqft];

        // Unit Types naming:
        // 1) Has HD → use beds-based name like "1BR", "2BR" (from HD floorplan or beds)
        // 2) No HD → use sqft as name
        var typeName;
        if (showHD && beds != null) {
          // Use beds-based naming from HD
          var bedsLabel = beds === 0 ? "Studio" : beds + "BR";
          // If same beds has multiple sqft groups, add sqft suffix
          if (bedsSqftMap[beds] && bedsSqftMap[beds].length > 1) {
            typeName = bedsLabel + " (" + sqft + ")";
          } else {
            typeName = bedsLabel;
          }
        } else if (hdMatch && hdMatch.floorplan) {
          typeName = hdMatch.floorplan;
        } else {
          typeName = sqft + "";
        }

        // # Units: count of all units in group (including vacant)
        var unitCount = group.length;

        // As-is Rent: average of actual_rent > 0 (exclude vacant/zero rent)
        var rentsAboveZero = group.filter(function (r) {
          return r.actual_rent > 0;
        });
        var asIsRent =
          rentsAboveZero.length > 0
            ? rentsAboveZero.reduce(function (s, r) {
                return s + r.actual_rent;
              }, 0) / rentsAboveZero.length
            : 0;

        mixRows.push({
          type: typeName,
          units: unitCount,
          beds: beds,
          sqft: sqft,
          asIsRent: Math.round(asIsRent),
          growthRent: null, // user manual input
        });
      });
    } else if (showHD) {
      // No RR data, use HD Unit Mix only
      hdUmix.forEach(function (hd) {
        mixRows.push({
          type: hd.floorplan || hd.beds + "BR",
          units: hd.units || 0,
          beds: hd.beds,
          sqft: hd.sqft || 0,
          asIsRent: Math.round(hd.leasedRent || 0),
          growthRent: null,
        });
      });
    }

    // Preserve user-entered growthRent from existing PF_DATA.unitMix
    var oldMix = PF_DATA.unitMix || [];
    mixRows.forEach(function (row, idx) {
      if (oldMix[idx] && oldMix[idx].growthRent != null) {
        row.growthRent = oldMix[idx].growthRent;
      }
    });

    // Add Total row
    mixRows.push({ type: "Total", isTotal: true });
    PF_DATA.unitMix = mixRows;
  }

  var isEdit = window._globalEditMode || false;
  var metricKey = _getHDMetricKey(pid);
  var metricInfo =
    HD_METRICS.find(function (m) {
      return m.key === metricKey;
    }) || HD_METRICS[0];

  var hdC = DS_COLORS.hd;
  var rrC = DS_COLORS.rr;
  var manC = DS_COLORS.manual;

  var colSrc = _getUmixColSrc(pid);
  // If HD not available, force RR; if RR not available, force first HD
  if (!showHD && colSrc.indexOf("hd-") === 0) colSrc = "rr";
  if (!hasRRData && colSrc === "rr") colSrc = showHD ? "hd-leasedRent" : "rr";
  var manualRents = _getUmixManualRents(pid);

  // Helper: get effective rent for a row based on column source (+ manual override)
  function _getRowRent(rowIdx, u, hdMatch) {
    // Manual override always wins if present
    var mv = manualRents[rowIdx];
    if (mv != null && !isNaN(mv)) return { src: "manual", val: mv };
    if (colSrc.indexOf("hd-") === 0 && hdMatch) {
      var metric = colSrc.substring(3);
      return { src: "hd", val: hdMatch[metric] || null, metric: metric };
    }
    return { src: "rr", val: u.asIsRent || null };
  }

  function fmtD(v) {
    if (v == null || v === 0) return "";
    return "$\u00a0" + Math.round(v).toLocaleString();
  }
  // ── THEAD ──
  var th =
    "padding:8px 10px;font-weight:700;color:var(--header);white-space:nowrap;font-size:11px";
  var thB = th + ";border-left:1px solid var(--border)";
  var hdReportLabel =
    hdMeta && hdMeta.reportDate ? hdMeta.reportDate.slice(0, 7) : "";

  var theadHtml =
    '<tr style="background:rgba(139,115,85,0.07);border-bottom:2px solid var(--border)">';
  theadHtml +=
    '<th style="' + th + ';text-align:left;padding-left:14px">Unit Types</th>';
  theadHtml += '<th style="' + th + ';text-align:center"># Units</th>';
  theadHtml += '<th style="' + th + ';text-align:center">Bedroom</th>';
  theadHtml += '<th style="' + th + ';text-align:right">SQF</th>';
  // Single As-is Rent column — header holds the column-level Source select
  var curOpt =
    UMIX_SRC_OPTIONS.find(function (o) {
      return o.value === colSrc;
    }) || UMIX_SRC_OPTIONS[0];
  var cOptC = curOpt.color;
  var optW = _srcSelectWidth(curOpt.label);
  var headerSelStyle =
    "font-size:9px;padding:3px 18px 3px 10px;border:1px solid " +
    cOptC.tag +
    ";border-radius:11px;color:" +
    cOptC.tag +
    ";background:" +
    cOptC.tagBg +
    ";cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;transition:all .15s;text-align:center;text-align-last:center;width:" +
    optW +
    "px;background-image:url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='" +
    encodeURIComponent(cOptC.tag) +
    "' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 6px center;margin-left:8px";
  var headerSelHtml =
    '<select onchange="setUmixColSource(this.value)" style="' +
    headerSelStyle +
    '" title="Change source for all rows">';
  UMIX_SRC_OPTIONS.forEach(function (o) {
    // Hide HD options if HD not uploaded
    if (!showHD && o.value.indexOf("hd-") === 0) return;
    // Hide RR option if no RR data uploaded
    if (!hasRRData && o.value === "rr") return;
    headerSelHtml +=
      '<option value="' +
      o.value +
      '"' +
      (o.value === colSrc ? " selected" : "") +
      ' style="background:#fff;color:' +
      o.color.tag +
      ';text-align:center">' +
      o.label +
      "</option>";
  });
  headerSelHtml += "</select>";
  var _ayAsmt =
    typeof getProjectAssumptions === "function" ? getProjectAssumptions() : {};
  var _rrAsIsYr = _ayAsmt.acquisitionYear || 2026;
  var _rrAY = _rrAsIsYr + 1;
  theadHtml +=
    '<th style="' +
    thB +
    ';text-align:right;white-space:nowrap">' +
    _rrAsIsYr +
    " As-is Rent " +
    headerSelHtml +
    "</th>";
  theadHtml +=
    '<th style="' + thB + ';text-align:right">' + _rrAY + " Growth</th>";
  theadHtml +=
    '<th style="' +
    th +
    ';text-align:right">' +
    _rrAsIsYr +
    " As-is Rent Annually</th>";
  theadHtml +=
    '<th style="' +
    th +
    ';text-align:right;color:var(--green)">' +
    _rrAY +
    " Projected Rent</th>";
  theadHtml += "</tr>";
  headEl.innerHTML = theadHtml;

  // ── TBODY ──
  var totalAsIs = 0,
    totalProj = 0,
    totalUnits = 0;
  var rows = PF_DATA.unitMix || [];

  var tbodyHtml = rows
    .map(function (u, i) {
      var isTot = u.isTotal;
      var fw = isTot ? "700" : "400";
      var rowBg = isTot
        ? "background:rgba(196,220,196,0.35);border-top:2px solid rgba(74,124,89,0.3)"
        : i % 2 === 1
          ? "background:rgba(0,0,0,0.018)"
          : "";

      var hc = "color:var(--header);font-weight:" + fw;
      var mc = "color:var(--muted)";
      var gc = "color:var(--green);font-weight:" + fw;
      var cp = "padding:8px 10px;font-size:12px;";

      // HD match by sqft (closest)
      var hdMatch = !isTot && u.sqft ? _findHDBySqft(hdUmix, u.sqft) : null;

      // Determine active rent based on per-row source
      var rentInfo = isTot
        ? { src: "rr", val: null }
        : _getRowRent(i, u, hdMatch);
      var activeRent = rentInfo.val;
      var activeSrc = rentInfo.src;
      var rentColor =
        activeSrc === "hd"
          ? hdC.tag
          : activeSrc === "manual"
            ? manC.tag
            : rrC.tag;
      var rentBg = "transparent";

      var asIsAnn =
        !isTot && activeRent && u.units ? activeRent * 12 * u.units : 0;
      var growthFactor =
        u.asIsRent && u.growthRent ? u.growthRent / u.asIsRent : 1;
      var projRent = activeRent ? activeRent * growthFactor : 0;
      var projAnn = !isTot && projRent && u.units ? projRent * 12 * u.units : 0;

      if (!isTot) {
        totalAsIs += asIsAnn;
        totalProj += projAnn;
        totalUnits += u.units || 0;
      }

      if (isTot) {
        asIsAnn = totalAsIs;
        projAnn = totalProj;
      }

      var trId = isTot ? ' id="rrTotalRow"' : "";
      var html =
        "<tr" +
        trId +
        ' style="' +
        rowBg +
        ';border-bottom:1px solid var(--border)">';
      html +=
        '<td style="' +
        cp +
        "padding-left:14px;font-weight:" +
        fw +
        ';color:var(--header)">' +
        u.type +
        "</td>";
      html +=
        "<td" +
        (isTot ? ' id="rrTotalUnits"' : "") +
        ' style="' +
        cp +
        "text-align:center;" +
        hc +
        '">' +
        (u.units != null ? (isTot ? totalUnits : u.units + ".00") : "") +
        "</td>";
      html +=
        '<td style="' +
        cp +
        "text-align:center;" +
        mc +
        '">' +
        (isTot ? "" : u.beds != null ? u.beds : "") +
        "</td>";
      html +=
        '<td style="' +
        cp +
        "text-align:right;" +
        mc +
        '">' +
        (isTot ? "" : u.sqft || "—") +
        "</td>";

      // As-is Rent — row shows only the value (source is column-level via header)
      if (isTot) {
        html +=
          '<td style="' +
          cp +
          'text-align:right;border-left:1px solid var(--border);color:var(--header);font-weight:700"></td>';
      } else if (isEdit) {
        var valStr = activeRent ? Math.round(activeRent) : "";
        var vW = Math.max(String(valStr).length * 8 + 16, 48);
        // Manual badge if this row has a manual override
        var manBadge =
          activeSrc === "manual"
            ? '<span style="font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:' +
              manC.tag +
              ";background:" +
              manC.tagBg +
              ';margin-right:6px">MANUAL</span>'
            : "";
        var clearBtn =
          activeSrc === "manual"
            ? '<button onclick="clearUmixManualRent(' +
              i +
              ')" style="margin-left:6px;border:none;background:none;color:var(--muted);cursor:pointer;font-size:11px" title="Clear manual override">×</button>'
            : "";
        html +=
          '<td style="' +
          cp +
          "text-align:right;border-left:1px solid var(--border);background:" +
          rentBg +
          '">' +
          '<div style="display:inline-flex;align-items:center;justify-content:flex-end">' +
          manBadge +
          '<input type="text" value="' +
          valStr +
          '"' +
          ' onchange="setUmixManualRent(' +
          i +
          ',this.value)"' +
          ' style="text-align:right;font-size:12px;padding:3px 6px;border-radius:4px;outline:none;' +
          "border:1px solid " +
          rentColor +
          ";color:" +
          rentColor +
          ";background:transparent;width:" +
          vW +
          'px;box-sizing:content-box">' +
          clearBtn +
          "</div></td>";
      } else {
        html +=
          '<td style="' +
          cp +
          "text-align:right;border-left:1px solid var(--border);color:" +
          rentColor +
          ";font-weight:" +
          fw +
          ";background:" +
          rentBg +
          '">' +
          (activeRent
            ? "$\u00a0" + Number(Math.round(activeRent)).toLocaleString()
            : "—") +
          "</td>";
      }

      html +=
        '<td style="' +
        cp +
        "text-align:right;" +
        hc +
        ';border-left:1px solid var(--border)">' +
        (u.growthRent && !isTot
          ? "$\u00a0" + Number(u.growthRent).toLocaleString()
          : isTot
            ? ""
            : "\u2014") +
        "</td>";
      html +=
        "<td" +
        (isTot ? ' id="rrTotalAsIs"' : "") +
        ' style="' +
        cp +
        "text-align:right;" +
        hc +
        '">' +
        fmtD(asIsAnn) +
        "</td>";
      html +=
        "<td" +
        (isTot ? ' id="rrTotalProj"' : "") +
        ' style="' +
        cp +
        "text-align:right;" +
        gc +
        '">' +
        fmtD(projAnn) +
        "</td>";
      html += "</tr>";
      return html;
    })
    .join("");

  bodyEl.innerHTML = tbodyHtml;
}

function hideHDUmixCols() {
  var pid = window._currentProjectId || currentProjectId || "default";
  setHDUmixHidden(pid, true);
  buildPFUnitMix();
  toast("HD columns hidden");
}
function showHDUmixCols() {
  var pid = window._currentProjectId || currentProjectId || "default";
  setHDUmixHidden(pid, false);
  buildPFUnitMix();
}

function renderRentRoll() {
  const tbody = document.getElementById("rentRollBody");
  if (!tbody) return;
  var rrRows = _getRRData(currentProjectId) || RR_DATA || [];
  tbody.innerHTML = rrRows
    .map((r) => {
      const occupied = r.tenant !== "VACANT";
      const rentFmt = occupied ? "$" + r.actual_rent.toLocaleString() : "—";
      const psfFmt = r.rent_psf > 0 ? "$" + r.rent_psf.toFixed(2) : "—";
      const depFmt =
        (r.other_dep || 0) > 0
          ? "$" + (r.other_dep || 0).toLocaleString()
          : "—";
      return `<tr>
      <td style="font-weight:600">${r.unit}</td>
      <td>${r.sqft}</td>
      <td style="font-size:12px">${r.tenant}</td>
      <td style="font-weight:500">${rentFmt}</td>
      <td style="color:var(--muted)">${psfFmt}</td>
      <td style="color:var(--muted)">${depFmt}</td>
      <td style="font-size:12px;color:var(--muted)">${r.move_in || "—"}</td>
      <td style="font-size:12px;color:var(--muted)">${r.lease_exp || "—"}</td>
      <td style="font-size:12px;color:var(--muted)">${r.move_out || "—"}</td>
      <td><span class="badge ${occupied ? "badge-status-active" : "badge-status-draft"}">${occupied ? (currentLang === "zh" ? "已出租" : "Occupied") : currentLang === "zh" ? "空置" : "Vacant"}</span></td>
    </tr>`;
    })
    .join("");
}

// ─── MARKET DATA ──────────────────────────────────────────────────────────────

function switchMarketRegion(val) {
  currentMarketRegion = val;
  renderMarket();
}
function fetchMarketData() {
  toast("Fetching market data from RentCast…");
  setTimeout(() => {
    renderMarket();
    toast("Market data updated", "success");
  }, 1200);
}
function renderMarket() {
  const d = MARKET_DATA[currentMarketRegion] || MARKET_DATA.philadelphia;
  const container = document.getElementById("marketContent");
  if (!container) return;
  if (!d) {
    container.innerHTML =
      '<div class="card" style="padding:24px;text-align:center;color:var(--muted)">No market data available. Configure API keys in Settings to fetch market data.</div>';
    return;
  }
  container.innerHTML = `
  <div class="bento bento-4" style="margin-bottom:var(--gap)">
    <div class="kpi-card"><div class="kpi-accent" style="background:var(--green)"></div><div class="kpi-icon" style="background:rgba(74,124,89,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.8" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div><div class="kpi-value">${d.vacancy}%</div><div class="kpi-label">Market Vacancy</div><span class="badge badge-rentcast" style="margin-top:6px">RentCast</span></div>
    <div class="kpi-card"><div class="kpi-accent"></div><div class="kpi-value">$${d.avg1br.toLocaleString()}</div><div class="kpi-label">Avg 1BR Rent</div><span class="badge badge-rentcast" style="margin-top:6px">RentCast</span></div>
    <div class="kpi-card"><div class="kpi-accent"></div><div class="kpi-value">$${d.avg2br.toLocaleString()}</div><div class="kpi-label">Avg 2BR Rent</div><span class="badge badge-rentcast" style="margin-top:6px">RentCast</span></div>
    <div class="kpi-card"><div class="kpi-accent" style="background:var(--amber)"></div><div class="kpi-value">${d.yoyRent}%</div><div class="kpi-label">YoY Rent Growth</div><span class="badge badge-rentcast" style="margin-top:6px">RentCast</span></div>
  </div>
  <div class="bento bento-2">
    <div class="card">
      <div class="section-title" style="margin-bottom:var(--gap)">Rent Benchmark — ${d.city}</div>
      <div class="mini-chart">
        <div class="mini-chart-row"><span class="mini-chart-label">Subject 1BR</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:${((1450 / d.avg2brDeluxe) * 100).toFixed(0)}%"></div></div><span class="mini-chart-val">$1,450</span></div>
        <div class="mini-chart-row"><span class="mini-chart-label">Market 1BR</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:${((d.avg1br / d.avg2brDeluxe) * 100).toFixed(0)}%;background:linear-gradient(90deg,var(--blue),#6a8fad)"></div></div><span class="mini-chart-val">$${d.avg1br.toLocaleString()}</span></div>
        <div class="mini-chart-row"><span class="mini-chart-label">Subject 2BR</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:${((1850 / d.avg2brDeluxe) * 100).toFixed(0)}%"></div></div><span class="mini-chart-val">$1,850</span></div>
        <div class="mini-chart-row"><span class="mini-chart-label">Market 2BR</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:${((d.avg2br / d.avg2brDeluxe) * 100).toFixed(0)}%;background:linear-gradient(90deg,var(--blue),#6a8fad)"></div></div><span class="mini-chart-val">$${d.avg2br.toLocaleString()}</span></div>
        <div class="mini-chart-row"><span class="mini-chart-label">Subject 2BR DLX</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:${((1950 / d.avg2brDeluxe) * 100).toFixed(0)}%"></div></div><span class="mini-chart-val">$1,950</span></div>
        <div class="mini-chart-row"><span class="mini-chart-label">Market 2BR DLX</span><div class="mini-chart-bar-wrap"><div class="chart-bar" style="width:100%;background:linear-gradient(90deg,var(--blue),#6a8fad)"></div></div><span class="mini-chart-val">$${d.avg2brDeluxe.toLocaleString()}</span></div>
      </div>
    </div>
    <div class="card">
      <div class="section-title" style="margin-bottom:var(--gap)">Market Indicators</div>
      <div class="table-wrap"><table class="data-table">
        <tbody>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "子市场" : "Sub-market"}</td><td style="text-align:right;font-weight:500">${d.city}</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "市场空置率" : "Market Vacancy"}</td><td style="text-align:right">${d.vacancy}%</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "本项目空置率" : "Subject Vacancy"}</td><td style="text-align:right">3.58%</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "同比租金增长" : "YoY Rent Growth"}</td><td style="text-align:right;color:var(--green);font-weight:500">+${d.yoyRent}%</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "市场资本化率" : "Market Cap Rate"}</td><td style="text-align:right">${d.capRate}%</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "本项目资本化率" : "Subject Cap Rate"}</td><td style="text-align:right;color:var(--green);font-weight:500">6.46% (above mkt)</td></tr>
          <tr><td style="color:var(--muted)">${currentLang === "zh" ? "数据来源" : "Data Sources"}</td><td style="text-align:right">${(d.sources || []).map((s) => `<span class="badge badge-${s.toLowerCase()}" style="margin-left:4px;font-size:10px">${s}</span>`).join("")}</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>`;
}

// ─── COMPARABLES ──────────────────────────────────────────────────────────────

function switchCompTab(tab, btn) {
  currentCompTab = tab;
  document
    .querySelectorAll("[id^=compTab-]")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderComps();
}
function fetchComps() {
  toast("Querying ATTOM & HelloData comps…");
  setTimeout(() => {
    renderComps();
    toast("Comps refreshed", "success");
  }, 1400);
}
function renderComps() {
  const container = document.getElementById("compsContent");
  if (!container) return;
  if (currentCompTab === "sales") {
    container.innerHTML = `<div class="card" style="overflow-x:auto">
      <div class="section-header"><div class="section-title">Sales Comparables <span class="badge badge-attom" style="margin-left:8px">ATTOM</span><span class="badge badge-hellodata" style="margin-left:4px">HelloData</span></div><div style="font-size:12px;color:var(--muted)">Multifamily 16–42 units · Within 1 mile · Last 12 months</div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>${currentLang === "zh" ? "地址" : "Address"}</th><th>${currentLang === "zh" ? "成交日期" : "Sold"}</th><th>${currentLang === "zh" ? "套数" : "Units"}</th><th>${currentLang === "zh" ? "成交价" : "Sale Price"}</th><th>${currentLang === "zh" ? "每套均价" : "Price/Unit"}</th><th>${currentLang === "zh" ? "资本化率" : "Cap Rate"}</th><th>NOI</th><th>${currentLang === "zh" ? "来源" : "Source"}</th></tr></thead>
        <tbody>
          ${(COMPS_DATA.sales || [])
            .map(
              (c) => `<tr>
            <td style="font-size:12px">${c.address}</td><td style="font-size:12px;color:var(--muted)">${c.date}</td>
            <td>${c.units}</td><td style="font-weight:500">$${c.price.toLocaleString()}</td>
            <td>$${c.ppu.toLocaleString()}</td><td>${c.capRate}</td>
            <td>$${c.noi.toLocaleString()}</td>
            <td><span class="badge badge-${c.source.toLowerCase()}" style="font-size:10px">${c.source}</span></td>
          </tr>`,
            )
            .join("")}
          <tr id="compsSubjectSalesRow" style="background:rgba(139,115,85,0.08);font-weight:600;display:none">
            <td id="csSalesAddr">—</td><td>Offer</td><td id="csSalesUnits">—</td><td id="csSalesPrice">—</td><td id="csSalesPPU">—</td><td id="csSalesCap">—</td><td id="csSalesNOI">—</td><td><span class="badge badge-t12" style="font-size:10px">T12</span></td>
          </tr>
        </tbody>
      </table></div>
      <div id="compsSalesAnalysis" style="margin-top:16px;padding:12px 16px;background:rgba(74,124,89,0.06);border-radius:10px;font-size:12px;color:var(--green);display:none">
        <strong>Analysis:</strong> <span id="compsSalesAnalysisText"></span>
      </div>
    </div>`;
  } else if (currentCompTab === "rental") {
    container.innerHTML = `<div class="card" style="overflow-x:auto">
      <div class="section-header"><div class="section-title">Rental Comparables <span class="badge badge-rentcast" style="margin-left:8px">RentCast</span><span class="badge badge-hellodata" style="margin-left:4px">HelloData</span></div><div style="font-size:12px;color:var(--muted)">Active listings & leased units within 0.5 mile</div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>${currentLang === "zh" ? "地址" : "Address"}</th><th>${currentLang === "zh" ? "套数" : "Units"}</th><th>${currentLang === "zh" ? "1居室均价" : "Avg 1BR"}</th><th>${currentLang === "zh" ? "2居室均价" : "Avg 2BR"}</th><th>${currentLang === "zh" ? "空置率" : "Vacancy"}</th><th>${currentLang === "zh" ? "优惠让步" : "Concessions"}</th><th>${currentLang === "zh" ? "来源" : "Source"}</th></tr></thead>
        <tbody>
          ${(COMPS_DATA.rental || [])
            .map(
              (c) => `<tr>
            <td style="font-size:12px">${c.address}</td><td>${c.units}</td>
            <td style="font-weight:500">$${c.avgRent1br.toLocaleString()}</td>
            <td style="font-weight:500">$${c.avgRent2br.toLocaleString()}</td>
            <td>${c.vacancy}</td>
            <td style="font-size:12px">${c.concession}</td>
            <td><span class="badge badge-${c.source.toLowerCase()} " style="font-size:10px">${c.source}</span></td>
          </tr>`,
            )
            .join("")}
          <tr id="compsSubjectRentalRow" style="background:rgba(139,115,85,0.08);font-weight:600;display:none">
            <td id="csRentalAddr">—</td><td id="csRentalUnits">—</td><td id="csRental1br">—</td><td id="csRental2br">—</td><td id="csRentalVac">—</td><td id="csRentalConc">—</td><td><span class="badge badge-rr" style="font-size:10px">RR</span></td>
          </tr>
        </tbody>
      </table></div>
      <div id="compsRentalAnalysis" style="margin-top:16px;padding:12px 16px;background:rgba(74,101,133,0.06);border-radius:10px;font-size:12px;color:var(--blue);display:none">
        <strong>Analysis:</strong> <span id="compsRentalAnalysisText"></span>
      </div>
    </div>`;
  } else {
    container.innerHTML = `<div class="card" style="overflow-x:auto">
      <div class="section-header"><div class="section-title">Expense Comparables <span class="badge badge-hellodata" style="margin-left:8px">HelloData</span></div><div style="font-size:12px;color:var(--muted)">Similar vintage multifamily · North Philadelphia submarket</div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>${currentLang === "zh" ? "物业" : "Property"}</th><th>${currentLang === "zh" ? "建成年份" : "Year Built"}</th><th>${currentLang === "zh" ? "套数" : "Units"}</th><th>${currentLang === "zh" ? "每套运营成本" : "OpEx/Unit"}</th><th>${currentLang === "zh" ? "每套税费" : "Tax/Unit"}</th><th>${currentLang === "zh" ? "每套水电费" : "Utility/Unit"}</th><th>${currentLang === "zh" ? "管理费率" : "Mgmt %"}</th><th>${currentLang === "zh" ? "来源" : "Source"}</th></tr></thead>
        <tbody>
          ${(COMPS_DATA.expense || [])
            .map(
              (
                c,
              ) => `<tr style="${c.isSubject ? "background:rgba(139,115,85,0.08);font-weight:600" : ""}">
            <td style="font-size:12px">${c.address}</td><td>${c.year}</td><td>${c.units}</td>
            <td>$${c.opexPU.toLocaleString()}</td>
            <td style="${c.taxPU > 1400 ? "color:var(--amber)" : ""}">${"$" + c.taxPU.toLocaleString()}</td>
            <td>$${c.utilPU.toLocaleString()}</td>
            <td>${c.mgmtPct}</td>
            <td><span class="badge badge-${c.source === "T12" ? "t12" : "hellodata"}" style="font-size:10px">${c.source}</span></td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table></div>
      <div id="compsExpenseAnalysis" style="margin-top:16px;padding:12px 16px;background:rgba(139,106,46,0.06);border-radius:10px;font-size:12px;color:var(--amber);display:none">
        <strong>Analysis:</strong> <span id="compsExpenseAnalysisText"></span>
      </div>
    </div>`;
  }
}

// ─── PUBLISH / SUBMISSIONS ────────────────────────────────────────────────────
function publishProject() {
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (!proj) return;
  if (proj.published) {
    toast("Already published", "error");
    return;
  }
  const sess = getSession();
  proj.published = true;
  proj.publishedAt = new Date().toISOString();
  proj.status = "review";
  saveProjects(projs);
  const subs = getSubmissions();
  if (!subs.find((s) => s.projectId === proj.id)) {
    subs.push({
      id: "s" + Date.now(),
      projectId: proj.id,
      projectName: proj.name,
      authorId: sess.id,
      submittedAt: new Date().toISOString(),
      status: "submitted",
    });
    saveSubmissions(subs);
  }
  // (UI elements removed)
  renderProjects();
  toast("Analysis published — admin notified", "success");
}

function renderSubmissions() {
  var container = document.getElementById("submissionsList");
  if (!container) return;
  var zh = currentLang === "zh";
  var allProjs = getProjects();
  var users = getUsers();
  var completed = allProjs.filter(function (p) {
    return p && p.status === "completed";
  });
  var sess = getSession();
  var isAdmin = sess && sess.role === "admin";

  // Underwriters see their own projects
  if (!isAdmin) {
    var mine = allProjs.filter(function (p) {
      return p && sess && p.ownerId === sess.id;
    });
    if (!mine.length) {
      container.innerHTML =
        '<div class="card" style="text-align:center;padding:56px"><div style="font-size:14px;color:var(--muted)">' +
        (zh ? "暂无项目" : "No projects yet") +
        "</div></div>";
      return;
    }
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      mine
        .map(function (p) {
          var sc2 =
            p.status === "active"
              ? "var(--green)"
              : p.status === "completed"
                ? "var(--blue)"
                : p.status === "archive"
                  ? "var(--muted)"
                  : "rgba(139,106,46,0.8)";
          var sl =
            p.status === "active"
              ? zh
                ? "活跃"
                : "Active"
              : p.status === "completed"
                ? zh
                  ? "已完成"
                  : "Completed"
                : p.status === "archive"
                  ? zh
                    ? "归档"
                    : "Archive"
                  : zh
                    ? "草稿"
                    : "Draft";
          return (
            '<div class="card sub-proj-card" data-pid="' +
            p.id +
            '" style="cursor:pointer">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            "<div>" +
            '<div style="font-size:14px;font-weight:700;color:var(--header)">' +
            p.name +
            "</div>" +
            '<div style="font-size:12px;color:var(--muted);margin-top:2px">' +
            (p.address || "") +
            "</div>" +
            "</div>" +
            '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:' +
            sc2 +
            "18;color:" +
            sc2 +
            '">' +
            sl +
            "</span>" +
            "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>";
    // Wire up clicks via delegation
    container.querySelectorAll(".sub-proj-card").forEach(function (el) {
      el.onclick = function () {
        openProjectAnalysis(this.dataset.pid);
      };
    });
    return;
  }

  // Admin view — show completed projects
  if (!completed.length) {
    container.innerHTML =
      '<div class="card" style="text-align:center;padding:64px 40px">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.2" style="width:52px;height:52px;margin:0 auto 16px;display:block"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' +
      '<div style="font-size:16px;font-weight:700;color:var(--header);margin-bottom:8px">' +
      (zh ? "暂无已完成项目" : "No Completed Projects") +
      "</div>" +
      '<div style="font-size:13px;color:var(--muted);max-width:360px;margin:0 auto">' +
      (zh
        ? '承销人将项目状态更改为"已完成"后，项目将显示在此处。'
        : 'When underwriters set a project to "Completed", it appears here.') +
      "</div>" +
      "</div>";
    return;
  }

  container.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:14px">' +
    completed
      .map(function (p) {
        var owner = users.find(function (u) {
          return u && u.id === p.ownerId;
        });
        var ownerName = owner ? owner.firstName + " " + owner.lastName : "—";
        var cr = p.id === "p1" ? 6.46 : p.capRate || null;
        var noi = p.id === "p1" ? 331934 : p.noi || null;
        var dscr = p.id === "p1" ? 1.51 : p.dscr || null;
        var irr = p.id === "p1" ? 17.5 : p.irr || null;
        function kpi2(label, val, color) {
          if (!val && val !== 0) return "";
          return (
            '<div style="text-align:center;padding:10px 14px;background:rgba(255,255,255,0.7);border-radius:8px;border:1px solid rgba(0,0,0,0.06)">' +
            '<div style="font-size:15px;font-weight:800;color:' +
            (color || "var(--header)") +
            '">' +
            val +
            "</div>" +
            '<div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">' +
            label +
            "</div>" +
            "</div>"
          );
        }
        return (
          '<div class="card completed-proj-card" data-pid="' +
          p.id +
          '" style="cursor:pointer;border-left:4px solid var(--blue)">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">' +
          "<div>" +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">' +
          '<span style="font-size:12px;font-weight:700;padding:3px 9px;border-radius:6px;background:rgba(74,101,133,0.12);color:var(--blue)">&#10003; ' +
          (zh ? "已完成" : "Completed") +
          "</span>" +
          '<span style="font-size:11px;color:var(--muted)">' +
          (p.lastUpdated || "") +
          "</span>" +
          "</div>" +
          '<div style="font-size:17px;font-weight:800;color:var(--header)">' +
          p.name +
          "</div>" +
          '<div style="font-size:12px;color:var(--muted);margin-top:3px">' +
          (p.address || "") +
          "&nbsp;&middot;&nbsp;" +
          (zh ? "负责人 " : "Owner ") +
          "<strong>" +
          ownerName +
          "</strong></div>" +
          "</div>" +
          '<button class="btn btn-primary btn-sm view-analysis-btn" data-pid="' +
          p.id +
          '">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
          (zh ? "查看详情" : "View Analysis") +
          "</button>" +
          "</div>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          kpi2(
            zh ? "报价" : "Offer",
            p.offerPrice ? "$" + (p.offerPrice / 1e6).toFixed(1) + "M" : "—",
          ) +
          kpi2(zh ? "套数" : "Units", p.units || null) +
          kpi2("Cap Rate", cr ? cr + "%" : null, "var(--green)") +
          kpi2("NOI", noi ? "$" + (noi / 1000).toFixed(0) + "K" : null) +
          kpi2("DSCR", dscr ? dscr + "&times;" : null, "var(--blue)") +
          kpi2("IRR", irr ? irr + "%" : null, "var(--green)") +
          "</div>" +
          "</div>"
        );
      })
      .join("") +
    "</div>";

  // Wire up clicks
  container
    .querySelectorAll(".completed-proj-card,.view-analysis-btn")
    .forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        openProjectAnalysis(
          this.dataset.pid || (this.closest("[data-pid]") || {}).dataset.pid,
        );
      };
    });
}

function reviewSubmission(sid) {
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === sid);
  if (!s) return;
  currentProjectId = s.projectId;
  openProjectAnalysis(currentProjectId);
  buildPFTable();
  buildProjectDropdowns();
}
var _approveTargetId = null;
function openApproveModal(sid) {
  _approveTargetId = sid;
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === sid);
  if (!s) return;
  const zh = currentLang === "zh";
  document.getElementById("approveModalTitle").textContent =
    (zh ? "批准提交：" : "Approve: ") + s.projectName;
  document.getElementById("approveNoteInput").value = "";
  document.getElementById("approveModal").style.display = "flex";
  setTimeout(() => document.getElementById("approveNoteInput").focus(), 50);
}
function confirmApprove() {
  if (!_approveTargetId) return;
  const zh = currentLang === "zh";
  const note = document.getElementById("approveNoteInput").value.trim();
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === _approveTargetId);
  if (!s) return;
  s.status = "approved";
  s.adminNote =
    note ||
    (zh ? "已批准，请推进后续步骤。" : "Approved. Proceed with next steps.");
  saveSubmissions(subs);
  const projs = getProjects();
  const p = projs.find((x) => x.id === s.projectId);
  if (p) {
    p.status = "active";
    saveProjects(projs);
  }
  document.getElementById("approveModal").style.display = "none";
  _approveTargetId = null;
  renderSubmissions();
  renderProjects();
  toast(zh ? "已批准提交" : "Submission approved", "success");
}
// ─── SUBMIT / RESUBMIT MODAL ─────────────────────────────────────────────────
var _submitProjectId = null;
var _resubmitSubId = null;

function openSubmitModal(pid, existingSubId) {
  _submitProjectId = pid;
  _resubmitSubId = existingSubId || null;
  const projs = getProjects();
  const p = projs.find((x) => x.id === pid);
  if (!p) return;
  const zh = currentLang === "zh";
  const isResubmit = !!existingSubId;
  const subs = getSubmissions();
  const existingSub = existingSubId
    ? subs.find((s) => s.id === existingSubId)
    : null;

  document.getElementById("submitModalTitle").textContent = isResubmit
    ? zh
      ? "修改并重新提交"
      : "Edit & Resubmit"
    : zh
      ? "提交审核"
      : "Submit for Review";
  document.getElementById("submitProjName").textContent = p.name;

  // Editable fields
  document.getElementById("sub_offerPrice").value = p.offerPrice || "";
  document.getElementById("sub_units").value = p.units || "";
  document.getElementById("sub_capRate").value = p.capRate || "";
  document.getElementById("sub_noi").value = p.noi || "";
  document.getElementById("sub_irr").value = p.irr || "";
  document.getElementById("sub_dscr").value = p.dscr || "";
  document.getElementById("sub_notes").value = existingSub
    ? existingSub.notes
    : "";

  // Admin feedback if resubmit
  const fb = document.getElementById("submitAdminFeedback");
  if (isResubmit && existingSub && existingSub.adminNote) {
    fb.style.display = "block";
    fb.querySelector(".admin-fb-text").textContent = existingSub.adminNote;
  } else {
    fb.style.display = "none";
  }

  document.getElementById("submitModal").style.display = "flex";
}

function confirmSubmit() {
  if (!_submitProjectId) return;
  const zh = currentLang === "zh";
  const projs = getProjects();
  const p = projs.find((x) => x.id === _submitProjectId);
  if (!p) return;
  const sess = getSession();
  if (!sess) return;

  // Save edits back to project
  const offerPrice =
    parseFloat(document.getElementById("sub_offerPrice").value) || p.offerPrice;
  const units = parseInt(document.getElementById("sub_units").value) || p.units;
  const capRate =
    parseFloat(document.getElementById("sub_capRate").value) || p.capRate;
  const noi = parseFloat(document.getElementById("sub_noi").value) || p.noi;
  const irr = parseFloat(document.getElementById("sub_irr").value) || p.irr;
  const dscr = parseFloat(document.getElementById("sub_dscr").value) || p.dscr;
  const notes = document.getElementById("sub_notes").value.trim();

  p.offerPrice = offerPrice;
  p.units = units;
  p.capRate = capRate;
  p.noi = noi;
  p.irr = irr;
  p.dscr = dscr;
  p.status = "review";
  p.published = true;
  p.lastUpdated = new Date().toISOString().split("T")[0];
  saveProjects(projs);

  // Upsert submission
  const subs = getSubmissions();
  if (_resubmitSubId) {
    const s = subs.find((x) => x.id === _resubmitSubId);
    if (s) {
      s.status = "submitted";
      s.notes = notes;
      s.submittedAt = new Date().toISOString();
      s.adminNote = "";
    }
  } else {
    subs.push({
      id: "s" + Date.now(),
      projectId: p.id,
      projectName: p.name,
      authorId: sess.id,
      submittedAt: new Date().toISOString(),
      status: "submitted",
      notes: notes,
      adminNote: "",
    });
  }
  saveSubmissions(subs);

  document.getElementById("submitModal").style.display = "none";
  _submitProjectId = null;
  _resubmitSubId = null;
  renderProjects();
  renderSubmissions();
  toast(zh ? "项目已提交审核" : "Project submitted for review", "success");
}

// ─── UNDERWRITER DATA EDIT (inline in project card) ──────────────────────────

function approveSubmission(sid) {
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === sid);
  if (!s) return;
  s.status = "approved";
  if (!s.adminNote) s.adminNote = "Approved. Proceed with next steps.";
  saveSubmissions(subs);
  const projs = getProjects();
  const p = projs.find((x) => x.id === s.projectId);
  if (p) {
    p.status = "active";
    saveProjects(projs);
  }
  renderSubmissions();
  renderProjects();
  toast(currentLang === "zh" ? "已批准提交" : "Submission approved", "success");
}
var _rejectTargetId = null;
function openRejectModal(sid) {
  _rejectTargetId = sid;
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === sid);
  if (!s) return;
  document.getElementById("rejectModalTitle").textContent =
    "Reject: " + s.projectName;
  document.getElementById("rejectNoteInput").value = "";
  document.getElementById("rejectModal").style.display = "flex";
  setTimeout(() => document.getElementById("rejectNoteInput").focus(), 50);
}
function confirmReject() {
  if (!_rejectTargetId) return;
  const note = document.getElementById("rejectNoteInput").value.trim();
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === _rejectTargetId);
  if (!s) return;
  s.status = "rejected";
  s.adminNote = note;
  saveSubmissions(subs);
  document.getElementById("rejectModal").style.display = "none";
  _rejectTargetId = null;
  renderSubmissions();
  toast(currentLang === "zh" ? "已拒绝提交" : "Submission rejected");
}
function rejectSubmission(sid) {
  const subs = getSubmissions();
  const s = subs.find((x) => x.id === sid);
  if (!s) return;
  s.status = "rejected";
  saveSubmissions(subs);
  renderSubmissions();
  toast(currentLang === "zh" ? "已拒绝提交" : "Submission rejected");
}

// ─── USERS ────────────────────────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById("usersBody");
  if (!tbody) return;
  const sess = getSession();
  const isAdmin = sess && sess.role === "admin";
  const users = getUsers();
  tbody.innerHTML = users
    .map((u) => {
      const isAdmin_badge = u.role === "admin";
      const roleCell = isAdmin
        ? `<div class="role-select-wrap" style="position:relative;display:inline-flex;align-items:center;gap:4px">
           <select onchange="changeUserRole('${u.id}',this.value)" onclick="event.stopPropagation()"
             style="appearance:none;-webkit-appearance:none;border:1px solid transparent;border-radius:20px;padding:3px 22px 3px 9px;font-size:11px;font-weight:600;cursor:pointer;outline:none;font-family:inherit;transition:all 0.15s;
               background:${isAdmin_badge ? "rgba(139,106,46,0.1)" : "rgba(74,101,133,0.1)"};
               color:${isAdmin_badge ? "var(--amber)" : "var(--blue)"}">
             <option value="admin"    ${u.role === "admin" ? "selected" : ""}>admin</option>
             <option value="underwriter" ${u.role === "underwriter" ? "selected" : ""}>underwriter</option>
           </select>
           <svg style="position:absolute;right:6px;pointer-events:none;opacity:0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
         </div>`
        : `<span class="badge ${isAdmin_badge ? "badge-attom" : "badge-rentcast"}">${u.role}</span>`;
      return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:white">${u.firstName[0]}${u.lastName[0]}</div><strong>${u.firstName} ${u.lastName}</strong></div></td>
      <td style="color:var(--muted)">${u.email}</td>
      <td>${roleCell}</td>
      <td><span class="badge ${u.status === "active" ? "badge-status-complete" : "badge-status-draft"}">${u.status}</span></td>
      <td style="font-size:12px;color:var(--muted)">${getProjects().filter((p) => p.ownerId === u.id).length} projects</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-ghost" onclick="toggleUserStatus('${u.id}')">${u.status === "active" ? "Disable" : "Enable"}</button>
        <button class="btn btn-sm btn-ghost" onclick="removeUser('${u.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
      </div></td>
    </tr>`;
    })
    .join("");
}

function changeUserRole(uid, newRole) {
  const users = getUsers();
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  const oldRole = u.role;
  if (oldRole === newRole) return;
  u.role = newRole;
  saveUsers(users);
  // If the changed user is the current session user, update session too
  const sess = getSession();
  if (sess && sess.id === uid) {
    sess.role = newRole;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    // Update admin nav visibility and redirect if demoted from admin
    var adminNav = document.getElementById("adminNav");
    if (newRole === "admin") {
      adminNav.style.display = "";
    } else {
      adminNav.style.display = "none";
      // If currently on an admin page, redirect to projects
      var activePage = document.querySelector(".page.active");
      if (
        activePage &&
        (activePage.id === "page-users" || activePage.id === "page-settings")
      ) {
        navTo("projects", document.getElementById("nav-projects"));
      }
    }
  }
  renderUsersTable();
  const zh = currentLang === "zh";
  toast(
    `${u.firstName} ${u.lastName} → ${newRole === "admin" ? (zh ? "管理员" : "Administrator") : zh ? "承销师" : "Underwriter"}`,
    "success",
  );
}
function toggleUserStatus(uid) {
  const users = getUsers();
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  u.status = u.status === "active" ? "disabled" : "active";
  saveUsers(users);
  renderUsersTable();
  toast(`User ${u.status}`, "success");
}
function removeUser(uid) {
  if (!confirm("Remove this user?")) return;
  saveUsers(getUsers().filter((u) => u.id !== uid));
  renderUsersTable();
  toast("User removed");
}
function openAddUserModal() {
  openModal(
    "Add User",
    `
    <div class="bento bento-2" style="gap:12px"><div class="form-group"><label class="form-label">First Name</label><input class="form-input" id="auFirst" placeholder="First"></div><div class="form-group"><label class="form-label">Last Name</label><input class="form-input" id="auLast" placeholder="Last"></div></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="auEmail" placeholder="email@company.com"></div>
    <div class="form-group"><label class="form-label">Temporary Password</label><input class="form-input" type="password" id="auPassword" placeholder="Min 8 characters"></div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-input form-select" id="auRole"><option value="underwriter">Underwriter</option><option value="admin">Admin</option></select></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="addUser()">Add User</button></div>
  `,
  );
}
function addUser() {
  const first = document.getElementById("auFirst").value.trim();
  const last = document.getElementById("auLast").value.trim();
  const email = document.getElementById("auEmail").value.trim();
  const pass = document.getElementById("auPassword").value;
  const role = document.getElementById("auRole").value;
  if (!first || !last || !email || !pass) {
    toast("All fields required", "error");
    return;
  }
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    toast("Email already exists", "error");
    return;
  }
  users.push({
    id: "u" + Date.now(),
    firstName: first,
    lastName: last,
    email,
    password: pass,
    role,
    status: "active",
  });
  saveUsers(users);
  closeModal();
  renderUsersTable();
  toast("User added", "success");
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
// ─── AI Scoring Engine (Rule-based) ──────────────────────────────────
// Calculates a score (0-85) for underwriting completeness and correctness.
// Max completeness: 50, Max correctness: 35, Total max: 85.
function calculateAIScore(pid) {
  pid = pid || currentProjectId;
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (!proj) return null;

  var deductions = [];
  var completeness = 0,
    correctness = 0;
  var cMax = 50,
    corrMax = 35;

  // ─── COMPLETENESS (max 50) ──────────────────────────
  // Summary basic fields (6 points)
  var summaryFields = ["yearBuilt", "offerPrice", "units", "occupancy"];
  var summaryFilled = 0;
  summaryFields.forEach(function (f) {
    if (
      proj[f] !== null &&
      proj[f] !== undefined &&
      proj[f] !== "" &&
      proj[f] !== 0
    )
      summaryFilled++;
  });
  var summaryPts = Math.round((summaryFilled / summaryFields.length) * 6);
  completeness += summaryPts;
  if (summaryPts < 6)
    deductions.push({
      module: "Summary",
      reason:
        "Missing basic fields (Year Built / Offer Price / Units / Occupancy)",
      points: -(6 - summaryPts),
    });

  // Rent Roll uploaded (7 points)
  var hasRR = (proj.files || []).some(function (f) {
    return f.parsedAs === "Rent Roll" || f.type === "Rent Roll";
  });
  if (hasRR) completeness += 7;
  else {
    deductions.push({
      module: "Rent Roll",
      reason: "Rent Roll file not uploaded",
      points: -7,
    });
  }

  // T12 uploaded (7 points)
  var hasT12 = (proj.files || []).some(function (f) {
    return (
      f.parsedAs === "T12" || f.type === "T12" || f.parsedAs === "Selling Model"
    );
  });
  if (hasT12) completeness += 7;
  else {
    deductions.push({
      module: "T12",
      reason: "T12 file not uploaded",
      points: -7,
    });
  }

  // HD uploaded (4 points)
  var hasHD = !!(typeof getHDData === "function" && getHDData(pid));
  if (hasHD) completeness += 4;
  else {
    deductions.push({
      module: "HelloData",
      reason: "HD file not uploaded",
      points: -4,
    });
  }

  // Revenue filled (6 points) - check if PF_DATA.revenue has values
  var revFilled = 0;
  try {
    (PF_DATA.revenue || []).forEach(function (r) {
      if (!r.isSectionHdr && !r.isTotal && r.vals && r.vals[0]) revFilled++;
    });
  } catch (e) {}
  var revPts = revFilled >= 10 ? 6 : Math.round((revFilled / 10) * 6);
  completeness += revPts;
  if (revPts < 6)
    deductions.push({
      module: "Revenue",
      reason: "Some revenue line items are empty",
      points: -(6 - revPts),
    });

  // Expenses filled (6 points)
  var expFilled = 0;
  try {
    (PF_DATA.expenses || []).forEach(function (r) {
      if (!r.isSectionHdr && !r.isTotal && r.vals && r.vals[0]) expFilled++;
    });
  } catch (e) {}
  var expPts = expFilled >= 25 ? 6 : Math.round((expFilled / 25) * 6);
  completeness += expPts;
  if (expPts < 6)
    deductions.push({
      module: "Expenses",
      reason: "Some expense line items are empty",
      points: -(6 - expPts),
    });

  // Debt filled (7 points) - check both Current and Refinance
  var debtData = null;
  try {
    debtData = JSON.parse(localStorage.getItem("debt_data_" + pid) || "null");
  } catch (e) {}
  var hasDebtCurrent =
    debtData && debtData.current && debtData.current.loanAmount;
  var hasDebtRefi = debtData && debtData.refi && debtData.refi.loanAmount;
  // Even without uploaded file, demo defaults exist so treat as half-filled
  var debtPts = 0;
  if (hasDebtCurrent) debtPts += 4;
  else debtPts += 2; // demo defaults give partial credit
  if (hasDebtRefi) debtPts += 3;
  else debtPts += 1;
  completeness += debtPts;
  if (debtPts < 7)
    deductions.push({
      module: "Debt",
      reason: "Debt data not explicitly parsed from file",
      points: -(7 - debtPts),
    });

  // Closing Costs / Purchase Price percentages (7 points)
  var closingPts = 5; // assume partial fill, could check specific localStorage keys
  completeness += closingPts;
  if (closingPts < 7)
    deductions.push({
      module: "Closing Costs",
      reason: "Some percentage fields not filled",
      points: -(7 - closingPts),
    });

  // ─── CORRECTNESS (max 35) ──────────────────────────
  var nCols = 7;
  var asmt =
    typeof getProjectAssumptions === "function"
      ? getProjectAssumptions()
      : { rentGrowth: 3, opexGrowth: 3, taxGrowth: 3 };

  // NOI > 0 at Stab (5 points)
  var noi = null;
  try {
    var revTotal = (PF_DATA.revenue || []).find(function (r) {
      return r.isTotal;
    });
    var expTotal = (PF_DATA.expenses || []).find(function (r) {
      return r.isTotal;
    });
    if (revTotal && expTotal && revTotal.vals && expTotal.vals) {
      noi = (revTotal.vals[2] || 0) - (expTotal.vals[2] || 0);
    }
  } catch (e) {}
  if (noi !== null && noi > 0) {
    correctness += 5;
  } else {
    deductions.push({
      module: "NOI",
      reason: "NOI is not positive at Stabilized year",
      points: -5,
    });
  }

  // DSCR at Stab year (6 points)
  var ds =
    (debtData && debtData.current && debtData.current.annualMortgagePayments) ||
    0;
  var dscr = noi && ds > 0 ? noi / ds : 0;
  if (dscr >= 1.25) correctness += 6;
  else if (dscr >= 1.0) {
    correctness += 3;
    deductions.push({
      module: "DSCR",
      reason: "DSCR between 1.00-1.25 (borderline)",
      points: -3,
    });
  } else {
    deductions.push({
      module: "DSCR",
      reason: "DSCR below 1.00 (unable to cover debt)",
      points: -6,
    });
  }

  // Cash Flow after DS > 0 (5 points)
  var cfAfterDS = noi - ds;
  if (cfAfterDS > 0) correctness += 5;
  else {
    deductions.push({
      module: "Cash Flow",
      reason: "Cash Flow after Debt Service is negative",
      points: -5,
    });
  }

  // Occupancy >= 90% (5 points)
  var occ = proj.occupancy || 0;
  if (occ >= 90) correctness += 5;
  else if (occ >= 80) {
    correctness += 2;
    deductions.push({
      module: "Occupancy",
      reason: "Occupancy below 90%",
      points: -3,
    });
  } else {
    deductions.push({
      module: "Occupancy",
      reason: "Occupancy significantly low (<80%)",
      points: -5,
    });
  }

  // Cap Rate 3%-10% (5 points)
  var capRate = proj.offerPrice && noi ? (noi / proj.offerPrice) * 100 : 0;
  if (capRate >= 3 && capRate <= 10) correctness += 5;
  else if (capRate > 0) {
    correctness += 2;
    deductions.push({
      module: "Cap Rate",
      reason: "Cap Rate outside typical 3%-10% range",
      points: -3,
    });
  }

  // Expense Ratio 30%-60% (5 points)
  var expRatio =
    noi !== null && revTotal && revTotal.vals && revTotal.vals[2]
      ? (((revTotal.vals[2] || 0) - noi) / (revTotal.vals[2] || 1)) * 100
      : 0;
  if (expRatio >= 30 && expRatio <= 60) correctness += 5;
  else if (expRatio > 0) {
    correctness += 2;
    deductions.push({
      module: "Expense Ratio",
      reason: "Expense ratio outside typical 30%-60% range",
      points: -3,
    });
  }

  // Growth rates 0-10% (4 points)
  var rg = asmt.rentGrowth || 0,
    og = asmt.opexGrowth || 0,
    tg = asmt.taxGrowth || 0;
  if (rg >= 0 && rg <= 10 && og >= 0 && og <= 10 && tg >= 0 && tg <= 10)
    correctness += 4;
  else {
    deductions.push({
      module: "Assumptions",
      reason: "Growth rate out of reasonable range (0-10%)",
      points: -4,
    });
  }

  // Cap at maximum
  completeness = Math.min(completeness, cMax);
  correctness = Math.min(correctness, corrMax);
  var total = completeness + correctness;

  // Grade
  var grade, color;
  if (total >= 75) {
    grade = "Excellent";
    color = "#2E7D32";
  } else if (total >= 60) {
    grade = "Good";
    color = "#4A7C59";
  } else if (total >= 45) {
    grade = "Fair";
    color = "#E65100";
  } else {
    grade = "Needs Attention";
    color = "#c0392b";
  }

  var result = {
    score: total,
    maxScore: 85,
    grade: grade,
    color: color,
    completeness: { score: completeness, max: cMax },
    correctness: { score: correctness, max: corrMax },
    deductions: deductions,
    scoredAt: new Date().toISOString(),
  };

  // Save to localStorage
  try {
    localStorage.setItem("ai_score_" + pid, JSON.stringify(result));
  } catch (e) {}
  return result;
}

function getAIScore(pid) {
  pid = pid || currentProjectId;
  try {
    var cached = JSON.parse(localStorage.getItem("ai_score_" + pid) || "null");
    if (cached) return cached;
  } catch (e) {}
  return calculateAIScore(pid);
}

function renderAIScoreBadge(pid, size) {
  var sc = getAIScore(pid);
  if (!sc) return "";
  size = size || "sm";
  // Ring dimensions per size
  var dims = {
    sm: {
      ring: 52,
      stroke: 4,
      fontScore: 16,
      fontLabel: 8,
      fontGrade: 0,
      showGrade: false,
      gap: 8,
    },
    md: {
      ring: 72,
      stroke: 5,
      fontScore: 22,
      fontLabel: 9,
      fontGrade: 10,
      showGrade: true,
      gap: 10,
    },
    lg: {
      ring: 96,
      stroke: 6,
      fontScore: 30,
      fontLabel: 10,
      fontGrade: 11,
      showGrade: true,
      gap: 12,
    },
  };
  var d = dims[size] || dims.sm;
  var r = (d.ring - d.stroke) / 2;
  var cx = d.ring / 2;
  var circumference = 2 * Math.PI * r;
  // Progress based on /100 scale
  var progress = Math.min(sc.score / 100, 1);
  var dashOffset = circumference * (1 - progress);
  var trackColor = "rgba(0,0,0,0.08)";

  var ringSvg =
    '<svg width="' +
    d.ring +
    '" height="' +
    d.ring +
    '" viewBox="0 0 ' +
    d.ring +
    " " +
    d.ring +
    '" style="flex-shrink:0">' +
    '<circle cx="' +
    cx +
    '" cy="' +
    cx +
    '" r="' +
    r +
    '" stroke="' +
    trackColor +
    '" stroke-width="' +
    d.stroke +
    '" fill="none"/>' +
    '<circle cx="' +
    cx +
    '" cy="' +
    cx +
    '" r="' +
    r +
    '" stroke="' +
    sc.color +
    '" stroke-width="' +
    d.stroke +
    '" fill="none"' +
    ' stroke-linecap="round" stroke-dasharray="' +
    circumference.toFixed(2) +
    '" stroke-dashoffset="' +
    dashOffset.toFixed(2) +
    '"' +
    ' transform="rotate(-90 ' +
    cx +
    " " +
    cx +
    ')" style="transition:stroke-dashoffset .6s ease"/>' +
    '<text x="' +
    cx +
    '" y="' +
    (cx + d.fontScore * 0.15) +
    '" text-anchor="middle" dominant-baseline="middle"' +
    ' font-size="' +
    d.fontScore +
    '" font-weight="900" fill="' +
    sc.color +
    '" style="font-family:inherit">' +
    sc.score +
    "</text>" +
    '<text x="' +
    cx +
    '" y="' +
    (cx + d.fontScore * 0.75) +
    '" text-anchor="middle" dominant-baseline="middle"' +
    ' font-size="' +
    d.fontLabel +
    '" font-weight="600" fill="' +
    sc.color +
    '" opacity="0.65" style="font-family:inherit;letter-spacing:.04em">/100</text>' +
    "</svg>";

  var gradeHtml = "";
  if (d.showGrade) {
    gradeHtml =
      '<div style="display:flex;flex-direction:column;gap:2px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">AI Score</div>' +
      '<div style="font-size:' +
      d.fontGrade +
      "px;font-weight:700;color:" +
      sc.color +
      ';letter-spacing:.02em">' +
      sc.grade +
      "</div>" +
      "</div>";
  }

  return (
    "<div onclick=\"event.stopPropagation();openAIScoreModal('" +
    pid +
    "')\"" +
    ' style="display:inline-flex;align-items:center;gap:' +
    d.gap +
    'px;cursor:pointer;padding:2px;border-radius:10px;transition:all .15s"' +
    " onmouseenter=\"this.style.background='rgba(0,0,0,0.03)'\" onmouseleave=\"this.style.background=''\"" +
    ' title="AI Score · Click for details">' +
    ringSvg +
    gradeHtml +
    "</div>"
  );
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  return r + "," + g + "," + b;
}

function openAIScoreModal(pid) {
  var sc = getAIScore(pid);
  if (!sc) return;
  var body =
    '<div style="padding:4px 0">' +
    '<div style="text-align:center;padding:16px 0;border-bottom:1px solid var(--border);margin-bottom:16px">' +
    '<div style="font-size:48px;font-weight:900;color:' +
    sc.color +
    ';line-height:1">' +
    sc.score +
    '<span style="font-size:20px;color:var(--muted);font-weight:400"> / 100</span></div>' +
    '<div style="font-size:13px;font-weight:600;color:' +
    sc.color +
    ';margin-top:6px">' +
    sc.grade +
    "</div>" +
    "</div>" +
    '<div style="display:flex;gap:12px;margin-bottom:16px">' +
    '<div style="flex:1;padding:12px;border-radius:8px;background:rgba(74,124,89,0.06);border:1px solid rgba(74,124,89,0.15)">' +
    '<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Completeness</div>' +
    '<div style="font-size:18px;font-weight:800;color:var(--green)">' +
    sc.completeness.score +
    '<span style="font-size:12px;color:var(--muted);font-weight:400"> / ' +
    sc.completeness.max +
    "</span></div>" +
    "</div>" +
    '<div style="flex:1;padding:12px;border-radius:8px;background:rgba(74,101,133,0.06);border:1px solid rgba(74,101,133,0.15)">' +
    '<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Correctness</div>' +
    '<div style="font-size:18px;font-weight:800;color:var(--blue)">' +
    sc.correctness.score +
    '<span style="font-size:12px;color:var(--muted);font-weight:400"> / ' +
    sc.correctness.max +
    "</span></div>" +
    "</div>" +
    "</div>";
  if (sc.deductions && sc.deductions.length) {
    body +=
      '<div style="font-size:12px;font-weight:700;color:var(--header);margin-bottom:8px">Deductions:</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">';
    sc.deductions.forEach(function (d) {
      body +=
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:6px;background:rgba(192,57,43,0.05);border-left:3px solid rgba(192,57,43,0.35)">' +
        '<div><span style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.04em">' +
        d.module.toUpperCase() +
        "</span>" +
        '<div style="font-size:12px;color:var(--body);margin-top:2px">' +
        d.reason +
        "</div></div>" +
        '<span style="font-size:13px;font-weight:700;color:#c0392b;white-space:nowrap;margin-left:12px">' +
        d.points +
        "</span>" +
        "</div>";
    });
    body += "</div>";
  } else {
    body +=
      '<div style="text-align:center;padding:12px;color:var(--muted);font-size:12px;font-style:italic">All checks passed</div>';
  }
  body +=
    '<div style="margin-top:16px;font-size:10px;color:var(--muted);text-align:right">Scored: ' +
    new Date(sc.scoredAt).toLocaleString() +
    "</div>" +
    "</div>";
  openModal("AI Underwriting Score", body);
}

function savePF() {
  // Save pfOverrides to project
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (proj) {
    proj.pfOverrides = pfOverrides;
    saveProjects(projs);
  }
  renderOverrideLog(currentProjectId);
  // Recalculate AI score on save
  calculateAIScore(currentProjectId);
  // Refresh header badge
  var hdr = document.getElementById("detailAIScoreBadge");
  if (hdr) hdr.innerHTML = renderAIScoreBadge(currentProjectId, "md");
  toast(currentLang === "zh" ? "分析已保存" : "Pro forma saved", "success");
}
function exportPDF() {
  toast("Generating PDF export…");
  setTimeout(() => toast("PDF ready — check Downloads", "success"), 1600);
}

function toast(msg, type = "") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  const icon =
    type === "success"
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === "error"
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  t.innerHTML = icon + msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => t.remove(), 300);
  }, 3200);
}
function openModal(title, body) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = body;
  document.getElementById("modalOverlay").classList.add("open");
}
function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}
document.getElementById("modalOverlay").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

function sweepI18nAttrs() {
  document.querySelectorAll("[data-en]").forEach(function (el) {
    var val =
      currentLang === "zh"
        ? el.getAttribute("data-zh")
        : el.getAttribute("data-en");
    if (!val) return;
    var replaced = false;
    el.childNodes.forEach(function (node) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        node.textContent = val;
        replaced = true;
      }
    });
    if (!replaced && !el.children.length) el.textContent = val;
  });
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

function t(key) {
  return (I18N[currentLang] || I18N.en)[key] || I18N.en[key] || key;
}

function toggleLang() {
  currentLang = currentLang === "en" ? "zh" : "en";
  applyLang();
}

function applyLang() {
  const L = currentLang;
  document.documentElement.lang = L === "zh" ? "zh-CN" : "en";
  // Toggle button label
  document.getElementById("langToggleLabel").textContent = t("lang_label");
  // Nav labels
  const navLabels = document.querySelectorAll(".nav-label");
  const labelKeys = ["workspace", "analysis", "market", "admin"];
  navLabels.forEach((el, i) => {
    if (labelKeys[i]) el.textContent = t(labelKeys[i]);
  });
  // Nav items (by onclick attribute matching)
  const navMap = {
    dashboard: "nav_dashboard",
    projects: "nav_projects",
    proforma: "nav_proforma",
    rentroll: "nav_rentroll",
    debt: "nav_debt",
    market: "nav_market",
    comps: "nav_comps",
    submissions: "nav_submissions",
    users: "nav_users",
    settings: "nav_settings",
  };
  document.querySelectorAll(".nav-item").forEach((el) => {
    const oc = el.getAttribute("onclick") || "";
    for (const [k, v] of Object.entries(navMap)) {
      if (oc.includes("'" + k + "'")) {
        // Replace text node (last child after svg)
        const nodes = Array.from(el.childNodes);
        const txt = nodes.find((n) => n.nodeType === 3 && n.textContent.trim());
        if (txt) txt.textContent = t(v);
        break;
      }
    }
  });
  // User role
  const roleEl = document.getElementById("sidebarUserRole");
  if (roleEl) {
    const sess = getSession();
    if (sess)
      roleEl.textContent =
        sess.role === "admin" ? t("role_administrator") : t("role_underwriter");
  }
  // Logout tooltip
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.title = t("signout");
  // Logo sub
  document.querySelectorAll(".logo-sub").forEach((el) => {
    el.textContent = L === "zh" ? "投资分析平台" : "Underwriting Platform";
  });
  // Page titles & subtitles — only re-render the visible page header
  applyPageTitles();
  // Auth page
  applyAuthLang();
  // Re-render dynamic content
  renderProjects();
  renderUsersTable();
  renderSubmissions();
  buildPFTable();
  renderRentRoll();
}

function applyPageTitles() {
  const map = {
    dashboard: { title: "dashboard_title", sub: "dashboard_sub" },
    projects: { title: "projects_title", sub: "projects_sub" },
    proforma: { title: "proforma_title", sub: "proforma_sub" },
    rentroll: { title: "rentroll_title", sub: "rentroll_sub" },
    debt: { title: "debt_title", sub: "debt_sub" },
    market: { title: "market_title", sub: "market_sub" },
    comps: { title: "comps_title", sub: "comps_sub" },
    submissions: { title: "submissions_title", sub: "submissions_sub" },
    users: { title: "users_title", sub: "users_sub" },
    settings: { title: "settings_title", sub: "settings_sub" },
  };
  document.querySelectorAll(".page").forEach((page) => {
    const id = page.id.replace("page-", "");
    const keys = map[id];
    if (!keys) return;
    const h = page.querySelector(".page-title");
    const s = page.querySelector(".page-subtitle");
    if (h) h.textContent = t(keys.title);
    if (s) {
      if (id === "projects") {
        const sess = getSession();
        s.textContent =
          sess && sess.role === "admin"
            ? t("projects_sub_admin")
            : t("projects_sub");
      } else s.textContent = t(keys.sub);
    }
  });
  // New project btn
  document.querySelectorAll(".btn-primary").forEach((btn) => {
    if (
      btn.textContent.trim() === "New Project" ||
      btn.textContent.trim() === "新建项目"
    )
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${t("new_project")}`;
  });
}

function applyAuthLang() {
  const tabs = document.querySelectorAll(".auth-tab-btn");
  if (tabs[0]) tabs[0].textContent = t("sign_in");
  if (tabs[1]) tabs[1].textContent = t("register");
  const labels = document.querySelectorAll(".form-label");
  labels.forEach((el) => {
    const txt = el.textContent.trim().toLowerCase();
    if (txt === "email address" || txt === "电子邮箱")
      el.textContent = t("email");
    if (txt === "password" || txt === "密码") el.textContent = t("password");
    if (txt === "first name" || txt === "名") el.textContent = t("first_name");
    if (txt === "last name" || txt === "姓") el.textContent = t("last_name");
  });
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  // Dashboard page removed — guard all DOM accesses
  const dashTitleEl = document.getElementById("dashTitle");
  if (!dashTitleEl) return; // page no longer in DOM
  const user = getSession();
  if (!user) return;
  const allProjects = getProjects();
  const myProjects =
    user.role === "admin"
      ? allProjects
      : allProjects.filter((p) => p.ownerId === user.id);
  const submissions = getSubmissions();
  const allUsers = getUsers();
  const zh = currentLang === "zh";

  // Update header
  dashTitleEl.textContent = zh ? "控制台" : "Dashboard";
  if (user.role === "admin") {
    document.getElementById("dashSubtitle").textContent = zh
      ? `投资组合总览 · ${allProjects.length} 个项目`
      : `Portfolio overview · ${allProjects.length} project${allProjects.length !== 1 ? "s" : ""}`;
  } else {
    document.getElementById("dashSubtitle").textContent = zh
      ? `我的工作台 · ${myProjects.length} 个项目`
      : `My workspace · ${myProjects.length} project${myProjects.length !== 1 ? "s" : ""}`;
  }

  const el = document.getElementById("dashboardContent");
  if (user.role === "admin") {
    el.innerHTML = renderAdminDashboard(allProjects, submissions, allUsers, zh);
  } else {
    el.innerHTML = renderUnderwriterDashboard(
      myProjects,
      submissions,
      user,
      zh,
    );
  }
}

function renderAdminDashboard(projects, submissions, users, zh) {
  const active = projects.filter((p) => p.status === "active");
  const draft = projects.filter((p) => p.status === "draft");
  const review = projects.filter((p) => p.status === "review");
  const published = projects.filter((p) => p.published);
  const totalValue = projects.reduce((s, p) => s + (p.offerPrice || 0), 0);
  const totalUnits = projects.reduce((s, p) => s + (p.units || 0), 0);
  const avgCap = projects.filter((p) => p.capRate || p.id === "p1").length
    ? (
        projects.reduce((s, p) => {
          const cr = p.id === "p1" ? 6.46 : p.capRate || 0;
          return s + cr;
        }, 0) / projects.filter((p) => p.capRate || p.id === "p1").length
      ).toFixed(2)
    : "—";

  const pending = submissions.filter((s) => s.status === "pending");
  const approvedSubs = submissions.filter((s) => s.status === "approved");
  const rejectedSubs = submissions.filter((s) => s.status === "rejected");

  const underwriters = users.filter(
    (u) => u.role === "underwriter" && u.status === "active",
  );
  const workload = underwriters.map((u) => {
    const userProjs = projects.filter((p) => p.ownerId === u.id);
    const userSubs = submissions.filter((s) => {
      const p = projects.find((pp) => pp.id === s.projectId);
      return p && p.ownerId === u.id;
    });
    const lastActive = userProjs.reduce((latest, p) => {
      if (!p.lastUpdated) return latest;
      return !latest || new Date(p.lastUpdated) > new Date(latest)
        ? p.lastUpdated
        : latest;
    }, null);
    return { user: u, projects: userProjs, submissions: userSubs, lastActive };
  });

  // Selected project for detail panel
  const selectedId =
    window._dashSelectedProject || (active[0] || projects[0] || null)?.id;
  const selectedProj = projects.find((p) => p.id === selectedId) || null;

  // Project selector grid
  const projCards = projects
    .map((p) => {
      const isSelected = p.id === selectedId;
      const cr =
        p.id === "p1" ? "6.46" : p.capRate ? p.capRate.toString() : null;
      const statusCls =
        p.status === "active"
          ? "badge-status-active"
          : p.status === "completed"
            ? "badge-status-published"
            : p.status === "archive"
              ? "badge-status-review"
              : "badge-status-draft";
      const statusLabel = zh
        ? p.status === "active"
          ? "活跃"
          : p.status === "completed"
            ? "已完成"
            : p.status === "archive"
              ? "归档"
              : "草稿"
        : p.status;
      const border = isSelected
        ? "border:2px solid var(--accent);"
        : "border:1px solid var(--border2);";
      const bg = isSelected ? "background:rgba(139,115,85,0.08);" : "";
      return `<div style="border-radius:10px;padding:12px 14px;cursor:pointer;transition:all .15s;${border}${bg}"
      onclick="window._dashSelectedProject='${p.id}';renderDashboard()">
      <div style="font-size:12px;font-weight:600;color:var(--header);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px">${p.units} ${zh ? "套" : "units"} · $${(p.offerPrice / 1e6).toFixed(1)}M</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge ${statusCls}" style="font-size:10px">${statusLabel}</span>
        ${cr ? `<span style="font-size:11px;color:var(--green);font-weight:600">${cr}%</span>` : ""}
      </div>
    </div>`;
    })
    .join("");

  // Recent submissions
  const recentSubs = [...submissions]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 6);
  const subRows = recentSubs.length
    ? recentSubs
        .map((s) => {
          const proj = projects.find((p) => p.id === s.projectId);
          const author = users.find((u) => u.id === s.authorId);
          const statusCls =
            s.status === "approved"
              ? "badge-status-active"
              : s.status === "rejected"
                ? "badge-status-review"
                : "badge-status-draft";
          const statusLabel = zh
            ? s.status === "approved"
              ? "已批准"
              : s.status === "rejected"
                ? "已拒绝"
                : "待审核"
            : s.status;
          const dt = new Date(s.submittedAt).toLocaleDateString();
          return `<tr>
      <td><strong>${proj ? proj.name : zh ? "未知" : "Unknown"}</strong></td>
      <td>${author ? author.firstName + " " + author.lastName : zh ? "未知" : "Unknown"}</td>
      <td style="color:var(--muted);font-size:12px">${dt}</td>
      <td><span class="badge ${statusCls}">${statusLabel}</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="reviewSubmission('${s.id}')">${zh ? "查看" : "Review"}</button></td>
    </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">${zh ? "暂无提交记录" : "No submissions yet"}</td></tr>`;

  // Underwriter workload rows
  const workloadRows = workload.length
    ? workload
        .map((w) => {
          const pendingW = (w.submissions || []).filter(
            (s) => s.status === "pending",
          ).length;
          const approvedW = (w.submissions || []).filter(
            (s) => s.status === "approved",
          ).length;
          const rejectedW = (w.submissions || []).filter(
            (s) => s.status === "rejected",
          ).length;
          const totalW = w.submissions.length;
          const barPct = totalW
            ? Math.min(100, Math.round((approvedW / Math.max(totalW, 1)) * 100))
            : 0;
          const lastDt = w.lastActive
            ? new Date(w.lastActive).toLocaleDateString()
            : "—";
          return `<tr>
      <td>
        <div style="font-weight:600;font-size:13px">${w.user.firstName} ${w.user.lastName}</div>
        <div style="font-size:11px;color:var(--muted)">${w.user.email}</div>
      </td>
      <td style="text-align:center"><strong>${w.projects.length}</strong></td>
      <td style="text-align:center"><strong>${totalW}</strong></td>
      <td style="text-align:center"><span style="color:var(--amber);font-weight:600">${pendingW}</span></td>
      <td style="text-align:center"><span style="color:var(--green);font-weight:600">${approvedW}</span></td>
      <td style="text-align:center"><span style="color:var(--error,#c0392b);font-weight:600">${rejectedW}</span></td>
      <td style="min-width:90px">
        <div style="background:var(--border2);border-radius:4px;height:6px;margin-bottom:3px">
          <div style="background:var(--green);border-radius:4px;height:6px;width:${barPct}%"></div>
        </div>
        <div style="font-size:10px;color:var(--muted)">${barPct}% ${zh ? "通过率" : "approval"}</div>
      </td>
      <td style="font-size:11px;color:var(--muted)">${lastDt}</td>
    </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">${zh ? "暂无承销分析师" : "No underwriters"}</td></tr>`;

  const pfDisplay = selectedProj
    ? renderProjectKPIs(selectedProj, zh)
    : `<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">${zh ? "请选择项目" : "Select a project"}</p>`;

  return `
  <!-- Portfolio KPIs -->
  <div class="bento bento-4" style="margin-bottom:var(--gap)">
    <div class="kpi-card">
      <div class="kpi-accent"></div>
      <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div>
      <div class="kpi-value">${projects.length}</div>
      <div class="kpi-label">${zh ? "项目总数" : "Total Projects"}</div>
      <div class="kpi-change up">${active.length} ${zh ? "活跃" : "active"} · ${draft.length} ${zh ? "草稿" : "draft"} · ${review.length} ${zh ? "审核中" : "review"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--green)"></div>
      <div class="kpi-icon" style="background:rgba(74,124,89,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
      <div class="kpi-value">${totalValue >= 1e6 ? "$" + (totalValue / 1e6).toFixed(1) + "M" : totalValue ? "$" + totalValue.toLocaleString() : "—"}</div>
      <div class="kpi-label">${zh ? "总资产规模" : "Total AUM"}</div>
      <div class="kpi-change up">${totalUnits} ${zh ? "套" : "units"} · ${zh ? "均Cap" : "Avg Cap"} ${avgCap}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--amber,#d4a843)"></div>
      <div class="kpi-icon" style="background:rgba(212,168,67,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--amber,#d4a843)" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <div class="kpi-value">${submissions.length}</div>
      <div class="kpi-label">${zh ? "提交总数" : "Total Submissions"}</div>
      <div class="kpi-change ${pending.length ? "up" : ""}">${pending.length} ${zh ? "待审核" : "pending"} · ${approvedSubs.length} ${zh ? "已批准" : "approved"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--blue)"></div>
      <div class="kpi-icon" style="background:rgba(74,101,133,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
      <div class="kpi-value">${underwriters.length}</div>
      <div class="kpi-label">${zh ? "活跃分析师" : "Active Analysts"}</div>
      <div class="kpi-change up">${workload.reduce((s, w) => s + w.projects.length, 0)} ${zh ? "个项目" : "projects assigned"}</div>
    </div>
  </div>

  <!-- Main content: project selector + detail + submissions -->
  <div class="dash-main-grid" style="display:grid;grid-template-columns:220px 1fr;gap:var(--gap);margin-bottom:var(--gap)">
    <!-- Project selector -->
    <div class="card" style="padding:14px">
      <div class="section-title" style="margin-bottom:10px;font-size:12px">${zh ? "项目列表" : "Projects"}</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:min(360px,40vh);overflow-y:auto">
        ${projCards}
      </div>
    </div>
    <!-- Selected project detail -->
    <div class="card" style="padding:16px">
      <div class="section-title" style="margin-bottom:12px">${zh ? "项目详情" : "Project Detail"}</div>
      ${pfDisplay}
    </div>
  </div>

  <!-- Bottom: submissions + workload -->
  <div class="dash-bottom-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)">
    <!-- Recent submissions -->
    <div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin-bottom:0">${zh ? "近期提交" : "Recent Submissions"}</div>
        ${pending.length ? `<span class="badge badge-status-review">${pending.length} ${zh ? "待审" : "pending"}</span>` : ""}
      </div>
      <div class="table-wrap"><table class="data-table" style="width:100%">
        <thead><tr>
          <th>${zh ? "项目" : "Project"}</th>
          <th>${zh ? "分析师" : "Analyst"}</th>
          <th>${zh ? "日期" : "Date"}</th>
          <th>${zh ? "状态" : "Status"}</th>
          <th></th>
        </tr></thead>
        <tbody>${subRows}</tbody>
      </table></div>
    </div>
    <!-- Underwriter workload -->
    <div class="card" style="padding:16px">
      <div class="section-title" style="margin-bottom:12px">${zh ? "分析师工作量" : "Analyst Workload"}</div>
      <div class="table-wrap"><table class="data-table" style="width:100%">
        <thead><tr>
          <th>${zh ? "姓名" : "Name"}</th>
          <th style="text-align:center">${zh ? "项目" : "Projects"}</th>
          <th style="text-align:center">${zh ? "提交" : "Subs"}</th>
          <th style="text-align:center">${zh ? "待审" : "Pending"}</th>
          <th style="text-align:center">${zh ? "通过" : "Approved"}</th>
          <th style="text-align:center">${zh ? "退回" : "Rejected"}</th>
          <th>${zh ? "通过率" : "Rate"}</th>
          <th>${zh ? "最近活跃" : "Last Active"}</th>
        </tr></thead>
        <tbody>${workloadRows}</tbody>
      </table></div>
    </div>
  </div>`;
}

function renderUnderwriterDashboard(myProjects, submissions, user, zh) {
  const mySubs = submissions.filter((s) => {
    const allP = getProjects();
    const p = allP.find((pp) => pp.id === s.projectId);
    return p && p.ownerId === user.id;
  });

  const active = myProjects.filter((p) => p.status === "active");
  const draft = myProjects.filter((p) => p.status === "draft");
  const review = myProjects.filter((p) => p.status === "review");
  const pending = mySubs.filter((s) => s.status === "pending");
  const approvedSubs = mySubs.filter((s) => s.status === "approved");
  const rejectedSubs = mySubs.filter((s) => s.status === "rejected");

  // Completion rate
  const completedProjs = myProjects.filter(
    (p) =>
      p.status === "complete" ||
      p.status === "completed" ||
      p.status === "active",
  );
  const completionPct = myProjects.length
    ? Math.round((completedProjs.length / myProjects.length) * 100)
    : 0;

  const selectedId =
    window._dashSelectedProject || (active[0] || myProjects[0] || null)?.id;
  const selectedProj = myProjects.find((p) => p.id === selectedId) || null;

  // Project cards
  const projCards = myProjects
    .map((p) => {
      const isSelected = p.id === selectedId;
      const cr =
        p.id === "p1" ? "6.46" : p.capRate ? p.capRate.toString() : null;
      const statusCls =
        p.status === "active"
          ? "badge-status-active"
          : p.status === "completed"
            ? "badge-status-published"
            : p.status === "archive"
              ? "badge-status-review"
              : "badge-status-draft";
      const statusLabel = zh
        ? p.status === "active"
          ? "活跃"
          : p.status === "completed"
            ? "已完成"
            : p.status === "archive"
              ? "归档"
              : "草稿"
        : p.status;
      const border = isSelected
        ? "border:2px solid var(--accent);"
        : "border:1px solid var(--border2);";
      const bg = isSelected ? "background:rgba(139,115,85,0.08);" : "";
      const pubBadge = p.published
        ? `<span style="font-size:9px;color:var(--green);font-weight:600">${zh ? "已发布" : "✓ Published"}</span>`
        : "";
      return `<div style="border-radius:10px;padding:12px 14px;cursor:pointer;transition:all .15s;${border}${bg}"
      onclick="window._dashSelectedProject='${p.id}';renderDashboard()">
      <div style="font-size:12px;font-weight:600;color:var(--header);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:5px">${p.units} ${zh ? "套" : "units"} · $${(p.offerPrice / 1e6).toFixed(1)}M</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge ${statusCls}" style="font-size:10px">${statusLabel}</span>
        ${pubBadge || ""}
      </div>
    </div>`;
    })
    .join("");

  // Recent activity timeline
  const recentSubs = [...mySubs]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 5);
  const subRows = recentSubs.length
    ? recentSubs
        .map((s) => {
          const allP = getProjects();
          const proj = allP.find((p) => p.id === s.projectId);
          const statusCls =
            s.status === "approved"
              ? "badge-status-active"
              : s.status === "rejected"
                ? "badge-status-review"
                : "badge-status-draft";
          const statusLabel = zh
            ? s.status === "approved"
              ? "已批准"
              : s.status === "rejected"
                ? "已拒绝"
                : "待审核"
            : s.status;
          const dt = new Date(s.submittedAt).toLocaleDateString();
          const icon =
            s.status === "approved" ? "✓" : s.status === "rejected" ? "✕" : "○";
          const iconColor =
            s.status === "approved"
              ? "var(--green)"
              : s.status === "rejected"
                ? "#c0392b"
                : "var(--muted)";
          return `<tr>
      <td><span style="font-size:14px;color:${iconColor};font-weight:700">${icon}</span></td>
      <td><strong>${proj ? proj.name : zh ? "未知" : "Unknown"}</strong></td>
      <td style="font-size:12px;color:var(--muted)">${dt}</td>
      <td><span class="badge ${statusCls}">${statusLabel}</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="reviewSubmission('${s.id}')">${zh ? "查看" : "View"}</button></td>
    </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">${zh ? "暂无提交记录" : "No submissions yet"}</td></tr>`;

  // Quick action buttons for projects without submission
  const unsubmitted = myProjects.filter(
    (p) => !p.published && p.status !== "review",
  );
  const quickActions = unsubmitted
    .slice(0, 3)
    .map(
      (p) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(139,115,85,0.05);border-radius:8px;margin-bottom:6px">
      <div>
        <div style="font-size:12px;font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${p.status} · ${p.units} ${zh ? "套" : "units"}</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="window.currentProjectId='${p.id}';openProjectAnalysis(currentProjectId)">${zh ? "继续分析" : "Continue"}</button>
    </div>`,
    )
    .join("");

  const pfDisplay = selectedProj
    ? renderProjectKPIs(selectedProj, zh)
    : `<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px">${zh ? "请选择项目" : "Select a project"}</p>`;

  return `
  <!-- My KPIs -->
  <div class="bento bento-4" style="margin-bottom:var(--gap)">
    <div class="kpi-card">
      <div class="kpi-accent"></div>
      <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div>
      <div class="kpi-value">${myProjects.length}</div>
      <div class="kpi-label">${zh ? "我的项目" : "My Projects"}</div>
      <div class="kpi-change up">${active.length} ${zh ? "活跃" : "active"} · ${draft.length} ${zh ? "草稿" : "draft"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--blue)"></div>
      <div class="kpi-icon" style="background:rgba(74,101,133,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="kpi-value">${mySubs.length}</div>
      <div class="kpi-label">${zh ? "提交总数" : "Submissions"}</div>
      <div class="kpi-change ${pending.length ? "up" : ""}">${pending.length} ${zh ? "待审" : "pending"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--green)"></div>
      <div class="kpi-icon" style="background:rgba(74,124,89,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="kpi-value">${approvedSubs.length}</div>
      <div class="kpi-label">${zh ? "已批准" : "Approved"}</div>
      <div class="kpi-change up">${mySubs.length ? Math.round((approvedSubs.length / mySubs.length) * 100) : 0}% ${zh ? "通过率" : "rate"}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-accent" style="background:var(--amber,#d4a843)"></div>
      <div class="kpi-icon" style="background:rgba(212,168,67,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--amber,#d4a843)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="kpi-value">${completionPct}%</div>
      <div class="kpi-label">${zh ? "完成率" : "Completion"}</div>
      <div class="kpi-change up">${completedProjs.length}/${myProjects.length} ${zh ? "已完成" : "completed"}</div>
    </div>
  </div>

  <!-- Main: project selector + detail -->
  <div style="display:grid;grid-template-columns:200px 1fr;gap:var(--gap);margin-bottom:16px">
    <div class="card" style="padding:14px">
      <div class="section-title" style="margin-bottom:10px;font-size:12px">${zh ? "我的项目" : "My Projects"}</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:min(360px,40vh);overflow-y:auto">
        ${projCards || `<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">${zh ? "暂无项目" : "No projects"}</div>`}
      </div>
    </div>
    <div class="card" style="padding:16px">
      <div class="section-title" style="margin-bottom:12px">${zh ? "项目详情" : "Project Detail"}</div>
      ${pfDisplay}
    </div>
  </div>

  <!-- Bottom: activity + quick actions -->
  <div style="display:grid;grid-template-columns:1fr 280px;gap:var(--gap)">
    <div class="card" style="padding:16px">
      <div class="section-title" style="margin-bottom:12px">${zh ? "提交记录" : "Submission History"}</div>
      <div class="table-wrap"><table class="data-table" style="width:100%">
        <thead><tr>
          <th></th>
          <th>${zh ? "项目" : "Project"}</th>
          <th>${zh ? "日期" : "Date"}</th>
          <th>${zh ? "状态" : "Status"}</th>
          <th></th>
        </tr></thead>
        <tbody>${subRows}</tbody>
      </table></div>
    </div>
    <div class="card" style="padding:16px">
      <div class="section-title" style="margin-bottom:12px">${zh ? "待处理" : "Action Needed"}</div>
      ${unsubmitted.length ? quickActions : `<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">${zh ? "所有项目均已提交" : "All projects submitted"}</div>`}
    </div>
  </div>`;
}

function renderProjectKPIs(proj, zh) {
  if (!proj) return "";
  const offerFmt = proj.offerPrice
    ? "$" + (proj.offerPrice / 1e6).toFixed(2) + "M"
    : "—";
  const capRate = proj.capRate ? proj.capRate + "%" : "—";
  const noi = proj.noi ? "$" + proj.noi.toLocaleString() : "—";
  const dscr = proj.dscr ? proj.dscr + "×" : "—";
  const irr = proj.irr ? proj.irr + "%" : "—";
  const equity = proj.offerPrice
    ? "$" + ((proj.offerPrice * 0.35) / 1e6).toFixed(2) + "M"
    : "—";
  const statusCls =
    proj.status === "active"
      ? "badge-status-active"
      : proj.status === "completed"
        ? "badge-status-published"
        : proj.status === "archive"
          ? "badge-status-review"
          : "badge-status-draft";
  const statusLabel = zh
    ? proj.status === "active"
      ? "活跃"
      : proj.status === "completed"
        ? "已完成"
        : proj.status === "archive"
          ? "归档"
          : "草稿"
    : proj.status;
  const owner = getUsers().find((u) => u.id === proj.ownerId);
  const ownerName = owner ? owner.firstName + " " + owner.lastName : "—";
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--header)">${proj.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${proj.address || ""}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span class="badge ${statusCls}">${statusLabel}</span>
      ${proj.published ? `<span class="badge badge-status-published">${zh ? "已发布" : "Published"}</span>` : ""}
      <span style="font-size:11px;color:var(--muted)">${zh ? "分析师:" : "Analyst:"} ${ownerName}</span>
    </div>
  </div>
  <div class="bento bento-3" style="gap:10px;margin-bottom:12px">
    <div style="background:rgba(139,115,85,0.06);border-radius:10px;padding:14px">
      <div style="font-size:20px;font-weight:700;color:var(--header)">${offerFmt}</div>
      <div style="font-size:11px;color:var(--muted)">${zh ? "报价" : "Offer Price"}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${proj.units} ${zh ? "套" : "units"}</div>
    </div>
    <div style="background:rgba(74,124,89,0.06);border-radius:10px;padding:14px">
      <div style="font-size:20px;font-weight:700;color:var(--green)">${capRate}</div>
      <div style="font-size:11px;color:var(--muted)">${zh ? "资本化率" : "Cap Rate"}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">NOI ${noi}</div>
    </div>
    <div style="background:rgba(74,101,133,0.06);border-radius:10px;padding:14px">
      <div style="font-size:20px;font-weight:700;color:var(--blue)">${dscr}</div>
      <div style="font-size:11px;color:var(--muted)">DSCR</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">IRR ${irr}</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="window.currentProjectId='${proj.id}';openProjectAnalysis(currentProjectId)">${zh ? "打开分析" : "Open Analysis"}</button>
    
    <span style="font-size:11px;color:var(--muted);align-self:center">${zh ? "最后更新:" : "Updated:"} ${proj.lastUpdated || "—"}</span>
  </div>`;
}

// Patch navTo to call renderDashboard when navigating to dashboard

// Expose to global scope

// ─── GL Capital: Submenu toggle ──────────────────────────────────────────────
function toggleSubmenu(id) {
  var menu = document.getElementById("submenu-" + id);
  var chev = document.getElementById(id + "-chevron");
  if (!menu) return;
  var closing = !menu.classList.contains("closed");
  menu.classList.toggle("closed", closing);
  if (chev) chev.classList.toggle("rotated", !closing);
}

// ─── GL Capital: Project tab switching ──────────────────────────────────────
function switchProjTab(tab, btn) {
  // 't12' is an alias for 'files' tab
  if (tab === "t12") tab = "files";
  document.querySelectorAll(".proj-tab").forEach(function (t) {
    t.classList.remove("active");
  });
  document.querySelectorAll(".proj-tab-content").forEach(function (c) {
    c.style.display = "none";
  });
  if (btn) btn.classList.add("active");
  var content = document.getElementById("proj-tab-" + tab);
  if (content) content.style.display = "";
  var proj = getProjects().find(function (p) {
    return p.id === currentProjectId;
  });
  if (tab === "proforma") {
    _loadPFOverrides();
    _checkPFEmptyState(proj);
    buildPFTable();
    buildPFUnitMix();
    if (typeof populateSummary === "function") populateSummary();
    updatePFEditLog();
  }
  if (tab === "files") {
    if (proj) {
      _updateT12UI(proj);
      renderT12Parsed(proj);
      _updateRRUI(proj);
      renderRRParsed(proj);
    }
    _refreshHDUploadUI();
    _renderHDParsedContent();
    if (typeof _updateDebtUI === "function") _updateDebtUI();
  }
  // Legacy aliases — redirect to files tab
  if (tab === "rentroll" || tab === "hellodata") {
    switchProjTab("files", document.getElementById("ptab-files"));
    return;
  }
  if (tab === "debt") {
    if (typeof buildDebtAnalysis === "function") buildDebtAnalysis();
  }
}

// ─── GL Capital: Open project analysis (new detail page) ────────────────────
function openProjectAnalysis(pid) {
  currentProjectId = pid;
  window.currentProjectId = pid;
  window._currentProjectId = pid;
  _loadPfManualVals();
  _loadPfSourceSel();
  // Reset edit mode on project open
  if (_globalEditMode) {
    _globalEditMode = false;
    _t12EditMode = false;
    _rrEditMode = false;
    _debtEditMode = false;
    _pfEditMode = false;
    pfEditMode = false;
    var editBtn = document.getElementById("globalEditToggleBtn");
    var editLbl = document.getElementById("globalEditToggleLabel");
    if (editBtn) {
      editBtn.style.background = "";
      editBtn.style.borderColor = "";
      editBtn.style.color = "";
    }
    if (editLbl)
      editLbl.textContent = currentLang === "zh" ? "编辑模式" : "Edit Mode";
    var detailPage = document.getElementById("page-project-detail");
    if (detailPage) detailPage.classList.remove("edit-mode");
  }
  const proj = getProjects().find((p) => p.id === pid);
  if (!proj) return;
  // Update detail page header
  const nameEl = document.getElementById("detailProjectName");
  const addrEl = document.getElementById("detailProjectAddr");
  const statusEl = document.getElementById("detailProjectStatus");
  if (nameEl) nameEl.textContent = proj.name;
  if (addrEl) addrEl.textContent = proj.address || "";
  if (statusEl) {
    _updateDetailStatusBadge(proj.status);
  }
  // Render AI Score badge in header
  var scoreBadge = document.getElementById("detailAIScoreBadge");
  if (scoreBadge) scoreBadge.innerHTML = renderAIScoreBadge(pid, "md");
  // Status select
  const statusSel = document.getElementById("detailStatusSelect");
  if (statusSel)
    statusSel.value =
      proj.status === "complete" ||
      proj.status === "completed" ||
      proj.status === "active"
        ? "complete"
        : "draft";
  // (publish banner removed)
  // Show pro forma tab by default
  switchProjTab("proforma", document.getElementById("ptab-proforma"));
  // Render T12 and RentRoll tabs + ProForma empty state
  renderAllParsedPreviews(proj);
  _loadPFOverrides();
  _checkPFEmptyState(proj);
  // Navigate
  navTo("project-detail", null);
  // Re-render after page is shown (ensures pfContent is visible)
  setTimeout(function () {
    _checkPFEmptyState(proj);
    if (typeof renderRentRoll === "function") renderRentRoll();
    if (typeof populateSummary === "function") populateSummary();
  }, 0);
  // Update dropdown names
  ["pf", "rr", "debt"].forEach((id) => {
    const el =
      document.getElementById(id + "ProjectName") ||
      document.getElementById(
        id === "pf"
          ? "pfProjectName"
          : id === "rr"
            ? "rrProjectName"
            : "debtProjectName",
      );
    if (el) el.textContent = proj.name;
  });
}

// ═══════════════════════════════════════════════════════════════════
// T12 UPLOAD & RENDER
// ═══════════════════════════════════════════════════════════════════
function handleT12Upload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  // Read/write projects directly via localStorage (avoids ES-module closure issues)
  var pid = currentProjectId;
  var projs = JSON.parse(localStorage.getItem("glcapital_projects") || "[]");
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (!proj) return;
  if (!proj.files) proj.files = [];
  // Remove old T12 files and their stored data
  proj.files.forEach(function (f) {
    if (
      f.type === "T12" ||
      f.type === "Selling Model" ||
      f.parsedAs === "T12" ||
      f.parsedAs === "Selling Model"
    ) {
      try {
        localStorage.removeItem("file_data_" + f.id);
      } catch (e) {}
    }
  });
  proj.files = proj.files.filter(function (f) {
    return (
      f.type !== "T12" &&
      f.type !== "Selling Model" &&
      f.parsedAs !== "T12" &&
      f.parsedAs !== "Selling Model"
    );
  });
  var fileId = "f" + Date.now();
  proj.files.push({
    id: fileId,
    name: file.name,
    size: file.size,
    type: "T12",
    parsedAs: "T12",
    date: new Date().toLocaleDateString(),
    status: "parsed",
  });
  localStorage.setItem("glcapital_projects", JSON.stringify(projs));

  // Store original file as dataUrl for preview (separate key to avoid quota)
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      localStorage.setItem("file_data_" + fileId, e.target.result);
    } catch (err) {
      console.warn("[T12 preview] localStorage quota exceeded");
    }
    var p2 = getProjects().find(function (p) {
      return p.id === pid;
    });
    if (p2) {
      _updateT12UI(p2);
      renderT12Parsed(p2);
    }
  };
  reader.readAsDataURL(file);

  // Parse xlsx for T12 data (also handles RR + Debt sheets if present)
  var parseReader = new FileReader();
  parseReader.onload = function (e) {
    try {
      var parsed = _parseUnderwritingXlsx(e.target.result, pid);
      _pfLoaded = true;
      if (parsed.rr) renderRentRoll();
      buildPFUnitMix();
      buildPFTable();
      if (parsed.debt && typeof buildDebtAnalysis === "function")
        buildDebtAnalysis();
      // Refresh Summary tab: dual-source cells + KPI strip
      var _p2 = JSON.parse(
        localStorage.getItem("glcapital_projects") || "[]",
      ).find(function (x) {
        return x.id === pid;
      });
      if (typeof populateSummary === "function") populateSummary();
      toast(
        currentLang === "zh"
          ? "T12文件已上传并解析" +
              (parsed.rr ? " (含Rent Roll)" : "") +
              (parsed.debt ? " (含Debt)" : "")
          : "T12 parsed" +
              (parsed.rr ? " + Rent Roll" : "") +
              (parsed.debt ? " + Debt" : ""),
        "success",
      );
    } catch (err) {
      toast("Parse error: " + err.message, "error");
    }
  };
  parseReader.readAsArrayBuffer(file);

  // Update UI
  _updateT12UI(proj);
  // Reset input to allow re-uploading same file
  var t12InputEl = document.getElementById("t12Input");
  if (t12InputEl) t12InputEl.value = "";
  updateTabDots();
}

function handleT12Drop(event) {
  const file =
    event.dataTransfer &&
    event.dataTransfer.files &&
    event.dataTransfer.files[0];
  if (!file) return;
  handleT12Upload({ target: { files: [file] } });
}

function deleteT12() {
  const proj = getProjects().find((p) => p.id === currentProjectId);
  if (!proj) return;
  (proj.files || []).forEach(function (f) {
    if (["T12", "Selling Model"].includes(f.parsedAs || f.type)) {
      try {
        localStorage.removeItem("file_data_" + f.id);
      } catch (e) {}
    }
  });
  proj.files = (proj.files || []).filter(
    (f) => !["T12", "Selling Model"].includes(f.parsedAs || f.type),
  );
  saveProjects(getProjects().map((p) => (p.id === proj.id ? proj : p)));
  renderT12Tab(proj);
  // Reset pro forma
  resetProForma();
  toast(currentLang === "zh" ? "T12文件已删除" : "T12 file removed");
}

function renderT12Tab(proj) {
  if (!proj) return;
  const zh = currentLang === "zh";
  const t12File = (proj.files || []).find((f) =>
    ["T12", "Selling Model"].includes(f.parsedAs || f.type),
  );
  const dropZone = document.getElementById("t12DropZone");
  const parsedContent = document.getElementById("t12ParsedContent");
  const fileInfo = document.getElementById("t12FileInfo");
  const uploadBtn = document.getElementById("t12UploadBtn");
  const uploadBtnLabel = document.getElementById("t12UploadBtnLabel");
  const deleteBtn = document.getElementById("t12DeleteBtn");

  if (!t12File) {
    if (dropZone) dropZone.style.display = "";
    if (parsedContent) parsedContent.style.display = "none";
    if (fileInfo)
      fileInfo.textContent = zh
        ? "未上传文件 · 仅限一个文件"
        : "No file uploaded · Single file only";
    if (uploadBtnLabel)
      uploadBtnLabel.textContent = zh ? "上传T12" : "Upload T12";
    if (deleteBtn) deleteBtn.style.display = "none";
    return;
  }

  // File exists — show parsed data
  if (dropZone) dropZone.style.display = "none";
  if (parsedContent) parsedContent.style.display = "";
  const sizeFmt = t12File.size
    ? t12File.size > 1024 * 1024
      ? (t12File.size / 1024 / 1024).toFixed(1) + "MB"
      : (t12File.size / 1024).toFixed(0) + "KB"
    : "";
  if (fileInfo)
    fileInfo.textContent =
      (zh ? "已上传：" : "Uploaded: ") +
      t12File.name +
      (sizeFmt ? " · " + sizeFmt : "");
  if (uploadBtnLabel)
    uploadBtnLabel.textContent = zh ? "替换文件" : "Replace File";
  if (deleteBtn) deleteBtn.style.display = "";

  // Render T12 parsed table (full display)
  renderT12Parsed(proj);
}

// ── T12 Card UI state & data ──────────────────────────────────
var _t12Year = "y1";
var _t12EditMode = false;
var _rrEditMode = false;
var _debtEditMode = false;
// T12D is now dynamically loaded from parsed T12 data
var T12D = {
  income: {},
  expenses: {},
  netIncome: { y1: 0, y2: 0 },
  cash: {},
  acctPayable: {},
  memContrib: {},
  retainedEarnings: {},
  cashFlow: { y1: 0, y2: 0 },
  bankRecon: {},
};

function t12Fmt(n) {
  if (n === 0) return "$0";
  var s = "$" + Math.abs(Math.round(n)).toLocaleString();
  return n < 0 ? "\u2013" + s : s;
}
function t12Amt(y1, y2, ec) {
  var v = _t12Year === "y1" ? y1 : y2;
  var cls =
    "t12-amt" +
    (ec ? " " + ec : "") +
    (v < 0 ? " neg" : "") +
    (v === 0 ? " zero-val" : "");
  return (
    '<span class="' +
    cls +
    '" data-y1="' +
    y1 +
    '" data-y2="' +
    y2 +
    '">' +
    t12Fmt(v) +
    "</span>"
  );
}
function t12Field(lbl, y1, y2, lvl, opts) {
  opts = opts || {};
  var v = _t12Year === "y1" ? y1 : y2;
  var badges = "";
  if (opts.warn)
    badges += '<span class="t12-badge t12-badge-warn">\u26a0</span>';
  if (opts.debt)
    badges += '<span class="t12-badge t12-badge-debt">\u2192 Debt</span>';
  if (opts.custom)
    badges += '<span class="t12-badge t12-badge-custom">custom</span>';
  return (
    '<div class="t12-field t12-lvl' +
    (lvl || 1) +
    (v === 0 ? " zero" : "") +
    '">' +
    '<span class="t12-field-lbl">' +
    lbl +
    badges +
    "</span>" +
    '<span class="t12-field-val' +
    (v < 0 ? " neg" : "") +
    '">' +
    t12Amt(y1, y2) +
    "</span>" +
    "</div>"
  );
}
function t12Sec(lbl) {
  return '<div class="t12-section-lbl">' + lbl + "</div>";
}
function t12Sub(lbl, y1, y2) {
  var v = _t12Year === "y1" ? y1 : y2;
  return (
    '<div class="t12-subtotal-row"><span>' +
    lbl +
    "</span>" +
    "<span" +
    (v < 0 ? ' style="color:var(--red,#c0392b)"' : "") +
    ">" +
    t12Amt(y1, y2) +
    "</span></div>"
  );
}
function t12Div() {
  return '<div class="t12-divider"></div>';
}
function t12AddBtn(id) {
  var zh = currentLang === "zh";
  return (
    '<div class="t12-add-row">' +
    '<button class="t12-add-btn" onclick="showT12AddForm(\'' +
    id +
    "')\">" +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    " " +
    (zh ? "添加字段" : "Add Field") +
    "</button>" +
    '<div id="t12af-' +
    id +
    '"></div></div>'
  );
}

function renderT12ParsedHTML() {
  var zh = currentLang === "zh";
  var D = T12D;

  // ── Year toggle bar ───────────────────────────────────────
  var yearBar =
    '<div class="t12-year-bar">' +
    '<button class="t12-yr-btn' +
    (_t12Year === "y1" ? " active" : "") +
    '" onclick="switchT12Year(\'y1\')">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
    " Y1 &nbsp;Nov'23\u2013Oct'24</button>" +
    '<button class="t12-yr-btn' +
    (_t12Year === "y2" ? " active" : "") +
    '" onclick="switchT12Year(\'y2\')">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
    " Y2 &nbsp;Nov'24\u2013Oct'25</button>" +
    '<span class="t12-period-label">' +
    ((
      getProjects().find(function (p) {
        return p.id === currentProjectId;
      }) || {}
    ).name || "") +
    " &middot; Cash Basis</span>" +
    "</div>";

  // ── INCOME body ───────────────────────────────────────────
  var incBody =
    t12Sec(zh ? "租金收入" : "RENTS") +
    t12Field("Rent Income", D.income.rentIncome.y1, D.income.rentIncome.y2, 2) +
    t12Field(
      "Other Rental Income",
      D.income.otherRental.y1,
      D.income.otherRental.y2,
      2,
    ) +
    t12Field(
      "Application Fee Income",
      D.income.appFee.y1,
      D.income.appFee.y2,
      2,
    ) +
    t12Field("NSF Fees Collected", D.income.nsfFee.y1, D.income.nsfFee.y2, 2) +
    t12Field("Late Fee", D.income.lateFee.y1, D.income.lateFee.y2, 2) +
    t12Field("Pet Fee", D.income.petFee.y1, D.income.petFee.y2, 2) +
    t12Field(
      "Furniture Charge",
      D.income.furniture.y1,
      D.income.furniture.y2,
      2,
    ) +
    t12Field("Laundry Income", D.income.laundry.y1, D.income.laundry.y2, 2) +
    t12Field(
      "Insurance Services",
      D.income.insuranceSvc.y1,
      D.income.insuranceSvc.y2,
      2,
    ) +
    t12Field(
      "Utility Reimbursement Fee",
      D.income.utilReimb.y1,
      D.income.utilReimb.y2,
      2,
    ) +
    t12Field(
      "Concessions",
      D.income.concessions.y1,
      D.income.concessions.y2,
      2,
    ) +
    t12Sub("TOTAL RENTS", D.income.totalRents.y1, D.income.totalRents.y2) +
    t12Div() +
    t12Sec(zh ? "管理收入" : "MANAGEMENT INCOME") +
    t12Field(
      "Maintenance Labor Fee Income",
      D.income.maintLaborFeeInc.y1,
      D.income.maintLaborFeeInc.y2,
      2,
    ) +
    t12Field(
      "Prepaid Rent",
      D.income.prepaidRentInc.y1,
      D.income.prepaidRentInc.y2,
      2,
    ) +
    t12Sub(
      "TOTAL MANAGEMENT INCOME",
      D.income.totalMgmtIncome.y1,
      D.income.totalMgmtIncome.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "其他收入" : "FEES") +
    t12Field(
      "Miscellaneous Income",
      D.income.miscIncome.y1,
      D.income.miscIncome.y2,
      2,
    ) +
    t12Sub("TOTAL FEES", D.income.totalFees.y1, D.income.totalFees.y2) +
    t12AddBtn("income");

  // ── EXPENSES body ─────────────────────────────────────────
  var expBody =
    t12Sec(zh ? "清洁" : "CLEANING & JANITORIAL") +
    t12Field(
      "Cleaning and Janitorial",
      D.expenses.cleaning.y1,
      D.expenses.cleaning.y2,
      2,
    ) +
    t12Field(
      "Maintenance Labor",
      D.expenses.maintLabor.y1,
      D.expenses.maintLabor.y2,
      2,
    ) +
    t12Field(
      "Garbage & Recycling",
      D.expenses.garbage.y1,
      D.expenses.garbage.y2,
      2,
    ) +
    t12Field("Pest Control", D.expenses.pest.y1, D.expenses.pest.y2, 2) +
    t12Sub(
      zh ? "小计 · 清洁" : "TOTAL CLEANING & JANITORIAL",
      D.expenses.totalCleaning.y1,
      D.expenses.totalCleaning.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "保险" : "INSURANCE") +
    t12Field(
      "Property Insurance",
      D.expenses.propInsurance.y1,
      D.expenses.propInsurance.y2,
      2,
    ) +
    t12Field(
      "Insurance - Other",
      D.expenses.insOther.y1,
      D.expenses.insOther.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 保险" : "TOTAL INSURANCE",
      D.expenses.totalInsurance.y1,
      D.expenses.totalInsurance.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "专业服务" : "LEGAL & PROFESSIONAL") +
    t12Field(
      "Accounting",
      D.expenses.accounting.y1,
      D.expenses.accounting.y2,
      2,
    ) +
    t12Field("Appfolio", D.expenses.appfolio.y1, D.expenses.appfolio.y2, 2) +
    t12Sub(
      zh ? "小计 · 专业服务" : "TOTAL LEGAL & PROFESSIONAL",
      D.expenses.totalLegal.y1,
      D.expenses.totalLegal.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "管理费" : "MANAGEMENT FEES") +
    t12Field(
      "Management Fee",
      D.expenses.mgmtFee.y1,
      D.expenses.mgmtFee.y2,
      2,
    ) +
    t12Field(
      "Commissions / Placement Fee",
      D.expenses.commissions.y1,
      D.expenses.commissions.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 管理费" : "TOTAL MANAGEMENT FEES",
      D.expenses.totalMgmtFees.y1,
      D.expenses.totalMgmtFees.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "贷款利息" : "MORTGAGE") +
    t12Field(
      "Mortgage Interest",
      D.expenses.mortgageInt.y1,
      D.expenses.mortgageInt.y2,
      2,
    ) +
    t12Field(
      "Mortgage - Other",
      D.expenses.mortgageOther.y1,
      D.expenses.mortgageOther.y2,
      2,
    ) +
    t12Field(
      "Other Interest",
      D.expenses.otherInt.y1,
      D.expenses.otherInt.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 贷款利息" : "TOTAL MORTGAGE",
      D.expenses.totalMortgage.y1,
      D.expenses.totalMortgage.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "维修保养" : "REPAIRS & MAINTENANCE") +
    t12Field("Painting", D.expenses.painting.y1, D.expenses.painting.y2, 2) +
    t12Field("Plumbing", D.expenses.plumbing.y1, D.expenses.plumbing.y2, 2) +
    t12Field("Flooring", D.expenses.flooring.y1, D.expenses.flooring.y2, 2) +
    t12Field("HVAC", D.expenses.hvac.y1, D.expenses.hvac.y2, 2) +
    t12Field(
      "Sub Contractor",
      D.expenses.subContractor.y1,
      D.expenses.subContractor.y2,
      2,
    ) +
    t12Field(
      "Key / Lock Replacement",
      D.expenses.keyLock.y1,
      D.expenses.keyLock.y2,
      2,
    ) +
    t12Field(
      "Security Service",
      D.expenses.security.y1,
      D.expenses.security.y2,
      2,
    ) +
    t12Field(
      "Roof Repair",
      D.expenses.roofRepair.y1,
      D.expenses.roofRepair.y2,
      2,
    ) +
    t12Field(
      "Elevator Contract",
      D.expenses.elevatorContract.y1,
      D.expenses.elevatorContract.y2,
      2,
    ) +
    t12Field(
      "Elevator Repair",
      D.expenses.elevatorRepair.y1,
      D.expenses.elevatorRepair.y2,
      2,
    ) +
    t12Field(
      "Appliance Repair",
      D.expenses.applianceRepair.y1,
      D.expenses.applianceRepair.y2,
      2,
    ) +
    t12Field(
      "Repairs - Other",
      D.expenses.repairsOther.y1,
      D.expenses.repairsOther.y2,
      2,
    ) +
    t12Field("Supplies", D.expenses.supplies.y1, D.expenses.supplies.y2, 2) +
    t12Sub(
      zh ? "小计 · 维修保养" : "TOTAL REPAIRS & MAINTENANCE",
      D.expenses.totalRepairs.y1,
      D.expenses.totalRepairs.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "税费" : "TAXES") +
    t12Field("Property Tax", D.expenses.propTax.y1, D.expenses.propTax.y2, 2) +
    t12Field(
      "Taxes - Other",
      D.expenses.taxesOther.y1,
      D.expenses.taxesOther.y2,
      2,
    ) +
    t12Field(
      "Licenses & Registration",
      D.expenses.licenses.y1,
      D.expenses.licenses.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 税费" : "TOTAL TAXES",
      D.expenses.totalTaxes.y1,
      D.expenses.totalTaxes.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "公用事业" : "UTILITIES") +
    t12Field(
      "Electricity",
      D.expenses.electricity.y1,
      D.expenses.electricity.y2,
      2,
    ) +
    t12Field("Gas", D.expenses.gas.y1, D.expenses.gas.y2, 2) +
    t12Field("Water", D.expenses.water.y1, D.expenses.water.y2, 2) +
    t12Field("Telephone", D.expenses.telephone.y1, D.expenses.telephone.y2, 2) +
    t12Sub(
      zh ? "小计 · 公用事业" : "TOTAL UTILITIES",
      D.expenses.totalUtilities.y1,
      D.expenses.totalUtilities.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "行政管理" : "ADMINISTRATIVE") +
    t12Field(
      "Office Expense",
      D.expenses.officeExpense.y1,
      D.expenses.officeExpense.y2,
      2,
    ) +
    t12Field("Salary", D.expenses.salary.y1, D.expenses.salary.y2, 2) +
    t12Field("Bank Fees", D.expenses.bankFees.y1, D.expenses.bankFees.y2, 2) +
    t12Sub(
      zh ? "小计 · 行政管理" : "TOTAL ADMINISTRATIVE",
      D.expenses.totalAdmin.y1,
      D.expenses.totalAdmin.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "市场营销" : "MARKETING") +
    t12Field(
      "Marketing Expense",
      D.expenses.marketing.y1,
      D.expenses.marketing.y2,
      2,
    ) +
    t12Field(
      "Advertising",
      D.expenses.advertising.y1,
      D.expenses.advertising.y2,
      2,
    ) +
    t12Field(
      "Meetings & Events",
      D.expenses.meetings.y1,
      D.expenses.meetings.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 市场营销" : "TOTAL MARKETING",
      D.expenses.totalMarketing.y1,
      D.expenses.totalMarketing.y2,
    ) +
    t12Div() +
    t12Sec(zh ? "建筑费用" : "BUILDING EXPENSES") +
    t12Field(
      "Inspection Costs",
      D.expenses.inspection.y1,
      D.expenses.inspection.y2,
      2,
    ) +
    t12Field(
      "Depreciation Expense",
      D.expenses.depreciation ? D.expenses.depreciation.y1 : 0,
      D.expenses.depreciation ? D.expenses.depreciation.y2 : 0,
      2,
      { warn: true },
    ) +
    t12Field(
      "Amortization Expense",
      D.expenses.amortization ? D.expenses.amortization.y1 : 0,
      D.expenses.amortization ? D.expenses.amortization.y2 : 0,
      2,
      { warn: true },
    ) +
    t12Field(
      "Refinance Fee Expense",
      D.expenses.refinanceFee ? D.expenses.refinanceFee.y1 : 0,
      D.expenses.refinanceFee ? D.expenses.refinanceFee.y2 : 0,
      2,
      { warn: true },
    ) +
    t12Field(
      "Miscellaneous Expense",
      D.expenses.miscExpense ? D.expenses.miscExpense.y1 : 0,
      D.expenses.miscExpense ? D.expenses.miscExpense.y2 : 0,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 建筑费用" : "TOTAL BUILDING EXPENSES",
      D.expenses.totalBuilding.y1,
      D.expenses.totalBuilding.y2,
    ) +
    t12Div() +
    t12Field(
      "Depreciation Expense (Unused)",
      D.expenses.depreciationUnused ? D.expenses.depreciationUnused.y1 : 0,
      D.expenses.depreciationUnused ? D.expenses.depreciationUnused.y2 : 0,
      1,
      { warn: true },
    ) +
    t12Div() +
    t12Sec(zh ? "优先回报" : "PREFERRED RETURNS") +
    t12Field(
      "Guaranteed Payments",
      D.expenses.guaranteedPayments.y1,
      D.expenses.guaranteedPayments.y2,
      2,
    ) +
    t12Field(
      "Pref - Int - Ho Ruiming",
      D.expenses.prefIntHo.y1,
      D.expenses.prefIntHo.y2,
      2,
    ) +
    t12Sub(
      zh ? "小计 · 优先回报" : "TOTAL PREFERRED RETURNS",
      D.expenses.totalPreferred.y1,
      D.expenses.totalPreferred.y2,
    ) +
    t12Div() +
    '<div class="t12-field t12-lvl1" style="background:rgba(139,106,46,0.05)">' +
    '<span class="t12-field-lbl">Ask My Accountant&nbsp;<span class="t12-badge t12-badge-warn">\u26a0 ' +
    (zh ? "暂挂" : "Pending") +
    "</span></span>" +
    '<span class="t12-field-val' +
    ((_t12Year === "y1"
      ? D.expenses.askAccountant.y1
      : D.expenses.askAccountant.y2) < 0
      ? " neg"
      : "") +
    '">' +
    t12Amt(D.expenses.askAccountant.y1, D.expenses.askAccountant.y2) +
    "</span>" +
    "</div>" +
    t12AddBtn("expenses");

  // ── TOTAL CASH body ───────────────────────────────────────
  var cashBody =
    t12Field(
      "Secondary Checking",
      D.cash.secChecking.y1,
      D.cash.secChecking.y2,
      2,
    ) +
    t12Field(
      "Escrow - Prepaid Property Taxes",
      D.cash.escrowTax.y1,
      D.cash.escrowTax.y2,
      2,
    ) +
    t12Field(
      "Escrow - Capex Reserves",
      D.cash.escrowCapex.y1,
      D.cash.escrowCapex.y2,
      2,
    ) +
    t12Field("Reserves", D.cash.reserves.y1, D.cash.reserves.y2, 2) +
    t12Field(
      "Investment in GLC Penn",
      D.cash.investGLC.y1,
      D.cash.investGLC.y2,
      2,
    ) +
    t12AddBtn("cash");

  // ── TOTAL ACCOUNTS PAYABLE body ───────────────────────────
  var apBody =
    t12Sec(zh ? "固定资产" : "FIXED ASSETS") +
    t12Field(
      "Buildings",
      D.acctPayable.buildings.y1,
      D.acctPayable.buildings.y2,
      2,
    ) +
    t12Field(
      "Building Improvements",
      D.acctPayable.buildingImprov.y1,
      D.acctPayable.buildingImprov.y2,
      2,
    ) +
    t12Field(
      "Building Depreciation",
      D.acctPayable.buildingDeprec.y1,
      D.acctPayable.buildingDeprec.y2,
      2,
    ) +
    t12Field(
      "5 Year Property",
      D.acctPayable.fiveYearProp.y1,
      D.acctPayable.fiveYearProp.y2,
      2,
    ) +
    t12Field(
      "Deferred Loan Costs",
      D.acctPayable.deferredLoan.y1,
      D.acctPayable.deferredLoan.y2,
      2,
    ) +
    t12Field(
      "Accumulated Amortization",
      D.acctPayable.accumAmort.y1,
      D.acctPayable.accumAmort.y2,
      2,
    ) +
    t12Div() +
    t12Sec(zh ? "关联方借款" : "INTERCOMPANY LOANS") +
    t12Field(
      "Intercompany Loan - Yu Dai",
      D.acctPayable.icYuDai.y1,
      D.acctPayable.icYuDai.y2,
      2,
    ) +
    t12Field(
      "Intercompany Loan - GL Capital",
      D.acctPayable.icGL.y1,
      D.acctPayable.icGL.y2,
      2,
    ) +
    t12Field(
      "Intercompany Loan - Global Leaders",
      D.acctPayable.icGlobal.y1,
      D.acctPayable.icGlobal.y2,
      2,
    ) +
    t12Field(
      "Intercompany Loan - GLC Penn",
      D.acctPayable.icGLCPenn.y1,
      D.acctPayable.icGLCPenn.y2,
      2,
    ) +
    t12Div() +
    t12Sec(zh ? "流动负债" : "CURRENT LIABILITIES") +
    t12Field(
      "Owner Held Security Deposits",
      D.acctPayable.secDeposits.y1,
      D.acctPayable.secDeposits.y2,
      2,
    ) +
    t12Field(
      "Clearing Account",
      D.acctPayable.clearingAcct.y1,
      D.acctPayable.clearingAcct.y2,
      2,
    ) +
    t12Field(
      "Prepaid Rent",
      D.acctPayable.prepaidRentBS.y1,
      D.acctPayable.prepaidRentBS.y2,
      2,
    ) +
    t12Field(
      "Bank of America Credit Card",
      D.acctPayable.bofaCC.y1,
      D.acctPayable.bofaCC.y2,
      2,
    ) +
    t12Field(
      "Mortgage Payable",
      D.acctPayable.mortgagePayable.y1,
      D.acctPayable.mortgagePayable.y2,
      2,
      { debt: true },
    ) +
    t12AddBtn("acctpayable");

  // ── TOTAL ADJUSTMENTS body ────────────────────────────────
  var adjBody =
    '<div class="t12-field t12-lvl1"><span class="t12-field-lbl" style="color:var(--muted);font-size:11px">TOTAL ACCOUNTS PAYABLE</span>' +
    '<span class="t12-field-val" style="color:var(--muted)">' +
    t12Amt(
      D.acctPayable.totalAcctPayable.y1,
      D.acctPayable.totalAcctPayable.y2,
    ) +
    "</span></div>" +
    t12Div() +
    t12Sec(zh ? "成员出资与分配" : "MEMBER CONTRIBUTIONS & DISTRIBUTIONS") +
    '<div class="t12-field t12-lvl2"><span class="t12-field-lbl">Member Contributions (21 members)</span>' +
    '<span class="t12-field-val">' +
    t12Amt(1877417, 939418) +
    "</span></div>" +
    t12Field("Owner Distribution", -457296, -144038, 2) +
    t12Field("Member Dist. - Ho Ruiming", -37817, 0, 2) +
    t12Field("Member Dist. - Richard Ke", -100000, 0, 2) +
    t12Div() +
    t12Sec(zh ? "留存收益" : "RETAINED EARNINGS (Cards above)") +
    '<div class="t12-field t12-lvl2"><span class="t12-field-lbl">Retained Earnings</span>' +
    '<span class="t12-field-val">' +
    t12Amt(D.retainedEarnings.y1, D.retainedEarnings.y2) +
    "</span></div>" +
    '<div class="t12-field t12-lvl2"><span class="t12-field-lbl">Prior Years Retained Earnings</span>' +
    '<span class="t12-field-val">' +
    t12Amt(D.priorYearsRE.y1, D.priorYearsRE.y2) +
    "</span></div>";

  // ── Card builder helpers ──────────────────────────────────
  var icoIncome =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" style="width:18px;height:18px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
  var icoExp =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--red,#c0392b)" stroke-width="2" style="width:18px;height:18px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
  var icoNet =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
  var icoCash =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" style="width:16px;height:16px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>';
  var icoRE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--amber,#8b6a2e)" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
  var icoPrior =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" style="width:16px;height:16px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>';
  var icoAP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" style="width:18px;height:18px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
  var icoAdj =
    '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" style="width:18px;height:18px"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
  var icoCF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';

  function mkCard(id, ico, bg, title, y1t, y2t, body) {
    var v = _t12Year === "y1" ? y1t : y2t;
    return (
      '<div class="t12-card" id="t12c-' +
      id +
      '">' +
      '<div class="t12-card-header" onclick="toggleT12Card(\'' +
      id +
      "')\">" +
      '<div class="t12-card-icon" style="background:' +
      bg +
      '">' +
      ico +
      "</div>" +
      '<div class="t12-card-meta"><div class="t12-card-title">' +
      title +
      "</div></div>" +
      '<div class="t12-card-total' +
      (v < 0 ? " neg" : "") +
      '">' +
      t12Amt(y1t, y2t, "card-total-amt") +
      "</div>" +
      '<svg class="t12-chevron" id="t12chev-' +
      id +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
      "</div>" +
      '<div class="t12-card-body" id="t12b-' +
      id +
      '" style="display:none">' +
      body +
      "</div>" +
      "</div>"
    );
  }

  function mkHL(ico, bg, icoColor, title, y1t, y2t, note, hlCls) {
    var v = _t12Year === "y1" ? y1t : y2t;
    var icoStyled = ico.replace(
      'stroke="currentColor"',
      'stroke="' + icoColor + '"',
    );
    return (
      '<div class="t12-card t12-card-standalone t12-card-highlight ' +
      hlCls +
      '">' +
      '<div class="t12-card-header">' +
      '<div class="t12-card-icon" style="background:' +
      bg +
      '">' +
      icoStyled +
      "</div>" +
      '<div class="t12-card-meta"><div class="t12-card-title">' +
      title +
      "</div>" +
      (note ? '<div class="t12-formula-note">' + note + "</div>" : "") +
      "</div>" +
      '<div class="t12-card-total" style="font-size:22px;color:' +
      (v < 0 ? "var(--red,#c0392b)" : "var(--green)") +
      '">' +
      t12Amt(y1t, y2t, "card-total-amt") +
      "</div>" +
      "</div></div>"
    );
  }

  function mkSm(ico, bg, title, y1t, y2t, note) {
    var v = _t12Year === "y1" ? y1t : y2t;
    return (
      '<div class="t12-card t12-card-standalone t12-card-sm">' +
      '<div class="t12-card-header">' +
      '<div class="t12-card-icon" style="background:' +
      bg +
      '">' +
      ico +
      "</div>" +
      '<div class="t12-card-meta"><div class="t12-card-title">' +
      title +
      "</div>" +
      (note ? '<div class="t12-formula-note">' + note + "</div>" : "") +
      "</div>" +
      '<div class="t12-card-total' +
      (v < 0 ? " neg" : "") +
      '">' +
      t12Amt(y1t, y2t, "card-total-amt") +
      "</div>" +
      "</div></div>"
    );
  }

  function mkSmExp(id, ico, bg, title, y1t, y2t, note, body) {
    var v = _t12Year === "y1" ? y1t : y2t;
    return (
      '<div class="t12-card t12-card-sm" id="t12c-' +
      id +
      '">' +
      '<div class="t12-card-header" onclick="toggleT12Card(\'' +
      id +
      "')\">" +
      '<div class="t12-card-icon" style="background:' +
      bg +
      '">' +
      ico +
      "</div>" +
      '<div class="t12-card-meta"><div class="t12-card-title">' +
      title +
      "</div>" +
      (note ? '<div class="t12-formula-note">' + note + "</div>" : "") +
      "</div>" +
      '<div class="t12-card-total' +
      (v < 0 ? " neg" : "") +
      '">' +
      t12Amt(y1t, y2t, "card-total-amt") +
      "</div>" +
      '<svg class="t12-chevron" id="t12chev-' +
      id +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
      "</div>" +
      '<div class="t12-card-body" id="t12b-' +
      id +
      '" style="display:none">' +
      body +
      "</div>" +
      "</div>"
    );
  }

  var ni = _t12Year === "y1" ? D.netIncome.y1 : D.netIncome.y2;
  var cf = _t12Year === "y1" ? D.cashFlow.y1 : D.cashFlow.y2;

  return (
    yearBar +
    '<div class="t12-cards">' +
    mkCard(
      "income",
      icoIncome,
      "rgba(74,124,89,0.1)",
      zh ? "收入" : "INCOME",
      D.income.totalRevenue.y1,
      D.income.totalRevenue.y2,
      incBody,
    ) +
    mkCard(
      "expenses",
      icoExp,
      "rgba(192,57,43,0.1)",
      zh ? "支出" : "EXPENSES",
      D.expenses.totalExpenses.y1,
      D.expenses.totalExpenses.y2,
      expBody,
    ) +
    mkHL(
      icoNet,
      "rgba(74,124,89,0.1)",
      ni >= 0 ? "var(--green)" : "var(--red,#c0392b)",
      zh ? "净收益" : "NET INCOME",
      D.netIncome.y1,
      D.netIncome.y2,
      "TOTAL REVENUE \u2212 TOTAL EXPENSES",
      ni >= 0 ? "green" : "red",
    ) +
    '<div class="t12-cards-row">' +
    mkSmExp(
      "cash",
      icoCash,
      "rgba(74,101,133,0.1)",
      zh ? "现金合计" : "TOTAL CASH",
      D.cash.totalCash.y1,
      D.cash.totalCash.y2,
      zh ? "5项现金账户" : "5 cash accounts",
      cashBody,
    ) +
    mkSm(
      icoRE,
      "rgba(139,106,46,0.1)",
      zh ? "留存收益" : "RETAINED EARNINGS",
      D.retainedEarnings.y1,
      D.retainedEarnings.y2,
      zh ? "本期留存净收益" : "Current period retained",
    ) +
    mkSm(
      icoPrior,
      "rgba(0,0,0,0.05)",
      zh ? "历年留存" : "PRIOR YEARS RE",
      D.priorYearsRE.y1,
      D.priorYearsRE.y2,
      zh ? "历史累计留存" : "Historical accumulated",
    ) +
    "</div>" +
    mkCard(
      "acctpayable",
      icoAP,
      "rgba(74,101,133,0.08)",
      zh ? "应付账款合计" : "TOTAL ACCOUNTS PAYABLE",
      D.acctPayable.totalAcctPayable.y1,
      D.acctPayable.totalAcctPayable.y2,
      apBody,
    ) +
    mkCard(
      "adjustments",
      icoAdj,
      "rgba(0,0,0,0.05)",
      zh ? "调整合计" : "TOTAL ADJUSTMENTS",
      D.totalAdjustments.y1,
      D.totalAdjustments.y2,
      adjBody,
    ) +
    mkHL(
      icoCF,
      "rgba(74,101,133,0.1)",
      cf >= 0 ? "var(--blue)" : "var(--red,#c0392b)",
      zh ? "现金流" : "CASH FLOW",
      D.cashFlow.y1,
      D.cashFlow.y2,
      "NET INCOME + TOTAL ADJUSTMENTS",
      cf >= 0 ? "green" : "red",
    ) +
    (function () {
      // ── BANK RECONCILIATION card ──
      if (!D.bankRecon) return "";
      var icoBank =
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" style="width:18px;height:18px"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="8" y1="10" x2="8" y2="21"/><line x1="12" y1="10" x2="12" y2="21"/><line x1="16" y1="10" x2="16" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/></svg>';
      function reconAcct(name, data) {
        var b1 = data.begin.y1,
          b2 = data.begin.y2,
          e1 = data.end.y1,
          e2 = data.end.y2;
        var d1 = e1 - b1,
          d2 = e2 - b2;
        return (
          t12Sec(name) +
          t12Field("Beginning Balance", b1, b2, 2) +
          t12Field("Ending Balance", e1, e2, 2) +
          t12Sub("Difference", d1, d2) +
          t12Div()
        );
      }
      var reconBody =
        reconAcct("Operating Cash", D.bankRecon.operatingCash) +
        reconAcct("Secondary Checking", D.bankRecon.secChecking) +
        reconAcct("Other Checking", D.bankRecon.otherChecking) +
        reconAcct("Cash-Security Deposit", D.bankRecon.securityDeposit);
      return mkCard(
        "bankrecon",
        icoBank,
        "rgba(0,0,0,0.04)",
        zh ? "银行对账" : "BANK RECONCILIATION",
        0,
        0,
        reconBody,
      );
    })() +
    "</div>"
  );
}

function toggleT12Card(id) {
  var body = document.getElementById("t12b-" + id);
  var chev = document.getElementById("t12chev-" + id);
  if (!body) return;
  var open = body.style.display !== "none";
  body.style.display = open ? "none" : "";
  if (chev) chev.classList.toggle("open", !open);
}

function switchT12Year(yr) {
  _t12Year = yr;
  document.querySelectorAll(".t12-yr-btn").forEach(function (b) {
    b.classList.toggle(
      "active",
      b.getAttribute("onclick").indexOf("'" + yr + "'") > -1,
    );
  });
  document.querySelectorAll(".t12-amt").forEach(function (el) {
    var v = yr === "y1" ? parseFloat(el.dataset.y1) : parseFloat(el.dataset.y2);
    if (isNaN(v)) return;
    el.textContent = t12Fmt(v);
    el.classList.toggle("neg", v < 0);
    el.classList.toggle("zero-val", v === 0);
    var f = el.closest(".t12-field");
    if (f) f.classList.toggle("zero", v === 0);
    var tot = el.closest(".t12-card-total");
    if (tot) tot.classList.toggle("neg", v < 0);
  });
}

// ── Shared edit-mode icon snippets ────────────────────────────
var _icoEdit =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
var _icoDone =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><polyline points="20 6 9 17 4 12"/></svg>';

// ── Global Edit Mode (project-wide) ───────────────────────────
function toggleGlobalEditMode() {
  _globalEditMode = !_globalEditMode;
  _t12EditMode = _globalEditMode;
  _rrEditMode = _globalEditMode;
  _debtEditMode = _globalEditMode;
  _pfEditMode = _globalEditMode;
  pfEditMode = _globalEditMode;
  var zh = currentLang === "zh";
  var btn = document.getElementById("globalEditToggleBtn");
  var lbl = document.getElementById("globalEditToggleLabel");
  var page = document.getElementById("page-project-detail");
  if (btn) {
    if (_globalEditMode) {
      btn.style.background = "var(--green)";
      btn.style.borderColor = "var(--green)";
      btn.style.color = "white";
    } else {
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
    }
  }
  if (lbl)
    lbl.textContent = _globalEditMode
      ? zh
        ? "完成编辑"
        : "Done Editing"
      : zh
        ? "编辑模式"
        : "Edit Mode";
  if (page) page.classList.toggle("edit-mode", _globalEditMode);
  // Propagate to modules that use CSS class toggling
  var t12 = document.getElementById("t12ParsedContent");
  var rr = document.getElementById("rrParsedContent");
  var debt = document.getElementById("proj-tab-debt");
  if (t12) t12.classList.toggle("t12-edit-active", _globalEditMode);
  if (rr) rr.classList.toggle("rr-edit-active", _globalEditMode);
  if (debt) debt.classList.toggle("debt-edit-active", _globalEditMode);
  // Rebuild PF table so cells render correctly
  if (typeof buildPFTable === "function") buildPFTable();
  if (typeof updatePFEditLog === "function") updatePFEditLog();
  if (!_globalEditMode) toast(zh ? "编辑模式已关闭" : "Edit mode off");
}
// Per-module toggles all delegate to global
function toggleT12EditMode() {
  toggleGlobalEditMode();
}
function toggleRREditMode() {
  toggleGlobalEditMode();
}
function toggleDebtEditMode() {
  toggleGlobalEditMode();
}

// ── T12 inline edit ────────────────────────────────────────────
function t12EditClick(el) {
  if (!_globalEditMode) return;
  var yr = _t12Year;
  var curVal = parseFloat(yr === "y1" ? el.dataset.y1 : el.dataset.y2) || 0;
  var inp = document.createElement("input");
  inp.type = "number";
  inp.value = curVal;
  inp.className = "t12-inline-input";
  inp.style.width =
    Math.max(65, String(Math.abs(Math.round(curVal))).length * 9 + 24) + "px";
  el.parentNode.replaceChild(inp, el);
  inp.focus();
  inp.select();
  function commit() {
    var v = parseFloat(inp.value);
    if (!isNaN(v)) {
      if (yr === "y1") el.dataset.y1 = v;
      else el.dataset.y2 = v;
      el.textContent = t12Fmt(v);
      el.classList.toggle("neg", v < 0);
      el.classList.toggle("zero-val", v === 0);
    }
    if (inp.parentNode) inp.parentNode.replaceChild(el, inp);
  }
  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      if (inp.parentNode) inp.parentNode.replaceChild(el, inp);
    }
  });
}

// ── Rent Roll inline edit ──────────────────────────────────────
function rrCellEdit(el) {
  if (!_globalEditMode) return;
  var raw =
    el.dataset.rrRaw !== undefined
      ? el.dataset.rrRaw
      : el.textContent.replace(/[$,+\s]/g, "").trim();
  var isNum = el.dataset.rrType === "num";
  var inp = document.createElement("input");
  inp.type = isNum ? "number" : "text";
  inp.value = raw;
  inp.className = "rr-inline-input";
  el.innerHTML = "";
  el.appendChild(inp);
  inp.focus();
  inp.select();
  function commit() {
    var v = inp.value.trim() || raw;
    el.dataset.rrRaw = v;
    if (isNum) {
      var n = parseFloat(v) || 0;
      el.innerHTML = "$" + n.toLocaleString();
    } else el.textContent = v;
  }
  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      inp.blur();
    }
    if (e.key === "Escape") {
      el.innerHTML = isNum
        ? "$" + (parseFloat(raw) || 0).toLocaleString()
        : raw;
    }
  });
}

// ── Debt inline edit ───────────────────────────────────────────
function debtCellEdit(el) {
  if (!_globalEditMode) return;
  var raw = el.dataset.debtRaw || el.textContent.trim();
  var inp = document.createElement("input");
  inp.type = "text";
  inp.value = raw;
  inp.className = "debt-inline-input";
  el.innerHTML = "";
  el.appendChild(inp);
  inp.focus();
  inp.select();
  function commit() {
    var v = inp.value.trim() || raw;
    el.dataset.debtRaw = v;
    el.textContent = v;
  }
  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      inp.blur();
    }
    if (e.key === "Escape") {
      el.textContent = raw;
    }
  });
}

// ── Debt data storage ─────────────────────────────────────────
function handleDebtUpload(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  var pid = currentProjectId;

  // Store original file as dataUrl for preview
  var previewReader = new FileReader();
  previewReader.onload = function (e) {
    // Store in project files for preview
    var proj = getProjects().find(function (p) {
      return p.id === pid;
    });
    if (proj) {
      if (!proj.files) proj.files = [];
      // Remove old Debt files and their stored data
      proj.files.forEach(function (f) {
        if (f.type === "Debt" || f.parsedAs === "Debt") {
          try {
            localStorage.removeItem("file_data_" + f.id);
          } catch (e) {}
        }
      });
      proj.files = proj.files.filter(function (f) {
        return f.type !== "Debt";
      });
      var debtFileId = "f" + Date.now();
      proj.files.push({
        id: debtFileId,
        name: file.name,
        size: file.size,
        type: "Debt",
        parsedAs: "Debt",
        date: new Date().toLocaleDateString(),
        status: "parsed",
      });
      saveProjects(
        getProjects().map(function (p) {
          return p.id === proj.id ? proj : p;
        }),
      );
      try {
        localStorage.setItem("file_data_" + debtFileId, e.target.result);
      } catch (err) {
        console.warn("[Debt preview] localStorage quota exceeded");
      }
    }
  };
  previewReader.readAsDataURL(file);

  // Parse debt data
  var parseReader = new FileReader();
  parseReader.onload = function (e) {
    try {
      _parseDebtFromXlsx(e.target.result, pid);
      // Recompute ProForma with new debt data
      if (_getT12Data(pid)) _t12ToPFData(pid);
      buildDebtAnalysis();
      buildPFTable();
      toast(
        currentLang === "zh"
          ? "债务数据已上传并解析"
          : "Debt data uploaded and parsed",
        "success",
      );
      _updateDebtUI();
      updateTabDots();
    } catch (err) {
      toast("Parse error: " + err.message, "error");
    }
  };
  parseReader.readAsArrayBuffer(file);
  var debtInputEl = document.getElementById("debtFileInput");
  if (debtInputEl) debtInputEl.value = "";
}
function handleDebtDrop(evt) {
  var file =
    evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files[0];
  if (file) handleDebtUpload({ target: { files: [file] } });
}
window.handleDebtDrop = handleDebtDrop;

function _updateDebtUI() {
  var pid = currentProjectId;
  var proj = getProjects().find(function (p) {
    return p.id === pid;
  });
  var f =
    proj &&
    (proj.files || []).find(function (x) {
      return (x.parsedAs || x.type) === "Debt";
    });
  var zh = currentLang === "zh";
  var infoEl = document.getElementById("debtFileInfo");
  var dz = document.getElementById("debtDropZone");
  var delBtn = document.getElementById("debtDeleteBtn");
  var upLabel = document.getElementById("debtUploadBtnLabel");
  var pc = document.getElementById("debtParsedContent");
  if (f) {
    if (infoEl)
      infoEl.textContent =
        f.name +
        " · " +
        (f.size ? Math.round(f.size / 1024) + "KB · " : "") +
        (zh ? "已解析" : "Parsed");
    if (dz) dz.style.display = "none";
    if (delBtn) delBtn.style.display = "";
    if (upLabel) upLabel.textContent = zh ? "替换文件" : "Replace File";
    if (pc) {
      pc.style.display = "";
      pc.innerHTML = _buildFilePreviewCard(f);
    }
  } else {
    if (infoEl)
      infoEl.textContent = zh
        ? "未上传文件 · Debt Current & Refinance"
        : "No file uploaded · Debt Current & Refinance";
    if (dz) dz.style.display = "";
    if (delBtn) delBtn.style.display = "none";
    if (upLabel)
      upLabel.textContent = zh ? "上传债务文件" : "Upload Debt Excel";
    if (pc) {
      pc.style.display = "none";
      pc.innerHTML = "";
    }
  }
}
window._updateDebtUI = _updateDebtUI;

function clearDebtData() {
  var pid = currentProjectId;
  localStorage.removeItem("debt_data_" + pid);
  // Remove debt file from project
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (proj) {
    (proj.files || []).forEach(function (f) {
      if (
        ["Debt", "Debt Current", "Debt Refinance"].indexOf(
          f.parsedAs || f.type,
        ) !== -1
      ) {
        try {
          localStorage.removeItem("file_data_" + f.id);
        } catch (e) {}
      }
    });
    proj.files = (proj.files || []).filter(function (f) {
      return (
        (f.parsedAs || f.type) !== "Debt" &&
        (f.parsedAs || f.type) !== "Debt Current" &&
        (f.parsedAs || f.type) !== "Debt Refinance"
      );
    });
    saveProjects(projs);
  }
  _updateDebtUI();
  if (typeof buildDebtAnalysis === "function") buildDebtAnalysis();
  updateTabDots();
  toast(currentLang === "zh" ? "债务数据已删除" : "Debt data removed");
}
window.clearDebtData = clearDebtData;

function _getDebtData(pid) {
  try {
    return JSON.parse(localStorage.getItem("debt_data_" + pid) || "null");
  } catch (e) {
    return null;
  }
}
function _saveDebtData(pid, data) {
  localStorage.setItem("debt_data_" + pid, JSON.stringify(data));
}

// Build Debt Analysis page from parsed data or defaults
function buildDebtAnalysis() {
  var pid = window._currentProjectId || "default";
  var debtData = _getDebtData(pid);

  // Empty defaults when no data uploaded (all fields show "—")
  var _emptyDebt = {
    loanAmount: null,
    principal: null,
    interestPerAnnum: null,
    interestPerMonth: null,
    mortgageConstant: null,
    commencementDate: null,
    finalMaturityDate: null,
    durationYears: null,
    durationMonths: null,
    mortgageInsurancePremium: null,
    mortgageInsurancePremiumPerAnnum: null,
    mortgageInsurancePremiumPerMonth: null,
    annualMortgagePayments: null,
    interestPerYear: null,
    payment: null,
  };
  var current = (debtData && debtData.current) || Object.assign({}, _emptyDebt);
  var refi = (debtData && debtData.refi) || Object.assign({}, _emptyDebt);

  // Merge HD Financing Assumptions as fallback (only fill null fields)
  var deal = getHDDealAssumptions(pid);
  var hdFin = deal && deal._financing ? deal._financing : null;
  if (hdFin) {
    // Helper: get HD financing value
    function _hdF(label, col) {
      var row = hdFin[label];
      return row ? row[col] : null;
    }
    // Debt Current ← Financing column
    if (current.loanAmount == null) {
      var hdLoan = _hdF("Loan Amount", "financing");
      if (hdLoan) current.loanAmount = hdLoan;
    }
    if (current.principal == null && current.loanAmount)
      current.principal = current.loanAmount;
    if (current.interestPerAnnum == null) {
      var hdRate = _hdF("Interest Rate", "financing");
      if (hdRate != null) current.interestPerAnnum = hdRate * 100; // 0.065 → 6.5
    }
    if (current.durationMonths == null) {
      var hdAmort = _hdF("Amortization", "financing");
      if (hdAmort) {
        current.durationMonths = hdAmort;
        current.durationYears = Math.round(hdAmort / 12);
      }
    }
    // Debt Refinance ← Refi Loan column
    if (refi.loanAmount == null) {
      var hdRefiLoan = _hdF("Loan Amount", "refiLoan");
      if (hdRefiLoan) refi.loanAmount = hdRefiLoan;
    }
    if (refi.principal == null && refi.loanAmount)
      refi.principal = refi.loanAmount;
    if (refi.interestPerAnnum == null) {
      var hdRefiRate = _hdF("Interest Rate", "refiLoan");
      if (hdRefiRate != null) refi.interestPerAnnum = hdRefiRate * 100;
    }
    if (refi.durationMonths == null) {
      var hdRefiAmort = _hdF("Amortization", "refiLoan");
      if (hdRefiAmort) {
        refi.durationMonths = hdRefiAmort;
        refi.durationYears = Math.round(hdRefiAmort / 12);
      }
    }
  }

  // Recompute derived values after HD merge
  [current, refi].forEach(function (d) {
    if (d.interestPerAnnum && !d.interestPerMonth)
      d.interestPerMonth = d.interestPerAnnum / 12;
    if (d.durationYears && !d.durationMonths)
      d.durationMonths = d.durationYears * 12;
    if (!d.mortgageConstant && d.interestPerMonth && d.durationMonths) {
      var im = d.interestPerMonth / 100; // convert from pct to decimal
      d.mortgageConstant = im / (1 - Math.pow(1 + im, -d.durationMonths));
    }
    if (!d.annualMortgagePayments && d.mortgageConstant && d.principal) {
      d.annualMortgagePayments =
        Math.round(d.mortgageConstant * d.principal * 12 * 100) / 100;
    }
    if (!d.interestPerYear && d.principal && d.interestPerAnnum) {
      d.interestPerYear =
        Math.round(d.principal * (d.interestPerAnnum / 100) * 100) / 100;
    }
  });

  // Null-safe formatters
  function _fmtPctDebt(v, suffix) {
    if (v === null || v === undefined) return "—";
    return (
      Number(v).toFixed(
        suffix === "/mo" ? 4 : String(v).indexOf(".") > -1 ? 4 : 2,
      ) +
      "%" +
      (suffix || "")
    );
  }
  function _fmtValDebt(v) {
    if (v === null || v === undefined) return "—";
    return String(v);
  }

  // Render Current Debt card
  var curBody = document.getElementById("debtCurrentBody");
  if (curBody) {
    curBody.innerHTML = _debtRows([
      ["Loan Amount", _fmtCurrency(current.loanAmount), "dcLoanAmount"],
      ["Principal", _fmtCurrency(current.principal), "dcPrincipal"],
      [
        "Interest per Annum",
        _fmtPctDebt(current.interestPerAnnum),
        "dcInterestAnnum",
      ],
      [
        "Interest per Month",
        _fmtPctDebt(current.interestPerMonth),
        "dcInterestMonth",
      ],
      [
        "Mortgage Constant",
        _fmtPctDebt(current.mortgageConstant, "/mo"),
        "dcMortgageConst",
      ],
      [
        "Commencement Date",
        _fmtValDebt(current.commencementDate),
        "dcCommenceDate",
      ],
      [
        "Final Maturity Date",
        _fmtValDebt(current.finalMaturityDate),
        "dcMaturityDate",
      ],
      ["Duration (Years)", _fmtValDebt(current.durationYears), "dcDurationYrs"],
      [
        "Duration (Months)",
        _fmtValDebt(current.durationMonths),
        "dcDurationMos",
      ],
      ["Mortgage Insurance Premium", "", "_section"],
      [
        "MIP per Annum",
        _fmtCurrency(current.mortgageInsurancePremiumPerAnnum),
        "dcMIPAnnum",
      ],
      [
        "MIP per Month",
        _fmtCurrency(current.mortgageInsurancePremiumPerMonth),
        "dcMIPMonth",
      ],
      [
        "Annual Mortgage Payments",
        _fmtCurrency(current.annualMortgagePayments),
        "dcAnnualPayment",
        true,
      ],
      [
        "Interest per year Payment",
        _fmtCurrency(current.interestPerYear),
        "dcInterestYrPayment",
      ],
    ]);
  }

  // Render Refinance card
  var refiBody = document.getElementById("debtRefiBody");
  if (refiBody) {
    refiBody.innerHTML = _debtRows([
      ["Loan Amount", _fmtCurrency(refi.loanAmount), "drLoanAmount"],
      ["Principal", _fmtCurrency(refi.principal), "drPrincipal"],
      [
        "Interest per Annum",
        _fmtPctDebt(refi.interestPerAnnum),
        "drInterestAnnum",
      ],
      [
        "Interest per Month",
        _fmtPctDebt(refi.interestPerMonth),
        "drInterestMonth",
      ],
      [
        "Mortgage Constant",
        _fmtPctDebt(refi.mortgageConstant, "/mo"),
        "drMortgageConst",
      ],
      [
        "Commencement Date",
        _fmtValDebt(refi.commencementDate),
        "drCommenceDate",
      ],
      [
        "Final Maturity Date",
        _fmtValDebt(refi.finalMaturityDate),
        "drMaturityDate",
      ],
      ["Duration (Years)", _fmtValDebt(refi.durationYears), "drDurationYrs"],
      ["Duration (Months)", _fmtValDebt(refi.durationMonths), "drDurationMos"],
      ["Mortgage Insurance Premium", "", "_section"],
      [
        "MIP per Annum",
        _fmtCurrency(refi.mortgageInsurancePremiumPerAnnum),
        "drMIPAnnum",
      ],
      [
        "MIP per Month",
        _fmtCurrency(refi.mortgageInsurancePremiumPerMonth),
        "drMIPMonth",
      ],
      [
        "Annual Mortgage Payments",
        _fmtCurrency(refi.annualMortgagePayments),
        "drAnnualPayment",
        true,
      ],
      [
        "I/O",
        refi.interestPerAnnum != null && refi.principal != null
          ? _fmtCurrency(
              Math.round((refi.interestPerAnnum / 100) * refi.principal),
            )
          : "—",
        "drIO",
      ],
    ]);
  }

  // Update PF_DATA.debt dynamically (only if data exists)
  var dsY1to3 = current.annualMortgagePayments || 0;
  var dsY4to7 = refi.annualMortgagePayments || 0;
  PF_DATA.debt = [
    dsY1to3,
    dsY1to3,
    dsY1to3,
    dsY4to7,
    dsY4to7,
    dsY4to7,
    dsY4to7,
  ];

  // Render Year-by-Year DSCR table
  var dscrBody = document.getElementById("debtDscrBody");
  if (dscrBody) {
    var _hasDebtData = debtData && (debtData.current || debtData.refi);
    var noi =
      _hasDebtData || _pfLoaded ? window._noiTotals || PF_DATA.noi || [] : [];
    var _dAY =
      typeof getProjectAssumptions === "function"
        ? getProjectAssumptions().acquisitionYear || 2026
        : 2026;
    var periods = [];
    for (var _pi = 0; _pi < 7; _pi++) {
      var _yr = _dAY - 2 + _pi;
      if (_pi === 2) {
        periods.push("Stabilized");
      } else {
        periods.push(
          "Nov'" +
            String(_yr - 1).slice(2) +
            "\u2013Oct'" +
            String(_yr).slice(2),
        );
      }
    }
    var html = "";
    for (var i = 0; i < 7; i++) {
      var noiVal = noi[i] || 0;
      var ds = i < 3 ? dsY1to3 : dsY4to7;
      if (isNaN(noiVal)) noiVal = 0;
      if (isNaN(ds)) ds = 0;
      var dscr = ds > 0 ? noiVal / ds : 0;
      var cf = noiVal - ds;
      var isStab = i === 2;
      var debtType =
        i < 3
          ? '<span class="badge badge-t12" style="font-size:10px">Existing</span>'
          : '<span class="badge badge-rentcast" style="font-size:10px">Refi</span>';
      var dscrColor =
        dscr === 0
          ? "var(--muted)"
          : dscr >= 1.25
            ? "var(--green)"
            : dscr >= 1.0
              ? "#E65100"
              : "var(--red)";
      var cfColor =
        cf === 0 ? "var(--muted)" : cf > 0 ? "var(--green)" : "var(--red)";
      var cfText =
        cf === 0
          ? "\u2014"
          : cf > 0
            ? "+$" + Math.abs(Math.round(cf)).toLocaleString()
            : "\u2013$" + Math.abs(Math.round(cf)).toLocaleString();
      var rowStyle = isStab ? ' style="background:rgba(0,0,0,0.015)"' : "";
      var label = isStab ? "<strong>" + periods[i] + "</strong>" : periods[i];
      var noiText =
        noiVal === 0
          ? "\u2014"
          : isStab
            ? "<strong>$" + Math.round(noiVal).toLocaleString() + "</strong>"
            : "$" + Math.round(noiVal).toLocaleString();
      var dsText = ds === 0 ? "\u2014" : "$" + Math.round(ds).toLocaleString();
      var dscrText = dscr === 0 ? "\u2014" : dscr.toFixed(2) + "\u00d7";
      html +=
        "<tr" +
        rowStyle +
        ">" +
        "<td>" +
        label +
        "</td>" +
        "<td>" +
        noiText +
        "</td>" +
        "<td>" +
        dsText +
        "</td>" +
        '<td style="color:' +
        dscrColor +
        ";font-weight:" +
        (isStab ? "700" : "600") +
        '">' +
        dscrText +
        "</td>" +
        "<td>" +
        debtType +
        "</td>" +
        '<td style="color:' +
        cfColor +
        (isStab ? ";font-weight:600" : "") +
        '">' +
        cfText +
        "</td>" +
        "</tr>";
    }
    dscrBody.innerHTML = html;
  }
}

function _debtRows(fields) {
  var html = "";
  fields.forEach(function (f) {
    if (f[2] === "_section") {
      // Section header row
      html +=
        '<tr><td colspan="2" style="font-weight:700;color:var(--header);padding-top:10px;font-size:11px">' +
        f[0] +
        "</td></tr>";
      return;
    }
    var bold = f[3] ? ";font-weight:600" : "";
    html +=
      '<tr><td style="color:var(--muted)">' +
      f[0] +
      "</td>" +
      '<td style="text-align:right' +
      bold +
      '" data-debt-field="' +
      f[2] +
      '" onclick="debtCellEdit(this)">' +
      f[1] +
      "</td></tr>";
  });
  return html;
}

function _fmtCurrency(v) {
  if (v === null || v === undefined) return "—";
  var n = Number(v);
  if (isNaN(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0) return "-$" + Math.abs(Math.round(n)).toLocaleString();
  return "$" + Math.round(n).toLocaleString();
}

function showT12AddForm(cardId) {
  var c = document.getElementById("t12af-" + cardId);
  if (!c) return;
  if (c.innerHTML) {
    c.innerHTML = "";
    return;
  }
  var zh = currentLang === "zh";
  // Build section picker from the card body's actual rendered section labels (language-agnostic)
  var body = document.getElementById("t12b-" + cardId);
  var secEls = body ? body.querySelectorAll(".t12-section-lbl") : [];
  var selectHtml = "";
  if (secEls.length > 0) {
    selectHtml =
      '<div class="t12-add-sec-row">' +
      '<span class="t12-add-sec-lbl">' +
      (zh ? "层级" : "Section") +
      "</span>" +
      '<select id="t12afs-' +
      cardId +
      '" class="t12-sec-select">' +
      Array.from(secEls)
        .map(function (el) {
          var t = el.textContent.trim();
          return '<option value="' + t + '">' + t + "</option>";
        })
        .join("") +
      "</select></div>";
  }
  c.innerHTML =
    '<div class="t12-add-form">' +
    selectHtml +
    '<div class="t12-add-form-row">' +
    '<input id="t12afn-' +
    cardId +
    '" type="text" placeholder="' +
    (zh ? "字段名称" : "Field name") +
    '"/>' +
    '<input id="t12afv-' +
    cardId +
    '" type="number" class="amt-input" placeholder="0"/>' +
    '<div class="t12-add-form-btns">' +
    '<button class="t12-add-confirm" onclick="confirmT12AddField(\'' +
    cardId +
    "')\">" +
    (zh ? "确认" : "Add") +
    "</button>" +
    '<button class="t12-add-cancel" onclick="document.getElementById(\'t12af-' +
    cardId +
    "').innerHTML=''\">" +
    (zh ? "取消" : "Cancel") +
    "</button>" +
    "</div></div></div>";
  setTimeout(function () {
    var i = document.getElementById("t12afn-" + cardId);
    if (i) i.focus();
  }, 50);
}

function confirmT12AddField(cardId) {
  var n = document.getElementById("t12afn-" + cardId);
  var v = document.getElementById("t12afv-" + cardId);
  var s = document.getElementById("t12afs-" + cardId); // section select (null for flat cards)
  if (!n || !v) return;
  var name = n.value.trim(),
    val = parseFloat(v.value) || 0;
  if (!name) {
    n.focus();
    return;
  }
  var body = document.getElementById("t12b-" + cardId);
  var c = document.getElementById("t12af-" + cardId);
  if (!body || !c) return;
  var zh = currentLang === "zh";
  var row = document.createElement("div");
  row.className = "t12-field t12-lvl2" + (val === 0 ? " zero" : "");
  row.innerHTML =
    '<span class="t12-field-lbl">' +
    name +
    ' <span class="t12-badge t12-badge-custom">' +
    (zh ? "自定义" : "custom") +
    "</span></span>" +
    '<span class="t12-field-val' +
    (val < 0 ? " neg" : "") +
    '">' +
    t12Fmt(val) +
    "</span>";
  // Insert before the subtotal row of the selected section
  var inserted = false;
  if (s && s.value) {
    var secLbls = body.querySelectorAll(".t12-section-lbl");
    for (var i = 0; i < secLbls.length; i++) {
      if (secLbls[i].textContent.trim() === s.value) {
        var el = secLbls[i].nextElementSibling;
        while (el) {
          if (
            el.classList.contains("t12-subtotal-row") ||
            el.classList.contains("t12-divider")
          ) {
            body.insertBefore(row, el);
            inserted = true;
            break;
          }
          el = el.nextElementSibling;
        }
        break;
      }
    }
  }
  if (!inserted) {
    var addRow = body.querySelector(".t12-add-row");
    body.insertBefore(row, addRow || null);
  }
  c.innerHTML = "";
  toast(
    (zh ? "已添加字段：" : "Field added: ") +
      name +
      (s && s.value ? " → " + s.value : ""),
  );
}

function applyT12ToProForma() {
  var zh = currentLang === "zh";
  loadDemoProForma();
  switchProjTab("proforma", document.getElementById("ptab-proforma"));
  toast(
    zh
      ? "T12 数据已映射至 Pro-forma，高亮字段为来源标注"
      : "T12 data applied to Pro-forma — highlighted fields show source",
  );
}

function handleRRUpload(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  // Read/write projects directly via localStorage (avoids ES-module closure issues)
  var pid = window._currentProjectId || currentProjectId;
  if (!pid) {
    toast("No active project", "error");
    return;
  }
  var projs = JSON.parse(localStorage.getItem("glcapital_projects") || "[]");
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (!proj) {
    toast("No active project", "error");
    return;
  }
  if (!proj.files) proj.files = [];
  // Remove old RR files and their stored data
  proj.files.forEach(function (f) {
    if (f.type === "Rent Roll" || f.parsedAs === "Rent Roll") {
      try {
        localStorage.removeItem("file_data_" + f.id);
      } catch (e) {}
    }
  });
  proj.files = proj.files.filter(function (f) {
    return f.type !== "Rent Roll" && f.parsedAs !== "Rent Roll";
  });
  var fileId = "f" + Date.now();
  proj.files.push({
    id: fileId,
    name: file.name,
    size: file.size,
    type: "Rent Roll",
    parsedAs: "Rent Roll",
    date: new Date().toLocaleDateString(),
    status: "parsed",
  });
  localStorage.setItem("glcapital_projects", JSON.stringify(projs));

  // Store original file as dataUrl for preview (separate key to avoid quota)
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      localStorage.setItem("file_data_" + fileId, e.target.result);
    } catch (err) {
      console.warn(
        "[RR preview] localStorage quota exceeded, preview may not work",
      );
    }
    var p2 = getProjects().find(function (p) {
      return p.id === pid;
    });
    if (p2) {
      _updateRRUI(p2);
      renderRRParsed(p2);
    }
  };
  reader.readAsDataURL(file);

  // Parse xlsx — detect all sheets (T12, RR, Debt) and parse accordingly
  var parseReader = new FileReader();
  parseReader.onload = function (e) {
    try {
      var parsed = _parseUnderwritingXlsx(e.target.result, pid);
      if (parsed.t12) _pfLoaded = true;
      renderRentRoll();
      buildPFUnitMix();
      buildPFTable();
      if (parsed.debt && typeof buildDebtAnalysis === "function")
        buildDebtAnalysis();
      // Refresh Summary tab: dual-source cells + KPI strip
      var _p = JSON.parse(
        localStorage.getItem("glcapital_projects") || "[]",
      ).find(function (x) {
        return x.id === pid;
      });
      if (typeof populateSummary === "function") populateSummary();
      // Refresh Upload Files UI
      var _projAfterParse = getProjects().find(function (p) {
        return p.id === pid;
      });
      if (_projAfterParse) {
        _updateRRUI(_projAfterParse);
        renderRRParsed(_projAfterParse);
      }
      var msg =
        currentLang === "zh"
          ? "租户清单已上传并解析" +
            (parsed.t12 ? " (含T12)" : "") +
            (parsed.debt ? " (含Debt)" : "")
          : "Rent Roll uploaded & parsed" +
            (parsed.t12 ? " + T12" : "") +
            (parsed.debt ? " + Debt" : "");
      toast(msg, "success");
      updateTabDots();
    } catch (err) {
      console.error("[RR parse]", err);
      toast("Parse error: " + err.message, "error");
    }
  };
  parseReader.readAsArrayBuffer(file);

  _updateRRUI(proj);
  // Reset file input to allow re-uploading the same file
  var rrInputEl = document.getElementById("rrInput");
  if (rrInputEl) rrInputEl.value = "";
}

function handleRRDrop(event) {
  const file =
    event.dataTransfer &&
    event.dataTransfer.files &&
    event.dataTransfer.files[0];
  if (!file) return;
  handleRRUpload({ target: { files: [file] } });
}

function deleteRR() {
  const proj = getProjects().find((p) => p.id === currentProjectId);
  if (!proj) return;
  (proj.files || []).forEach(function (f) {
    if (["Rent Roll"].includes(f.parsedAs || f.type)) {
      try {
        localStorage.removeItem("file_data_" + f.id);
      } catch (e) {}
    }
  });
  proj.files = (proj.files || []).filter(
    (f) => !["Rent Roll"].includes(f.parsedAs || f.type),
  );
  saveProjects(getProjects().map((p) => (p.id === proj.id ? proj : p)));
  renderRRTab(proj);
  toast(currentLang === "zh" ? "租户清单已删除" : "Rent Roll removed");
}

function renderRRTab(proj) {
  if (!proj) return;
  const zh = currentLang === "zh";
  const rrFile = (proj.files || []).find((f) =>
    ["Rent Roll"].includes(f.parsedAs || f.type),
  );
  const dropZone = document.getElementById("rrDropZone");
  const parsedContent = document.getElementById("rrParsedContent");
  const fileInfo = document.getElementById("rrFileInfo");
  const uploadBtnLabel = document.getElementById("rrUploadBtnLabel");
  const deleteBtn = document.getElementById("rrDeleteBtn");

  if (!rrFile) {
    if (dropZone) dropZone.style.display = "";
    if (parsedContent) parsedContent.style.display = "none";
    if (fileInfo)
      fileInfo.textContent = zh
        ? "未上传文件 · 仅限一个文件"
        : "No file uploaded · Single file only";
    if (uploadBtnLabel)
      uploadBtnLabel.textContent = zh ? "上传租户清单" : "Upload Rent Roll";
    if (deleteBtn) deleteBtn.style.display = "none";
    return;
  }

  if (dropZone) dropZone.style.display = "none";
  if (parsedContent) parsedContent.style.display = "";
  const sizeFmt = rrFile.size
    ? rrFile.size > 1024 * 1024
      ? (rrFile.size / 1024 / 1024).toFixed(1) + "MB"
      : (rrFile.size / 1024).toFixed(0) + "KB"
    : "";
  if (fileInfo)
    fileInfo.textContent =
      (zh ? "已上传：" : "Uploaded: ") +
      rrFile.name +
      (sizeFmt ? " · " + sizeFmt : "");
  if (uploadBtnLabel)
    uploadBtnLabel.textContent = zh ? "替换文件" : "Replace File";
  if (deleteBtn) deleteBtn.style.display = "";
  renderRRParsed(proj);
}

function renderRRParsedHTML() {
  // This function is unused — renderParsedRRTable handles RR display
  return "";
}

function resetProForma() {
  _pfLoaded = false;
  _pfManualEdits = {};
  _pfEditMode = false;
  // Reset global edit mode when changing project
  _globalEditMode = false;
  _t12EditMode = false;
  _rrEditMode = false;
  _debtEditMode = false;
  pfEditMode = false;
  var _geBtn = document.getElementById("globalEditToggleBtn");
  var _geLbl = document.getElementById("globalEditToggleLabel");
  if (_geBtn) {
    _geBtn.style.background = "";
    _geBtn.style.borderColor = "";
    _geBtn.style.color = "";
  }
  if (_geLbl) _geLbl.textContent = "Edit Mode";
  var _gePage = document.getElementById("page-project-detail");
  if (_gePage) _gePage.classList.remove("edit-mode");
  // Keep pfContent visible but re-render with empty data
  var empty = document.getElementById("pfEmptyState");
  if (empty) empty.style.display = "none";
  buildPFTable();
}

function loadDemoProForma() {
  _pfLoaded = true;
  var empty = document.getElementById("pfEmptyState");
  var content = document.getElementById("pfContent");
  if (empty) empty.style.display = "none";
  if (content) content.style.display = "";
  buildPFTable();
}

function pfCellEdit(key, label, col, currentVal) {
  if (!_globalEditMode) return;
  var numericVal = parseFloat(String(currentVal).replace(/[$,]/g, ""));
  var input = prompt(
    (currentLang === "zh" ? "编辑 " : "Edit: ") +
      label +
      " (" +
      col +
      ") " +
      (currentLang === "zh" ? "当前值：" : "Current: ") +
      currentVal,
    isNaN(numericVal) ? currentVal : numericVal,
  );
  if (input === null) return;
  var newNum = parseFloat(input.replace(/[$,]/g, ""));
  if (isNaN(newNum)) return;
  _pfManualEdits[key] = {
    label: label,
    col: col,
    oldVal: currentVal,
    newVal: newNum,
    ts: new Date().toLocaleString(),
  };
  buildPFTable();
  updatePFEditLog();
}

function updatePFEditLog() {
  var logDiv = document.getElementById("pfEditLog");
  var logList = document.getElementById("pfEditLogList");
  if (!logDiv || !logList) return;
  var keys = Object.keys(_pfManualEdits);
  if (!keys.length) {
    logDiv.style.display = "none";
    return;
  }
  logDiv.style.display = "";
  var zh = currentLang === "zh";
  logList.innerHTML = keys
    .map((k) => {
      var e = _pfManualEdits[k];
      var fmt = function (v) {
        return typeof v === "number" && Math.abs(v) > 100
          ? "$" + Math.round(v).toLocaleString()
          : v;
      };
      return (
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(139,115,85,0.07);border-radius:7px;border-left:3px solid var(--amber)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" style="width:12px;height:12px;flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:12px;font-weight:600;color:var(--header)">' +
        e.label +
        '  <span style="font-weight:400;color:var(--muted)">' +
        e.col +
        "</span></div>" +
        '<div style="font-size:11px;color:var(--muted);margin-top:1px"><span style="text-decoration:line-through">' +
        fmt(e.oldVal) +
        '</span> → <strong style="color:var(--amber)">' +
        fmt(e.newVal) +
        "</strong></div>" +
        "</div>" +
        '<div style="font-size:10px;color:var(--muted);flex-shrink:0">' +
        e.ts +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function exportPF() {
  toast(currentLang === "zh" ? "导出功能开发中" : "Export coming soon");
}

// ─── GL Capital: PF Edit Mode ────────────────────────────────────────────────
var pfOverrides = {}; // {fieldKey: {original, value, source, timestamp}}
var pfConflictChoices = {}; // {rowLabel: selectedSource}

// resolvePFConflict — defined later (line ~18858)

function togglePFEdit() {
  toggleGlobalEditMode();
}
function togglePFEditMode() {
  toggleGlobalEditMode();
}

function showConflictPicker(key, label, col) {
  var allRows = [
    ...(PF_DATA.revenue || []),
    ...(PF_DATA.expenses || []),
    ...(PF_DATA.debtService || []),
  ];
  var row = allRows.find(function (r) {
    return r.label === label || (r.zhLabel && r.zhLabel === label);
  });
  var zh = currentLang === "zh";
  if (!row) {
    var input = prompt(
      (zh ? "编辑值 " : "Edit value: ") + label + " (" + col + ")",
      "0",
    );
    if (input === null) return;
    var num = parseFloat(input.replace(/[$,]/g, ""));
    if (!isNaN(num)) {
      _pfManualEdits[key] = {
        label: label,
        col: col,
        oldVal: 0,
        newVal: num,
        ts: new Date().toLocaleString(),
      };
      buildPFTable();
    }
    return;
  }
  var dataVal = row[col] || 0;
  var srcList = (row.sources || ["T12"])
    .map(function (s, i) {
      return i + 1 + ". " + s;
    })
    .join("\n");
  var msg =
    (zh ? "数据冲突 — 选择数据来源：\n" : "Conflict — choose data source:\n") +
    srcList +
    "\n\n" +
    (zh ? "或直接输入自定义数值：" : "Or enter a custom value:");
  var input = prompt(msg, "" + Math.round(dataVal));
  if (input === null) return;
  var num = parseFloat(input.replace(/[$,]/g, ""));
  if (!isNaN(num)) {
    _pfManualEdits[key] = {
      label: label,
      col: col,
      oldVal: dataVal,
      newVal: num,
      ts: new Date().toLocaleString(),
    };
    buildPFTable();
  }
}

function openPFCellEdit(key, label, originalVal, currentVal, colName) {
  if (!_globalEditMode) return;
  loadPFOverrides(currentProjectId);
  const zh = currentLang === "zh";
  const existingOverride = pfOverrides[key];
  const diffPct =
    originalVal !== 0
      ? (((currentVal - originalVal) / Math.abs(originalVal)) * 100).toFixed(1)
      : 0;
  const hasDiff = existingOverride && existingOverride.value !== originalVal;
  openModal(`
    <div class="modal-header">
      <div class="modal-title" style="display:flex;align-items:center;gap:8px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${zh ? "手动修改" : "Manual Override"}: <span style="color:var(--accent)">${label}</span>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <!-- Source info -->
      <div style="background:rgba(139,115,85,0.06);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px">
        <div style="color:var(--muted);margin-bottom:4px">${zh ? "列：" : "Column:"} <strong style="color:var(--header)">${colName.toUpperCase()}</strong></div>
        <div style="display:flex;gap:var(--gap);flex-wrap:wrap">
          <span>${zh ? "系统原始值：" : "System default:"} <strong>$${Number(originalVal).toLocaleString()}</strong></span>
          ${hasDiff ? `<span style="color:var(--amber)">${zh ? "当前修改值：" : "Current override:"} <strong>$${Number(existingOverride.value).toLocaleString()}</strong></span>` : ""}
          ${hasDiff ? `<span style="color:var(--muted)">${zh ? "偏差：" : "Variance:"} ${diffPct > 0 ? "+" : ""}${diffPct}%</span>` : ""}
        </div>
      </div>
      <label style="font-size:13px;font-weight:600;color:var(--header);display:block;margin-bottom:6px">${zh ? "新数值（USD）" : "New Value (USD)"}</label>
      <div style="position:relative">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px">$</span>
        <input type="number" id="pfCellInput" value="${currentVal}" step="1" min="0"
          style="width:100%;padding:10px 12px 10px 24px;border:1.5px solid var(--border);border-radius:8px;font-size:16px;font-weight:600;font-family:Arial;color:var(--header);background:var(--surface);outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='var(--amber)'"
          onblur="this.style.borderColor='var(--border)'"
          oninput="document.getElementById('pfLivePreview').textContent='→ $'+Number(this.value||0).toLocaleString()"
          onkeydown="if(event.key==='Enter')applyPFOverride('${key}','${label.replace(/'/g, "\'")}',${originalVal},'${colName}')">
      </div>
      <div style="font-size:12px;color:var(--amber);margin-top:6px;font-weight:500" id="pfLivePreview">→ $${Number(currentVal).toLocaleString()}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${zh ? "修改后将以琥珀色◆标记，并记录在修改日志中。可随时一键恢复原始值。" : "Modified cells show in amber ◆ and are logged. You can restore the original value at any time."}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        ${
          existingOverride
            ? `<button class="btn btn-ghost btn-sm" onclick="resetPFOverride('${key}',${originalVal})" style="color:var(--muted)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          ${zh ? "恢复原始值" : "Restore Original"}
        </button>`
            : ""
        }
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">${zh ? "取消" : "Cancel"}</button>
        <button class="btn btn-primary btn-sm" onclick="applyPFOverride('${key}','${label.replace(/'/g, "\'")}',${originalVal},'${colName}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${zh ? "确认修改" : "Apply Override"}
        </button>
      </div>
    </div>`);
  // Focus and select
  setTimeout(() => {
    const el = document.getElementById("pfCellInput");
    if (el) {
      el.focus();
      el.select();
    }
  }, 50);
}

function applyPFOverride(key, label, originalVal, colName) {
  const inp = document.getElementById("pfCellInput");
  if (!inp) return;
  const newVal = parseFloat(inp.value);
  if (isNaN(newVal)) {
    toast(
      currentLang === "zh" ? "请输入有效数字" : "Enter a valid number",
      "error",
    );
    return;
  }
  pfOverrides[key] = {
    label,
    originalVal,
    value: newVal,
    colName,
    timestamp: new Date().toLocaleString(),
    source: "Manual Override",
  };
  // Save overrides to project
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (proj) {
    proj.pfOverrides = pfOverrides;
    saveProjects(projs);
  }
  closeModal();
  buildPFTable();
  renderOverrideLog(currentProjectId);
  toast(
    currentLang === "zh"
      ? `${label} 已修改 → $${newVal.toLocaleString()}`
      : `${label} overridden → $${newVal.toLocaleString()}`,
    "success",
  );
}

function resetPFOverride(key, originalVal) {
  delete pfOverrides[key];
  const projs = getProjects();
  const proj = projs.find((p) => p.id === currentProjectId);
  if (proj) {
    proj.pfOverrides = pfOverrides;
    saveProjects(projs);
  }
  closeModal();
  buildPFTable();
  renderOverrideLog(currentProjectId);
  toast(
    currentLang === "zh" ? "已恢复默认值" : "Reset to system default",
    "success",
  );
}

function loadPFOverrides(pid) {
  const proj = getProjects().find((p) => p.id === pid);
  pfOverrides = proj && proj.pfOverrides ? { ...proj.pfOverrides } : {};
}

function renderOverrideLog(pid) {
  const el = document.getElementById("overrideLog");
  if (!el) return;
  loadPFOverrides(pid);
  const entries = Object.entries(pfOverrides);
  const zh = currentLang === "zh";
  if (!entries.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px">${zh ? "暂无手动修改记录" : "No overrides yet"}</div>`;
    return;
  }
  el.innerHTML =
    `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border2)">${zh ? "◆ 琥珀色标记为手动修改，原始值显示在下方" : "◆ Amber cells = manual override. Original shown below."}</div>` +
    entries
      .map(
        ([key, ov]) => `
    <div class="override-entry" style="border-left:3px solid var(--amber);padding-left:8px;margin-bottom:8px">
      <div class="ov-field" style="display:flex;justify-content:space-between;align-items:flex-start">
        <span style="font-weight:600;color:var(--header)">${ov.label}</span>
        <span style="font-size:10px;color:var(--muted);flex-shrink:0;margin-left:8px">[${ov.colName}]</span>
      </div>
      <div class="ov-vals" style="margin:4px 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="ov-old" style="text-decoration:line-through;color:var(--muted);font-size:12px">$${Number(ov.originalVal).toLocaleString()}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg>
        <span class="ov-new" style="color:var(--amber);font-weight:700;font-size:13px">$${Number(ov.value).toLocaleString()}</span>
        <button onclick="resetPFOverride('${key}',${ov.originalVal})" style="margin-left:auto;background:none;border:1px solid var(--border2);border-radius:4px;cursor:pointer;color:var(--muted);font-size:10px;padding:2px 7px;display:flex;align-items:center;gap:3px" title="${zh ? "恢复默认值" : "Restore original"}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          ${zh ? "恢复" : "Restore"}
        </button>
      </div>
      <div class="ov-meta" style="font-size:10px;color:var(--muted)">${ov.timestamp}</div>
    </div>`,
      )
      .join("");
}

// ─── GL Capital: File preview ────────────────────────────────────────────────
function previewFile(fileName, fileType, pid) {
  const zh = currentLang === "zh";
  // Generate mock data table based on file type
  let previewHTML = "";
  if (fileType === "T12") {
    previewHTML = `<table class="preview-table">
      <thead><tr><th>Category</th><th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th><th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td><strong>Rental Income</strong></td><td>$44,525</td><td>$44,525</td><td>$44,525</td><td>$44,525</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$44,700</td><td>$536,298</td></tr>
        <tr><td>Late Fees</td><td>$295</td><td>$312</td><td>$280</td><td>$310</td><td>$295</td><td>$300</td><td>$290</td><td>$295</td><td>$300</td><td>$290</td><td>$295</td><td>$288</td><td>$3,550</td></tr>
        <tr><td>Laundry</td><td>$175</td><td>$160</td><td>$190</td><td>$180</td><td>$175</td><td>$165</td><td>$185</td><td>$180</td><td>$170</td><td>$175</td><td>$180</td><td>$165</td><td>$2,100</td></tr>
        <tr><td>Concessions</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($607)</td><td>($7,277)</td></tr>
        <tr style="font-weight:600;background:rgba(74,124,89,0.05)"><td><strong>EGI</strong></td><td>$44,388</td><td>$44,390</td><td>$44,388</td><td>$44,408</td><td>$44,563</td><td>$44,558</td><td>$44,568</td><td>$44,568</td><td>$44,563</td><td>$44,558</td><td>$44,568</td><td>$44,546</td><td>$534,671</td></tr>
        <tr><td colspan="14" style="padding:8px 0 4px;font-weight:600;color:var(--muted)">Operating Expenses</td></tr>
        <tr><td>Property Tax</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,432</td><td>$3,433</td><td>$41,189</td></tr>
        <tr><td>Property Insurance</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$2,017</td><td>$24,206</td></tr>
        <tr><td>Management Fee</td><td>$1,775</td><td>$1,776</td><td>$1,775</td><td>$1,776</td><td>$1,783</td><td>$1,782</td><td>$1,783</td><td>$1,783</td><td>$1,783</td><td>$1,782</td><td>$1,783</td><td>$1,782</td><td>$21,363</td></tr>
        <tr style="font-weight:600;background:rgba(122,50,50,0.05)"><td><strong>Total OpEx</strong></td><td>$22,189</td><td>$22,190</td><td>$22,189</td><td>$22,195</td><td>$22,230</td><td>$22,228</td><td>$22,232</td><td>$22,232</td><td>$22,230</td><td>$22,228</td><td>$22,232</td><td>$22,213</td><td>$266,388</td></tr>
        <tr style="font-weight:700;background:rgba(74,124,89,0.08)"><td><strong>NOI</strong></td><td>$22,199</td><td>$22,200</td><td>$22,199</td><td>$22,213</td><td>$22,333</td><td>$22,330</td><td>$22,336</td><td>$22,336</td><td>$22,333</td><td>$22,330</td><td>$22,336</td><td>$22,333</td><td>$268,283</td></tr>
      </tbody>
    </table>`;
  } else if (fileType === "Rent Roll") {
    previewHTML = `<table class="preview-table">
      <thead><tr><th>Unit</th><th>Type</th><th>Sqft</th><th>Tenant</th><th>Lease Start</th><th>Lease End</th><th>Contract Rent</th><th>Market Rent</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>1A</td><td>1BR</td><td>540</td><td>Adam Ha…</td><td>2024-02-01</td><td>2025-01-31</td><td>$1,350</td><td>$1,395</td><td><span class="badge badge-status-active">Occupied</span></td></tr>
        <tr><td>1B</td><td>2BR</td><td>840</td><td>Maria L…</td><td>2023-09-01</td><td>2024-08-31</td><td>$1,700</td><td>$1,745</td><td><span class="badge badge-status-active">Occupied</span></td></tr>
        <tr><td>1C</td><td>2BR</td><td>840</td><td>James R…</td><td>2024-04-01</td><td>2025-03-31</td><td>$1,720</td><td>$1,745</td><td><span class="badge badge-status-active">Occupied</span></td></tr>
        <tr><td>2A</td><td>1BR</td><td>540</td><td>—</td><td>—</td><td>—</td><td>—</td><td>$1,395</td><td><span class="badge badge-status-draft">Vacant</span></td></tr>
        <tr><td>2B</td><td>2B Deluxe</td><td>960</td><td>Chen W…</td><td>2024-01-01</td><td>2024-12-31</td><td>$1,950</td><td>$1,980</td><td><span class="badge badge-status-active">Occupied</span></td></tr>
        <tr><td colspan="9" style="text-align:center;color:var(--muted);padding:8px">… 23 more units</td></tr>
      </tbody>
    </table>`;
  } else if (fileType === "Debt") {
    previewHTML = `<table class="preview-table">
      <thead><tr><th>Field</th><th>Current Loan</th><th>Refi (Yr4)</th></tr></thead>
      <tbody>
        <tr><td>Loan Amount</td><td>$4,000,000</td><td>$3,960,000</td></tr>
        <tr><td>Interest Rate</td><td>3.25%</td><td>5.50%</td></tr>
        <tr><td>Amortization</td><td>30 years</td><td>30 years</td></tr>
        <tr><td>Monthly Payment</td><td>$18,279</td><td>$18,162</td></tr>
        <tr><td>Annual Debt Service</td><td>$219,344</td><td>$217,948</td></tr>
        <tr><td>LTC</td><td>64.5%</td><td>63.9%</td></tr>
        <tr><td>DSCR (Stabilized)</td><td>1.51×</td><td>1.49×</td></tr>
      </tbody>
    </table>`;
  } else {
    previewHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div style="font-size:13px">${fileName}</div>
      <div style="font-size:12px;margin-top:4px">${zh ? "预览暂不支持此文件类型" : "Preview not available for this file type"}</div>
    </div>`;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${zh ? "文件预览" : "File Preview"}: ${fileName}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${fileType} · ${zh ? "解析数据" : "Parsed Data"}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="overflow-x:auto;padding:0">${previewHTML}</div>
  `);
}

// Override renderUploadedFiles to use new file-card style with preview button
function renderUploadedFiles(proj) {
  const el = document.getElementById("uploadedFiles");
  if (!el) return;
  if (!proj) {
    el.innerHTML = "";
    return;
  }
  const files = proj.files || [];
  const zh = currentLang === "zh";
  if (!files.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0">${zh ? "暂无上传文件" : "No files uploaded yet"}</div>`;
    return;
  }
  el.innerHTML = files
    .map((f, i) => {
      const ext = f.name.split(".").pop().toUpperCase();
      const extColor =
        ext === "XLSX" || ext === "XLS"
          ? "rgba(74,124,89,0.15)"
          : ext === "PDF"
            ? "rgba(122,50,50,0.12)"
            : "rgba(139,115,85,0.1)";
      return `<div class="file-card">
      <div class="file-icon" style="background:${extColor}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="min-width:0">
        <div class="file-name">${f.name}</div>
        <div class="file-meta">${f.type} · ${f.date}</div>
      </div>
      <div class="file-actions">
        <button class="btn btn-sm btn-secondary" onclick="previewFile('${f.name.replace(/'/g, "\\'")}','${f.type}','${proj.id}')">${zh ? "预览" : "Preview"}</button>
        <button class="btn btn-sm btn-ghost" onclick="removeFile(${i},'${proj.id}')" style="padding:4px 8px" title="${zh ? "删除" : "Remove"}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join("");
}

function removeFile(idx, pid) {
  const projs = getProjects();
  const proj = projs.find((p) => p.id === pid);
  if (!proj || !proj.files) return;
  proj.files.splice(idx, 1);
  saveProjects(projs);
  if (proj) renderUploadedFiles(proj);
  toast(currentLang === "zh" ? "文件已删除" : "File removed");
}

// ─── Override loadApp to use new nav ────────────────────────────────────────
// Patch the dashboard redirect to uw-dashboard
_domReady(function () {
  // Fix navTo to handle home + uw-dashboard
  window.navTo = function (page, el) {
    // Hide ALL pages — remove class AND inline style so nothing leaks through
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.remove("active");
      p.style.display = "none";
    });
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.remove("active");
    });
    // Map old page names to new
    const pageMap = { dashboard: "uw-dashboard" };
    const actualPage = pageMap[page] || page;
    const p = document.getElementById("page-" + actualPage);
    if (p) {
      p.classList.add("active");
      p.style.display = "block";
    }
    if (el) el.classList.add("active");
    // Reset scroll position
    window.scrollTo(0, 0);
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTop = 0;
    // Page-specific render hooks
    if (actualPage === "submissions") renderSubmissions();
    if (actualPage === "users") renderUsersTable();
    if (actualPage === "projects") renderProjects();
  };
});

// ─── Patch buildPFTable to support edit mode ─────────────────────────────────
var _origBuildPFTable = buildPFTable;
buildPFTable = function () {
  // Always run the base render (populates Income/Expense tables, pfNoiBody/pfCfBody)
  _origBuildPFTable();
  loadPFOverrides(currentProjectId);
  const tbody = document.getElementById("pfTableBody");
  if (!tbody) return; // pfTableBody only used for legacy edit-mode overlay; skip if absent
  const rows = [];
  const colNames = ["Y1", "Y2", "Stab", "Y4", "Y5", "Y6", "Y7"];
  function pfCell(key, label, val, colIdx) {
    const ov = pfOverrides[key + "_" + colIdx];
    const displayVal = ov ? ov.value : val;
    const isOv = !!ov;
    const colName = colNames[colIdx] || "";
    const hint = isOv
      ? "Override: $" +
        displayVal.toLocaleString() +
        " (original: $" +
        val.toLocaleString() +
        ")"
      : "Double-click to edit";
    return `<td><span class="pf-editable${isOv ? " pf-overridden" : ""}"
      ondblclick="openPFCellEdit('${key}_${colIdx}','${label.replace(/'/g, "\\'")}',${val},${displayVal},'${colName}')"
      title="${hint}"
      >${isOv ? "$" + displayVal.toLocaleString() : fmt(displayVal)}${isOv ? '<span style="font-size:9px;margin-left:2px;opacity:.6">✎</span>' : ""}</span></td>`;
  }

  function getVal(r, colKey) {
    const idx = ["y1", "y2", "stab", "y4", "y5", "y6", "y7"].indexOf(colKey);
    const baseVals = [r.y1, r.y2, r.stab, r.y4, r.y5, r.y6, r.y7];
    const key = r.label.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const ov = pfOverrides[key + "_" + idx];
    return ov ? ov.value : baseVals[idx] || 0;
  }

  // Revenue section
  rows.push(
    `<tr class="pf-section"><td colspan="10" style="padding:10px 0 4px">Revenue</td></tr>`,
  );
  let totRevY1 = 0,
    totRevY2 = 0,
    totRevStab = 0,
    totRevY4 = 0,
    totRevY5 = 0,
    totRevY6 = 0,
    totRevY7 = 0;
  (PF_DATA.revenue || []).forEach((r) => {
    const key = r.label.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const v = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const baseVals = [r.y1, r.y2, r.stab, r.y4, r.y5, r.y6, r.y7];
      const ov = pfOverrides[key + "_" + i];
      return ov ? ov.value : baseVals[i];
    });
    totRevY1 += v[0];
    totRevY2 += v[1];
    totRevStab += v[2];
    totRevY4 += v[3];
    totRevY5 += v[4];
    totRevY6 += v[5];
    totRevY7 += v[6];
    const srcTooltip = `${r.note || ""}`;
    rows.push(`<tr title="${srcTooltip}" style="position:relative">
      <td style="position:relative">
        ${currentLang === "zh" && r.zhLabel ? r.zhLabel : r.label}
        <span class="src-info">
          <div class="src-info-label">Source: ${(r.sources || []).join(", ")}</div>
          <div class="src-info-formula">${r.note || "—"}</div>
        </span>
      </td>
      <td>${(r.sources || []).map(srcBadge).join("")}</td>
      <td style="color:var(--muted)">${fmtPU(r.perUnit)}</td>
      ${pfCell(key, r.label, r.y1, 0)}${pfCell(key, r.label, r.y2, 1)}
      <td style="background:rgba(139,115,85,0.04);font-weight:500">${pfCell(key, r.label, r.stab, 2).replace("<td>", "").replace("</td>", "")}</td>
      ${pfCell(key, r.label, r.y4, 3)}${pfCell(key, r.label, r.y5, 4)}${pfCell(key, r.label, r.y6, 5)}${pfCell(key, r.label, r.y7, 6)}
    </tr>`);
  });
  rows.push(`<tr class="pf-total"><td>Total Revenue (EGI)</td><td></td><td style="color:var(--muted)">$21,544</td>
    <td>${fmt(totRevY1)}</td><td>${fmt(totRevY2)}</td>
    <td style="background:rgba(139,115,85,0.06)">${fmt(totRevStab)}</td>
    <td>${fmt(totRevY4)}</td><td>${fmt(totRevY5)}</td><td>${fmt(totRevY6)}</td><td>${fmt(totRevY7)}</td></tr>`);

  // Expenses section
  rows.push(
    `<tr class="pf-section"><td colspan="10" style="padding:14px 0 4px">Operating Expenses</td></tr>`,
  );
  let totExpY1 = 0,
    totExpY2 = 0,
    totExpStab = 0,
    totExpY4 = 0,
    totExpY5 = 0,
    totExpY6 = 0,
    totExpY7 = 0;
  (PF_DATA.expenses || []).forEach((r) => {
    const key = r.label.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const v = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const baseVals = [r.y1, r.y2, r.stab, r.y4, r.y5, r.y6, r.y7];
      const ov = pfOverrides[key + "_" + i];
      return ov ? ov.value : baseVals[i];
    });
    totExpY1 += v[0];
    totExpY2 += v[1];
    totExpStab += v[2];
    totExpY4 += v[3];
    totExpY5 += v[4];
    totExpY6 += v[5];
    totExpY7 += v[6];
    rows.push(`<tr title="${r.note || ""}" style="position:relative">
      <td style="position:relative">
        ${currentLang === "zh" && r.zhLabel ? r.zhLabel : r.label}
        <span class="src-info">
          <div class="src-info-label">Source: ${(r.sources || []).join(", ")}</div>
          <div class="src-info-formula">${r.note || "—"}</div>
        </span>
      </td>
      <td>${(r.sources || []).map(srcBadge).join("")}</td>
      <td style="color:var(--muted)">${fmtPU(r.perUnit)}</td>
      ${pfCell(key, r.label, r.y1, 0)}${pfCell(key, r.label, r.y2, 1)}
      <td style="background:rgba(139,115,85,0.04);font-weight:500">${pfCell(key, r.label, r.stab, 2).replace("<td>", "").replace("</td>", "")}</td>
      ${pfCell(key, r.label, r.y4, 3)}${pfCell(key, r.label, r.y5, 4)}${pfCell(key, r.label, r.y6, 5)}${pfCell(key, r.label, r.y7, 6)}
    </tr>`);
  });
  rows.push(`<tr class="pf-total"><td>Total Expenses</td><td></td><td style="color:var(--muted)">$9,689</td>
    <td>${fmt(totExpY1)}</td><td>${fmt(totExpY2)}</td>
    <td style="background:rgba(139,115,85,0.06)">${fmt(totExpStab)}</td>
    <td>${fmt(totExpY4)}</td><td>${fmt(totExpY5)}</td><td>${fmt(totExpY6)}</td><td>${fmt(totExpY7)}</td></tr>`);

  // % of Revenue
  const pctRow = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "—");
  rows.push(`<tr style="color:var(--muted);font-size:12px"><td>% of Revenue</td><td></td><td></td>
    <td>${pctRow(totExpY1, totRevY1)}</td><td>${pctRow(totExpY2, totRevY2)}</td>
    <td style="background:rgba(139,115,85,0.04)">${pctRow(totExpStab, totRevStab)}</td>
    <td>${pctRow(totExpY4, totRevY4)}</td><td>${pctRow(totExpY5, totRevY5)}</td><td>${pctRow(totExpY6, totRevY6)}</td><td>${pctRow(totExpY7, totRevY7)}</td></tr>`);

  // NOI
  const noi = (r, e) => r - e;
  rows.push(`<tr class="pf-noi"><td>Net Operating Income (NOI)</td>
    <td><span class="badge badge-manual" style="font-size:10px">Calc</span></td>
    <td style="font-weight:600;color:var(--green)">$11,854</td>
    <td>${fmt(noi(totRevY1, totExpY1))}</td><td>${fmt(noi(totRevY2, totExpY2))}</td>
    <td style="background:rgba(74,124,89,0.08);font-weight:700">${fmt(noi(totRevStab, totExpStab))}</td>
    <td>${fmt(noi(totRevY4, totExpY4))}</td><td>${fmt(noi(totRevY5, totExpY5))}</td>
    <td>${fmt(noi(totRevY6, totExpY6))}</td><td>${fmt(noi(totRevY7, totExpY7))}</td></tr>`);

  // Debt Service — read from localStorage debt_data
  var _ntDebtData = null;
  try {
    _ntDebtData = JSON.parse(
      localStorage.getItem(
        "debt_data_" +
          (window._currentProjectId || currentProjectId || "default"),
      ) || "null",
    );
  } catch (e) {}
  var _ntCurrent = (_ntDebtData && _ntDebtData.current) || {};
  var _ntRefi = (_ntDebtData && _ntDebtData.refi) || {};
  var _ntDsCurrent = _ntCurrent.annualMortgagePayments || 0;
  var _ntRefiPrincipal = _ntRefi.principal || 0;
  var _ntRefiRate = _ntRefi.interestPerAnnum || 0;
  var _ntDsRefi = Math.round(_ntRefiPrincipal * (_ntRefiRate / 100));
  const dsVals = [
    _ntDsCurrent,
    _ntDsCurrent,
    _ntDsCurrent,
    _ntDsRefi,
    _ntDsRefi,
    _ntDsRefi,
    _ntDsRefi,
  ];
  rows.push(`<tr style="font-weight:500">
    <td>Debt Service <span style="font-size:11px;font-weight:400;color:var(--muted)">(Current → Refi Yr4)</span></td>
    <td><span class="badge badge-t12" style="font-size:10px">Debt</span></td><td></td>
    <td>${fmt(dsVals[0])}</td><td>${fmt(dsVals[1])}</td>
    <td style="background:rgba(139,115,85,0.04)">${fmt(dsVals[2])}</td>
    <td>${fmt(dsVals[3])}</td><td>${fmt(dsVals[4])}</td><td>${fmt(dsVals[5])}</td><td>${fmt(dsVals[6])}</td></tr>`);

  // CF after DS
  const noiVals = [
    noi(totRevY1, totExpY1),
    noi(totRevY2, totExpY2),
    noi(totRevStab, totExpStab),
    noi(totRevY4, totExpY4),
    noi(totRevY5, totExpY5),
    noi(totRevY6, totExpY6),
    noi(totRevY7, totExpY7),
  ];
  rows.push(`<tr style="font-weight:600"><td>Cash Flow after Debt Service</td><td></td><td></td>
    ${noiVals
      .map((n, i) => {
        const cf = n - dsVals[i];
        const col = cf >= 0 ? "var(--green)" : "var(--red)";
        const bg = i === 2 ? "background:rgba(139,115,85,0.06);" : "";
        return `<td style="${bg}color:${col}">${fmt(cf)}</td>`;
      })
      .join("")}</tr>`);

  tbody.innerHTML = rows.join("");
};

// ─── CHANGE PROJECT STATUS ───────────────────────────────────────────────────
function changeProjectStatus(newStatus) {
  var pid = window.currentProjectId;
  if (!pid) return;
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (!proj) return;
  proj.status = newStatus;
  proj.lastUpdated = new Date().toISOString().slice(0, 10);
  saveProjects(projs);
  _updateDetailStatusBadge(newStatus);
  var zh = currentLang === "zh";
  var msg =
    newStatus === "complete"
      ? zh
        ? "✓ 项目已标记为完成"
        : "✓ Project marked as Complete"
      : zh
        ? "项目已重置为草稿"
        : "Project reverted to Draft";
  toast(msg);
  renderProjects();
}

function _updateDetailStatusBadge(status) {
  var statusEl = document.getElementById("detailProjectStatus");
  var selectEl = document.getElementById("detailStatusSelect");
  var zh = currentLang === "zh";
  var isDone =
    status === "complete" || status === "completed" || status === "active";
  if (statusEl) {
    statusEl.className =
      "badge " + (isDone ? "badge-status-complete" : "badge-status-draft");
    statusEl.textContent = isDone
      ? zh
        ? "已完成"
        : "Complete"
      : zh
        ? "草稿"
        : "Draft";
  }
  if (selectEl) selectEl.value = isDone ? "complete" : "draft";
  _updateToggleBtn(isDone);
}

// ─── T12 PARSED DISPLAY ──────────────────────────────────────────────────────
function renderT12Parsed(proj) {
  var pc = document.getElementById("t12ParsedContent");
  var dz = document.getElementById("t12DropZone");
  if (!pc) return;
  var f =
    proj &&
    (proj.files || []).find(function (x) {
      var t = x.parsedAs || x.type || "";
      return t === "T12" || t === "Selling Model";
    });
  if (!f) {
    pc.innerHTML = "";
    pc.style.display = "none";
    if (dz) dz.style.display = "";
    return;
  }
  if (dz) dz.style.display = "none";
  pc.style.display = "";
  // Show preview card instead of parsed table
  pc.innerHTML = _buildFilePreviewCard(f);
}
function renderRRParsed(proj) {
  var pc = document.getElementById("rrParsedContent");
  var dz = document.getElementById("rrDropZone");
  if (!pc) return;
  var f =
    proj &&
    (proj.files || []).find(function (x) {
      return (x.parsedAs || x.type) === "Rent Roll";
    });
  if (!f) {
    pc.innerHTML = "";
    pc.style.display = "none";
    if (dz) dz.style.display = "";
    return;
  }
  if (dz) dz.style.display = "none";
  pc.style.display = "";
  // Show preview card instead of parsed table
  pc.innerHTML = _buildFilePreviewCard(f);
}

// ─── UPDATED renderAllParsedPreviews ─────────────────────────────────────────
function renderAllParsedPreviews(proj) {
  if (!proj) return;
  _updateT12UI(proj);
  _updateRRUI(proj);
  renderT12Parsed(proj);
  renderRRParsed(proj);
  _checkPFEmptyState(proj);
  renderPFDualSource(proj);
}

// ─── DUAL-SOURCE COMPARISON UI (RR vs API) ───────────────────────────────────
// Mock HelloData API response — replace with real fetch when API is wired in
var _helloDataMock = {};

// Tracks current selection per field: 'rr', 'api', or 'manual'
var _pfSourceSel = { occ: "rr", units: "rr" };
function _loadPfSourceSel() {
  try {
    var saved = JSON.parse(
      localStorage.getItem(
        "pf_source_sel_" + (window._currentProjectId || ""),
      ) || "null",
    );
    if (saved) {
      _pfSourceSel.occ = saved.occ || "rr";
      _pfSourceSel.units = saved.units || "rr";
    }
  } catch (e) {}
}
function _savePfSourceSel() {
  localStorage.setItem(
    "pf_source_sel_" + (window._currentProjectId || ""),
    JSON.stringify(_pfSourceSel),
  );
}
// Stores manual override values per field
var _pfManualVals = {};
function _loadPfManualVals() {
  try {
    _pfManualVals = JSON.parse(
      localStorage.getItem(
        "pf_manual_vals_" + (window._currentProjectId || ""),
      ) || "{}",
    );
  } catch (e) {
    _pfManualVals = {};
  }
}
function _savePfManualVals() {
  localStorage.setItem(
    "pf_manual_vals_" + (window._currentProjectId || ""),
    JSON.stringify(_pfManualVals),
  );
}

function togglePFSec(secId) {
  var items = document.querySelectorAll(".pf-si-" + secId);
  var hdr = document.querySelector('.pf-sec-hdr[data-secid="' + secId + '"]');
  var isOpen = hdr && hdr.classList.contains("open");
  items.forEach(function (el) {
    el.classList.toggle("pf-si-hidden", isOpen);
  });
  if (hdr) hdr.classList.toggle("open", !isOpen);
}

function _getRRMeta(pid) {
  try {
    return JSON.parse(
      localStorage.getItem("rr_meta_" + (pid || currentProjectId)) || "null",
    );
  } catch (e) {
    return null;
  }
}

function renderPFDualSource(proj) {
  var pid = window._currentProjectId || currentProjectId || "default";
  var rows = _getRRData(pid) || RR_DATA || [];
  var rrMeta = _getRRMeta(pid);
  // RR occupancy: prefer %Unit Occupancy from RR file summary, else compute from unit data
  var rrUnits = rows.length;
  var rrOcc;
  if (rrMeta && rrMeta.unitOccupancy != null) {
    rrOcc = parseFloat(rrMeta.unitOccupancy.toFixed(1));
  } else {
    var rrOccupied = rows.filter(function (r) {
      var t = (r.tenant || "").trim().toUpperCase();
      return t && t !== "VACANT" && t !== "OCCUPIED";
    }).length;
    rrOcc = rrUnits ? parseFloat(((rrOccupied / rrUnits) * 100).toFixed(1)) : 0;
  }

  var apiOcc = _helloDataMock.occupancy;
  var apiUnits = _helloDataMock.units;

  var occCell = document.getElementById("pfSummOccCell");
  var unitsCell = document.getElementById("pfSummUnitsCell");
  if (!occCell || !unitsCell) return;

  // Only show dual-source when both sources have data; otherwise show single source
  var rrOccStr = rrUnits ? rrOcc + "%" : "—";
  var hdOccStr = apiOcc != null ? apiOcc + "%" : "—";
  var rrUnitsStr = rrUnits ? rrUnits + "" : "—";
  var hdUnitsStr = apiUnits != null ? apiUnits + "" : "—";

  occCell.innerHTML = _dualSrcHtml(
    "occ",
    _pfSourceSel.occ,
    rrOccStr,
    hdOccStr,
    "RR",
    "HelloData",
  );
  unitsCell.innerHTML = _dualSrcHtml(
    "units",
    _pfSourceSel.units,
    rrUnitsStr,
    hdUnitsStr,
    "RR",
    "HelloData",
  );
}

function _dualSrcHtml(field, sel, rrVal, apiVal, rrLabel, apiLabel) {
  var rrC = DS_COLORS.rr;
  var hdC = DS_COLORS.hd;
  var mnC = DS_COLORS.manual;
  var isEdit = window._globalEditMode || false;
  var manualVal = _pfManualVals[field];
  // Determine active value + color
  var activeVal, activeColor;
  if (sel === "manual") {
    activeVal = manualVal !== undefined && manualVal !== "" ? manualVal : "—";
    activeColor = mnC;
  } else if (sel === "api") {
    activeVal = apiVal;
    activeColor = hdC;
  } else {
    activeVal = rrVal;
    activeColor = rrC;
  }
  // Build dropdown options — only include sources that have data
  var allOpts = [
    { val: "rr", label: rrLabel, display: rrVal, color: rrC },
    { val: "api", label: apiLabel, display: apiVal, color: hdC },
    {
      val: "manual",
      label: "Manual",
      display: manualVal !== undefined && manualVal !== "" ? manualVal : "—",
      color: mnC,
    },
  ];
  // Filter: hide RR/HD option if its value is "—" (no data); always keep Manual in edit mode
  var opts = allOpts.filter(function (o) {
    if (o.val === "manual") return isEdit;
    return o.display !== "—";
  });
  // Never override _pfSourceSel — it's the user's explicit choice.
  // If the selected source has no data, just show "—" as its value.
  var hasSel = opts.some(function (o) {
    return o.val === sel;
  });
  if (!hasSel && opts.length > 0) {
    // Selected source was filtered (no data). Show first available value but keep sel unchanged.
    activeVal = "—";
  }
  // Hide switcher when not needed:
  // - Only one data source has data, OR
  // - Multiple sources have data but values are identical
  var dataSources = opts.filter(function (o) {
    return o.val !== "manual";
  });
  var allSame =
    dataSources.length >= 2 &&
    dataSources.every(function (o) {
      return o.display === dataSources[0].display;
    });
  if ((dataSources.length <= 1 || allSame) && !isEdit) {
    var showVal = dataSources.length >= 1 ? dataSources[0].display : "—";
    var showColor = dataSources.length >= 1 ? dataSources[0].color : rrC;
    // When values match, show value with a tooltip listing all sources
    var tip = dataSources
      .map(function (o) {
        return o.label + ": " + o.display;
      })
      .join(" · ");
    return (
      '<span style="font-size:13px;font-weight:700;color:' +
      showColor.tag +
      ';font-variant-numeric:tabular-nums" title="' +
      tip +
      '">' +
      showVal +
      "</span>"
    );
  }
  // Always include all available sources in dropdown (not just filtered ones)
  var dropdownOpts = allOpts.filter(function (o) {
    if (o.val === "manual") return isEdit;
    return true; // show all RR/HD options
  });
  var selOpts = dropdownOpts
    .map(function (o) {
      return (
        '<option value="' +
        o.val +
        '"' +
        (o.val === sel ? " selected" : "") +
        ">" +
        o.label +
        "</option>"
      );
    })
    .join("");
  // Compute dropdown chevron color
  var dropdownStyle =
    "font-size:9px;padding:3px 18px 3px 10px;border:1px solid " +
    activeColor.tag +
    ";border-radius:11px;color:" +
    activeColor.tag +
    ";background:" +
    activeColor.tagBg +
    ";cursor:pointer;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-appearance:none;appearance:none;outline:none;text-align:center;text-align-last:center;min-width:80px;background-image:url('data:image/svg+xml,%3Csvg width=\\'8\\' height=\\'5\\' viewBox=\\'0 0 8 5\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M1 1l3 3 3-3\\' stroke=\\'" +
    encodeURIComponent(activeColor.tag) +
    "\\' stroke-width=\\'1.5\\' fill=\\'none\\' stroke-linecap=\\'round\\'/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 6px center";
  // Manual edit input (only when Manual is active + edit mode)
  var manualInput = "";
  if (isEdit && sel === "manual") {
    manualInput =
      ' <input type="text" value="' +
      (manualVal || "") +
      '"' +
      " onchange=\"savePFManualVal('" +
      field +
      "',this.value)\"" +
      ' onclick="event.stopPropagation()"' +
      ' style="width:60px;border:1px solid ' +
      mnC.tag +
      ";background:transparent;text-align:right;font-size:12px;font-weight:600;color:" +
      mnC.tag +
      ';outline:none;padding:2px 6px;border-radius:4px;margin-right:6px">';
  }
  return (
    '<div id="pfSrc-' +
    field +
    '" class="dual-src-wrap" style="display:inline-flex;align-items:center;gap:8px;justify-content:flex-end">' +
    manualInput +
    '<span style="font-size:13px;font-weight:700;color:var(--header);font-variant-numeric:tabular-nums" title="' +
    opts
      .map(function (o) {
        return o.label + ": " + o.display;
      })
      .join(" · ") +
    '">' +
    activeVal +
    "</span>" +
    "<select onchange=\"selectPFSource('" +
    field +
    '\',this.value)" style="' +
    dropdownStyle +
    '" title="Switch data source">' +
    selOpts +
    "</select>" +
    "</div>"
  );
}

function savePFManualVal(field, val) {
  _pfManualVals[field] = val;
  _savePfManualVals();
}

function selectPFSource(field, src) {
  _pfSourceSel[field] = src;
  _savePfSourceSel();
  // Re-render to update chip styles and show manual input if needed
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === currentProjectId;
  });
  renderPFDualSource(proj);
  // When Total Apartment Units source changes, sync everything
  if (field === "units") {
    // Directly update KPI units card
    var kpiEl = document.getElementById("kpiUnits");
    if (kpiEl) {
      var unitsVal = _resolveUnits(currentProjectId);
      kpiEl.textContent = unitsVal > 0 ? unitsVal : "—";
    }
    if (typeof buildPFTable === "function") buildPFTable();
    if (typeof buildPFUnitMix === "function") buildPFUnitMix();
  }
  if (typeof updateSummKpis === "function") updateSummKpis();
  var srcNames = { rr: "Rent Roll", api: "HelloData", manual: "Manual" };
  toast("Source: " + (srcNames[src] || src) + " · " + field.toUpperCase());
}
window.selectPFSource = selectPFSource;

// ─── POPULATE SUMMARY FIELDS ─────────────────────────────────────────────────
// Fills all Summary section cells from available data: project info, HD Rent Comps, RR data
function populateSummary() {
  var pid = window._currentProjectId || currentProjectId || "default";
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  var rc = getHDRentComps(pid);
  var rrRows = _getRRData(pid) || RR_DATA || [];
  var hdUmix = getHDUnitMix(pid);

  // Helper: set cell text if element exists and value is truthy
  function _setCell(id, val) {
    var el = document.getElementById(id);
    if (el && val != null && val !== "" && val !== 0) {
      el.textContent = val;
    }
  }

  // ── Name: project name or HD Rent Comps property name ──
  var name = proj && proj.name ? proj.name : null;
  if (!name && rc && rc.propertyName) name = rc.propertyName;
  _setCell("pfSummNameCell", name);

  // ── Address: project address or HD Rent Comps address ──
  var addr = proj && proj.address ? proj.address : null;
  if (!addr && rc && rc.address) addr = rc.address;
  _setCell("pfSummAddrCell", addr);

  // ── Year Built: HD Rent Comps yr built ──
  if (rc && rc.yrBuilt) {
    _setCell("pfSummYearBuiltCell", rc.yrBuilt);
  }

  // ── Occupancy Rate & Units: populate _helloDataMock from all HD sources ──
  if (rc && rc.leasedPct != null) {
    _helloDataMock.occupancy = rc.leasedPct.toFixed(1);
  }
  // Units: try Rent Comps → HD Meta → HD Unit Mix total
  var hdUnitsVal = _getHDUnits(pid);
  if (hdUnitsVal > 0) _helloDataMock.units = hdUnitsVal;

  // ── Ask Price / Offer Price: from project data (manual entry) ──
  if (proj && proj.askPrice) {
    _setCell(
      "pfSummAskPriceCell",
      "$\u00a0" + Number(proj.askPrice).toLocaleString(),
    );
  }
  if (proj && proj.offerPrice) {
    _setCell(
      "pfSummOfferPriceCell",
      "$\u00a0" + Number(proj.offerPrice).toLocaleString(),
    );
  }

  // ── Total Apartment Units: auto-select source only on first load (no saved preference) ──
  var hasSavedSel = !!localStorage.getItem("pf_source_sel_" + pid);
  if (!hasSavedSel) {
    var hasRRUnits = rrRows.length > 0;
    var hasHDUnits = _helloDataMock.units > 0;
    if (hasHDUnits && !hasRRUnits) {
      _pfSourceSel.units = "api";
    } else if (hasRRUnits) {
      _pfSourceSel.units = "rr";
    }
    _savePfSourceSel();
  }

  // ── Total Parking Spaces: from project data if available ──
  if (proj && proj.prkgSpaces) {
    _setCell("pfSummParkingCell", proj.prkgSpaces);
  }

  // Refresh dual-source cells (Occupancy + Units) with updated _helloDataMock
  renderPFDualSource(proj);
  // Refresh KPI strip
  if (typeof updateSummKpis === "function") updateSummKpis();
}
window.populateSummary = populateSummary;

// ─── PRO FORMA EMPTY STATE ────────────────────────────────────────────────────
function _checkPFEmptyState(proj) {
  var emptyEl = document.getElementById("pfEmptyState");
  var tableEl = document.getElementById("pfTableWrap");
  var pfContentEl = document.getElementById("pfContent");

  // Check if any data source has been uploaded
  var hasT12 =
    proj &&
    (proj.files || []).some(function (f) {
      var t = f.parsedAs || f.type || "";
      return t === "T12" || t === "Selling Model";
    });
  var hasHD = !!getHDMeta(currentProjectId);
  var hasRR =
    proj &&
    (proj.files || []).some(function (f) {
      return (f.parsedAs || f.type) === "Rent Roll";
    });
  var hasData = hasT12 || hasHD || hasRR;

  // Always show pfContent (table structure with empty or filled data)
  if (pfContentEl) pfContentEl.style.display = "";
  if (emptyEl) emptyEl.style.display = "none";
  if (tableEl) tableEl.style.display = "";

  // Update _pfLoaded based on whether we have data
  if (hasData) {
    _pfLoaded = true;
  } else {
    _pfLoaded = false;
  }
  buildPFTable();
}

// ─── PRO FORMA CONFLICT RESOLUTION ───────────────────────────────────────────
// pfConflicts: track conflicts that underwriter needs to resolve
var pfConflicts = {}; // {key: {sources: [{source, value}], chosen: null}}
var pfEditMode = false;
var pfManualLog = []; // [{field, oldVal, newVal, timestamp}]

function togglePFEditModeNew(on) {
  toggleGlobalEditMode();
}

function _renderPFEditLog() {
  var el = document.getElementById("pfEditLogList");
  if (!el) return;
  if (!pfManualLog.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">No manual edits yet</div>';
    return;
  }
  el.innerHTML = pfManualLog
    .slice()
    .reverse()
    .map(function (entry) {
      return (
        '<div style="padding:8px 10px;background:rgba(139,106,46,0.06);border-radius:8px;border-left:3px solid var(--amber)">' +
        '<div style="font-size:12px;font-weight:600;color:var(--header)">◆ ' +
        entry.field +
        "</div>" +
        '<div style="font-size:11px;color:var(--muted);margin-top:2px">' +
        (entry.oldVal !== null
          ? '<span style="text-decoration:line-through;color:var(--muted)">$' +
            Number(entry.oldVal).toLocaleString() +
            "</span> → "
          : "") +
        '<strong style="color:var(--amber)">$' +
        Number(entry.newVal).toLocaleString() +
        "</strong>" +
        ' <span style="color:var(--muted)">· ' +
        entry.timestamp +
        "</span>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function openPFCellEditNew(fieldKey, currentVal, label) {
  if (!_globalEditMode) return;
  var newValStr = prompt(
    'Edit "' +
      label +
      '" (current: $' +
      (currentVal || 0).toLocaleString() +
      ") Enter new value:",
    currentVal || "",
  );
  if (newValStr === null) return;
  var newVal = parseFloat(newValStr.replace(/[^0-9.-]/g, ""));
  if (isNaN(newVal)) return;
  var oldVal = pfOverrides[fieldKey] ? pfOverrides[fieldKey].value : currentVal;
  pfOverrides[fieldKey] = {
    value: newVal,
    source: "Manual",
    timestamp: new Date().toLocaleString(),
  };
  pfManualLog.push({
    field: label,
    oldVal: oldVal,
    newVal: newVal,
    timestamp: new Date().toLocaleTimeString(),
  });
  _savePFOverrides();
  buildPFTable();
  _renderPFEditLog();
  toast("Value updated: " + label + " → $" + newVal.toLocaleString());
}

function resolvePFConflict(fieldKey, chosenVal, chosenSource) {
  if (!pfConflicts[fieldKey]) return;
  pfConflicts[fieldKey].chosen = chosenVal;
  pfConflicts[fieldKey].chosenSource = chosenSource;
  pfOverrides[fieldKey] = {
    value: chosenVal,
    source: chosenSource,
    timestamp: new Date().toLocaleString(),
  };
  _savePFOverrides();
  buildPFTable();
  toast("Using " + chosenSource + " value for this field");
}

function _savePFOverrides() {
  try {
    localStorage.setItem(
      "glcapital_pf_overrides_" + (window.currentProjectId || ""),
      JSON.stringify(pfOverrides),
    );
  } catch (e) {}
}

function _loadPFOverrides() {
  try {
    var raw = localStorage.getItem(
      "glcapital_pf_overrides_" + (window.currentProjectId || ""),
    );
    if (raw) {
      pfOverrides = JSON.parse(raw) || {};
    }
  } catch (e) {
    pfOverrides = {};
  }
}

// ─── EXPOSE NEW FUNCTIONS ─────────────────────────────────────────────────────
window.renderT12Parsed = renderT12Parsed;
window.renderRRParsed = renderRRParsed;
window.renderAllParsedPreviews = renderAllParsedPreviews;
window._checkPFEmptyState = _checkPFEmptyState;
window.togglePFEditModeNew = togglePFEditModeNew;
window.openPFCellEditNew = openPFCellEditNew;
window.resolvePFConflict = resolvePFConflict;
window._renderPFEditLog = _renderPFEditLog;
window.handleT12Upload = handleT12Upload;
window.handleT12Drop = handleT12Drop;
window.deleteT12 = deleteT12;
window.handleRRUpload = handleRRUpload;
window.handleRRDrop = handleRRDrop;
window.deleteRR = deleteRR;
window._updateT12UI = _updateT12UI;
window._updateRRUI = _updateRRUI;

// ─── CONFLICT PICKER ─────────────────────────────────────────────────────────

function resolveConflict(key, label, newVal, source) {
  pfOverrides[key] = {
    value: newVal,
    source: source,
    timestamp: new Date().toLocaleString(),
  };
  _pfManualEdits[key] = {
    label: label,
    col: "",
    oldVal: null,
    newVal: newVal,
    ts: new Date().toLocaleString(),
    isConflictResolved: true,
    source: source,
  };
  _savePFOverrides();
  buildPFTable();
  updatePFEditLog();
  closeModal();
  toast((currentLang === "zh" ? "已选择来源：" : "Using source: ") + source);
}
window.showConflictPicker = showConflictPicker;
window.resolveConflict = resolveConflict;

// ─── T12/RR UI STATE HELPERS ─────────────────────────────────────────────────
function _updateT12UI(proj) {
  var f = (proj && (proj.files || [])).find(function (x) {
    var t = x.parsedAs || x.type || "";
    return t === "T12" || t === "Selling Model";
  });
  var infoEl = document.getElementById("t12FileInfo");
  var dz = document.getElementById("t12DropZone");
  var delBtn = document.getElementById("t12DeleteBtn");
  var upLabel = document.getElementById("t12UploadBtnLabel");
  if (f) {
    if (infoEl)
      infoEl.textContent =
        f.name +
        " · " +
        (f.size ? Math.round(f.size / 1024) + "KB · " : "") +
        (currentLang === "zh" ? "已解析" : "Parsed");
    if (dz) dz.style.display = "none";
    if (delBtn) delBtn.style.display = "";
    if (upLabel)
      upLabel.textContent = currentLang === "zh" ? "替换文件" : "Replace File";
  } else {
    if (infoEl)
      infoEl.textContent =
        currentLang === "zh"
          ? "未上传文件 · 仅限一个文件"
          : "No file uploaded · Single file only";
    if (dz) dz.style.display = "";
    if (delBtn) delBtn.style.display = "none";
    if (upLabel)
      upLabel.textContent = currentLang === "zh" ? "上传T12" : "Upload T12";
  }
}
function _updateRRUI(proj) {
  var f = (proj && (proj.files || [])).find(function (x) {
    return (x.parsedAs || x.type) === "Rent Roll";
  });
  var _rrCheck = _getRRData(currentProjectId) || RR_DATA || [];
  var hasDemo = !f && _rrCheck.length > 0;
  var infoEl = document.getElementById("rrFileInfo");
  var dz = document.getElementById("rrDropZone");
  var delBtn = document.getElementById("rrDeleteBtn");
  var upLabel = document.getElementById("rrUploadBtnLabel");
  if (f) {
    if (infoEl)
      infoEl.textContent =
        f.name +
        " · " +
        (f.size ? Math.round(f.size / 1024) + "KB · " : "") +
        (currentLang === "zh" ? "已解析" : "Parsed");
    if (dz) dz.style.display = "none";
    if (delBtn) delBtn.style.display = "";
    if (upLabel)
      upLabel.textContent = currentLang === "zh" ? "替换文件" : "Replace File";
  } else if (hasDemo) {
    if (infoEl)
      infoEl.textContent =
        "Rent_Roll_Sample.xlsx · 100KB · " +
        (currentLang === "zh" ? "示例数据" : "Demo data");
    if (dz) dz.style.display = "none";
    if (delBtn) delBtn.style.display = "none";
    if (upLabel)
      upLabel.textContent = currentLang === "zh" ? "替换文件" : "Replace File";
  } else {
    if (infoEl)
      infoEl.textContent =
        currentLang === "zh"
          ? "未上传文件 · 仅限一个文件"
          : "No file uploaded · Single file only";
    if (dz) dz.style.display = "";
    if (delBtn) delBtn.style.display = "none";
    if (upLabel)
      upLabel.textContent =
        currentLang === "zh" ? "上传租户清单" : "Upload Rent Roll";
  }
}
window._updateT12UI = _updateT12UI;
window._updateRRUI = _updateRRUI;
window.togglePFEdit = togglePFEdit;
window.togglePFEditMode = togglePFEditMode;

function renderPFConflicts() {
  var panel = document.getElementById("pfConflictPanel");
  var listEl = document.getElementById("pfConflictList");
  if (!panel || !listEl) return;
  var zh = currentLang === "zh";
  // Find rows with multiple sources (potential conflicts)
  var conflicts = [];
  var allRows = (PF_DATA.revenue || []).concat(PF_DATA.expenses || []);
  allRows.forEach(function (r) {
    if (r.sources && r.sources.length >= 2) {
      var base = r.stab || r.y1 || 0;
      var alt = Math.round(base * 1.05); // Simulated alternate source value
      conflicts.push({ row: r, vals: [base, alt] });
    }
  });
  if (!conflicts.length) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";
  listEl.innerHTML = conflicts
    .slice(0, 5)
    .map(function (c) {
      var rowLabel = zh ? c.row.zhLabel || c.row.label : c.row.label;
      var key = c.row.label;
      var chosen = pfConflictChoices ? pfConflictChoices[key] : null;
      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.7);flex-wrap:wrap">' +
        '<span style="font-size:12px;font-weight:600;color:var(--header);min-width:140px">' +
        rowLabel +
        "</span>" +
        (c.row.sources || [])
          .map(function (src, i) {
            var val = c.vals[i] || c.vals[0];
            var isChosen = chosen === src;
            return (
              "<button onclick=\"resolvePFConflict('" +
              key +
              "','" +
              src +
              "'," +
              val +
              ')" style="' +
              "font-size:11px;padding:5px 12px;border-radius:6px;cursor:pointer;" +
              "border:1.5px solid " +
              (isChosen ? "var(--accent)" : "var(--border2)") +
              ";" +
              "background:" +
              (isChosen ? "rgba(139,115,85,0.12)" : "rgba(255,255,255,0.8)") +
              ";" +
              "font-weight:" +
              (isChosen ? "700" : "400") +
              ";" +
              "color:" +
              (isChosen ? "var(--accent)" : "var(--header)") +
              '">' +
              '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-right:5px;background:' +
              (src === "T12"
                ? "rgba(74,124,89,0.15)"
                : src === "RentCast"
                  ? "rgba(61,90,120,0.15)"
                  : "rgba(139,115,85,0.15)") +
              ";color:" +
              (src === "T12"
                ? "var(--green)"
                : src === "RentCast"
                  ? "var(--blue)"
                  : "var(--accent)") +
              '">' +
              src +
              "</span>$" +
              val.toLocaleString() +
              (isChosen ? " ✓" : "") +
              "</button>"
            );
          })
          .join("") +
        (!chosen
          ? '<span style="font-size:10px;color:#c05800;font-weight:600;margin-left:4px">' +
            (zh ? "请选择" : "Choose source") +
            "</span>"
          : '<span style="font-size:10px;color:var(--green);font-weight:600">' +
            (zh ? "已选择" : "Selected") +
            "</span>") +
        "</div>"
      );
    })
    .join("");
}

// ── Role Switcher ─────────────────────────────────────────────────────
var _roleSwitcherOpen = false;

function toggleRoleSwitcher(e) {
  e.stopPropagation();
  _roleSwitcherOpen = !_roleSwitcherOpen;
  var menu = document.getElementById("roleSwitcherMenu");
  if (_roleSwitcherOpen) {
    buildRoleSwitcherList();
    menu.style.display = "";
  } else {
    menu.style.display = "none";
  }
}

function buildRoleSwitcherList() {
  var list = document.getElementById("roleSwitcherList");
  if (!list) return;
  var users = getUsers().filter(function (u) {
    return u.status === "active";
  });
  var sess = getSession();
  var COLORS = [
    "#8b7355",
    "#4a6585",
    "#4a7c59",
    "#8b6a2e",
    "#6a4a8b",
    "#8b4a4a",
  ];
  list.innerHTML = users
    .map(function (u, i) {
      var isActive = sess && sess.id === u.id;
      var isAdmin = u.role === "admin";
      var initials = (u.firstName[0] || "") + (u.lastName[0] || "");
      var roleClass = isAdmin ? "role-admin" : "role-underwriter";
      var check = isActive
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
        : "";
      return [
        '<div class="role-switch-item' + (isActive ? " active" : "") + '"',
        " onclick=\"switchToUser('" + u.id + "')\">",
        '<div class="role-switch-avatar ' +
          roleClass +
          '">' +
          initials +
          "</div>",
        '<div style="flex:1;min-width:0">',
        '<div class="role-switch-name">' +
          u.firstName +
          " " +
          u.lastName +
          "</div>",
        '<div class="role-switch-role">' +
          (isAdmin ? "Administrator" : "Underwriter") +
          "</div>",
        "</div>",
        check,
        "</div>",
      ].join("");
    })
    .join("");
}

function switchToUser(userId) {
  var users = getUsers();
  var user = users.find(function (u) {
    return u.id === userId;
  });
  if (!user) return;
  setSession(user);
  loadApp(user);
  document.getElementById("roleSwitcherMenu").style.display = "none";
  _roleSwitcherOpen = false;
  toast(
    "Switched to " +
      user.firstName +
      " " +
      user.lastName +
      " · " +
      (user.role === "admin" ? "Administrator" : "Underwriter"),
  );
}

// Close role switcher when clicking outside
document.addEventListener("click", function (e) {
  if (
    _roleSwitcherOpen &&
    !document.getElementById("userBadge").contains(e.target)
  ) {
    document.getElementById("roleSwitcherMenu").style.display = "none";
    _roleSwitcherOpen = false;
  }
});

function toggleProjectComplete() {
  var pid = window.currentProjectId;
  if (!pid) return;
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === pid;
  });
  if (!proj) return;
  var isDone =
    proj.status === "complete" ||
    proj.status === "completed" ||
    proj.status === "active";
  var sess = getSession();
  var isAdmin = sess && sess.role === "admin";

  // If already complete — only admin can revert
  if (isDone) {
    if (!isAdmin) {
      // underwriter: do nothing, button should already be hidden/disabled — safety guard
      return;
    }
    // Admin can revert directly without confirmation
    changeProjectStatus("draft");
    _updateToggleBtn(false);
    return;
  }

  // Marking as complete — underwriter needs confirmation dialog
  if (!isAdmin) {
    var overlay = document.getElementById("completeConfirmOverlay");
    if (overlay) {
      overlay.style.display = "flex";
    }
    return;
  }

  // Admin: mark complete directly
  changeProjectStatus("complete");
  _updateToggleBtn(true);
}

function closeCompleteConfirm() {
  var overlay = document.getElementById("completeConfirmOverlay");
  if (overlay) overlay.style.display = "none";
}

function confirmMarkComplete() {
  closeCompleteConfirm();
  changeProjectStatus("complete");
  _updateToggleBtn(true);
}

function _updateToggleBtn(isDone) {
  var btn = document.getElementById("detailStatusToggle");
  var lbl = document.getElementById("detailStatusToggleLabel");
  if (!btn || !lbl) return;
  var zh = currentLang === "zh";
  var sess = getSession();
  var isAdmin = sess && sess.role === "admin";

  if (isDone) {
    if (!isAdmin) {
      // Underwriter: hide the button entirely — status is locked
      btn.style.display = "none";
    } else {
      // Admin: show revert option
      btn.style.display = "";
      btn.style.background = "rgba(74,124,89,0.08)";
      btn.style.borderColor = "rgba(74,124,89,0.3)";
      btn.style.color = "var(--green)";
      lbl.textContent = zh ? "撤回为草稿" : "Revert to Draft";
    }
  } else {
    btn.style.display = "";
    btn.style.background = "var(--surface)";
    btn.style.borderColor = "var(--border)";
    btn.style.color = "var(--muted)";
    lbl.textContent = zh ? "标记为完成" : "Mark Complete";
  }
}

// ─── API KEY VALIDATION ───────────────────────────────────────────────────────

const API_CONFIGS = {
  rc: {
    inputId: "key-rentcast",
    statusId: "rc-status",
    msgId: "rc-msg",
    btnId: "rc-btn",
    label: "RentCast",
    // Format: starts with 'rc_' and at least 10 chars
    formatRe: /^rc_[a-zA-Z0-9_-]{6,}$/,
    formatHint: 'Key must start with "rc_" followed by alphanumeric characters',
    // Live endpoint — lightweight ping (expects 200 or 401/403, not CORS)
    endpoint: "https://api.rentcast.io/v1/markets?zipCode=10001&historyRange=1",
    authHeader: (k) => ({ "X-Api-Key": k }),
    okStatus: [200, 204],
    badStatus: [401, 403],
  },
  attom: {
    inputId: "key-attom",
    statusId: "attom-status",
    msgId: "attom-msg",
    btnId: "attom-btn",
    label: "ATTOM Data",
    formatRe: /^[a-zA-Z0-9]{16,}$/,
    formatHint: "ATTOM keys are alphanumeric, typically 32+ characters",
    endpoint:
      "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address1=4529+Winona+Court&address2=Denver%2C+CO+80212",
    authHeader: (k) => ({ apikey: k }),
    okStatus: [200],
    badStatus: [401, 403],
  },
  hd: {
    inputId: "key-hellodata",
    statusId: "hd-status",
    msgId: "hd-msg",
    btnId: "hd-btn",
    label: "HelloData",
    formatRe: /^hd_(live|test)_[a-zA-Z0-9_-]{6,}$/,
    formatHint: 'Key must start with "hd_live_" or "hd_test_"',
    endpoint: "https://api.hellodata.ai/v1/markets",
    authHeader: (k) => ({ Authorization: "Bearer " + k }),
    okStatus: [200, 204],
    badStatus: [401, 403],
  },
};

// Track per-key validation state: null=unverified, true=ok, false=invalid
const _apiKeyState = { rc: null, attom: null, hd: null };

function clearApiStatus(key) {
  _apiKeyState[key] = null;
  const cfg = API_CONFIGS[key];
  const inp = document.getElementById(cfg.inputId);
  const sta = document.getElementById(cfg.statusId);
  const msg = document.getElementById(cfg.msgId);
  const btn = document.getElementById(cfg.btnId);
  if (inp) {
    inp.style.borderColor = "";
  }
  if (sta) {
    sta.style.display = "none";
    sta.textContent = "";
  }
  if (msg) {
    msg.style.display = "none";
  }
  if (btn) {
    btn.textContent = "Verify";
    btn.innerHTML = "Verify";
    btn.style.color = "";
    btn.style.borderColor = "";
    btn.style.background = "";
    btn.disabled = false;
  }
}

function _setKeyState(key, state, message) {
  // state: 'ok' | 'error' | 'warn' | 'loading'
  const cfg = API_CONFIGS[key];
  const inp = document.getElementById(cfg.inputId);
  const sta = document.getElementById(cfg.statusId);
  const msg = document.getElementById(cfg.msgId);
  const btn = document.getElementById(cfg.btnId);

  const themes = {
    ok: {
      inputBorder: "1.5px solid rgba(74,124,89,0.6)",
      inputShadow: "0 0 0 3px rgba(74,124,89,0.12)",
      staColor: "var(--green)",
      staIcon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
      staLabel: "Valid",
      msgBg: "rgba(74,124,89,0.09)",
      msgBorder: "3px solid rgba(74,124,89,0.5)",
      msgColor: "#2d6b45",
      msgIcon: "✓",
      msgWeight: "600",
      msgSize: "13px",
    },
    error: {
      inputBorder: "1.5px solid #e05252",
      inputShadow: "0 0 0 3px rgba(192,57,43,0.1)",
      staColor: "#c0392b",
      staIcon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      staLabel: "Invalid",
      msgBg: "rgba(192,57,43,0.07)",
      msgBorder: "3px solid #e05252",
      msgColor: "#9b2335",
      msgIcon: "✕",
      msgWeight: "600",
      msgSize: "13px",
    },
    warn: {
      inputBorder: "1.5px solid rgba(139,106,46,0.5)",
      inputShadow: "0 0 0 3px rgba(139,106,46,0.07)",
      staColor: "var(--amber)",
      staIcon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      staLabel: "Unverified",
      msgBg: "rgba(139,106,46,0.07)",
      msgBorder: "3px solid rgba(139,106,46,0.45)",
      msgColor: "#7a5a1a",
      msgIcon: "⚠",
      msgWeight: "500",
      msgSize: "12px",
    },
    loading: {
      inputBorder: "1.5px solid var(--border)",
      inputShadow: "none",
      staColor: "var(--muted)",
      staIcon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg>`,
      staLabel: "Checking…",
      msgBg: "transparent",
      msgBorder: "none",
      msgColor: "var(--muted)",
      msgIcon: "",
      msgWeight: "400",
      msgSize: "11px",
    },
  };
  const t = themes[state] || themes.warn;

  if (inp) {
    inp.style.border = t.inputBorder;
    inp.style.boxShadow = t.inputShadow;
    inp.style.outline = "none";
  }
  if (sta) {
    sta.style.display = "inline-flex";
    sta.style.alignItems = "center";
    sta.style.gap = "4px";
    sta.style.color = t.staColor;
    sta.style.fontWeight = "600";
    sta.style.animation = state === "ok" ? "fadeUp 0.2s ease" : "";
    sta.innerHTML = t.staIcon + t.staLabel;
  }
  if (btn) {
    if (state === "ok") {
      btn.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Done';
      btn.style.color = "var(--green)";
      btn.style.borderColor = "rgba(74,124,89,0.35)";
      btn.style.background = "rgba(74,124,89,0.07)";
      btn.disabled = false;
    } else if (state === "loading") {
      btn.textContent = "…";
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.style.background = "";
      btn.disabled = true;
    } else {
      btn.textContent = "Verify";
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.style.background = "";
      btn.disabled = false;
    }
  }
  if (msg && message) {
    msg.style.display = "flex";
    msg.style.alignItems = "flex-start";
    msg.style.gap = "8px";
    msg.style.background = t.msgBg;
    msg.style.borderLeft = t.msgBorder;
    msg.style.borderTop = "none";
    msg.style.borderRight = "none";
    msg.style.borderBottom = "none";
    msg.style.borderRadius = "0 6px 6px 0";
    msg.style.color = t.msgColor;
    msg.style.fontWeight = t.msgWeight;
    msg.style.fontSize = t.msgSize;
    msg.style.padding = "9px 12px";
    msg.style.lineHeight = "1.45";
    if (state === "ok") {
      msg.style.animation = "fadeUp 0.25s ease";
      msg.innerHTML =
        `<span style="flex-shrink:0;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(74,124,89,0.15)">` +
        `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d6b45" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"` +
        ` style="stroke-dasharray:30;stroke-dashoffset:30;animation:checkDraw 0.35s ease 0.1s forwards">` +
        `<polyline points="20 6 9 17 4 12"/></svg></span>` +
        `<span>${message}</span>`;
      // Pulse the input border briefly
      if (inp) {
        inp.style.animation = "successPulse 0.7s ease";
        setTimeout(() => {
          if (inp) inp.style.animation = "";
        }, 800);
      }
    } else {
      msg.style.animation = "";
      msg.innerHTML =
        (t.msgIcon
          ? `<span style="flex-shrink:0;margin-top:1px;font-size:14px">${t.msgIcon}</span>`
          : "") + `<span>${message}</span>`;
    }
  } else if (msg) {
    msg.style.display = "none";
  }
}

async function validateSingleKey(key) {
  const cfg = API_CONFIGS[key];
  const inp = document.getElementById(cfg.inputId);
  const val = (inp ? inp.value : "").trim();

  // Empty = skip (allowed to be blank)
  if (!val) {
    _apiKeyState[key] = true; // blank = ok (optional field)
    _setKeyState(
      key,
      "warn",
      "No key entered — this integration will be disabled.",
    );
    return;
  }

  // Demo keys — bypass live call for UI testing
  const DEMO_KEYS = {
    rc: "rc_live_glcapital_demo",
    attom: "attomGLCapitalDemo2026",
    hd: "hd_live_glcapital_demo",
  };
  if (val === DEMO_KEYS[key]) {
    _apiKeyState[key] = true;
    await new Promise((r) => setTimeout(r, 900)); // simulate latency
    _setKeyState(key, "ok", cfg.label + " key is valid and active.");
    return;
  }

  // Format check first
  if (!cfg.formatRe.test(val)) {
    _apiKeyState[key] = false;
    _setKeyState(key, "error", "Invalid format. " + cfg.formatHint);
    return;
  }

  // Live API ping
  _setKeyState(key, "loading", "Contacting " + cfg.label + " API…");
  try {
    const res = await Promise.race([
      fetch(cfg.endpoint, {
        method: "GET",
        headers: { ...cfg.authHeader(val), Accept: "application/json" },
      }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), 8000),
      ),
    ]);

    if (cfg.okStatus.includes(res.status)) {
      _apiKeyState[key] = true;
      _setKeyState(key, "ok", cfg.label + " key is valid and active.");
    } else if (cfg.badStatus.includes(res.status)) {
      _apiKeyState[key] = false;
      _setKeyState(
        key,
        "error",
        "Authentication failed (HTTP " + res.status + "). Check your key.",
      );
    } else {
      // Unexpected status but not auth failure — treat as warn
      _apiKeyState[key] = true;
      _setKeyState(
        key,
        "warn",
        "Got HTTP " +
          res.status +
          " from " +
          cfg.label +
          ". Key format looks valid but response was unexpected.",
      );
    }
  } catch (err) {
    // CORS block or network error — format was valid, can't confirm live status
    _apiKeyState[key] = true; // don't block save on CORS
    if (err.message === "timeout") {
      _setKeyState(
        key,
        "warn",
        cfg.label + " API timed out. Key format is valid — save anyway?",
      );
    } else {
      _setKeyState(
        key,
        "warn",
        "Could not reach " +
          cfg.label +
          " (network/CORS). Key format looks valid.",
      );
    }
  }
}

async function saveApiKeys() {
  const zh = currentLang === "zh";

  // Run validation on any filled-in, unverified key
  const pending = [];
  for (const key of ["rc", "attom", "hd"]) {
    const cfg = API_CONFIGS[key];
    const val = (document.getElementById(cfg.inputId)?.value || "").trim();
    if (val && _apiKeyState[key] === null) {
      pending.push(validateSingleKey(key));
    }
  }
  if (pending.length) {
    await Promise.all(pending);
  }

  // Check if any key is in error state
  const failed = ["rc", "attom", "hd"].filter((k) => {
    const val = (
      document.getElementById(API_CONFIGS[k].inputId)?.value || ""
    ).trim();
    return val && _apiKeyState[k] === false;
  });

  if (failed.length) {
    const names = failed.map((k) => API_CONFIGS[k].label).join(", ");
    const hint = document.getElementById("save-hint");
    const banner = document.getElementById("save-error-banner");
    if (banner) banner.style.display = "flex";
    if (hint)
      hint.textContent =
        (zh ? "无法保存：" : "Cannot save: ") +
        names +
        (zh ? " 密钥无效" : " key(s) are invalid");
    toast(
      zh
        ? "请修正无效的 API Key 后再保存"
        : "Fix invalid API keys before saving",
      "error",
    );
    return;
  }

  // All clear — save to localStorage
  const saved = {};
  for (const key of ["rc", "attom", "hd"]) {
    const cfg = API_CONFIGS[key];
    const val = (document.getElementById(cfg.inputId)?.value || "").trim();
    saved[key] = val;
  }
  localStorage.setItem("glcapital_api_keys", JSON.stringify(saved));
  const banner = document.getElementById("save-error-banner");
  if (banner) banner.style.display = "none";
  toast(zh ? "API Keys 已保存 ✓" : "API keys saved ✓", "success");
}

// ─── GL Capital: Tax Assessment ───────────────────────────────────────────────
function getTaxAssessment() {
  var projs = getProjects();
  var proj = projs.find(function (p) {
    return p.id === currentProjectId;
  });
  if (!proj) return {};
  return proj.taxAssessment || {};
}
function saveTaxAssessment(data) {
  var projs = getProjects();
  var idx = projs.findIndex(function (p) {
    return p.id === currentProjectId;
  });
  if (idx === -1) return;
  projs[idx].taxAssessment = data;
  saveProjects(projs);
}
function _taxGetUnits() {
  var proj =
    getProjects().find(function (p) {
      return p.id === currentProjectId;
    }) || {};
  return proj.units || 0;
}
function _taxGetOfferPrice() {
  var proj =
    getProjects().find(function (p) {
      return p.id === currentProjectId;
    }) || {};
  return proj.offerPrice || 0;
}
function _taxGetT12PropertyTax() {
  // Try to read Property Tax from PF_DATA expenses
  if (!window.PF_DATA || !PF_DATA.expenses) return null;
  for (var i = 0; i < PF_DATA.expenses.length; i++) {
    if (
      PF_DATA.expenses[i].label === "Property Tax" &&
      PF_DATA.expenses[i].vals
    ) {
      return {
        y1: PF_DATA.expenses[i].vals[0] || 0,
        y2: PF_DATA.expenses[i].vals[1] || 0,
      };
    }
  }
  return null;
}

// Get the projected annual tax from Tax Assessment (used by Expenses linkage)
function getTaxProjectedAnnual() {
  var ta = getTaxAssessment();
  var offerPrice = _taxGetOfferPrice();
  var ratio =
    (ta.assessmentRatio != null ? parseFloat(ta.assessmentRatio) : 100) / 100;
  var projRate =
    (ta.projectedRate != null
      ? parseFloat(ta.projectedRate)
      : ta.currentRate != null
        ? parseFloat(ta.currentRate)
        : 1.62) / 100;
  var projValue = offerPrice * ratio;
  if (!projValue) return 0;
  return projValue * projRate;
}

function renderTaxTable() {
  var ta = getTaxAssessment();
  var units = _taxGetUnits();
  var offerPrice = _taxGetOfferPrice();
  var t12Tax = _taxGetT12PropertyTax();
  var asmt = getProjectAssumptions();

  // Defaults
  var curValue = ta.currentValue != null ? parseFloat(ta.currentValue) : "";
  var curRate = ta.currentRate != null ? parseFloat(ta.currentRate) : 1.62;
  var asmtRatio =
    ta.assessmentRatio != null ? parseFloat(ta.assessmentRatio) : 100;
  var projRate =
    ta.projectedRate != null ? parseFloat(ta.projectedRate) : curRate;

  // Computed
  var curAnnual =
    curValue !== "" ? (parseFloat(curValue) || 0) * (curRate / 100) : 0;
  var projAssessedValue = offerPrice * (asmtRatio / 100);
  var projAnnual = projAssessedValue * (projRate / 100);
  var taxPerUnit = units > 0 ? curAnnual / units : 0;
  var projPerUnit = units > 0 ? projAnnual / units : 0;

  var fmt = function (n) {
    return n ? "$" + Math.round(n).toLocaleString() : "—";
  };
  var inputStyle =
    "border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:13px;font-family:inherit;color:var(--header);background:transparent;outline:none;text-align:right;width:160px;";
  var readonlyStyle =
    "font-size:14px;font-weight:700;color:var(--blue);text-align:right;min-width:160px;";
  var labelStyle = "font-size:12px;color:var(--body);min-width:200px;";
  var rowStyle =
    "display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);";

  // ── Section 1: Current ──
  var sec1 = document.getElementById("taxCurrentSection");
  if (sec1) {
    var html1 = "";
    html1 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Current Assessed Value</span>' +
      '<input type="number" id="taxCurValue" value="' +
      (curValue !== "" ? curValue : "") +
      '" placeholder="e.g. 3,100,000" min="0" step="10000" ' +
      'oninput="onTaxFieldChange(\'currentValue\',this.value)" style="' +
      inputStyle +
      '">' +
      "</div>";
    html1 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Current Tax Rate (%)</span>' +
      '<input type="number" id="taxCurRate" value="' +
      curRate +
      '" min="0" max="100" step="0.001" ' +
      'oninput="onTaxFieldChange(\'currentRate\',this.value)" style="' +
      inputStyle +
      'width:100px;">' +
      "</div>";
    html1 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Current Annual Tax</span>' +
      '<span id="taxCurAnnual" style="' +
      readonlyStyle +
      '">' +
      (curAnnual ? fmt(curAnnual) : "—") +
      "</span>" +
      "</div>";
    html1 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Tax Per Unit</span>' +
      '<span id="taxCurPerUnit" style="' +
      readonlyStyle +
      'font-size:12px;font-weight:600;color:var(--body);">' +
      (taxPerUnit ? fmt(taxPerUnit) + "/yr" : "—") +
      "</span>" +
      "</div>";
    // T12 reference
    if (t12Tax) {
      html1 +=
        '<div style="padding:8px 0;font-size:11px;color:var(--muted);border-top:1px solid var(--border);margin-top:4px">' +
        '<span style="display:inline-block;padding:2px 7px;border-radius:3px;background:rgba(46,125,50,0.08);color:#2E7D32;font-weight:700;font-size:10px;margin-right:6px">T12</span>' +
        "Property Tax: " +
        fmt(t12Tax.y1) +
        " (Y1) / " +
        fmt(t12Tax.y2) +
        " (Y2)" +
        "</div>";
    }
    sec1.innerHTML = html1;
  }

  // ── Section 2: Post-Acquisition ──
  var sec2 = document.getElementById("taxProjectedSection");
  if (sec2) {
    var html2 = "";
    html2 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Purchase Price</span>' +
      '<span id="taxPurchasePrice" style="' +
      readonlyStyle +
      '">' +
      (offerPrice
        ? fmt(offerPrice)
        : '<span style="color:var(--muted);font-size:12px;font-weight:400">Set in Purchase Price tab</span>') +
      "</span>" +
      "</div>";
    html2 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Assessment Ratio (%)</span>' +
      '<input type="number" id="taxAsmtRatio" value="' +
      asmtRatio +
      '" min="0" max="200" step="1" ' +
      'oninput="onTaxFieldChange(\'assessmentRatio\',this.value)" style="' +
      inputStyle +
      'width:100px;">' +
      "</div>";
    html2 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Projected Assessed Value</span>' +
      '<span id="taxProjValue" style="' +
      readonlyStyle +
      '">' +
      (projAssessedValue ? fmt(projAssessedValue) : "—") +
      "</span>" +
      "</div>";
    html2 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Projected Tax Rate (%)</span>' +
      '<input type="number" id="taxProjRate" value="' +
      projRate +
      '" min="0" max="100" step="0.001" ' +
      'oninput="onTaxFieldChange(\'projectedRate\',this.value)" style="' +
      inputStyle +
      'width:100px;">' +
      "</div>";
    html2 +=
      '<div style="' +
      rowStyle +
      '">' +
      '<span style="' +
      labelStyle +
      '">Projected Annual Tax</span>' +
      '<span id="taxProjAnnual" style="' +
      readonlyStyle +
      '">' +
      (projAnnual ? fmt(projAnnual) : "—") +
      "</span>" +
      "</div>";
    html2 +=
      '<div style="' +
      rowStyle +
      'border-bottom:none">' +
      '<span style="' +
      labelStyle +
      '">Projected Tax Per Unit</span>' +
      '<span id="taxProjPerUnit" style="' +
      readonlyStyle +
      'font-size:12px;font-weight:600;color:var(--body);">' +
      (projPerUnit ? fmt(projPerUnit) + "/yr" : "—") +
      "</span>" +
      "</div>";
    sec2.innerHTML = html2;
  }

  // Tax increase alert
  var bar = document.getElementById("taxIncreaseBar");
  if (bar) {
    if (curAnnual > 0 && projAnnual > 0 && projAnnual !== curAnnual) {
      var diff = projAnnual - curAnnual;
      var pct = ((diff / curAnnual) * 100).toFixed(1);
      var sign = diff > 0 ? "+" : "";
      bar.style.display = "";
      if (diff > 0) {
        bar.style.borderTopColor = "rgba(217,119,6,0.2)";
        bar.style.background = "rgba(217,119,6,0.06)";
        bar.style.color = "#92400e";
        bar.innerHTML =
          "&#9888; Tax Increase: " +
          sign +
          fmt(diff) +
          " (" +
          sign +
          pct +
          "%) — Post-acquisition reassessment will raise property tax";
      } else {
        bar.style.borderTopColor = "rgba(46,125,50,0.2)";
        bar.style.background = "rgba(46,125,50,0.06)";
        bar.style.color = "#2E7D32";
        bar.innerHTML =
          "&#10003; Tax Decrease: " + fmt(diff) + " (" + pct + "%)";
      }
    } else {
      bar.style.display = "none";
    }
  }

  // ── Section 3: Multi-Year ──
  var nCols = 7;
  var escalation = asmt.taxGrowth;
  var escRow = document.getElementById("taxEscalationRow");
  if (escRow) {
    escRow.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:12px;color:var(--body)">Tax Escalation Rate (%)</span>' +
      '<input type="number" id="taxEscRate" value="' +
      escalation +
      '" min="0" max="20" step="0.1" ' +
      'oninput="onTaxEscalationChange(this.value)" style="' +
      inputStyle +
      'width:80px;">' +
      '<span style="font-size:10px;color:var(--muted)">Synced with Growth Assumptions</span>' +
      "</div>";
  }

  var yearHead = document.getElementById("taxYearHead");
  var yearRow = document.getElementById("taxYearRow");
  var yearPURow = document.getElementById("taxYearPerUnitRow");
  if (yearHead && yearRow) {
    var headHtml =
      '<th style="padding:9px 14px;text-align:left;font-weight:700;color:var(--header);min-width:140px"></th>';
    var rowHtml =
      '<td style="padding:8px 14px;font-size:12px;font-weight:700;color:var(--header)">Annual Tax</td>';
    var puHtml =
      '<td style="padding:6px 14px;font-size:11px;color:var(--muted)">Per Unit</td>';
    var rate = 1 + escalation / 100;
    var base = projAnnual || curAnnual || 0;

    for (var yi = 0; yi < nCols; yi++) {
      var yLabel = "Y" + (yi + 1);
      var yVal;
      if (yi === 0) {
        yVal = base;
      } else {
        yVal = base * Math.pow(rate, yi);
      }
      var isProj = yi >= 3;
      var borderL =
        yi === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = isProj ? "background:rgba(74,124,89,0.03);" : "";
      headHtml +=
        '<th style="padding:9px 10px;text-align:right;font-weight:700;color:var(--header);font-size:11px;' +
        bg +
        borderL +
        '">' +
        yLabel +
        "</th>";
      rowHtml +=
        '<td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:var(--blue);' +
        bg +
        borderL +
        '">' +
        (yVal ? fmt(yVal) : "—") +
        "</td>";
      var puVal = units > 0 && yVal ? Math.round(yVal / units) : 0;
      puHtml +=
        '<td style="padding:6px 10px;text-align:right;font-size:11px;color:var(--muted);' +
        bg +
        borderL +
        '">' +
        (puVal ? "$" + puVal.toLocaleString() : "—") +
        "</td>";
    }
    yearHead.innerHTML = headHtml;
    yearRow.innerHTML = rowHtml;
    if (yearPURow) yearPURow.innerHTML = puHtml;
  }

  // ── Summary strip ──
  var el;
  el = document.getElementById("taxSumCurrent");
  if (el) el.textContent = curAnnual ? fmt(curAnnual) : "—";
  el = document.getElementById("taxSumProjected");
  if (el) el.textContent = projAnnual ? fmt(projAnnual) : "—";
  el = document.getElementById("taxSumPerUnit");
  if (el) el.textContent = projPerUnit ? fmt(projPerUnit) + "/yr" : "—";
  var incEl = document.getElementById("taxSumIncrease");
  if (incEl) {
    if (curAnnual > 0 && projAnnual > 0) {
      var d = projAnnual - curAnnual;
      var p = ((d / curAnnual) * 100).toFixed(1);
      incEl.textContent =
        (d >= 0 ? "+" : "") + fmt(d) + " (" + (d >= 0 ? "+" : "") + p + "%)";
      incEl.style.color = d > 0 ? "#d97706" : "#2E7D32";
    } else {
      incEl.textContent = "—";
      incEl.style.color = "#d97706";
    }
  }
}

function onTaxFieldChange(field, val) {
  var ta = getTaxAssessment();
  ta[field] = val;
  saveTaxAssessment(ta);
  _taxUpdateComputed();
}

function onTaxEscalationChange(val) {
  // Sync with global assumptions
  var projs = getProjects();
  var idx = projs.findIndex(function (p) {
    return p.id === currentProjectId;
  });
  if (idx === -1) return;
  if (!projs[idx].assumptions) projs[idx].assumptions = {};
  projs[idx].assumptions.taxGrowth = parseFloat(val) || 3.0;
  saveProjects(projs);
  _taxUpdateComputed();
}

// Lightweight update: only recompute readonly/computed fields, preserve input focus
function _taxUpdateComputed() {
  var ta = getTaxAssessment();
  var units = _taxGetUnits();
  var offerPrice = _taxGetOfferPrice();
  var asmt = getProjectAssumptions();

  var curValue = ta.currentValue != null ? parseFloat(ta.currentValue) : 0;
  var curRate = ta.currentRate != null ? parseFloat(ta.currentRate) : 1.62;
  var asmtRatio =
    ta.assessmentRatio != null ? parseFloat(ta.assessmentRatio) : 100;
  var projRate =
    ta.projectedRate != null ? parseFloat(ta.projectedRate) : curRate;

  var curAnnual = (curValue || 0) * (curRate / 100);
  var projAssessedValue = offerPrice * (asmtRatio / 100);
  var projAnnual = projAssessedValue * (projRate / 100);
  var taxPerUnit = units > 0 ? curAnnual / units : 0;
  var projPerUnit = units > 0 ? projAnnual / units : 0;

  var fmt = function (n) {
    return n ? "$" + Math.round(n).toLocaleString() : "—";
  };
  var _s = function (id, txt) {
    var e = document.getElementById(id);
    if (e) e.textContent = txt;
  };

  // Section 1 computed
  _s("taxCurAnnual", curAnnual ? fmt(curAnnual) : "—");
  _s("taxCurPerUnit", taxPerUnit ? fmt(taxPerUnit) + "/yr" : "—");

  // Section 2 computed
  _s("taxProjValue", projAssessedValue ? fmt(projAssessedValue) : "—");
  _s("taxProjAnnual", projAnnual ? fmt(projAnnual) : "—");
  _s("taxProjPerUnit", projPerUnit ? fmt(projPerUnit) + "/yr" : "—");

  // Tax increase alert bar
  var bar = document.getElementById("taxIncreaseBar");
  if (bar) {
    if (curAnnual > 0 && projAnnual > 0 && projAnnual !== curAnnual) {
      var diff = projAnnual - curAnnual;
      var pct = ((diff / curAnnual) * 100).toFixed(1);
      var sign = diff > 0 ? "+" : "";
      bar.style.display = "";
      if (diff > 0) {
        bar.style.borderTopColor = "rgba(217,119,6,0.2)";
        bar.style.background = "rgba(217,119,6,0.06)";
        bar.style.color = "#92400e";
        bar.innerHTML =
          "&#9888; Tax Increase: " +
          sign +
          fmt(diff) +
          " (" +
          sign +
          pct +
          "%) — Post-acquisition reassessment will raise property tax";
      } else {
        bar.style.borderTopColor = "rgba(46,125,50,0.2)";
        bar.style.background = "rgba(46,125,50,0.06)";
        bar.style.color = "#2E7D32";
        bar.innerHTML =
          "&#10003; Tax Decrease: " + fmt(diff) + " (" + pct + "%)";
      }
    } else {
      bar.style.display = "none";
    }
  }

  // Multi-year projection table
  var nCols = 7;
  var escalation = asmt.taxGrowth;
  var rate = 1 + escalation / 100;
  var base = projAnnual || curAnnual || 0;
  var yearRow = document.getElementById("taxYearRow");
  var yearPURow = document.getElementById("taxYearPerUnitRow");
  if (yearRow) {
    var rowHtml =
      '<td style="padding:8px 14px;font-size:12px;font-weight:700;color:var(--header)">Annual Tax</td>';
    var puHtml =
      '<td style="padding:6px 14px;font-size:11px;color:var(--muted)">Per Unit</td>';
    for (var yi = 0; yi < nCols; yi++) {
      var yVal = yi === 0 ? base : base * Math.pow(rate, yi);
      var isProj = yi >= 3;
      var borderL =
        yi === 3 ? "border-left:2px solid rgba(74,124,89,0.3);" : "";
      var bg = isProj ? "background:rgba(74,124,89,0.03);" : "";
      rowHtml +=
        '<td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:var(--blue);' +
        bg +
        borderL +
        '">' +
        (yVal ? fmt(yVal) : "—") +
        "</td>";
      var puVal = units > 0 && yVal ? Math.round(yVal / units) : 0;
      puHtml +=
        '<td style="padding:6px 10px;text-align:right;font-size:11px;color:var(--muted);' +
        bg +
        borderL +
        '">' +
        (puVal ? "$" + puVal.toLocaleString() : "—") +
        "</td>";
    }
    yearRow.innerHTML = rowHtml;
    if (yearPURow) yearPURow.innerHTML = puHtml;
  }

  // Summary strip
  var el;
  el = document.getElementById("taxSumCurrent");
  if (el) el.textContent = curAnnual ? fmt(curAnnual) : "—";
  el = document.getElementById("taxSumProjected");
  if (el) el.textContent = projAnnual ? fmt(projAnnual) : "—";
  el = document.getElementById("taxSumPerUnit");
  if (el) el.textContent = projPerUnit ? fmt(projPerUnit) + "/yr" : "—";
  var incEl = document.getElementById("taxSumIncrease");
  if (incEl) {
    if (curAnnual > 0 && projAnnual > 0) {
      var d = projAnnual - curAnnual;
      var p = ((d / curAnnual) * 100).toFixed(1);
      incEl.textContent =
        (d >= 0 ? "+" : "") + fmt(d) + " (" + (d >= 0 ? "+" : "") + p + "%)";
      incEl.style.color = d > 0 ? "#d97706" : "#2E7D32";
    } else {
      incEl.textContent = "—";
      incEl.style.color = "#d97706";
    }
  }
}

// ─── PF Sub-tab switching ─────────────────────────────────────────────────────
function switchPFSubTab(prefix, tid) {
  // hide all panels with id starting pfsp-pf-
  document.querySelectorAll('[id^="pfsp-pf-"]').forEach(function (el) {
    el.style.display = "none";
  });
  // deactivate all buttons with id starting pfst-pf-
  document
    .querySelectorAll('[id^="pfst-' + prefix + '-"]')
    .forEach(function (el) {
      el.classList.remove("pf-subtab-active");
    });
  var panel = document.getElementById("pfsp-pf-" + tid);
  if (panel) panel.style.display = "";
  var btn = document.getElementById("pfst-" + prefix + "-" + tid);
  if (btn) btn.classList.add("pf-subtab-active");
  // rebuild NOI strip if switching to summary
  if (tid === "summary") {
    buildNoiStrip && buildNoiStrip();
    if (typeof renderRentRoll === "function") renderRentRoll();
    if (typeof populateSummary === "function") populateSummary();
  }
  if (tid === "revexp") {
    buildPFTable && buildPFTable();
  }
  if (tid === "closing") {
    if (typeof recalcClosingCostTotals === "function")
      recalcClosingCostTotals();
  }
  if (tid === "purchase") {
    if (typeof buildPurchasePrice === "function") buildPurchasePrice();
  }
  if (tid === "tax") {
    renderTaxTable && renderTaxTable();
  }
}
function switchPFSubTab2(group, tid) {
  // hide all panels for this group
  document
    .querySelectorAll('[id^="pfsp2-' + group + '-"]')
    .forEach(function (el) {
      el.style.display = "none";
    });
  document
    .querySelectorAll('[id^="pfst2-' + group + '-"]')
    .forEach(function (el) {
      el.classList.remove("pf-subtab-active");
    });
  var p = document.getElementById("pfsp2-" + tid);
  if (p) p.style.display = "";
  var b = document.getElementById("pfst2-" + tid);
  if (b) b.classList.add("pf-subtab-active");
}

// --- STATIC EVENT LISTENERS (replaces inline onclick) ---
_domReady(function setupListeners() {
  function on(sel, evt, fn) {
    var el = document.querySelector(sel);
    if (el) el.addEventListener(evt, fn);
  }
  function onAll(sel, evt, fn) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.addEventListener(evt, fn);
    });
  }

  on(".modal-close", "click", function (event) {
    closeModal();
  });
  on("#mobileMenuBtn", "click", function (event) {
    document.querySelector(".sidebar").classList.toggle("open");
  });
  on("#nav-uw-parent", "click", function (event) {
    toggleSubmenu("uw");
  });
  on("#nav-projects", "click", function (event) {
    navTo("projects", document.getElementById("nav-projects"));
  });
  on("#nav-users", "click", function (event) {
    navTo("users", document.getElementById("nav-users"));
  });
  on("#nav-settings", "click", function (event) {
    navTo("settings", document.getElementById("nav-settings"));
  });
  on("#langToggleBtn", "click", function (event) {
    toggleLang();
  });
  on("#userBadge", "click", function (event) {
    toggleRoleSwitcher(event);
  });
  on("#filterAll", "click", function (event) {
    setProjectFilter("all", event.currentTarget);
  });
  on("#filterDraft", "click", function (event) {
    setProjectFilter("draft", event.currentTarget);
  });
  on("#filterComplete", "click", function (event) {
    setProjectFilter("complete", event.currentTarget);
  });
  on("#detailStatusToggle", "click", function (event) {
    toggleProjectComplete();
  });
  on("#globalEditToggleBtn", "click", function (event) {
    toggleGlobalEditMode();
  });
  on("#ptab-proforma", "click", function (event) {
    switchProjTab("proforma", document.getElementById("ptab-proforma"));
  });
  on("#ptab-files", "click", function (event) {
    switchProjTab("files", document.getElementById("ptab-files"));
  });
  on("#ptab-rentroll", "click", function (event) {
    switchProjTab("rentroll", document.getElementById("ptab-rentroll"));
  });
  on("#ptab-hellodata", "click", function (event) {
    switchProjTab("hellodata", document.getElementById("ptab-hellodata"));
  });
  on("#ptab-debt", "click", function (event) {
    switchProjTab("debt", document.getElementById("ptab-debt"));
  });
  on("#t12UploadBtn", "click", function (event) {
    document.getElementById("t12Input").click();
  });
  on("#t12DeleteBtn", "click", function (event) {
    deleteT12();
  });
  on("#pfst-pf-summary", "click", function (event) {
    switchPFSubTab("pf", "summary");
  });
  on("#pfst-pf-revexp", "click", function (event) {
    switchPFSubTab("pf", "revexp");
  });
  on("#pfst-pf-closing", "click", function (event) {
    switchPFSubTab("pf", "closing");
  });
  on("#pfst-pf-purchase", "click", function (event) {
    switchPFSubTab("pf", "purchase");
  });
  on("#pfst-pf-equity", "click", function (event) {
    switchPFSubTab("pf", "equity");
  });
  on("#pfst-pf-sale", "click", function (event) {
    switchPFSubTab("pf", "sale");
  });
  on("#pfst-pf-eqreq", "click", function (event) {
    switchPFSubTab("pf", "eqreq");
  });
  on("#pfst-pf-refi", "click", function (event) {
    switchPFSubTab("pf", "refi");
  });
  on("#pfst-pf-tax", "click", function (event) {
    switchPFSubTab("pf", "tax");
  });
  on("#pfst-pf-waterfall", "click", function (event) {
    switchPFSubTab("pf", "waterfall");
  });
  on("#pfst2-se-reg", "click", function (event) {
    switchPFSubTab2("se", "se-reg");
  });
  on("#pfst2-se-ref", "click", function (event) {
    switchPFSubTab2("se", "se-ref");
  });
  on("#pfst2-eq-reg", "click", function (event) {
    switchPFSubTab2("eq", "eq-reg");
  });
  on("#pfst2-eq-ref", "click", function (event) {
    switchPFSubTab2("eq", "eq-ref");
  });
  on("#rrUploadBtn", "click", function (event) {
    document.getElementById("rrInput").click();
  });
  on("#rrDeleteBtn", "click", function (event) {
    deleteRR();
  });
  on("#saveKeysBtn", "click", function (event) {
    saveApiKeys();
  });

  // Auth tab buttons
  onAll(".auth-tab-btn", "click", function (event) {
    var tab =
      event.currentTarget.textContent.trim() === "Sign In"
        ? "login"
        : "register";
    switchAuthTab(tab, event.currentTarget);
  });

  // Assumptions overlay click-outside
  on("#assumptionsOverlay", "click", function (event) {
    if (event.target === event.currentTarget) closeAssumptionsModal();
  });
});

// --- REMAINING STATIC EVENT LISTENERS ---
_domReady(function setupListeners2() {
  function on(sel, evt, fn) {
    var el = document.querySelector(sel);
    if (el) el.addEventListener(evt, fn);
  }

  on("#loginSubmitBtn", "click", function () {
    doLogin();
  });
  on("#registerSubmitBtn", "click", function () {
    doRegister();
  });
  on("#newProjectBtn", "click", function () {
    openNewProjectModal();
  });
  on("#backToProjectsBtn", "click", function () {
    navTo("projects", document.getElementById("nav-projects"));
  });
  on("#savePFBtn", "click", function () {
    savePF();
  });
  on("#goToFilesTabBtn", "click", function () {
    switchProjTab("files", document.getElementById("ptab-files"));
  });
  on("#loadDemoPFBtn", "click", function () {
    loadDemoProForma();
  });
  on("#openAssumptionsBtn", "click", function () {
    openAssumptionsModal();
  });
  on("#exportPFBtn", "click", function () {
    exportPF();
  });
  // addTaxRowBtn removed — Tax Assessment redesigned to single-property model

  // ── Universal dblclick inline editor ─────────────────────────
  function _inlineEditCell(el, onCommit) {
    if (el.querySelector("input")) return; // already editing
    var oldText = el.textContent.trim();
    var inp = document.createElement("input");
    inp.type = "text";
    inp.value = oldText === "—" || oldText === "" ? "" : oldText;
    inp.style.cssText =
      "width:auto;max-width:120px;min-width:40px;border:none;background:transparent;font-size:inherit;font-family:inherit;font-weight:inherit;color:inherit;outline:2px solid var(--accent);border-radius:3px;padding:1px 4px;box-sizing:border-box;text-align:inherit;";
    el.innerHTML = "";
    el.appendChild(inp);
    inp.focus();
    inp.select();
    function commit() {
      var v = inp.value.trim();
      el.textContent = v || "—";
      if (typeof onCommit === "function") onCommit(v);
    }
    inp.addEventListener("blur", commit);
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        inp.blur();
      }
      if (ev.key === "Escape") {
        el.textContent = oldText;
      }
    });
  }

  document.addEventListener("dblclick", function (e) {
    if (!_globalEditMode) return;
    var target = e.target;

    // 1. T12 value spans
    var t12span = target.closest(".t12-amt");
    if (t12span) {
      t12EditClick(t12span);
      return;
    }

    // 2. Rent Roll editable cells
    var rrTd = target.closest("td[data-rr-edit]");
    if (rrTd) {
      rrCellEdit(rrTd);
      return;
    }

    // 3. PF Revenue & Expenses cells (tagged by makeCells)
    var pfTd = target.closest("td.pf-rev-cell");
    if (pfTd) {
      var pfLabel = pfTd.dataset.pfLabel;
      var pfCi = pfTd.dataset.pfCi;
      _inlineEditCell(pfTd, function (newVal) {
        var num = parseFloat(newVal.replace(/[$,()]/g, ""));
        if (isNaN(num)) return;
        var key =
          (pfLabel || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") +
          "_" +
          pfCi;
        pfOverrides[key] = {
          original: parseFloat(pfTd.dataset.pfVal) || 0,
          value: num,
          source: "manual",
          timestamp: new Date().toLocaleTimeString(),
        };
        savePFOverrides(currentProjectId);
        buildPFTable();
      });
      return;
    }

    // 4a. Yes/No select cells (Transfer of Membership)
    var yesnoCel = target.closest("td[data-cc-yesno]");
    if (yesnoCel && !yesnoCel.querySelector("select")) {
      var oldYN = yesnoCel.textContent.trim();
      var sel = document.createElement("select");
      sel.className = "pct-input cc-yes-no-select";
      sel.style.cssText =
        "width:60px;outline:2px solid var(--accent);border-radius:3px;";
      ["Yes", "No"].forEach(function (v) {
        var opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        if (v === oldYN) opt.selected = true;
        sel.appendChild(opt);
      });
      yesnoCel.innerHTML = "";
      yesnoCel.appendChild(sel);
      sel.focus();
      function commitYN() {
        var v = sel.value;
        yesnoCel.textContent = v || "—";
      }
      sel.addEventListener("blur", commitYN);
      sel.addEventListener("change", function () {
        sel.blur();
      });
      return;
    }

    // 4b. Any cell tagged data-editable (static HTML sub-tabs & Closing Costs)
    var staticTd = target.closest("td[data-editable]");
    if (staticTd) {
      var cellId = staticTd.id;
      var commitFn = null;
      // Ask Price / Offer Price: persist to project and update KPIs
      if (
        cellId === "pfSummAskPriceCell" ||
        cellId === "pfSummOfferPriceCell"
      ) {
        commitFn = function (newVal) {
          var pid = window._currentProjectId || currentProjectId;
          var projs = getProjects();
          var idx = projs.findIndex(function (p) {
            return p.id === pid;
          });
          if (idx === -1) return;
          var numVal = parseFloat(String(newVal).replace(/[^0-9.-]/g, "")) || 0;
          var field =
            cellId === "pfSummAskPriceCell" ? "askPrice" : "offerPrice";
          projs[idx][field] = numVal;
          saveProjects(projs);
          // Format display
          if (numVal > 0) {
            staticTd.textContent = "$\u00a0" + numVal.toLocaleString();
          }
          if (typeof updateSummKpis === "function") updateSummKpis();
        };
      }
      // Purchase Price (As-is value): persist and recalc derived fields
      if (!commitFn && cellId === "ppAsIsValue") {
        commitFn = function (newVal) {
          var numVal = parseFloat(String(newVal).replace(/[^0-9.-]/g, "")) || 0;
          if (numVal > 0) {
            staticTd.textContent =
              "$\u00a0" + Math.round(numVal).toLocaleString();
            // Also save as offerPrice
            var pid = window._currentProjectId || currentProjectId;
            var projs = getProjects();
            var idx = projs.findIndex(function (p) {
              return p.id === pid;
            });
            if (idx !== -1) {
              projs[idx].offerPrice = numVal;
              saveProjects(projs);
            }
          }
          if (typeof recalcClosingCostTotals === "function")
            recalcClosingCostTotals();
          if (typeof buildPurchasePrice === "function") buildPurchasePrice();
        };
      }
      // Closing Costs amount cells: recalc totals after edit
      if (!commitFn && staticTd.closest("#pfsp-pf-closing .cc-row")) {
        commitFn = function () {
          if (typeof recalcClosingCostTotals === "function")
            recalcClosingCostTotals();
        };
      }
      _inlineEditCell(staticTd, commitFn);
      return;
    }
  });

  // ── Right-click context menu ──────────────────────────────────
  function _showCtxMenu(x, y, tr) {
    _ctxTargetRow = tr;
    var menu = document.getElementById("ctxMenu");
    if (!menu) return;
    menu.style.display = "block";
    // Boundary-safe positioning
    var mw = 148,
      mh = 40;
    var left = x + mw > window.innerWidth ? x - mw : x + 2;
    var top = y + mh > window.innerHeight ? y - mh : y + 2;
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    tr.classList.add("ctx-row-highlight");
  }
  function _hideCtxMenu() {
    var menu = document.getElementById("ctxMenu");
    if (menu) menu.style.display = "none";
    if (_ctxTargetRow) {
      _ctxTargetRow.classList.remove("ctx-row-highlight");
      _ctxTargetRow = null;
    }
  }
  document.addEventListener("contextmenu", function (e) {
    if (!_globalEditMode) return;
    var tr = e.target.closest("#pfUnitMixBody tr:not(#rrTotalRow)");
    if (!tr) return;
    e.preventDefault();
    _hideCtxMenu();
    _showCtxMenu(e.clientX, e.clientY, tr);
  });
  document.addEventListener("click", function (e) {
    var menu = document.getElementById("ctxMenu");
    if (menu && menu.style.display !== "none" && !e.target.closest("#ctxMenu"))
      _hideCtxMenu();
  });
  document.addEventListener(
    "scroll",
    function () {
      _hideCtxMenu();
    },
    true,
  );
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") _hideCtxMenu();
  });
  on("#ctxDeleteBtn", "click", function () {
    if (!_ctxTargetRow) {
      _hideCtxMenu();
      return;
    }
    var tr = _ctxTargetRow;
    _hideCtxMenu();
    if (tr.closest("#pfUnitMixBody")) {
      tr.remove();
      rrRecalcTotals();
    }
  });
  on("#debtProjectSwitcher", "click", function () {
    toggleProjectDropdown("debt");
  });
  on("#addUserBtn", "click", function () {
    openAddUserModal();
  });
  on("#rc-btn", "click", function () {
    validateSingleKey("rc");
  });
  on("#attom-btn", "click", function () {
    validateSingleKey("attom");
  });
  on("#hd-btn", "click", function () {
    validateSingleKey("hd");
  });
  on("#rejectModalCloseBtn", "click", function () {
    document.getElementById("rejectModal").style.display = "none";
  });
  on("#rejectModalCancelBtn", "click", function () {
    document.getElementById("rejectModal").style.display = "none";
  });
  on("#rejectModalConfirmBtn", "click", function () {
    confirmReject();
  });
  on("#approveModalCloseBtn", "click", function () {
    document.getElementById("approveModal").style.display = "none";
  });
  on("#approveModalCancelBtn", "click", function () {
    document.getElementById("approveModal").style.display = "none";
  });
  on("#approveModalConfirmBtn", "click", function () {
    confirmApprove();
  });
  on("#completeConfirmCancelBtn", "click", function () {
    closeCompleteConfirm();
  });
  on("#completeConfirmBtn", "click", function () {
    confirmMarkComplete();
  });
  on("#assumptionsCloseBtn", "click", function () {
    closeAssumptionsModal();
  });
  on("#assumptionsCancelBtn", "click", function () {
    closeAssumptionsModal();
  });
  on("#assumptionsSaveBtn", "click", function () {
    saveAssumptions();
  });

  // Dropzone click-to-upload — only if click is on the dropzone itself, not on buttons inside it
  var t12Drop = document.getElementById("t12DropZone");
  if (t12Drop)
    t12Drop.addEventListener("click", function (e) {
      if (e.target.closest("button") || e.target.closest("input")) return;
      document.getElementById("t12Input").click();
    });
  var rrDrop = document.getElementById("rrDropZone");
  if (rrDrop)
    rrDrop.addEventListener("click", function (e) {
      if (e.target.closest("button") || e.target.closest("input")) return;
      document.getElementById("rrInput").click();
    });

  // React onChange handles file inputs — no duplicate native listeners needed
});

function downloadOriginalFile() {
  toast(
    currentLang === "zh"
      ? "原始文件已保留，可随时下载"
      : "Original file retained — available for download",
  );
}

// ─── Tab Red Dot Indicators ────────────────────────────────────────────────
function updateTabDots() {
  var proj =
    currentProjectId &&
    getProjects().find(function (p) {
      return p.id === currentProjectId;
    });
  var files = (proj && proj.files) || [];
  var hasT12 = files.some(function (f) {
    return ["T12", "Selling Model"].includes(f.parsedAs || f.type);
  });
  var hasRR = files.some(function (f) {
    return ["Rent Roll"].includes(f.parsedAs || f.type);
  });
  var hasDebt = files.some(function (f) {
    return ["Debt Current", "Debt Refinance"].includes(f.parsedAs || f.type);
  });
  var hasHD = !!getHDMeta(currentProjectId);
  var allUploaded = hasT12 && hasRR && hasDebt && hasHD;
  var dotFiles = document.getElementById("tabdot-files");
  if (dotFiles) dotFiles.classList.toggle("visible", !allUploaded);
}
window.updateTabDots = updateTabDots;

// ─── KPI Summary Strip ────────────────────────────────────────────────────
function _getActiveUnitsValue() {
  // Same logic as _resolveUnits but returns display string
  var v = _resolveUnits(currentProjectId);
  return v && v > 0 ? v : "—";
}

function updateSummKpis() {
  // Units — from Total Apartment Units selection
  var kpiUnits = document.getElementById("kpiUnits");
  if (kpiUnits) {
    kpiUnits.textContent = _getActiveUnitsValue() || "—";
  }

  // As-is Rent & Projected Rent from RR total row
  var asIsEl = document.getElementById("rrTotalAsIs");
  var projEl = document.getElementById("rrTotalProj");
  var kpiAsIs = document.getElementById("kpiAsIsRent");
  var kpiProj = document.getElementById("kpiProjRent");
  if (kpiAsIs && asIsEl)
    kpiAsIs.textContent = asIsEl.textContent.replace(/\u00a0/g, "").trim();
  if (kpiProj && projEl)
    kpiProj.textContent = projEl.textContent.replace(/\u00a0/g, "").trim();

  // Ask Price & Offer Price from summary table cells
  var rows = document.querySelectorAll("#pfSummarySection table tr");
  rows.forEach(function (tr) {
    var label = tr.cells[0] && tr.cells[0].textContent.trim();
    var val = tr.cells[1] && tr.cells[1].textContent.trim();
    if (label === "Ask Price") {
      var el = document.getElementById("kpiAskPrice");
      if (el) el.textContent = val || "—";
    }
    if (label === "Offer Price") {
      var el2 = document.getElementById("kpiOfferPrice");
      if (el2) el2.textContent = val || "—";
    }
  });
}
window.updateSummKpis = updateSummKpis;

// ─── Rent Roll: Add / Delete row ──────────────────────────────────────────
function rrAddRow() {
  var tbody = document.getElementById("pfUnitMixBody");
  var totalRow = document.getElementById("rrTotalRow");
  if (!tbody) return;
  var pid = window._currentProjectId || currentProjectId || "default";
  var hdUmix = getHDUnitMix(pid);
  var showHD = hdUmix && hdUmix.length > 0 && !isHDUmixHidden(pid);
  var tr = document.createElement("tr");
  tr.style.borderBottom = "1px solid var(--border)";
  var cs = "padding:6px 6px;font-size:12px;";
  var is =
    "width:auto;max-width:90px;min-width:36px;border:none;background:transparent;font-size:12px;color:var(--header);text-align:inherit;outline:none;padding:2px 4px;border-radius:3px;";
  var html =
    '<td style="' +
    cs +
    'padding-left:18px"><input style="' +
    is +
    '" placeholder="Type…" onchange="rrRecalcTotals()"></td>' +
    '<td style="' +
    cs +
    ';text-align:center"><input style="' +
    is +
    'text-align:center" type="number" min="0" placeholder="0" onchange="rrRecalcTotals()"></td>' +
    '<td style="' +
    cs +
    ';text-align:center"><input style="' +
    is +
    'text-align:center" type="number" min="0" placeholder="0" onchange="rrRecalcTotals()"></td>' +
    '<td style="' +
    cs +
    ';text-align:right"><input style="' +
    is +
    'text-align:right" type="number" min="0" placeholder="0" onchange="rrRecalcTotals()"></td>' +
    '<td style="' +
    cs +
    ';text-align:right;border-left:1px solid var(--border)"><input style="' +
    is +
    'text-align:right" type="number" min="0" placeholder="0" onchange="rrRecalcTotals()"></td>';
  if (showHD) {
    html +=
      '<td style="' +
      cs +
      ';text-align:right;border-left:1px solid var(--border);background:rgba(21,101,192,0.03);color:var(--muted)">—</td>';
  }
  html +=
    '<td style="' +
    cs +
    ';text-align:right;border-left:1px solid var(--border)"><input style="' +
    is +
    'text-align:right" type="number" min="0" placeholder="0" onchange="rrRecalcTotals()"></td>' +
    '<td style="' +
    cs +
    ';text-align:right;color:var(--muted)">—</td>' +
    '<td style="' +
    cs +
    ';text-align:right;color:var(--green);font-weight:600">—</td>';
  tr.innerHTML = html;
  tbody.insertBefore(tr, totalRow);
}
function rrDeleteRow(btn) {
  var tr = btn.closest("tr");
  if (tr) tr.remove();
  rrRecalcTotals();
}
function rrRecalcTotals() {
  var tbody = document.getElementById("pfUnitMixBody");
  var totalRow = document.getElementById("rrTotalRow");
  if (!tbody || !totalRow) return;
  var totalUnits = 0,
    totalAsIs = 0,
    totalProj = 0;
  tbody.querySelectorAll("tr:not(#rrTotalRow)").forEach(function (tr) {
    var inputs = tr.querySelectorAll("input");
    if (inputs.length < 6) return; // static row — read text
    var units = parseFloat(inputs[1].value) || 0;
    var asIs25 = parseFloat(inputs[3].value) || 0;
    var growth = parseFloat(inputs[4].value) || 0;
    var calcAsIs = asIs25 * 12 * units;
    var calcProj = growth * 12 * units;
    totalUnits += units;
    totalAsIs += calcAsIs;
    totalProj += calcProj;
    // Update auto-calc cells in the new row
    var cells = tr.querySelectorAll("td");
    if (cells[6])
      cells[6].textContent = calcAsIs
        ? "$\u00a0" + calcAsIs.toLocaleString()
        : "—";
    if (cells[7])
      cells[7].textContent = calcProj
        ? "$\u00a0" + calcProj.toLocaleString()
        : "—";
  });
  // Also sum static rows
  tbody.querySelectorAll("tr:not(#rrTotalRow)").forEach(function (tr) {
    if (tr.querySelectorAll("input").length > 0) return; // already counted above
    var cells = tr.querySelectorAll("td");
    var u = parseFloat((cells[1] && cells[1].textContent) || 0) || 0;
    var a =
      parseFloat(
        ((cells[6] && cells[6].textContent) || "").replace(/[$,\u00a0]/g, ""),
      ) || 0;
    var p =
      parseFloat(
        ((cells[7] && cells[7].textContent) || "").replace(/[$,\u00a0]/g, ""),
      ) || 0;
    totalUnits += u;
    totalAsIs += a;
    totalProj += p;
  });
  document.getElementById("rrTotalUnits").textContent = totalUnits || 27;
  document.getElementById("rrTotalAsIs").innerHTML =
    "$\u00a0" + (totalAsIs || 564120).toLocaleString();
  document.getElementById("rrTotalProj").innerHTML =
    "$\u00a0" + (totalProj || 597600).toLocaleString();
  updateSummKpis();
}
window.rrAddRow = rrAddRow;
window.rrDeleteRow = rrDeleteRow;
window.rrRecalcTotals = rrRecalcTotals;

// ─── Project Summary: Add / Remove custom field ───────────────────────────
function summAddField() {
  var tbody = document.getElementById("summCustomFields");
  if (!tbody) return;
  var idx = Date.now();
  var tr = document.createElement("tr");
  tr.style.borderBottom = "1px solid var(--border)";
  tr.innerHTML =
    '<td style="padding:6px 18px"><input style="border:none;background:transparent;font-size:12px;color:var(--body);outline:none;width:100%" placeholder="Field name…"></td>' +
    '<td style="padding:6px 18px;text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:8px">' +
    '<input style="border:none;background:transparent;font-size:12px;color:var(--header);outline:none;text-align:right;flex:1" placeholder="Value…">' +
    '<button onclick="this.closest(\'tr\').remove()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;padding:0 2px">×</button>' +
    "</td>";
  tbody.appendChild(tr);
  tr.querySelector("input").focus();
}
window.summAddField = summAddField;

// ─── PF Row Add / Delete System ──────────────────────────────────────────────
var pfCR = {};
function _pcrSave() {
  try {
    localStorage.setItem("pfCR_v1", JSON.stringify(pfCR));
  } catch (e) {}
}
function _pcrLoad() {
  try {
    pfCR = JSON.parse(localStorage.getItem("pfCR_v1") || "{}");
  } catch (e) {
    pfCR = {};
  }
}
function _pcrGet(pid, sec) {
  if (!pfCR[pid]) pfCR[pid] = {};
  if (!pfCR[pid][sec]) pfCR[pid][sec] = { adds: [], deletes: [] };
  return pfCR[pid][sec];
}

// Apply deletes + inserts onto a copy of the data array
function _pcrApply(origArr, sData) {
  var dels = sData.deletes || [],
    adds = sData.adds || [];
  var delSecs = dels
    .filter(function (k) {
      return k.indexOf("sec:") == 0;
    })
    .map(function (k) {
      return k.slice(4);
    });
  var curSec = null,
    arr = [];
  origArr.forEach(function (item) {
    if (item.isSectionHdr) {
      curSec = item.secId;
      if (dels.indexOf("sec:" + item.secId) >= 0) return;
      arr.push(item);
    } else if (item.isTotal || item.isPct || item.isSubtotal) {
      arr.push(item);
    } else {
      if (delSecs.indexOf(curSec) >= 0) return;
      if (dels.indexOf("row:" + item.label) >= 0) return;
      arr.push(item);
    }
  });
  adds.forEach(function (add) {
    if (add.isSectionHdr) {
      var ti = -1;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].isTotal) {
          ti = i;
          break;
        }
      }
      if (ti >= 0) arr.splice(ti, 0, add);
      else arr.push(add);
    } else {
      var sid = add.secId,
        last = -1,
        inSec = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].isSectionHdr) {
          if (inSec) break;
          if (arr[i].secId === sid) inSec = true;
          continue;
        }
        if (inSec && !arr[i].isTotal && !arr[i].isPct && !arr[i].isSubtotal)
          last = i;
      }
      if (last >= 0) arr.splice(last + 1, 0, add);
      else arr.push(add);
    }
  });
  return arr;
}

// Wrap the already-patched buildPFTable
var _pfBpt4 = buildPFTable;
buildPFTable = function () {
  _pcrLoad();
  var pid = currentProjectId || "default";
  var origRev = PF_DATA.revenue,
    origExp = PF_DATA.expenses;
  PF_DATA.revenue = _pcrApply(origRev, _pcrGet(pid, "revenue"));
  PF_DATA.expenses = _pcrApply(origExp, _pcrGet(pid, "expenses"));
  _pfBpt4();
  PF_DATA.revenue = origRev;
  PF_DATA.expenses = origExp;
  _pfCfCRApply(pid);
  if (pfEditMode || _pfEditMode) _pfEditUI();
};

function _pfCfCRApply(pid) {
  var tbody = document.getElementById("pfCfBody");
  if (!tbody) return;
  var sData = _pcrGet(pid, "cf");
  (sData.deletes || []).forEach(function (lbl) {
    Array.from(tbody.querySelectorAll("tr")).forEach(function (row) {
      var td = row.querySelector("td:first-child");
      if (td && td.textContent.trim() === lbl) row.remove();
    });
  });
  var dscrRow = null;
  Array.from(tbody.querySelectorAll("tr")).forEach(function (row) {
    var td = row.querySelector("td");
    if (td && td.textContent.trim() === "DSCR") dscrRow = row;
  });
  (sData.adds || []).forEach(function (add) {
    var vals = (add.vals || []).slice();
    while (vals.length < 7) vals.push(null);
    var cells = vals
      .map(function (v, i) {
        var bp = i >= 3,
          bl = i === 3 ? "border-left:2px solid rgba(74,101,133,0.22);" : "";
        var bg = bp ? "background:rgba(74,101,133,0.025);" : "";
        var txt =
          !v || v === 0
            ? '<span style="color:var(--muted)">\u2014</span>'
            : v < 0
              ? "(" + Math.abs(Math.round(v)).toLocaleString() + ")"
              : Math.round(v).toLocaleString();
        return (
          '<td style="padding:7px 8px;text-align:right;font-size:12px;color:var(--body);' +
          bg +
          bl +
          '">' +
          txt +
          "</td>"
        );
      })
      .join("");
    var tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid var(--border)";
    tr.innerHTML =
      '<td style="padding:7px 14px;font-size:12px;color:var(--body)">' +
      add.label +
      "</td>" +
      cells;
    if (dscrRow) tbody.insertBefore(tr, dscrRow);
    else tbody.appendChild(tr);
  });
}

function _pfEditUI() {
  ["revenue", "expenses"].forEach(function (section) {
    var tbody = document.getElementById(
      section === "revenue" ? "pfRevBody" : "pfExpBody",
    );
    if (!tbody) return;
    // Section headers: delete btn + Add Row btn after last item
    Array.from(tbody.querySelectorAll(".pf-sec-hdr")).forEach(function (row) {
      var secId = row.getAttribute("data-secid");
      if (!secId) return;
      var td = row.querySelector("td:first-child");
      if (td && !td.querySelector(".pf-del-btn")) {
        var b = document.createElement("button");
        b.className = "pf-del-btn";
        b.innerHTML = "&times;";
        b.title = "Delete section";
        (function (s, sid) {
          b.onclick = function (e) {
            e.stopPropagation();
            pfRowDelete(s, "sec", sid);
          };
        })(section, secId);
        td.appendChild(b);
      }
      var items = Array.from(tbody.querySelectorAll(".pf-si-" + secId));
      var after = items.length ? items[items.length - 1] : row;
      var addTr = document.createElement("tr");
      addTr.className = "pf-addrow-tr";
      (function (s, sid) {
        var btn = document.createElement("button");
        btn.className = "pf-addrow-btn";
        btn.textContent = "+ Add Row";
        btn.onclick = function () {
          pfRowAdd(s, sid);
        };
        var td2 = document.createElement("td");
        td2.colSpan = 9;
        td2.appendChild(btn);
        addTr.appendChild(td2);
      })(section, secId);
      after.insertAdjacentElement("afterend", addTr);
    });
    // Detail rows: delete btn
    Array.from(tbody.querySelectorAll("tr.pf-si")).forEach(function (row) {
      var td = row.querySelector("td:first-child");
      if (!td || td.querySelector(".pf-del-btn")) return;
      var lbl = Array.from(td.childNodes)
        .filter(function (n) {
          return n.nodeType === 3;
        })
        .map(function (n) {
          return n.textContent.trim();
        })
        .join("")
        .trim();
      if (!lbl) lbl = td.textContent.trim();
      var b = document.createElement("button");
      b.className = "pf-del-btn";
      b.innerHTML = "&times;";
      b.title = "Delete row";
      (function (s, l) {
        b.onclick = function () {
          pfRowDelete(s, "row", l);
        };
      })(section, lbl);
      td.appendChild(b);
    });
    // "+ Add Section / Row" before Total/% rows
    var allRows = Array.from(tbody.querySelectorAll("tr")),
      insertBefore = null;
    for (var i = allRows.length - 1; i >= 0; i--) {
      var td0 = allRows[i].querySelector("td");
      if (
        td0 &&
        (td0.textContent.indexOf("Total") >= 0 ||
          td0.textContent.indexOf("% of") >= 0)
      )
        insertBefore = allRows[i];
      else break;
    }
    if (!insertBefore) insertBefore = allRows[allRows.length - 1];
    var addSecTr = document.createElement("tr");
    addSecTr.className = "pf-addrow-tr";
    (function (s) {
      var btn = document.createElement("button");
      btn.className = "pf-addrow-btn pf-addrow-sec";
      btn.textContent = "+ Add Section / Row";
      btn.onclick = function () {
        pfRowAdd(s, null);
      };
      var td2 = document.createElement("td");
      td2.colSpan = 9;
      td2.appendChild(btn);
      addSecTr.appendChild(td2);
    })(section);
    tbody.insertBefore(addSecTr, insertBefore);
  });

  // Cash Flow section
  var cfTbody = document.getElementById("pfCfBody");
  if (!cfTbody) return;
  var skipLbls = ["DSCR", "Cash Flow after Debt Service"];
  Array.from(cfTbody.querySelectorAll("tr")).forEach(function (row) {
    if (row.style.height === "6px") return;
    var td0 = row.querySelector("td:first-child");
    if (!td0 || td0.querySelector(".pf-del-btn")) return;
    var lbl = Array.from(td0.childNodes)
      .filter(function (n) {
        return n.nodeType === 3;
      })
      .map(function (n) {
        return n.textContent.trim();
      })
      .join("")
      .trim();
    if (!lbl) lbl = td0.textContent.trim();
    if (skipLbls.indexOf(lbl) >= 0) return;
    var b = document.createElement("button");
    b.className = "pf-del-btn";
    b.innerHTML = "&times;";
    b.title = "Delete row";
    (function (l) {
      b.onclick = function () {
        pfRowDelete("cf", "row", l);
      };
    })(lbl);
    td0.appendChild(b);
  });
  var dscrRow2 = null;
  Array.from(cfTbody.querySelectorAll("tr")).forEach(function (row) {
    var td = row.querySelector("td");
    if (td && td.textContent.trim() === "DSCR") dscrRow2 = row;
  });
  var addCfTr = document.createElement("tr");
  addCfTr.className = "pf-addrow-tr";
  var cfBtn = document.createElement("button");
  cfBtn.className = "pf-addrow-btn";
  cfBtn.textContent = "+ Add Row";
  cfBtn.onclick = function () {
    pfRowAdd("cf", null);
  };
  var cfTd = document.createElement("td");
  cfTd.colSpan = 8;
  cfTd.appendChild(cfBtn);
  addCfTr.appendChild(cfTd);
  if (dscrRow2) cfTbody.insertBefore(addCfTr, dscrRow2);
  else cfTbody.appendChild(addCfTr);
}

function pfRowDelete(section, type, key) {
  _pcrLoad();
  var pid = currentProjectId || "default";
  var sData = _pcrGet(pid, section);
  var before = sData.adds.length;
  if (type === "sec")
    sData.adds = sData.adds.filter(function (a) {
      return !(a.isSectionHdr && a.secId === key);
    });
  else
    sData.adds = sData.adds.filter(function (a) {
      return !(!a.isSectionHdr && a.label === key);
    });
  var delKey = type + ":" + key;
  if (sData.adds.length === before && sData.deletes.indexOf(delKey) < 0)
    sData.deletes.push(delKey);
  _pcrSave();
  buildPFTable();
}

function pfRowAdd(section, secId) {
  var isCf = section === "cf";
  var sections = [];
  if (!isCf) {
    var src = section === "revenue" ? PF_DATA.revenue : PF_DATA.expenses;
    src
      .filter(function (r) {
        return r.isSectionHdr;
      })
      .forEach(function (r) {
        sections.push({ label: r.label, secId: r.secId });
      });
    _pcrLoad();
    var pid = currentProjectId || "default";
    (_pcrGet(pid, section).adds || [])
      .filter(function (a) {
        return a.isSectionHdr;
      })
      .forEach(function (a) {
        sections.push({ label: a.label, secId: a.secId });
      });
  }
  var colLabels = PF_DATA.cols
    ? PF_DATA.cols.concat(["2030"])
    : ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"];

  // Build modal HTML as DOM to avoid escaping issues
  var wrap = document.createElement("div");
  wrap.style.cssText = "padding:18px 20px;max-height:75vh;overflow-y:auto";

  // Level selector (only for revenue/expenses when no secId)
  if (!isCf) {
    if (secId) {
      var hidLvl = document.createElement("input");
      hidLvl.type = "hidden";
      hidLvl.id = "pfALvl";
      hidLvl.value = "2";
      wrap.appendChild(hidLvl);
    } else {
      var lvlDiv = document.createElement("div");
      lvlDiv.style.marginBottom = "14px";
      lvlDiv.innerHTML =
        '<label style="font-size:12px;font-weight:700;color:var(--header);display:block;margin-bottom:8px">Level</label>' +
        '<div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:13px">' +
        '<label style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 14px;cursor:pointer" id="pfALvl1Wrap">' +
        '<input type="radio" name="pfALvl" id="pfALvl1" value="1"> Level 1 &mdash; Section Header</label>' +
        '<label style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 14px;cursor:pointer;background:rgba(74,101,133,0.07);border-left:1px solid var(--border)">' +
        '<input type="radio" name="pfALvl" id="pfALvl2" value="2" checked> Level 2 &mdash; Detail Row</label>' +
        "</div>";
      wrap.appendChild(lvlDiv);
      // attach change handlers after DOM insertion
    }
  }

  // Field name
  var nameDiv = document.createElement("div");
  nameDiv.style.marginBottom = "12px";
  nameDiv.innerHTML =
    '<label style="font-size:12px;font-weight:700;color:var(--header);display:block;margin-bottom:6px">Field Name</label>';
  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "pfALabel";
  nameInput.placeholder = "e.g. Parking Income";
  nameInput.style.cssText =
    "width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface2);color:var(--body);box-sizing:border-box";
  nameDiv.appendChild(nameInput);
  wrap.appendChild(nameDiv);

  // Section selector
  var secWrap = document.createElement("div");
  secWrap.id = "pfASecWrap";
  secWrap.style.marginBottom = "12px";
  if (!isCf && !secId && sections.length) {
    secWrap.innerHTML =
      '<label style="font-size:12px;font-weight:700;color:var(--header);display:block;margin-bottom:6px">Under Section</label>';
    var sel = document.createElement("select");
    sel.id = "pfASecId";
    sel.style.cssText =
      "width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface2);color:var(--body)";
    sections.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.secId;
      opt.textContent = s.label;
      if (s.secId === secId) opt.selected = true;
      sel.appendChild(opt);
    });
    secWrap.appendChild(sel);
    wrap.appendChild(secWrap);
  } else if (secId) {
    var hidSec = document.createElement("input");
    hidSec.type = "hidden";
    hidSec.id = "pfASecId";
    hidSec.value = secId;
    wrap.appendChild(hidSec);
  }

  // Values
  var valsWrap = document.createElement("div");
  valsWrap.id = "pfAValsWrap";
  valsWrap.style.marginBottom = "16px";
  var valsLbl = document.createElement("label");
  valsLbl.style.cssText =
    "font-size:12px;font-weight:700;color:var(--header);display:block;margin-bottom:8px";
  valsLbl.textContent = "Values (per year)";
  valsWrap.appendChild(valsLbl);
  colLabels.forEach(function (col, i) {
    var row2 = document.createElement("div");
    row2.style.cssText =
      "display:flex;align-items:center;gap:10px;margin-bottom:5px";
    var lbl2 = document.createElement("label");
    lbl2.style.cssText =
      "font-size:11px;color:var(--muted);width:165px;flex-shrink:0";
    lbl2.textContent = col;
    var inp = document.createElement("input");
    inp.type = "number";
    inp.id = "pfAV" + i;
    inp.value = "0";
    inp.step = "any";
    inp.style.cssText =
      "width:110px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface2);color:var(--body)";
    row2.appendChild(lbl2);
    row2.appendChild(inp);
    valsWrap.appendChild(row2);
  });
  wrap.appendChild(valsWrap);

  // Buttons
  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost btn-sm";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = closeModal;
  var addBtn = document.createElement("button");
  addBtn.style.cssText =
    "background:var(--green);color:#fff;border:none;padding:7px 18px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer";
  addBtn.textContent = "+ Add";
  (function (s, sid) {
    addBtn.onclick = function () {
      pfRowAddConfirm(s, sid);
    };
  })(section, secId);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(addBtn);
  wrap.appendChild(btnRow);

  // Show modal
  document.getElementById("modalTitle").textContent = "Add Row";
  document.getElementById("modalBody").innerHTML = "";
  document.getElementById("modalBody").appendChild(wrap);
  document.getElementById("modalOverlay").classList.add("open");

  // Wire level change handlers after insertion
  if (!isCf && !secId) {
    var r1 = document.getElementById("pfALvl1"),
      r2 = document.getElementById("pfALvl2");
    if (r1) r1.addEventListener("change", pfAddLvlChg);
    if (r2) r2.addEventListener("change", pfAddLvlChg);
  }
  setTimeout(function () {
    var el = document.getElementById("pfALabel");
    if (el) el.focus();
  }, 80);
}

function pfAddLvlChg() {
  var l1 = document.getElementById("pfALvl1"),
    isL1 = l1 && l1.checked;
  var vw = document.getElementById("pfAValsWrap"),
    sw = document.getElementById("pfASecWrap");
  if (vw) vw.style.display = isL1 ? "none" : "";
  if (sw) sw.style.display = isL1 ? "none" : "";
}

function pfRowAddConfirm(section, secId) {
  var lbl = (document.getElementById("pfALabel") || {}).value || "";
  lbl = lbl.trim();
  if (!lbl) {
    alert("Please enter a field name.");
    return;
  }
  var level = 2;
  var l1 = document.getElementById("pfALvl1");
  if (l1 && l1.checked) level = 1;
  var hl = document.getElementById("pfALvl");
  if (hl) level = parseInt(hl.value) || 2;
  _pcrLoad();
  var pid = currentProjectId || "default";
  var sData = _pcrGet(pid, section);
  if (level === 1) {
    var ns = "cust-" + section[0] + "-" + Date.now();
    sData.adds.push({
      isSectionHdr: true,
      label: lbl,
      secId: ns,
      isCustom: true,
    });
  } else {
    var rs = secId || null;
    if (!rs) {
      var se = document.getElementById("pfASecId");
      if (se) rs = se.value;
    }
    var vals = [];
    for (var i = 0; i < 7; i++) {
      var inp = document.getElementById("pfAV" + i);
      var v = inp ? parseFloat(inp.value) : 0;
      vals.push(isNaN(v) ? 0 : v);
    }
    sData.adds.push({ label: lbl, secId: rs, vals: vals, isCustom: true });
  }
  _pcrSave();
  closeModal();
  buildPFTable();
  toast("Row added: " + lbl, "success");
}

// ─── Expose inline-handler functions to window (for ES module compatibility) ──
window.renderProjects = renderProjects;
window.clearApiStatus = clearApiStatus;
window.openAddFieldModal = openAddFieldModal;
window.closeAddFieldModal = closeAddFieldModal;
window.confirmAddField = confirmAddField;
window.openExpAddFieldModal = openExpAddFieldModal;
window.closeExpAddFieldModal = closeExpAddFieldModal;
window.confirmExpAddField = confirmExpAddField;
window.renderWfTemplate = renderWfTemplate;
window.updateSeRegValueOfProperty = updateSeRegValueOfProperty;
window.updateSeRefValueOfProperty = updateSeRefValueOfProperty;
window.handleDebtUpload = handleDebtUpload;
window.addUser = addUser;
window.applyPFOverride = applyPFOverride;
window.applyRRToProForma = applyRRToProForma;
window.changeUserRole = changeUserRole;
window.checkAddFieldWarning = checkAddFieldWarning;
window.closeModal = closeModal;
window.confirmDeleteFile = confirmDeleteFile;
window.confirmT12AddField = confirmT12AddField;
window.createProject = createProject;
window.debtCellEdit = debtCellEdit;
window.deleteUploadedFile = deleteUploadedFile;
window.downloadOriginalFile = downloadOriginalFile;
window.onTaxEscalationChange = onTaxEscalationChange;
window.onTaxFieldChange = onTaxFieldChange;
window.onWfParamChange = onWfParamChange;
window.openProjectAnalysis = openProjectAnalysis;
window.previewFile = previewFile;
window.previewUploadedFile = previewUploadedFile;
window.removeFile = removeFile;
window.removeUser = removeUser;
window.resetPFOverride = resetPFOverride;
window.reviewSubmission = reviewSubmission;
window.saveProjectEdit = saveProjectEdit;
window.showT12AddForm = showT12AddForm;
window.switchProject = switchProject;
window.switchT12Year = switchT12Year;
window.togglePFSec = togglePFSec;
window.toggleT12Card = toggleT12Card;
window.toggleUserStatus = toggleUserStatus;
window.openAIScoreModal = openAIScoreModal;
window.renderDashboard = renderDashboard;
window.switchToUser = switchToUser;
