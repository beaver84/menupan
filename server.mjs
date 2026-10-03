import { startServer } from './src/app.mjs';

const { port } = await startServer();
console.log(`메뉴판 서버 실행: http://localhost:${port}`);
