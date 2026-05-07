import { compactText } from './utils';

export class OpenAIClient {
  public async summarize(input: string, fallbackHint: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return compactText(`${fallbackHint}: ${input}`, 220);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content: 'You create concise operational engineering summaries. Prioritize intent, behavior, and risk in <=2 sentences.',
            },
            {
              role: 'user',
              content: input,
            },
          ],
          max_output_tokens: 140,
        }),
      });

      if (!response.ok) {
        return compactText(`${fallbackHint}: ${input}`, 220);
      }

      const data = (await response.json()) as {
        output_text?: string;
      };

      return compactText(data.output_text ?? `${fallbackHint}: ${input}`, 220);
    } catch {
      return compactText(`${fallbackHint}: ${input}`, 220);
    }
  }
}
