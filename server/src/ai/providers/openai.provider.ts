/**
 * OpenAI AI Provider - GPT-4o-mini integration for Touchline AI Coach.
 * 
 * This is behind the AIProvider interface so it can be swapped for
 * another provider (Bedrock, local LLM) without changing business logic.
 */

export interface AIProvider {
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string | undefined;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }
}

/**
 * Offline fallback - returns helpful messages when AI is unavailable.
 */
export class OfflineFallback implements AIProvider {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async generateText(): Promise<string> {
    return 'AI Coach is currently unavailable. Please check your OpenAI API key in Settings.';
  }
}

// Create singleton - use OpenAI if key available, otherwise fallback
export function createAIProvider(): AIProvider {
  const provider = new OpenAIProvider();
  return provider;
}
