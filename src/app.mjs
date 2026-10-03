import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkbook } from './parse.mjs';
import { readWorkbookFile } from './read-workbook.mjs';
import { createSseHub } from './sse.mjs';
import { watchFile } from './watch.mjs';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PORT = 3000;
export const DEFAULT_MENU_PATH = path.join(ROOT_DIR, 'data', 'menu.xlsx');
const DEFAULT_PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEFAULT_ASSETS_DIR = path.join(ROOT_DIR, 'design', 'project', 'assets');

export async function startServer({
  menuPath = DEFAULT_MENU_PATH,
  publicDir = DEFAULT_PUBLIC_DIR,
  assetsDir = DEFAULT_ASSETS_DIR,
  port = DEFAULT_PORT,
  readWorkbook = readWorkbookFile,
  watch = watchFile,
  logger = console,
} = {}) {
  const load = () => parseWorkbook(readWorkbook(menuPath));

  let menu;
  try {
    menu = load();
  } catch (err) {
    throw new Error(`메뉴 파일을 읽을 수 없음: ${menuPath} (${err.message})`, { cause: err });
  }

  const hub = createSseHub();
  const app = express();
  app.get('/api/menu', (req, res) => res.json(menu));
  app.get('/events', (req, res) => hub.connect(req, res));
  app.use('/assets', express.static(assetsDir));
  app.use(express.static(publicDir));

  const httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on('error', reject);
  });

  const reload = async () => {
    try {
      menu = load();
      return true;
    } catch (err) {
      logger.error(`메뉴 재로드 실패, 이전 데이터 유지: ${err.message}`);
      return false;
    }
  };

  const watcher = watch(menuPath, async () => {
    if (await reload()) hub.broadcast('menu-updated');
  });

  return {
    port: httpServer.address().port,
    reload,

    async close() {
      await watcher.close();
      await new Promise((resolve) => {
        httpServer.close(resolve);
        httpServer.closeAllConnections();
      });
    },
  };
}
