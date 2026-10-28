import { createRoot } from 'react-dom/client';
import { WorkspaceController } from './app/workspace-controller.js';
import { App } from './app/workspace-app.js';
import './styles/workspace.css';
const root = createRoot(document.getElementById('app')!);
root.render(<div className="loading-workspace">Opening your local workspace…</div>);
WorkspaceController.open()
  .then((controller) => root.render(<App controller={controller} />))
  .catch((error) =>
    root.render(
      <main className="storage-error">
        <h1>Your local records need attention.</h1>
        <p>{String(error)}</p>
        <p>Your saved data has not been deleted or reset.</p>
        <a href="/legacy.html">Open the previous preview</a>
      </main>,
    ),
  );
