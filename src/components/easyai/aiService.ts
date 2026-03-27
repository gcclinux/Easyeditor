/**
 * EasyAI Service — connects the persona system prompts to the AI backend.
 *
 * Reads config from:
 *   - Tauri: ~/.easyeditor/easyai-config.env
 *   - Web:   localStorage key "easyai-config"
 */

export interface EasyAIConfig {
  agent: string;   // Ollama | Gemini | Bedrock | Claude
  host: string;    // e.g. http://localhost:11434
  model: string;   // e.g. ministral-3:3b
  apiKey: string;
}

/**
 * Load the EasyAI config from the appropriate storage.
 */
export async function loadEasyAIConfig(): Promise<EasyAIConfig> {
  const defaults: EasyAIConfig = {
    agent: 'Ollama',
    host: 'http://localhost:11434',
    model: 'ministral-3:3b',
    apiKey: '',
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
          agent: get('EASYAI_AGENT', defaults.agent),
          host: get('EASYAI_HOST', defaults.host),
          model: get('EASYAI_MODEL', defaults.model),
          apiKey: get('EASYAI_API_KEY', defaults.apiKey),
        };
      }
    } else {
      const raw = localStorage.getItem('easyai-config');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          agent: parsed.agent || defaults.agent,
          host: parsed.host || defaults.host,
          model: parsed.model || defaults.model,
          apiKey: parsed.apiKey ?? defaults.apiKey,
        };
      }
    }
  } catch (err) {
    console.warn('[EasyAI] Could not load config, using defaults:', err);
  }

  return defaults;
}


/**
 * Send a prompt to the Ollama /api/chat endpoint.
 * Returns the assistant's message content.
 */
async function callOllama(
  config: EasyAIConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = `${config.host.replace(/\/+$/, '')}/api/chat`;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
 */
export async function queryEasyAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const config = await loadEasyAIConfig();

  console.log(`[EasyAI] Using agent=${config.agent}, model=${config.model}, host=${config.host}`);

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
