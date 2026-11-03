import { createRoot } from 'react-dom/client';
import { PublicApp } from './app/public-app.js';
import { takeReturn } from './features/connect/sign-in-return.js';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/workspace.css';
import './styles/prompt-workspace.css';
import './styles/brand.css';
import './styles/public-navigation.css';
import { startGridParallax } from './app/grid-parallax.js';
startGridParallax();
if (!window.location.hash) {
  const to = takeReturn();
  if (to) window.history.replaceState(null, '', to);
}
createRoot(document.getElementById('app')!).render(<PublicApp />);
