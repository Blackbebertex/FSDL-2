#!/usr/bin/env node
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import process from 'node:process';

const shouldTest = process.argv.includes('--test');
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const modelId = process.env.BEDROCK_MODEL_ID || process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

if (!region) {
  console.error('ERROR: AWS_REGION (or AWS_DEFAULT_REGION) not set.');
  process.exit(2);
}

console.log(`Using AWS region: ${region}`);
console.log(`Using Bedrock model: ${modelId}`);

if (!shouldTest) {
  console.log('Run with `--test` to perform a quick live Bedrock call (may use quota).');
  process.exit(0);
}

const run = async () => {
  try {
    const client = new BedrockRuntimeClient({ region });
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Reply with exactly OK',
              },
            ],
          },
        ],
      }),
    });

    const response = await client.send(command);
    const body = JSON.parse(new TextDecoder('utf-8').decode(response.body));
    const text = body?.content?.[0]?.text || '';
    console.log('Bedrock API call succeeded. Sample response:', text.trim() || '(empty)');
    process.exit(0);
  } catch (error) {
    console.error('Bedrock API check failed:', error.message || error);
    process.exit(3);
  }
};

run();
