import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAiStatus, useAiChat } from '@/hooks/use-ai-coach';
import type { ChatMessage } from '@/services/ai-coach.service';

const SUGGESTED_PROMPTS = [
  'Suggest a warm-up drill for passing',
  'How should I manage a child who is losing confidence?',
  'Suggest development goals for a left midfielder',
  'What should I focus on in training this week after a 3-0 loss?',
  'How do I balance playing time when I have 13 players?',
  'Suggest a 45-minute session focused on defending',
];

/**
 * AI Coach page - "Ask the Coach" chat interface.
 * Provides AI-powered coaching assistance aligned with the coach's philosophy.
 */
export function AiCoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useAiStatus();
  const chatMutation = useAiChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await chatMutation.mutateAsync({
        message: text,
        history: messages.slice(-6),
      });
      const assistantMessage: ChatMessage = { role: 'assistant', content: response.data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${errorMsg}` }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (statusLoading) {
    return <div className="text-muted-foreground py-12 text-center">Checking AI availability...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Coach</h2>
          <p className="text-muted-foreground">Your AI coaching assistant.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${status?.available ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-muted-foreground">
            {status?.available ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Not available warning */}
      {!status?.available && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">AI Coach not connected</p>
              <p className="text-amber-700">Add your OpenAI API key to the server .env file to enable AI features. Set <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY=sk-...</code></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <WelcomeState onSuggestionClick={handleSend} />
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))
        )}
        {chatMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4 animate-pulse" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t pt-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI Coach..."
            disabled={!status?.available || chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || !status?.available || chatMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function WelcomeState({ onSuggestionClick }: { onSuggestionClick: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">Ask the AI Coach</h3>
      <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
        I can help with training plans, development goals, coaching challenges, and more. I'll always align with your coaching philosophy.
      </p>

      <div className="mt-6 w-full max-w-md space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(prompt)}
            className="w-full text-left text-sm rounded-md border px-3 py-2 hover:bg-accent transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
