/**
 * EasyAI Service — connects the persona system prompts to the AI backend.
 *
 * Config policy: Bring Your Own Key (BYOK)
 *   1. Free users: Local Ollama (http://localhost:11434)
 *   2. Premium users: Bring Your Own API Key (configured in Settings > About > EasyAI API Hosting)
 */
import LicenseManager from '../../premium/LicenseManager';

export interface EasyAIConfig {
  agent: string;   // Ollama | Gemini | Bedrock | Claude
  host: string;    // e.g. http://localhost:11434
  model: string;   // e.g. ministral-3:3b
  apiKey: string;
  isPremiumDefault?: boolean;
}

/**
 * Returns true if the user has Premium or PremiumPlus license.
 */
export function hasPremiumAccess(): boolean {
  return LicenseManager.hasActiveLicense();
}

/**
 * Returns true if the user has PremiumPlus license.
 */
export function hasPremiumPlusAccess(): boolean {
  return LicenseManager.hasActiveLicense() && LicenseManager.getType() === 'PremiumPlus';
}

/**
 * Returns default details for BYOK models.
 */
export function getPremiumDefaults(): { agent: string; model: string; apiKey: string } {
  return {
    agent: 'Gemini',
    model: 'gemini-2.0-flash',
    apiKey: '',
  };
}

/**
 * Load the EasyAI config from storage.
 */
export async function loadEasyAIConfig(_forcePremiumDefault = false): Promise<EasyAIConfig> {
  const ollamaDefaults: EasyAIConfig = {
    agent: 'Ollama',
    host: 'http://localhost:11434',
    model: 'ministral-3:3b',
    apiKey: '',
    isPremiumDefault: false,
  };

  try {
    const isTauri = !!(window as any).__TAURI__;

    if (isTauri) {
      const { homeDir, join } = await import('@tauri-apps/api/path');
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
      const homePath = await homeDir();
      const configPath = await join(homePath, '.easyeditor', 'easyai-config.env');

      if (await exists(configPath)) {
        const content = await readTextFile(configPath);
        const get = (key: string, fallback: string) => {
          const m = content.match(new RegExp(`${key}=(.*)`));
          return m ? m[1].trim() : fallback;
        };
        return {
          agent: get('EASYAI_AGENT', ollamaDefaults.agent),
          host: get('EASYAI_HOST', ollamaDefaults.host),
          model: get('EASYAI_MODEL', ollamaDefaults.model),
          apiKey: get('EASYAI_API_KEY', ollamaDefaults.apiKey),
          isPremiumDefault: false,
        };
      }
    } else {
      const raw = localStorage.getItem('easyai-config');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          agent: parsed.agent || ollamaDefaults.agent,
          host: parsed.host || ollamaDefaults.host,
          model: parsed.model || ollamaDefaults.model,
          apiKey: parsed.apiKey ?? ollamaDefaults.apiKey,
          isPremiumDefault: false,
        };
      }
    }
  } catch (err) {
    console.warn('[EasyAI] Could not load config, using defaults:', err);
  }

  // No saved custom config
  if (hasPremiumAccess()) {
    return {
      agent: 'Gemini',
      host: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
      apiKey: '',
      isPremiumDefault: false,
    };
  }

  return ollamaDefaults;
}

/**
 * Returns true when the user has a saved custom config stored
 * (i.e. they have gone into Settings > About > EasyAI API Hosting and saved something).
 */
export async function hasCustomConfig(): Promise<boolean> {
  try {
    const isTauri = !!(window as any).__TAURI__;
    if (isTauri) {
      const { homeDir, join } = await import('@tauri-apps/api/path');
      const { exists } = await import('@tauri-apps/plugin-fs');
      const homePath = await homeDir();
      const configPath = await join(homePath, '.easyeditor', 'easyai-config.env');
      return await exists(configPath);
    } else {
      const raw = localStorage.getItem('easyai-config');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed.apiKey || (parsed.agent && parsed.agent !== 'Ollama'));
    }
  } catch {
    return false;
  }
}


/**
 * Send a prompt to the Ollama /api/chat endpoint.
 * Returns the assistant's message content.
 */
/**
 * Determine the effective Ollama URL.
 * When running in the browser (non-Tauri) against any remote Ollama host,
 * route through the Vite dev proxy to avoid CORS issues.
 * Local hosts (localhost / 127.0.0.1) are called directly.
 */
function getOllamaUrl(host: string): { url: string; proxyTarget?: string } {
  const cleanHost = host.replace(/\/+$/, '');
  const isTauri = !!(window as any).__TAURI__;
  const isLocal = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1');

  if (!isTauri && !isLocal) {
    return { url: '/api/ollama-proxy/api/chat', proxyTarget: cleanHost };
  }
  return { url: `${cleanHost}/api/chat` };
}

async function callOllama(
  config: EasyAIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const { url, proxyTarget } = getOllamaUrl(config.host);

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Ollama cloud requires an API key via Authorization header
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // Tell the proxy middleware where to forward the request
  if (proxyTarget) {
    headers['X-Proxy-Target'] = proxyTarget;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content ?? '';
}

/**
 * Send a prompt to the Google Gemini API.
 * Uses the generativelanguage.googleapis.com REST endpoint.
 * Config: apiKey = Google API key, model = e.g. gemini-2.0-flash
 * Host is ignored (uses Google's endpoint directly).
 */
async function callGemini(
  config: EasyAIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Gemini requires an API key. Set it in Settings > About > EasyAI API Hosting.');
  }

  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Send a prompt to the Anthropic Claude API.
 * Uses the api.anthropic.com Messages endpoint.
 * Config: apiKey = Anthropic API key, model = e.g. claude-sonnet-4-20250514
 * Host can override the base URL for proxied setups.
 */
async function callClaude(
  config: EasyAIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Claude requires an API key. Set it in Settings > About > EasyAI API Hosting.');
  }

  const baseUrl = config.host && !config.host.includes('localhost')
    ? config.host.replace(/\/+$/, '')
    : 'https://api.anthropic.com';
  const url = `${baseUrl}/v1/messages`;
  const model = config.model || 'claude-sonnet-4-20250514';

  const body = {
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Claude returns content as an array of blocks
  const blocks = data.content ?? [];
  return blocks
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
}

/**
 * Send a prompt to AWS Bedrock via the invoke-model REST endpoint.
 * Config: host = full Bedrock endpoint URL (e.g. https://bedrock-runtime.us-east-1.amazonaws.com),
 *         model = model ID (e.g. anthropic.claude-3-haiku-20240307-v1:0),
 *         apiKey = format "ACCESS_KEY_ID:SECRET_ACCESS_KEY" or a session token.
 *
 * NOTE: For browser-based usage, Bedrock typically requires a proxy/gateway
 * since direct AWS SigV4 signing from the browser is complex.
 * This implementation supports a proxy that accepts the Bedrock converse API format
 * and forwards to AWS with proper signing.
 */
async function callBedrock(
  config: EasyAIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (!config.host) {
    throw new Error('Bedrock requires a host URL (e.g. your Bedrock proxy endpoint). Set it in Settings > About > EasyAI API Hosting.');
  }

  const baseUrl = config.host.replace(/\/+$/, '');
  const model = config.model || 'anthropic.claude-3-haiku-20240307-v1:0';
  const url = `${baseUrl}/model/${encodeURIComponent(model)}/converse`;

  const body = {
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 8192,
      temperature: 0.7,
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If an API key is provided, pass it as Authorization header for proxy auth
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bedrock returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Bedrock Converse API response format
  const output = data.output?.message?.content ?? [];
  return output
    .filter((b: any) => b.text)
    .map((b: any) => b.text)
    .join('');
}

/**
 * Main entry point — dispatches to the correct backend based on config.agent.
 *
 * @param forcePremiumDefault - when true, bypass any saved user config and use
 *   the pre-configured premium model from .env.local.
 */
export async function queryEasyAI(
  systemPrompt: string,
  userPrompt: string,
  forcePremiumDefault = false,
): Promise<string> {
  const config = await loadEasyAIConfig(forcePremiumDefault);

  console.log(`[EasyAI] Using agent=${config.agent}, model=${config.model}, host=${config.host}, premiumDefault=${config.isPremiumDefault}`);

  switch (config.agent) {
    case 'Ollama':
      return callOllama(config, systemPrompt, userPrompt);
    case 'Gemini':
      return callGemini(config, systemPrompt, userPrompt);
    case 'Claude':
      return callClaude(config, systemPrompt, userPrompt);
    case 'Bedrock':
      return callBedrock(config, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported EasyAI agent: "${config.agent}". Configure a supported agent in Settings > About > EasyAI API Hosting.`);
  }
}
