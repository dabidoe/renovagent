import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { rememberSampleUpload } from './sample-rooms.js';

// One raw-file upload path for owner photos, camera photos and static samples.
// Intake checks the session (and offers guest sign-in) before calling this.
export async function uploadStudioPhoto(file: File): Promise<string> {
  const { sha256 } = (await workspaceRequest('/studio/photo', file)) as { sha256: string };
  rememberSampleUpload(file, sha256);
  return sha256;
}
