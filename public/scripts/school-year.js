// Shared academic-year helpers.
// Soshcomm school years run July 1 through June 30.
export const SCHOOL_YEAR_START_MONTH = 7; // 1 = January, 7 = July
export const SCHOOL_YEAR_STORAGE_KEY = "soshcommSchoolYear";

export function parseStoredDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(
    String(value || "").trim(),
  );
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  return date;
}

export function schoolYearKeyForDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const startYear =
    month >= SCHOOL_YEAR_START_MONTH
      ? date.getFullYear()
      : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

export function schoolYearKeyForTransaction(transaction) {
  // New transactions are explicitly tagged. Older records are inferred from date.
  if (transaction?.schoolYear && /^\d{4}-\d{4}$/.test(transaction.schoolYear)) {
    return transaction.schoolYear;
  }
  const date = parseStoredDate(transaction?.date);
  return date ? schoolYearKeyForDate(date) : "";
}

export function currentSchoolYearKey(now = new Date()) {
  return schoolYearKeyForDate(now);
}

export function schoolYearLabel(key) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(key || ""));
  if (!match) return key || "School year";
  const start = match[1];
  const end = match[2].slice(-2);
  return `${start}\u2013${end}`;
}

export function schoolYearLongLabel(key) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(key || ""));
  if (!match) return key || "School year";
  return `${match[1]}\u2013${match[2]}`;
}

export function schoolYearDateRangeLabel(key) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(key || ""));
  if (!match) return "July 1 \u2013 June 30";
  return `Jul 1, ${match[1]} \u2013 Jun 30, ${match[2]}`;
}

export function getSavedSchoolYear() {
  try {
    return localStorage.getItem(SCHOOL_YEAR_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveSchoolYear(key) {
  try {
    localStorage.setItem(SCHOOL_YEAR_STORAGE_KEY, key);
  } catch {
    // Local storage can be blocked; the page still works for this session.
  }
}

export function availableSchoolYearKeys(transactions = []) {
  const years = new Set();
  const current = currentSchoolYearKey();
  const currentStart = Number(current.slice(0, 4));

  // Always make nearby years selectable, even before they contain data.
  for (let offset = -2; offset <= 2; offset += 1) {
    const start = currentStart + offset;
    years.add(`${start}-${start + 1}`);
  }

  transactions.forEach((transaction) => {
    const key = schoolYearKeyForTransaction(transaction);
    if (key) years.add(key);
  });

  return [...years].sort(
    (a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4)),
  );
}

export function resolveSelectedSchoolYear(transactions = [], requested = "") {
  const available = availableSchoolYearKeys(transactions);
  const candidates = [requested, getSavedSchoolYear(), currentSchoolYearKey()];
  const selected =
    candidates.find((key) => key && available.includes(key)) || available[0];
  if (selected) saveSchoolYear(selected);
  return selected;
}

export function populateSchoolYearSelect(
  select,
  transactions = [],
  selectedKey = "",
) {
  if (!select) return selectedKey;
  const available = availableSchoolYearKeys(transactions);
  const selected = available.includes(selectedKey)
    ? selectedKey
    : resolveSelectedSchoolYear(transactions, selectedKey);

  select.replaceChildren(
    ...available.map(
      (key) => new Option(`${schoolYearLabel(key)} school year`, key),
    ),
  );
  if (selected) select.value = selected;
  return selected;
}

export function filterTransactionsBySchoolYear(transactions, key) {
  return transactions.filter(
    (transaction) => schoolYearKeyForTransaction(transaction) === key,
  );
}
