import { ProjectNotebook } from '../features/house-example/project-notebook.js';
import { SharedDesign } from '../features/house-example/shared-design.js';
import { OwnStudio, type OwnStart } from '../features/house-example/own-studio.js';
import { HutchinsonStudio } from '../features/house-example/hutchinson-studio.js';
import { ExamplesGallery, ListingStudio } from '../features/house-example/listing-studio.js';
import { InspoExample } from '../features/house-example/inspo-example.js';
import { SavedPlan } from '../features/house-example/saved-plan.js';
import { SavedDesign } from '../features/house-example/saved-design.js';
import { ProjectLibrary } from '../features/house-example/project-library.js';
import { ConnectAgent } from '../features/connect/connect-agent.js';
import { ApproveAgent } from '../features/connect/approve-agent.js';
import '../features/house-example/house-example.css';
import '../features/house-example/paint-floor.css';
import '../features/room3d/room-studio.css';
import '../features/room3d/example-studio.css';

export default function PublicStudio({
  hash,
  start,
  onOpen,
}: {
  hash: string;
  start: OwnStart | null;
  onOpen: (route: string) => void;
}) {
  if (hash === '#notebook') return <ProjectNotebook key={hash} />;
  if (hash.startsWith('#project/'))
    return <ProjectNotebook key={hash} projectId={decodeURIComponent(hash.split('/')[1])} />;
  if (hash.startsWith('#share/')) return <SharedDesign key={hash} token={hash.slice(7)} />;
  if (hash === '#projects') return <ProjectLibrary />;
  if (hash === '#connect') return <ConnectAgent />;
  if (hash.startsWith('#connect/approve/'))
    return <ApproveAgent key={hash} requestId={hash.split('/')[2]} />;
  if (hash === '#new-project') return <OwnStudio key={start ? 'start' : 'own'} start={start} />;
  if (hash === '#example-house')
    return <HutchinsonStudio onRoomExample={() => onOpen('#workspace/example-room')} />;
  if (hash.startsWith('#plan/')) return <SavedPlan key={hash} id={hash.slice('#plan/'.length)} />;
  if (hash.startsWith('#design/'))
    return (
      <SavedDesign
        key={hash}
        projectId={decodeURIComponent(hash.split('/')[1]!)}
        revision={Number(hash.split('/')[2])}
      />
    );
  if (hash === '#studio') return <ExamplesGallery onOpen={onOpen} />;
  if (hash === '#example/bedroom-refresh')
    return <InspoExample onBack={() => onOpen('#studio')} onTry={() => onOpen('#new-project')} />;
  return (
    <ListingStudio
      key={hash}
      id={hash.slice('#example/'.length)}
      onBack={() => onOpen('#studio')}
    />
  );
}
