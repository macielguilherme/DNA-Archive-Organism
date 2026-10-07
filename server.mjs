import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const envValue = name => { const value = process.env[name] || ''; return /^\{\{.*\}\}$/.test(value) ? '' : value; };
const KEY = envValue('GEMINI_API_KEY');
const PRODUCTION = process.env.NODE_ENV === 'production';
if (PRODUCTION && !KEY) throw new Error('Configure GEMINI_API_KEY como segredo da hospedagem.');
const ALLOWED_MODELS = new Set(['gemini-3.5-flash-lite']);
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon' };
const rate = new Map();

function send(res, code, data, headers = {}) { res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers }); res.end(JSON.stringify(data)); }
function sameOrigin(req) {
  const origin = req.headers.origin; if (!origin) return false;
  const host = req.headers['x-forwarded-host']?.split(',')[0].trim() || req.headers.host;
  const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || (PRODUCTION ? 'https' : 'http');
  try { return new URL(origin).host === host && new URL(origin).protocol === `${proto}:`; } catch { return false; }
}
async function body(req, max = 60 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error('A solicitação excede o limite permitido.'), { status:413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('JSON inválido.'), { status:400 }); }
}
function limited(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now(); const item = rate.get(ip) || { start:now, count:0 };
  if (now - item.start > 60_000) { item.start = now; item.count = 0; }
  item.count++; rate.set(ip,item); if (item.count > 12) return true;
  if (rate.size > 5000) for (const [key, value] of rate) if (now - value.start > 60_000) rate.delete(key);
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && !sameOrigin(req)) return send(res,403,{ message:'Origem não autorizada.' });
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res,200,{ geminiConfigured:Boolean(KEY), model:'gemini-3.5-flash-lite' });
      if (url.pathname === '/api/gemini' && req.method === 'POST') {
        if (limited(req)) return send(res,429,{ message:'Limite de solicitações atingido. Aguarde um minuto.' });
        if (!KEY) return send(res,503,{ message:'A hospedagem ainda não configurou a chave Gemini.' });
        const input=await body(req); const model=ALLOWED_MODELS.has(input.model) ? input.model : 'gemini-3.5-flash-lite';
        if (typeof input.prompt !== 'string' || input.prompt.length > 180_000) return send(res,400,{ message:'Texto de análise inválido ou muito longo.' });
        const parts=[{ text:input.prompt }];
        if (input.attachment) {
          const { mimeType, data }=input.attachment;
          if (!['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/heif'].includes(mimeType) || typeof data !== 'string' || data.length > 58*1024*1024) return send(res,400,{ message:'Anexo incompatível ou acima do limite.' });
          parts.push({ inline_data:{ mime_type:mimeType, data } });
        }
        const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{ method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':KEY}, body:JSON.stringify({ contents:[{parts}], generationConfig:{temperature:0.15, responseMimeType:'application/json'} }), signal:AbortSignal.timeout(120_000) });
        const data=await response.json().catch(()=>({error:{message:'Resposta inválida do Google.'}}));
        return send(res,response.status,data);
      }
      return send(res,404,{ message:'Rota não encontrada.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,{ message:'Método não permitido.' });
    const relative=decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\//,'');
    const segments=relative.split(/[\\/]/);
    if (segments.some(part => !part || part.startsWith('.') || part === '..') || !(relative === 'index.html' || /^(css|js|assets|data)\//.test(relative))) return send(res,404,{ message:'Recurso não encontrado.' });
    let filePath=path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT,'index.html')) return send(res,403,{message:'Acesso negado.'});
    const info=await stat(filePath); if (!info.isFile()) throw new Error('Not file');
    const content=await readFile(filePath); res.writeHead(200,{ 'Content-Type':MIME[path.extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'Cache-Control':['.html','.css','.js'].includes(path.extname(filePath))?'no-cache':'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end(); res.end(content);
  } catch (error) { if (!res.headersSent) send(res,error.status || 404,{ message:error.status ? error.message : 'Recurso não encontrado.' }); else res.destroy(); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`DNA Archive listening on port ${PORT}`));
