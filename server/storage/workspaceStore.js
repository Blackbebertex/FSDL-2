import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Workspace from '../models/Workspace.js';
import { createDefaultWorkspacePayload, normalizeWorkspacePayload } from '../data/defaultWorkspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceFilePath = path.resolve(__dirname, '..', 'data', 'workspace.local.json');
const WORKSPACE_KEY = 'examflow';

let storageMode = 'file';

const readFileWorkspace = async () => {
  try {
    const raw = await fs.readFile(workspaceFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.payload) {
      return { key: WORKSPACE_KEY, payload: createDefaultWorkspacePayload() };
    }

    return {
      key: parsed.key || WORKSPACE_KEY,
      payload: normalizeWorkspacePayload(parsed.payload),
    };
  } catch {
    const fallback = { key: WORKSPACE_KEY, payload: createDefaultWorkspacePayload() };
    await writeFileWorkspace(fallback);
    return fallback;
  }
};

const writeFileWorkspace = async (workspace) => {
  await fs.mkdir(path.dirname(workspaceFilePath), { recursive: true });
  await fs.writeFile(workspaceFilePath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
  return workspace;
};

export const setStorageMode = (mode) => {
  storageMode = mode;
};

export const getStorageMode = () => storageMode;

export const loadWorkspace = async () => {
  if (storageMode === 'mongo') {
    const existingWorkspace = await Workspace.findOne({ key: WORKSPACE_KEY });
    if (existingWorkspace) {
      return existingWorkspace;
    }

    const createdWorkspace = await Workspace.create({ key: WORKSPACE_KEY, payload: createDefaultWorkspacePayload() });
    return createdWorkspace;
  }

  return readFileWorkspace();
};

export const saveWorkspace = async (incomingPayload) => {
  const payload = normalizeWorkspacePayload(incomingPayload);

  if (storageMode === 'mongo') {
    const workspace = await Workspace.findOneAndUpdate(
      { key: WORKSPACE_KEY },
      { key: WORKSPACE_KEY, payload },
      { new: true, upsert: true }
    );

    return workspace;
  }

  return writeFileWorkspace({ key: WORKSPACE_KEY, payload });
};

export const saveGeneratedTimetable = async (incomingPayload, timetable) => {
  const payload = normalizeWorkspacePayload(incomingPayload);
  const workspacePayload = {
    ...payload,
    timetable,
    generatedAt: new Date().toISOString(),
  };

  return saveWorkspace(workspacePayload);
};