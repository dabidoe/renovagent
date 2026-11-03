import { OwnStudio, type OwnStart } from '../features/house-example/own-studio.js';
import { HutchinsonStudio } from '../features/house-example/hutchinson-studio.js';
import { ExamplesGallery, ListingStudio } from '../features/house-example/listing-studio.js';
import { InspoExample } from '../features/house-example/inspo-example.js';
import { SavedPlan } from '../features/house-example/saved-plan.js';
import { SavedDesign } from '../features/house-example/saved-design.js';
import { ProjectLibrary } from '../features/house-example/project-library.js';
import { ConnectAgent } from '../features/connect/connect-agent.js';
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
  if (hash === '#projects') return <ProjectLibrary />;
  if (hash === '#connect') return <ConnectAgent />;
  if (hash === '#your-project') return <OwnStudio key={start ? 'start' : 'own'} start={start} />;
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
  if (hash === '#examples') return <ExamplesGallery onOpen={onOpen} />;
  if (hash === '#example/bedroom-refresh')
    return (
      <InspoExample onBack={() => onOpen('#examples')} onTry={() => onOpen('#your-project')} />
    );
  return (
    <ListingStudio
      key={hash}
      id={hash.slice('#example/'.length)}
      onBack={() => onOpen('#examples')}
    />
  );
}
