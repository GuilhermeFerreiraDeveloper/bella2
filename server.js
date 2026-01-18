const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const ADMIN_FILE = path.join(__dirname, 'admin.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const sessions = new Map();

function readJsonSafe(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const raw = fs.readFileSync(file, 'utf-8');
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJsonSafe(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        return false;
    }
}

function hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const h = crypto.pbkdf2Sync(password, s, 150000, 32, 'sha256').toString('hex');
    return { salt: s, hash: h };
}

function ensureAdmin() {
    const admin = readJsonSafe(ADMIN_FILE, null);
    if (admin && admin.username && admin.hash && admin.salt) return admin;
    const creds = hashPassword('mudinho');
    const obj = { username: 'mudinho', hash: creds.hash, salt: creds.salt };
    writeJsonSafe(ADMIN_FILE, obj);
    return obj;
}

function parseCookies(req) {
    const header = req.headers['cookie'] || '';
    const out = {};
    header.split(';').map(s => s.trim()).filter(Boolean).forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > -1) {
            const k = pair.slice(0, idx);
            const v = pair.slice(idx + 1);
            out[k] = decodeURIComponent(v);
        }
    });
    return out;
}

function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
}

function requireAuth(req, res) {
    const cookies = parseCookies(req);
    const token = cookies['admin_session'];
    if (!token || !sessions.has(token)) {
        sendJson(res, 401, { error: 'unauthorized' });
        return null;
    }
    return sessions.get(token);
}

function serveStatic(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME[extname] || 'application/octet-stream';
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Arquivo não encontrado</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Erro no servidor');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch {
                resolve({});
            }
        });
    });
}

function handleApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
        readBody(req).then(body => {
            const { username, password } = body || {};
            const admin = ensureAdmin();
            if (username !== admin.username) {
                sendJson(res, 400, { error: 'credenciais inválidas' });
                return;
            }
            const derived = hashPassword(password, admin.salt);
            if (derived.hash !== admin.hash) {
                sendJson(res, 400, { error: 'credenciais inválidas' });
                return;
            }
            const token = crypto.randomBytes(24).toString('hex');
            sessions.set(token, { username: admin.username, issuedAt: Date.now() });
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
            });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
        const cookies = parseCookies(req);
        const token = cookies['admin_session'];
        if (token) sessions.delete(token);
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
        });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/me') {
        const s = requireAuth(req, res);
        if (!s) return;
        sendJson(res, 200, { username: s.username });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/api/order') {
        readBody(req).then(body => {
            const orders = readJsonSafe(ORDERS_FILE, []);
            const createdAt = new Date().toISOString();
            const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
            const record = { id, created_at: createdAt, ...body };
            orders.push(record);
            writeJsonSafe(ORDERS_FILE, orders);
            sendJson(res, 200, { ok: true, id });
        });
        return;
    }
    if (req.method === 'GET' && url.pathname === '/api/orders') {
        const s = requireAuth(req, res);
        if (!s) return;
        const month = url.searchParams.get('month') || '';
        const orders = readJsonSafe(ORDERS_FILE, []);
        const filtered = month
            ? orders.filter(o => typeof o.created_at === 'string' && o.created_at.slice(0, 7) === month)
            : orders.slice().reverse();
        sendJson(res, 200, { items: filtered });
        return;
    }
    sendJson(res, 404, { error: 'endpoint não encontrado' });
}

ensureAdmin();

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
        handleApi(req, res);
        return;
    }
    serveStatic(req, res);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
