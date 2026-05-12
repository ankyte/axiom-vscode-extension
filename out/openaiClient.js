"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIClient = void 0;
const utils_1 = require("./utils");
class OpenAIClient {
    async summarize(input, fallbackHint) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return (0, utils_1.compactText)(`${fallbackHint}: ${input}`, 220);
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
                return (0, utils_1.compactText)(`${fallbackHint}: ${input}`, 220);
            }
            const data = (await response.json());
            return (0, utils_1.compactText)(data.output_text ?? `${fallbackHint}: ${input}`, 220);
        }
        catch {
            return (0, utils_1.compactText)(`${fallbackHint}: ${input}`, 220);
        }
    }
}
exports.OpenAIClient = OpenAIClient;
//# sourceMappingURL=openaiClient.js.map