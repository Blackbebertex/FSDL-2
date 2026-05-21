import crypto from 'crypto';

const ROLE_VALUES = ['admin', 'faculty', 'view-only'];

const hashPassword = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const parseConfiguredUsers = () => {
  const raw = process.env.EXAMFLOW_USERS_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || item.username || '').trim(),
        username: String(item.username || '').trim().toLowerCase(),
        role: ROLE_VALUES.includes(item.role) ? item.role : 'view-only',
        passwordHash: item.passwordHash || hashPassword(item.password || ''),
      }))
      .filter((item) => item.id && item.username && item.passwordHash);
  } catch {
    return [];
  }
};

const fallbackUsers = [
  { id: 'u-admin', username: 'admin', role: 'admin', passwordHash: hashPassword('admin123') },
  { id: 'u-faculty', username: 'faculty', role: 'faculty', passwordHash: hashPassword('faculty123') },
  { id: 'u-viewer', username: 'viewer', role: 'view-only', passwordHash: hashPassword('viewer123') },
];

const configuredUsers = parseConfiguredUsers();
if (process.env.NODE_ENV === 'production' && !configuredUsers.length) {
  throw new Error('EXAMFLOW_USERS_JSON must be configured in production.');
}

const users = configuredUsers.length ? configuredUsers : fallbackUsers;

export const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
};

export const authenticateUser = (username, password) => {
  const user = users.find((item) => item.username === String(username || '').trim().toLowerCase());
  if (!user) return null;

  const incomingHash = hashPassword(password || '');
  if (incomingHash !== user.passwordHash) return null;

  return sanitizeUser(user);
};

export const getUserById = (id) => {
  const user = users.find((item) => item.id === id);
  return sanitizeUser(user);
};
