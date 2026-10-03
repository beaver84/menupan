import XLSX from 'xlsx';
import * as fs from 'node:fs';

XLSX.set_fs(fs);

export function readWorkbookFile(filePath) {
  return XLSX.readFile(filePath);
}
