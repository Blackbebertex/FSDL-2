const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shouldRetry = (status) => status === 429 || (status >= 500 && status <= 599);

const requestJson = async (path, options = {}, retryConfig = {}) => {
  const retries = Number.isFinite(retryConfig.retries) ? retryConfig.retries : 2;
  const baseDelayMs = Number.isFinite(retryConfig.baseDelayMs) ? retryConfig.baseDelayMs : 250;
  const maxDelayMs = Number.isFinite(retryConfig.maxDelayMs) ? retryConfig.maxDelayMs : 2500;

  let attempt = 0;

  while (attempt <= retries) {
    let response;
    let data;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...options,
      });

      data = await response.json().catch(() => null);
    } catch {
      if (attempt < retries) {
        const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt)) + Math.floor(Math.random() * 80);
        await sleep(delay);
        attempt += 1;
        continue;
      }

      const error = new Error('Network request failed.');
      error.code = 'NETWORK_ERROR';
      throw error;
    }

    if (!response.ok) {
      if (attempt < retries && shouldRetry(response.status)) {
        const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt)) + Math.floor(Math.random() * 80);
        await sleep(delay);
        attempt += 1;
        continue;
      }

      const error = new Error(data?.message || 'Workspace request failed.');
      error.status = response.status;
      error.code = data?.code || null;
      throw error;
    }

    return data;
  }

  throw new Error('Request failed after retries.');
};

export const login = async (username, password) => {
  const response = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  return response;
};

export const logout = async () => {
  await requestJson('/auth/logout', { method: 'POST' });
};

export const fetchCurrentUser = () => requestJson('/auth/me');

export const listWorkspaces = () => requestJson('/workspace/list');

export const createWorkspace = ({ title, semester }) => requestJson('/workspace/list', {
  method: 'POST',
  body: JSON.stringify({ title, semester }),
});

export const loadWorkspace = (workspaceId) => requestJson(`/workspace/${workspaceId}`);

export const saveWorkspace = (workspaceId, payload, clientRevision = null) => requestJson(`/workspace/${workspaceId}`, {
  method: 'PUT',
  body: JSON.stringify({ payload, clientRevision }),
});

export const updateWorkspaceMeta = (workspaceId, meta) => requestJson(`/workspace/${workspaceId}/meta`, {
  method: 'PATCH',
  body: JSON.stringify(meta),
});

export const deleteWorkspace = (workspaceId) => requestJson(`/workspace/${workspaceId}`, {
  method: 'DELETE',
});

export const setWorkspaceShare = (workspaceId, enabled) => requestJson(`/workspace/${workspaceId}/share`, {
  method: 'POST',
  body: JSON.stringify({ enabled }),
});

export const getSharedWorkspace = (token) => {
  const t = String(token || '').trim();
  if (!t) {
    const error = new Error('Share token is required.');
    error.status = 400;
    throw error;
  }
  return requestJson(`/workspace/shared/${t}`);
};


export const generateWorkspaceTimetable = (workspaceId, payload, clientRevision = null) => requestJson(`/workspace/${workspaceId}/generate`, {
  method: 'POST',
  body: JSON.stringify({ payload, clientRevision }),
});

export const fetchWorkspaceReports = (workspaceId) => requestJson(`/workspace/${workspaceId}/reports`);

export const uploadSyllabus = async (file) => {
  const formData = new FormData();
  formData.append('syllabus', file);

  const response = await fetch(`${API_BASE_URL}/syllabus/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to upload syllabus');
  }

  return response.json();
};