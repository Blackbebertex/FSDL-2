import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { setStorageMode } from '../../server/storage/workspaceStore.js';

const app = createApp({ allowedOrigins: ['http://localhost:5173'] });

const loginAsAdmin = async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(200);

  return response.body.token;
};

test('workspace list requires authentication', async () => {
  setStorageMode('file');

  await request(app)
    .get('/api/workspace/list')
    .expect(401);
});

test('workspace save rejects invalid payload with validation code', async () => {
  setStorageMode('file');
  const token = await loginAsAdmin();

  const createResponse = await request(app)
    .post('/api/workspace/list')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: `Integration-${Date.now()}`, semester: 'S1' })
    .expect(201);

  const workspaceId = createResponse.body.workspace.id;

  const invalidPayload = {
    exams: [{ id: 'E1', name: '', marks: 30, students: [] }],
    rooms: [{ id: 'R1', name: 'Room 1', capacity: 30 }],
    slots: [{ id: 'S1', name: 'Slot 1', date: new Date().toISOString(), time: '10:00 AM', endTime: '11:00 AM' }],
  };

  const saveResponse = await request(app)
    .put(`/api/workspace/${workspaceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ payload: invalidPayload })
    .expect(400);

  assert.equal(saveResponse.body.code, 'WORKSPACE_VALIDATION_FAILED');
});

test('workspace save detects revision conflict', async () => {
  setStorageMode('file');
  const token = await loginAsAdmin();

  const createResponse = await request(app)
    .post('/api/workspace/list')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: `Conflict-${Date.now()}`, semester: 'S2' })
    .expect(201);

  const workspaceId = createResponse.body.workspace.id;

  const loadResponse = await request(app)
    .get(`/api/workspace/${workspaceId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const firstRevision = loadResponse.body.workspace.updatedAt;
  const basePayload = loadResponse.body.workspace.payload;

  const firstSave = {
    ...basePayload,
    exams: [
      ...basePayload.exams,
      { id: `E-${Date.now()}`, name: 'New Exam', marks: 30, durationMinutes: 90, students: [] },
    ],
  };

  await request(app)
    .put(`/api/workspace/${workspaceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ payload: firstSave, clientRevision: firstRevision })
    .expect(200);

  const staleSave = {
    ...basePayload,
    exams: [
      ...basePayload.exams,
      { id: `E-${Date.now()}-stale`, name: 'Stale Exam', marks: 30, durationMinutes: 90, students: [] },
    ],
  };

  await request(app)
    .put(`/api/workspace/${workspaceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ payload: staleSave, clientRevision: firstRevision })
    .expect(409);
});
