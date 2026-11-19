/**
 * V46 OpenRouter video adapter.
 * Uses OpenRouter's documented asynchronous video endpoints.
 * Secret keys are read only from backend environment variables.
 */
const BASE = 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = process.env.VIDEO_MODEL || '';
const PROVIDER = String(process.env.VIDEO_PROVIDER || 'not-configured').toLowerCase();

function configured() { return PROVIDER === 'openrouter' && API_KEY.length > 10 && MODEL.length > 2; }
function providerName() { return configured() ? `OpenRouter (${MODEL})` : 'not-configured'; }
function adapterContract() {
  return {
    providerSelected: PROVIDER === 'openrouter',
    provider: 'OpenRouter Video Generation API',
    configured: configured(),
    model: MODEL || null,
    requiredEnvironment: ['VIDEO_PROVIDER=openrouter', 'OPENROUTER_API_KEY', 'VIDEO_MODEL'],
    endpoints: { submit: 'POST /api/v1/videos', status: 'GET /api/v1/videos/{jobId}', models: 'GET /api/v1/videos/models' },
    cancellationSupported: false,
    note: 'Each scene is submitted as a separate asynchronous provider job. Verify model duration/aspect/resolution support before rendering.'
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(45000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      'Unknown provider error';

    const error = new Error(
      `OpenRouter HTTP ${response.status} at ${path}: ${msg}`
    );

    error.status = response.status;
    error.providerPath = path;
    error.providerCode = data?.error?.code || null;

    throw error;
  }

  return data;  
}
async function listVideoModels() {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY_MISSING');
  const data = await request('/videos/models');
  return Array.isArray(data.data) ? data.data : [];
}

async function testConnection() {
  if (!configured()) {
    return {
      ok: false,
      configured: false,
      message: 'VIDEO_PROVIDER, OPENROUTER_API_KEY, VIDEO_MODEL ကို Backend environment ထဲမှာ သတ်မှတ်ပါ။'
    };
  }

  // API Key ကို OpenRouter ရဲ့ authenticated endpoint နဲ့ စစ်ဆေးမယ်
  await request('/key');

  const models = await listVideoModels();
  const selected = models.find(
    m => m.id === MODEL || m.canonical_slug === MODEL
  );

  return {
    ok: true,
    configured: true,
    keyVerified: true,
    provider: 'OpenRouter',
    model: MODEL,
    modelAvailable: Boolean(selected),
    modelInfo: selected ? {
      name: selected.name || selected.id,
      supportedDurations: selected.supported_durations || [],
      supportedAspectRatios: selected.supported_aspect_ratios || [],
      supportedResolutions: selected.supported_resolutions || [],
      pricingSkus: selected.pricing_skus || null
    } : null,
    modelCount: models.length,
    message: selected
      ? 'API Key အတည်ပြုပြီး ရွေးထားသော Model ကို တွေ့ရှိပါတယ်။'
      : 'API Key အတည်ပြုပြီးပါပြီ။ ရွေးထားသော Model ကို မတွေ့ပါ။'
  };
}
function normalizeRatio(value) {
  const s = String(value || process.env.VIDEO_ASPECT_RATIO || '9:16').trim();
  return ['9:16','16:9','1:1','4:3','3:4','3:2','2:3','21:9','9:21'].includes(s) ? s : '9:16';
}
async function submitRenderJob(scenePack) {
  if (!configured()) throw new Error('OPENROUTER_NOT_CONFIGURED');
  const models = await listVideoModels();
  const model = models.find(m => m.id === MODEL || m.canonical_slug === MODEL);
  if (!model) throw new Error('VIDEO_MODEL_NOT_AVAILABLE');
  const supportedDurations = Array.isArray(model.supported_durations) ? model.supported_durations : [];
  const supportedRatios = Array.isArray(model.supported_aspect_ratios) ? model.supported_aspect_ratios : [];
  const supportedResolutions = Array.isArray(model.supported_resolutions) ? model.supported_resolutions : [];
  const ratio = normalizeRatio(scenePack.project?.frameFormat);
  const resolution = process.env.VIDEO_RESOLUTION || '720p';
  const scenes = scenePack.scenes;
  const invalid = scenes.map((s, i) => {
    const duration = Math.max(1, Math.round(Number(s.duration) || Number(process.env.VIDEO_SCENE_DURATION) || 4));
    const reasons = [];
    if (supportedDurations.length && !supportedDurations.includes(duration)) reasons.push(`duration ${duration}s`);
    if (supportedRatios.length && !supportedRatios.includes(ratio)) reasons.push(`aspect ratio ${ratio}`);
    if (supportedResolutions.length && !supportedResolutions.includes(resolution)) reasons.push(`resolution ${resolution}`);
    return reasons.length ? `Scene ${i + 1}: ${reasons.join(', ')}` : null;
  }).filter(Boolean);
  if (invalid.length) throw new Error(`MODEL_PARAMETERS_UNSUPPORTED: ${invalid.join('; ')}`);

  const accepted = [];
  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const duration = Math.max(1, Math.round(Number(scene.duration) || Number(process.env.VIDEO_SCENE_DURATION) || 4));
      const payload = {
        model: MODEL,
        prompt: String(scene.prompt || ''),
        duration,
        aspect_ratio: ratio,
        resolution
      };
      const result = await request('/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!result.id) throw new Error('PROVIDER_RESPONSE_MISSING_JOB_ID');
      accepted.push({ scene: Number(scene.scene) || i + 1, id: result.id, status: result.status || 'pending' });
    }
  } catch (error) {
    error.acceptedJobs = accepted;
    throw error;
  }
  return { id: accepted.map(x => x.id), jobs: accepted, model: MODEL };
}
async function getRenderJob(providerJobIds) {
  if (!configured()) throw new Error('OPENROUTER_NOT_CONFIGURED');
  const ids = Array.isArray(providerJobIds) ? providerJobIds : [providerJobIds];
  const results = await Promise.all(ids.filter(Boolean).map(async item => {
    const id = typeof item === 'string' ? item : item.id;
    const scene = typeof item === 'string' ? null : item.scene;
    const data = await request(`/videos/${encodeURIComponent(id)}`);
    const status = String(data.status || 'pending').toLowerCase();
    const url = (Array.isArray(data.urls) && data.urls[0]) || (Array.isArray(data.unsigned_urls) && data.unsigned_urls[0]) || null;
    return { scene, providerJobId: id, status, resultUrl: url, error: data.error || null, usage: data.usage || null };
  }));
  const total = results.length || 1;
  const completed = results.filter(x => x.status === 'completed').length;
  const failed = results.some(x => ['failed','expired'].includes(x.status));
  const cancelled = results.every(x => ['cancelled','canceled'].includes(x.status));
  const done = completed + results.filter(x => ['failed','expired','cancelled','canceled'].includes(x.status)).length;
  const allTerminal = results.length > 0 && results.every(x => ['completed','failed','expired','cancelled','canceled'].includes(x.status));
  const status = !allTerminal ? 'processing' : failed ? 'failed' : cancelled ? 'cancelled' : completed === total ? 'completed' : 'failed';
  const resultUrls = results.filter(x => x.resultUrl).map(x => ({ scene: x.scene, url: x.resultUrl }));
  return { status, progress: Math.round(done / total * 100), resultUrl: resultUrls[0]?.url || null, resultUrls, sceneResults: results, error: results.find(x => x.error)?.error || null };
}
async function cancelRenderJob() {
  const error = new Error('OPENROUTER_VIDEO_CANCELLATION_NOT_SUPPORTED_BY_THIS_ADAPTER');
  error.status = 501; throw error;
}

export function isConfigured() { return configured(); }

export { adapterContract, providerName, listVideoModels, testConnection, submitRenderJob, getRenderJob, cancelRenderJob };
