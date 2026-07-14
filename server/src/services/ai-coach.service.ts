import { createAIProvider, type AIProvider } from '../ai/providers/openai.provider.js';
import { buildSystemPrompt, buildTrainingPlanPrompt, type CoachContext } from '../ai/prompts/system.js';
import { policyService } from './policy.service.js';
import { db } from '../db/index.js';
import { clubs, seasons } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * AI Coach Service - Orchestrates AI interactions.
 * 
 * Features:
 * 1. Free-form chat ("Ask the Coach")
 * 2. Training plan generation
 * 3. Contextual suggestions
 * 
 * Always respects coaching policies and philosophy.
 */

type ServiceResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AiCoachService {
  private provider: AIProvider;

  constructor() {
    this.provider = createAIProvider();
  }

  /**
   * Check if AI is available (API key configured).
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  /**
   * Chat with the AI Coach.
   * Sends the user's message with the coaching context as system prompt.
   */
  async chat(userMessage: string, conversationHistory?: ChatMessage[]): Promise<ServiceResult<{ reply: string }>> {
    const available = await this.provider.isAvailable();
    if (!available) {
      return {
        success: false,
        error: { code: 'AI_UNAVAILABLE', message: 'AI Coach is not available. Please configure your OpenAI API key in the .env file.' },
      };
    }

    // Check if AI is enabled in policies
    const aiConfig = await policyService.getAiBehaviourConfig();
    if (!aiConfig.enabled) {
      return {
        success: false,
        error: { code: 'AI_DISABLED', message: 'AI features are disabled in Settings. Enable them to use the AI Coach.' },
      };
    }

    try {
      const context = await this.getCoachContext();
      const systemPrompt = buildSystemPrompt(context);

      // Build conversation with history
      let fullPrompt = userMessage;
      if (conversationHistory && conversationHistory.length > 0) {
        const historyText = conversationHistory
          .slice(-6) // Keep last 6 messages for context
          .map((m) => `${m.role === 'user' ? 'Coach' : 'AI'}: ${m.content}`)
          .join('\n\n');
        fullPrompt = `Previous conversation:\n${historyText}\n\nCoach: ${userMessage}`;
      }

      const reply = await this.provider.generateText(fullPrompt, systemPrompt);
      return { success: true, data: { reply } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed.';
      return { success: false, error: { code: 'AI_ERROR', message } };
    }
  }

  /**
   * Generate a training session plan from a theme.
   */
  async generateTrainingPlan(theme: string, durationMinutes?: number): Promise<ServiceResult<{ plan: unknown[]; rawResponse: string }>> {
    const available = await this.provider.isAvailable();
    if (!available) {
      return { success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI Coach is not available.' } };
    }

    try {
      const context = await this.getCoachContext();
      const duration = durationMinutes ?? 60;
      const prompt = buildTrainingPlanPrompt(theme, context.ageGroup ?? 'U10', context.format ?? '7v7', duration);
      const systemPrompt = buildSystemPrompt(context);

      const rawResponse = await this.provider.generateText(prompt, systemPrompt);

      // Try to parse as JSON
      let plan: unknown[] = [];
      try {
        // Extract JSON from response (in case it has markdown code blocks)
        const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If parsing fails, return raw text
      }

      return { success: true, data: { plan, rawResponse } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed.';
      return { success: false, error: { code: 'AI_ERROR', message } };
    }
  }

  /**
   * Get the coaching context for AI prompts.
   */
  private async getCoachContext(): Promise<CoachContext> {
    const philosophy = await policyService.getCoachingPhilosophy();
    const aiConfig = await policyService.getAiBehaviourConfig();

    // Get team info
    let teamName: string | undefined;
    let ageGroup: string | undefined;
    let format: string | undefined;

    try {
      const clubResults = await db.select().from(clubs);
      if (clubResults.length > 0) {
        teamName = clubResults[0].teamName ?? clubResults[0].name;
        ageGroup = clubResults[0].ageGroup ?? undefined;
      }
      const seasonResults = await db.select().from(seasons).where(eq(seasons.isActive, true));
      if (seasonResults.length > 0) {
        format = seasonResults[0].format;
      }
    } catch {
      // Silently continue if tables don't have data yet
    }

    return {
      philosophy,
      tone: aiConfig.tone,
      teamName,
      ageGroup,
      format,
    };
  }
}

export const aiCoachService = new AiCoachService();
