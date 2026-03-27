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

    // Future agents can be added here:
    // case 'Gemini': return callGemini(config, systemPrompt, userPrompt);
    // case 'Claude': return callClaude(config, systemPrompt, userPrompt);
    // case 'Bedrock': return callBedrock(config, systemPrompt, userPrompt);

    default:
      throw new Error(`Unsupported EasyAI agent: "${config.agent}". Configure a supported agent in Settings > About > EasyAI API Hosting.`);
  }
}
