#!/usr/bin/env node
// Uses Node's global `fetch` (Node 18+). No external deps required.
import process from 'node:process';

const key = process.env.ANTHROPIC_API_KEY;
const shouldTest = process.argv.includes('--test');

if (!key) {
  console.error('ERROR: ANTHROPIC_API_KEY not set in environment.');
  console.error('Set the key and retry, or run without --test to only verify presence.');
  process.exit(2);
}

console.log('Found ANTHROPIC_API_KEY in environment.');

if (!shouldTest) {
  console.log('Run with `--test` to perform a quick live API call (may use quota).');
  process.exit(0);
}

(async () => {
  console.log('Performing live Anthropic API check...');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({
        model: 'claude-3-100k',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('Anthropic API responded with status', resp.status);
      const text = await resp.text();
      console.error(text);
      process.exit(3);
    }

    console.log('Anthropic API call succeeded (OK).');
    process.exit(0);
  } catch (err) {
    console.error('Anthropic API check failed:', err.message || err);
    process.exit(3);
  }
})();
