// 科研领料挑选系统 - Node.js Express 后端
// 兼容本地运行和 Render.com 云部署
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8765;

// 数据目录（本地用 ./data，云部署用 Render 持久化目录）
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// 确保数据目录和文件存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STATE_FILE)) {
  const initState = {
    ALL_DATA: [],
    PICKED: [],
    PROJECTS: [],
    CUSTOM_COLS: [],
    COUNTER: 1,
    META: { month: '', updated: '' }
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(initState, null, 2), 'utf8');
}

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 读取状态
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      ALL_DATA: [],
      PICKED: [],
      PROJECTS: [],
      CUSTOM_COLS: [],
      COUNTER: 1,
      META: { month: '', updated: '' }
    };
  }
}

// 保存状态（原子写入：先写临时文件再重命名）
function saveState(state) {
  state.META = state.META || {};
  state.META.updated = new Date().toISOString().replace(/\.\d{3}Z$/, '');
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

// === API 路由 ===

// GET /api/state - 读取全部数据
app.get('/api/state', (req, res) => {
  res.json(readState());
});

// POST /api/state - 保存全部数据
app.post('/api/state', (req, res) => {
  try {
    const state = req.body;
    saveState(state);
    res.json({ ok: true, updated: state.META ? state.META.updated : '' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/ping - 健康检查
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString().replace(/\.\d{3}Z$/, '') });
});

// === 静态文件服务 ===
// Render.com 部署时，前端文件在根目录
// 本地开发时也在根目录
const STATIC_DIR = __dirname;

app.use(express.static(STATIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
}));

// 所有其他路由返回 index.html（SPA 兼容）
app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).send('404 Not Found');
  }
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// 启动
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  科研领料挑选系统 - Node.js 服务已启动');
  console.log(`  本机访问: http://localhost:${PORT}/`);
  console.log(`  数据文件: ${STATE_FILE}`);
  console.log('='.repeat(60));
});
