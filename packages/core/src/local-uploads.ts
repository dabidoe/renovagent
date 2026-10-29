// Synthetic upload URLs are routing markers for locally stored attachments, not
// resolvable addresses. The pre-rename host stays recognized so records stored
// before the Renovagent rename keep routing; new uploads use the current host.
const UPLOAD_HOSTS = ['uploads.renovagent.invalid', 'uploads.unpermitted.invalid'];
export function isLocalUploadUrl(url: string): boolean {
  return UPLOAD_HOSTS.some(
    (host) => url === `https://${host}` || url.startsWith(`https://${host}/`),
  );
}
export function localUploadUrl(id: string): string {
  return `https://${UPLOAD_HOSTS[0]}/${id}`;
}
