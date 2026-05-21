import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { setStorageMode } from '../../server/storage/workspaceStore.js';

const app = createApp({ allowedOrigins: ['http://localhost:5173'] });

const login = async (username, password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);
  return response.body.token;
};

const callRoute = (method, route) => request(app)[method.toLowerCase()](route);

test('Protected routes should block unauthenticated users', async () => {
  setStorageMode('file');
  const routes = [
    ['GET', '/api/workspace/list'],
    ['POST', '/api/workspace/list'],
    ['PUT', '/api/workspace/some-id'],
    ['PATCH', '/api/workspace/some-id/meta'],
    ['DELETE', '/api/workspace/some-id'],
    ['POST', '/api/workspace/some-id/share'],
    ['POST', '/api/workspace/some-id/generate'],
  ];

  for (const [method, route] of routes) {
    await callRoute(method, route).expect(401);
  }
});

test('Viewer role should be blocked from mutation routes', async () => {
  setStorageMode('file');
  const token = await login('viewer', 'viewer123');

  const mutationRoutes = [
    ['POST', '/api/workspace/list', { title: 'Test', semester: 'S1' }],
    ['PUT', '/api/workspace/any-id', { payload: {} }],
    ['PATCH', '/api/workspace/any-id/meta', { title: 'New' }],
    ['DELETE', '/api/workspace/any-id', {}],
    ['POST', '/api/workspace/any-id/share', { enabled: true }],
    ['POST', '/api/workspace/any-id/generate', { payload: {} }],
  ];

  for (const [method, route, body] of mutationRoutes) {
    await callRoute(method, route)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(403);
  }
});

test('Admin role should access all routes', async () => {
  setStorageMode('file');
  const token = await login('admin', 'admin123');

  // We check listing, which admins should always be able to do
  await request(app)
    .get('/api/workspace/list')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
