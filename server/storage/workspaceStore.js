import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import { createDefaultWorkspacePayload, normalizeWorkspacePayload } from '../data/defaultWorkspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceFilePath = path.resolve(__dirname, '..', 'data', 'workspace.local.json');

let storageMode = 'file';

const makeWorkspaceKey = (ownerId, semester, title) => `${ownerId}:${semester}:${title}`.toLowerCase();
const makeWorkspaceId = () => crypto.randomUUID();
const makeShareToken = () => crypto.randomBytes(10).toString('hex');

const appendAudit = (workspace, actorId, action, details = '') => {
  const nextAudit = [{
    at: new Date().toISOString(),
    actorId,
    action,
    details,
  }, ...(workspace.auditTrail || [])].slice(0, 200);

  return {
    ...workspace,
    auditTrail: nextAudit,
  };
};

const normalizeSingleFileWorkspace = (raw) => {
  if (!raw?.payload) {
    return null;
  }

  const legacyOwner = 'u-admin';
  const legacyTitle = 'Default Workspace';
  const legacySemester = 'General';

  return {
    workspaces: [
      {
        id: makeWorkspaceId(),
        key: makeWorkspaceKey(legacyOwner, legacySemester, legacyTitle),
        ownerId: legacyOwner,
        title: legacyTitle,
        semester: legacySemester,
        visibility: 'private',
        shareToken: null,
        payload: normalizeWorkspacePayload(raw.payload),
        auditTrail: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
};

const readFileDb = async () => {
  try {
    const raw = await fs.readFile(workspaceFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.workspaces)) {
      return {
        workspaces: parsed.workspaces.map((workspace) => ({
          ...workspace,
          payload: normalizeWorkspacePayload(workspace.payload),
          visibility: workspace.visibility === 'shared-readonly' ? 'shared-readonly' : 'private',
          auditTrail: Array.isArray(workspace.auditTrail) ? workspace.auditTrail : [],
        })),
      };
    }

    const migrated = normalizeSingleFileWorkspace(parsed);
    if (migrated) {
      await writeFileDb(migrated);
      return migrated;
    }

    return { workspaces: [] };
  } catch {
    const fallback = { workspaces: [] };
    await writeFileDb(fallback);
    return fallback;
  }
};

const writeFileDb = async (dbState) => {
  await fs.mkdir(path.dirname(workspaceFilePath), { recursive: true });
  await fs.writeFile(workspaceFilePath, `${JSON.stringify(dbState, null, 2)}\n`, 'utf8');
  return dbState;
};

export const setStorageMode = (mode) => {
  storageMode = mode;
};

export const getStorageMode = () => storageMode;

const toWorkspaceSummary = (workspace) => ({
  id: workspace.id || workspace._id?.toString(),
  key: workspace.key,
  title: workspace.title,
  semester: workspace.semester,
  visibility: workspace.visibility || 'private',
  shareToken: workspace.shareToken || null,
  ownerId: workspace.ownerId,
  updatedAt: workspace.updatedAt,
  createdAt: workspace.createdAt,
});

export const listWorkspaces = async (user) => {
  if (storageMode === 'mongo') {
    const filter = user.role === 'admin' ? {} : { ownerId: user.id };
    const workspaces = await Workspace.find(filter).sort({ updatedAt: -1 }).lean();
    return workspaces.map(toWorkspaceSummary);
  }

  const db = await readFileDb();
  return db.workspaces
    .filter((workspace) => user.role === 'admin' || workspace.ownerId === user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(toWorkspaceSummary);
};

export const createWorkspace = async (user, meta) => {
  const title = meta.title;
  const semester = meta.semester;

  if (storageMode === 'mongo') {
    const key = makeWorkspaceKey(user.id, semester, title);
    const existing = await Workspace.findOne({ key });
    if (existing) {
      throw new Error('Workspace with the same title and semester already exists.');
    }

    const createdWorkspace = await Workspace.create({
      key,
      ownerId: user.id,
      title,
      semester,
      payload: createDefaultWorkspacePayload(),
      visibility: 'private',
      shareToken: null,
      auditTrail: [],
    });

    return toWorkspaceSummary(createdWorkspace);
  }

  const db = await readFileDb();
  const key = makeWorkspaceKey(user.id, semester, title);
  const duplicate = db.workspaces.find((workspace) => workspace.key === key);
  if (duplicate) {
    throw new Error('Workspace with the same title and semester already exists.');
  }

  const entry = {
    id: makeWorkspaceId(),
    key,
    ownerId: user.id,
    title,
    semester,
    visibility: 'private',
    shareToken: null,
    payload: createDefaultWorkspacePayload(),
    auditTrail: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.workspaces.unshift(entry);
  await writeFileDb(db);
  return toWorkspaceSummary(entry);
};

const canAccessWorkspace = (user, workspace) => user.role === 'admin' || workspace.ownerId === user.id;

export const loadWorkspace = async (user, workspaceId) => {
  if (!workspaceId) {
    throw new Error('workspaceId is required.');
  }

  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error('Invalid Workspace ID format.');
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');
    return workspace;
  }

  const db = await readFileDb();
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error('Workspace not found.');
  if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');
  return workspace;
};

const normalizeRevision = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString();
};

export const saveWorkspace = async (user, workspaceId, incomingPayload, action = 'workspace-save', expectedRevision = null) => {
  const payload = normalizeWorkspacePayload(incomingPayload);
  const normalizedExpectedRevision = normalizeRevision(expectedRevision);

  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error('Invalid Workspace ID format.');
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');

    if (normalizedExpectedRevision) {
      const currentRevision = workspace.updatedAt instanceof Date
        ? workspace.updatedAt.toISOString()
        : normalizeRevision(workspace.updatedAt);

      if (currentRevision && currentRevision !== normalizedExpectedRevision) {
        const conflictError = new Error('Workspace changed on server. Please reload or force save.');
        conflictError.statusCode = 409;
        throw conflictError;
      }
    }

    workspace.payload = payload;
    workspace.auditTrail = appendAudit(
      { auditTrail: workspace.auditTrail || [] },
      user.id,
      action,
      'Workspace payload updated'
    ).auditTrail;
    await workspace.save();

    return workspace;
  }

  const db = await readFileDb();
  const index = db.workspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (index < 0) throw new Error('Workspace not found.');
  const current = db.workspaces[index];
  if (!canAccessWorkspace(user, current)) throw new Error('Workspace access denied.');

  if (normalizedExpectedRevision) {
    const currentRevision = normalizeRevision(current.updatedAt);
    if (currentRevision && currentRevision !== normalizedExpectedRevision) {
      const conflictError = new Error('Workspace changed on server. Please reload or force save.');
      conflictError.statusCode = 409;
      throw conflictError;
    }
  }

  const updated = appendAudit({
    ...current,
    payload,
    updatedAt: new Date().toISOString(),
  }, user.id, action, 'Workspace payload updated');

  db.workspaces[index] = updated;
  await writeFileDb(db);
  return updated;
};

export const saveGeneratedTimetable = async (user, workspaceId, incomingPayload, timetable, expectedRevision = null) => {
  const payload = normalizeWorkspacePayload(incomingPayload);
  const workspacePayload = {
    ...payload,
    timetable,
    seatPlan: payload.seatPlan || null,
    generatedAt: new Date().toISOString(),
  };

  return saveWorkspace(user, workspaceId, workspacePayload, 'workspace-generate', expectedRevision);
};

export const updateWorkspaceMeta = async (user, workspaceId, meta) => {
  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error('Invalid Workspace ID format.');
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');
    workspace.title = meta.title;
    workspace.semester = meta.semester;
    await workspace.save();
    return toWorkspaceSummary(workspace);
  }

  const db = await readFileDb();
  const index = db.workspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (index < 0) throw new Error('Workspace not found.');

  const current = db.workspaces[index];
  if (!canAccessWorkspace(user, current)) throw new Error('Workspace access denied.');

  const updated = {
    ...current,
    title: meta.title,
    semester: meta.semester,
    key: makeWorkspaceKey(current.ownerId, meta.semester, meta.title),
    updatedAt: new Date().toISOString(),
  };
  db.workspaces[index] = updated;
  await writeFileDb(db);
  return toWorkspaceSummary(updated);
};

export const deleteWorkspace = async (user, workspaceId) => {
  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error('Invalid Workspace ID format.');
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');
    await workspace.deleteOne();
    return;
  }

  const db = await readFileDb();
  const index = db.workspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (index < 0) throw new Error('Workspace not found.');
  if (!canAccessWorkspace(user, db.workspaces[index])) throw new Error('Workspace access denied.');
  db.workspaces.splice(index, 1);
  await writeFileDb(db);
};

export const setWorkspaceShareState = async (user, workspaceId, enableShare) => {
  if (storageMode === 'mongo') {
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error('Invalid Workspace ID format.');
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    if (!canAccessWorkspace(user, workspace)) throw new Error('Workspace access denied.');
    workspace.visibility = enableShare ? 'shared-readonly' : 'private';
    workspace.shareToken = enableShare ? workspace.shareToken || makeShareToken() : null;
    await workspace.save();
    return toWorkspaceSummary(workspace);
  }

  const db = await readFileDb();
  const index = db.workspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (index < 0) throw new Error('Workspace not found.');
  const current = db.workspaces[index];
  if (!canAccessWorkspace(user, current)) throw new Error('Workspace access denied.');

  const updated = {
    ...current,
    visibility: enableShare ? 'shared-readonly' : 'private',
    shareToken: enableShare ? current.shareToken || makeShareToken() : null,
    updatedAt: new Date().toISOString(),
  };
  db.workspaces[index] = updated;
  await writeFileDb(db);
  return toWorkspaceSummary(updated);
};

export const getSharedWorkspace = async (token) => {
  if (!token) throw new Error('Share token is required.');

  if (storageMode === 'mongo') {
    const workspace = await Workspace.findOne({ shareToken: token, visibility: 'shared-readonly' });
    if (!workspace) throw new Error('Shared workspace not found.');
    return workspace;
  }

  const db = await readFileDb();
  const workspace = db.workspaces.find((item) => item.shareToken === token && item.visibility === 'shared-readonly');
  if (!workspace) throw new Error('Shared workspace not found.');
  return workspace;
};