import { useState, useEffect } from 'react';
import { type Workspace } from '@renovagent/contracts';
import { WorkspaceController } from '../../app/workspace-controller.js';
import { Glyph } from '../../components/glyph.js';
export function Media({
  controller,
  state,
  evidenceId,
}: {
  controller: WorkspaceController;
  state: Workspace;
  evidenceId: string;
}) {
  const evidence = state.evidence[evidenceId],
    attachment = evidence?.source.attachment;
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl = '';
    if (attachment)
      controller.repository
        .readBlob(attachment.blobId)
        .then((blob) => {
          if (blob && active) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [controller, attachment?.blobId]);
  if (!attachment) return null;
  return (
    <div className="media-reference">
      {attachment.mediaType.startsWith('image/') && url ? (
        <img src={url} alt={attachment.name} />
      ) : (
        <Glyph name="file" />
      )}
      <div>
        <strong>{attachment.name}</strong>
        <span>Local reference · not analyzed</span>
        {url && (
          <a href={url} download={attachment.name}>
            Download original
          </a>
        )}
      </div>
    </div>
  );
}
