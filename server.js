import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import * as provider from './provider.js';
import multer from 'multer';

const app = express();
const port = Number(process.env.PORT || 8787);
const token = process.env.BACKEND_ACCESS_TOKEN || '';
const allowedOrigin = process.env.CORS_ORIGIN || '';
const API_VERSION = '47';
const MAX_PROMPT_CHARS = 900;
const MAX_SCENES = 60;

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './uploads');
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const allowedVideoTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska'
]);

const videoStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    mkdir(UPLOAD_DIR, { recursive: true })
      .then(() => callback(null, UPLOAD_DIR))
      .catch(callback);
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedVideoTypes.has(file.mimetype)) {
      return callback(new Error('UNSUPPORTED_VIDEO_FORMAT'));
    }
    callback(null, true);
  }
});


if (!token || token.length < 24) {
  console.error('Set BACKEND_ACCESS_TOKEN in .env to a random secret of at least 24 characters.');
  process.exit(1);
}
if (!allowedOrigin || allowedOrigin === '*') {
  console.error('Set CORS_ORIGIN to the exact origin hosting the app. Wildcard CORS is not allowed.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

// V44: durable JSON file storage. For high-volume production, replace with a transactional database.
const DATA_FILE = resolve(process.env.JOBS_DATA_FILE || './data/jobs.json');
const jobs = new Map();
let persistChain = Promise.resolve();
async function loadJobs() {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Invalid jobs store format');
    for (const job of parsed) if (job && typeof job.jobId === 'string') jobs.set(job.jobId, job);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, '[]\n', { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  }
}
function persistJobs() {
  const snapshot = JSON.stringify([...jobs.values()], null, 2) + '\n';
  persistChain = persistChain.then(async () => {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.${process.pid}.tmp`;
    await writeFile(temp, snapshot, { mode: 0o600 });
    await rename(temp, DATA_FILE);
  });
  return persistChain;
}
const auth = (req, res, next) => {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  next();
};
// V47: authenticated video upload
app.post('/uploads', auth, (req, res) => {
  videoUpload.single('video')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'VIDEO_TOO_LARGE', maxSizeMB: 100 });
      }
      return res.status(400).json({
        error: error.message === 'UNSUPPORTED_VIDEO_FORMAT'
          ? 'UNSUPPORTED_VIDEO_FORMAT'
          : 'UPLOAD_FAILED'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'VIDEO_REQUIRED' });
    }

    return res.status(201).json({
      ok: true,
      uploadId: randomUUID(),
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      message: 'VIDEO_UPLOADED'
    });
  });
});
app.get('/health', (_req, res) => res.json({
  ok: true, apiVersion: API_VERSION, providerConfigured: Boolean(provider.isConfigured()),
  providerName: provider.providerName(), storage: 'persistent-json-file',
}));

app.get('/provider/contract', (_req, res) => res.json({ ok: true, apiVersion: API_VERSION, provider: provider.adapterContract() }));

// V46: verify the configured OpenRouter key and selected model without starting a render.
app.get('/provider/test', auth, async (_req, res) => {
  try { const result = await provider.testConnection(); return res.status(result.ok ? 200 : 503).json(result); }
  catch (error) { console.error('Provider test failed:', error?.message || error); return res.status(error.status || 502).json({ ok: false, error: 'PROVIDER_TEST_FAILED', message: error.message }); }
});
app.get('/provider/models', auth, async (_req, res) => {
  try { const models = await provider.listVideoModels(); return res.json({ ok: true, models: models.map(m => ({ id: m.id, name: m.name, supportedDurations: m.supported_durations || [], supportedAspectRatios: m.supported_aspect_ratios || [], supportedResolutions: m.supported_resolutions || [], pricingSkus: m.pricing_skus || null })) }); }
  catch (error) { console.error('Provider models failed:', error?.message || error); return res.status(error.status || 502).json({ ok: false, error: 'PROVIDER_MODELS_FAILED', message: error.message }); }
});

app.get('/capabilities', (_req, res) => res.json({
  ok: true, apiVersion: API_VERSION, providerConfigured: Boolean(provider.isConfigured()),
  providerName: provider.providerName(),
  limits: { maxPromptCharacters: MAX_PROMPT_CHARS, maxScenes: MAX_SCENES },
  endpoints: [
    { method: 'GET', path: '/health', auth: false },
    { method: 'GET', path: '/capabilities', auth: false },
    { method: 'GET', path: '/provider/contract', auth: false },
    { method: 'GET', path: '/provider/test', auth: true },
    { method: 'POST', path: '/uploads', auth: true },
    { method: 'GET', path: '/jobs', auth: true, pagination: true },
    { method: 'POST', path: '/jobs', auth: true },
    { method: 'GET', path: '/jobs/{jobId}', auth: true },
    { method: 'POST', path: '/jobs/{jobId}/cancel', auth: true },
  ],
  storage: 'persistent-json-file',
}));

// V45: authenticated, paginated job history. Returns metadata only; no provider calls.
app.get('/jobs', auth, (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit || '20'), 10);
  const rawOffset = Number.parseInt(String(req.query.offset || '0'), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  const requestedStatus = String(req.query.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['queued', 'processing', 'completed', 'succeeded', 'failed', 'error', 'cancelled', 'canceled']);
  if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
    return res.status(400).json({ error: 'INVALID_STATUS_FILTER', allowed: [...allowedStatuses] });
  }
  const all = [...jobs.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const filtered = requestedStatus ? all.filter(job => String(job.status || '').toLowerCase() === requestedStatus) : all;
  const items = filtered.slice(offset, offset + limit).map(job => ({
    jobId: job.jobId,
    status: job.status || 'unknown',
    progress: Number.isFinite(job.progress) ? job.progress : 0,
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null,
    resultUrl: job.resultUrl || null,
    resultUrls: job.resultUrls || [],
    error: job.error || null
  }));
  return res.json({ items, pagination: { limit, offset, total: filtered.length, hasMore: offset + items.length < filtered.length }, storage: 'persistent-json-file' });
});

app.post('/jobs', auth, async (req, res) => {
  const pack = req.body;
  if (!pack || pack.type !== 'VIDEO_RENDER_JOB' || !Array.isArray(pack.scenes) || pack.scenes.length < 1) {
    return res.status(400).json({ error: 'INVALID_SCENE_PACK', message: 'Expected VIDEO_RENDER_JOB with a non-empty scenes array.' });
  }
  if (pack.scenes.length > MAX_SCENES) {
    return res.status(413).json({ error: 'TOO_MANY_SCENES', maxScenes: MAX_SCENES });
  }
  for (let i = 0; i < pack.scenes.length; i++) {
    const scene = pack.scenes[i];
    const prompt = String(scene?.prompt || '');
    const count = Array.from(prompt).length;
    if (!prompt.trim()) return res.status(400).json({ error: 'EMPTY_SCENE_PROMPT', scene: i + 1 });
    if (count > MAX_PROMPT_CHARS) return res.status(413).json({ error: 'PROMPT_TOO_LONG', scene: i + 1, characters: count, maxCharacters: MAX_PROMPT_CHARS });
  }
  if (!provider.isConfigured()) {
    return res.status(503).json({ error: 'VIDEO_PROVIDER_NOT_CONFIGURED', message: 'Backend is running, but no AI video provider adapter is configured. No render was started.' });
  }
  const jobId = randomUUID();
  try {
    const providerJob = await provider.submitRenderJob(pack);
    jobs.set(jobId, { jobId, providerJobId: providerJob.id, providerJobIds: providerJob.jobs || [], model: providerJob.model || null, sceneCount: pack.scenes.length, status: 'queued', progress: 0, createdAt: new Date().toISOString() });
    await persistJobs();
    return res.status(202).json({ jobId, status: 'queued', sceneCount: pack.scenes.length, provider: provider.providerName() });
  } catch (error) {
    console.error('Provider submit failed:', error?.message || error);
    if (Array.isArray(error.acceptedJobs) && error.acceptedJobs.length) {
      jobs.set(jobId, { jobId, providerJobIds: error.acceptedJobs, sceneCount: pack.scenes.length, status: 'processing', progress: 0, error: 'PARTIAL_SUBMISSION: ' + error.message, createdAt: new Date().toISOString() });
      await persistJobs();
      return res.status(502).json({ error: 'PROVIDER_PARTIAL_SUBMISSION', jobId, acceptedScenes: error.acceptedJobs.length, message: 'အချို့ Scene များသာ Provider သို့ ရောက်ရှိသွားနိုင်သည်။ Job ID ဖြင့် စစ်ဆေးပါ။' });
    }
    return res.status(error.status || 502).json({ error: 'PROVIDER_SUBMIT_FAILED', message: error.message });
  }
});

app.get('/jobs/:jobId', auth, async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
  if (!provider.isConfigured()) return res.status(503).json({ error: 'VIDEO_PROVIDER_NOT_CONFIGURED' });
  try {
    const latest = await provider.getRenderJob(job.providerJobIds?.length ? job.providerJobIds : job.providerJobId);
    Object.assign(job, latest, { jobId: job.jobId, updatedAt: new Date().toISOString() });
    await persistJobs();
    return res.json(job);
  } catch (error) {
    console.error('Provider status failed:', error?.message || error);
    return res.status(502).json({ error: 'PROVIDER_STATUS_FAILED' });
  }
});

app.post('/jobs/:jobId/cancel', auth, async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
  if (!provider.isConfigured()) return res.status(503).json({ error: 'VIDEO_PROVIDER_NOT_CONFIGURED' });
  try {
    await provider.cancelRenderJob(job.providerJobId);
    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    await persistJobs();
    return res.json({ jobId: job.jobId, status: 'cancelled' });
  } catch (error) {
    console.error('Provider cancel failed:', error?.message || error);
    return res.status(error.status || 502).json({ error: 'PROVIDER_CANCEL_FAILED', message: error.message });
  }
});

await loadJobs();
app.listen(port, () => console.log(`AI Movie Recap backend v${API_VERSION} listening on port ${port}; restored ${jobs.size} job(s)`));
