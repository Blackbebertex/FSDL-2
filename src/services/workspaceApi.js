const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || 'Workspace request failed.');
  }

  return data;
};

export const loadWorkspace = () => requestJson('/workspace');

export const saveWorkspace = (payload) => requestJson('/workspace', {
  method: 'PUT',
  body: JSON.stringify({ payload }),
});

export const generateWorkspaceTimetable = (payload) => requestJson('/workspace/generate', {
  method: 'POST',
  body: JSON.stringify({ payload }),
});