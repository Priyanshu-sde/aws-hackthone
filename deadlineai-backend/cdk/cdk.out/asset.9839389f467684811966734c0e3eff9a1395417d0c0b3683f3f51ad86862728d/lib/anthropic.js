import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// HACKATHON NOTE: Using AWS Bedrock with Claude instead of direct Anthropic API.
// Bedrock auth uses IAM role credentials automatically — no API key needed.

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Call AWS Bedrock with Claude model for AI tasks.
 */
export async function callClaude(prompt, options = {}) {
  const { maxTokens = 4096, temperature = 0.2 } = options;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system: prompt.system,
    messages: [
      { role: 'user', content: prompt.user },
    ],
  });

  console.log('Calling Bedrock Claude with prompt length:', prompt.user.length);

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content[0].text;

  console.log('Bedrock response length:', text.length);
  return text;
}

/**
 * Call Claude and parse JSON response. Retries once on parse failure.
 */
export async function callClaudeJSON(prompt, options = {}) {
  let text = await callClaude(prompt, options);

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch (firstErr) {
    console.warn('First JSON parse failed, retrying with correction prompt:', firstErr.message);

    const retryPrompt = {
      system: prompt.system,
      user: `${prompt.user}\n\nYour previous response was not valid JSON. The parse error was: "${firstErr.message}". Please return ONLY valid JSON with no extra text, no markdown fences, no explanation.`,
    };

    let retryText = await callClaude(retryPrompt, options);
    retryText = retryText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      return JSON.parse(retryText);
    } catch (secondErr) {
      console.error('Second JSON parse also failed:', secondErr.message);
      throw new Error(`Claude returned invalid JSON after retry: ${secondErr.message}`);
    }
  }
}
