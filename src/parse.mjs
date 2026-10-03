import XLSX from 'xlsx';

const SETTINGS_SHEET = '_설정';
const EXCLUDED_SHEET_PREFIX = '_';
const SOLD_OUT_MARK = 'Y';

const SETTING_KEYS = {
  storeName: '매장명',
  theme: '테마',
  autoRotateSec: '자동전환초',
};

const DEFAULT_SETTINGS = {
  storeName: '',
  theme: 'cafe-dark',
  autoRotateSec: 0,
};

export function parseWorkbook(workbook) {
  const pages = [];
  let settings = { ...DEFAULT_SETTINGS };

  for (const sheetName of workbook.SheetNames) {
    const rows = readRows(workbook.Sheets[sheetName]);

    if (sheetName === SETTINGS_SHEET) {
      settings = parseSettings(rows);
    } else if (!sheetName.startsWith(EXCLUDED_SHEET_PREFIX)) {
      pages.push({ name: sheetName, items: parseItems(rows) });
    }
  }

  return { settings, pages };
}

function readRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function dataRows(rows) {
  return rows.slice(1);
}

function parseSettings(rows) {
  const values = Object.fromEntries(dataRows(rows));

  return {
    storeName: values[SETTING_KEYS.storeName] || DEFAULT_SETTINGS.storeName,
    theme: values[SETTING_KEYS.theme] || DEFAULT_SETTINGS.theme,
    autoRotateSec: toFiniteNumber(values[SETTING_KEYS.autoRotateSec], DEFAULT_SETTINGS.autoRotateSec),
  };
}

function parseItems(rows) {
  const items = [];

  for (const [name, price, description, soldOut, category] of dataRows(rows)) {
    const parsedPrice = parsePrice(price);
    if (!name || parsedPrice === null) continue;

    items.push({ name, price: parsedPrice, description, soldOut: isSoldOut(soldOut), category });
  }

  return items;
}

function parsePrice(value) {
  if (value === '') return null;
  return toFiniteNumber(value, null);
}

function isSoldOut(value) {
  return String(value).toUpperCase() === SOLD_OUT_MARK;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
