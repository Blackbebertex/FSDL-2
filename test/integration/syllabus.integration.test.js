import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'fs/promises';
import path from 'path';
import process from 'node:process';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { createApp } from '../../server/app.js';
import { setStorageMode } from '../../server/storage/workspaceStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = createApp({ allowedOrigins: ['http://localhost:5173'] });
const uploadsDir = path.resolve(__dirname, '../../server/uploads');
const dummyPdfPath = path.resolve(__dirname, '../../test-assets/dummy.pdf');

const login = async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(200);

  const cookie = response.headers['set-cookie']?.[0];
  assert.ok(cookie, 'login should set a session cookie');
  return cookie;
};

test('syllabus upload extracts data from a valid PDF and cleans up temp files', async () => {
  setStorageMode('file');
  const originalProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'local';
  const cookie = await login();
  const uniqueName = `cleanup-${Date.now()}-probe.pdf`;

  try {
    const beforeFiles = await fs.readdir(uploadsDir);

    const response = await request(app)
      .post('/api/syllabus/upload')
      .set('Cookie', cookie)
      .attach('syllabus', dummyPdfPath, { filename: uniqueName, contentType: 'application/pdf' })
      .expect(200);

    assert.equal(response.body.success, true);
    assert.equal(response.body.extractionMode, 'local');
    assert.equal(response.body.details.subjectName, 'Dummy PDF file');
    assert.equal(response.body.details.marks, 100);
    assert.equal(response.body.details.durationMinutes, 120);

    const afterFiles = await fs.readdir(uploadsDir);
    const leakedFiles = afterFiles.filter((file) => file.includes(uniqueName));
    assert.equal(leakedFiles.length, 0);
    assert.equal(afterFiles.length, beforeFiles.length);
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
  }
});

test('syllabus upload rejects non-PDF files', async () => {
  setStorageMode('file');
  const originalProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'local';
  const cookie = await login();

  try {
    const response = await request(app)
      .post('/api/syllabus/upload')
      .set('Cookie', cookie)
      .attach('syllabus', Buffer.from('not a pdf'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    assert.equal(response.body.error, 'Only PDF files are allowed');
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
  }
});

test('syllabus upload rejects oversized files', async () => {
  setStorageMode('file');
  const originalProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'local';
  const cookie = await login();
  const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);

  try {
    const response = await request(app)
      .post('/api/syllabus/upload')
      .set('Cookie', cookie)
      .attach('syllabus', oversizedBuffer, {
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    assert.equal(response.body.error, 'File size must be 10MB or less');
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
  }
});

test('syllabus upload falls back to local parsing when Claude fails', async () => {
  setStorageMode('file');
  const cookie = await login();
  const originalProvider = process.env.LLM_PROVIDER;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = globalThis.fetch;

  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  });

  try {
    const response = await request(app)
      .post('/api/syllabus/upload')
      .set('Cookie', cookie)
      .attach('syllabus', dummyPdfPath, { filename: 'fallback.pdf', contentType: 'application/pdf' })
      .expect(200);

    assert.equal(response.body.extractionMode, 'local');
    assert.equal(response.body.details.subjectName, 'Dummy PDF file');
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }

    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }

    globalThis.fetch = originalFetch;
  }
});

test('syllabus upload uses Bedrock when the SDK succeeds', async () => {
  setStorageMode('file');
  const cookie = await login();
  const originalProvider = process.env.LLM_PROVIDER;
  const originalRegion = process.env.AWS_REGION;
  const originalSend = BedrockRuntimeClient.prototype.send;

  process.env.LLM_PROVIDER = 'bedrock';
  process.env.AWS_REGION = 'us-east-1';
  BedrockRuntimeClient.prototype.send = async () => ({
    body: new TextEncoder().encode(JSON.stringify({
      content: [
        {
          text: JSON.stringify({
            subjectName: 'Bedrock Subject',
            paperDuration: 90,
            totalMarks: 100,
            passingMarks: 40,
          }),
        },
      ],
    })),
  });

  try {
    const response = await request(app)
      .post('/api/syllabus/upload')
      .set('Cookie', cookie)
      .attach('syllabus', dummyPdfPath, { filename: 'bedrock.pdf', contentType: 'application/pdf' })
      .expect(200);

    assert.equal(response.body.extractionMode, 'bedrock');
    assert.equal(response.body.details.subjectName, 'Bedrock Subject');
    assert.equal(response.body.details.durationMinutes, 90);
    assert.equal(response.body.details.marks, 100);
    assert.equal(response.body.details.passingMarks, 40);
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }

    if (originalRegion === undefined) {
      delete process.env.AWS_REGION;
    } else {
      process.env.AWS_REGION = originalRegion;
    }

    BedrockRuntimeClient.prototype.send = originalSend;
  }
});