import { useEffect, useState } from 'react';
import { WorkspaceController, storedMode } from './workspace-controller.js';
import { App } from './workspace-app.js';

export default function WorkspaceEntry() {
  const [controller, setController] = useState<WorkspaceController | null>(null);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let live = true;
    let opened: WorkspaceController | undefined;
    void WorkspaceController.open()
      .then((value) => {
        opened = value;
        if (live) setController(value);
        else value.repository.close();
      })
      .catch((failure) => {
        if (live) setError(failure);
      });
    return () => {
      live = false;
      opened?.repository.close();
    };
  }, []);
  if (error)
    return (
      <main className="storage-error">
        <h1>
          {storedMode() === 'mongo'
            ? 'Your connected workspace is unavailable.'
            : 'Your local records need attention.'}
        </h1>
        <p>{String(error)}</p>
        <p>Your saved data has not been deleted or reset.</p>
        <button onClick={() => window.location.reload()}>Retry connection</button>
        <a href="#">Return home</a>
      </main>
    );
  if (!controller)
    return (
      <div className="loading-workspace" role="status">
        <p>Opening your saved workspace…</p>
        <a href="#">Return home</a>
      </div>
    );
  return <App controller={controller} />;
}
