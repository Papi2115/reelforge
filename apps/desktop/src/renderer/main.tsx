import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { App } from './App.js';
import { errorMessage, rendererLog } from './log.js';
import './styles.css';
import './ui.css';
import './layout/layout.css';
import './layout/pipeline.css';
import './layout/shots.css';
import './layout/timeline.css';
import './layout/chat.css';
import './layout/chat-rail.css';
import './preview/preview.css';
import './settings/settings.css';
import './settings/tools.css';
import './stages/stages.css';
import './stages/panels.css';
import './stages/variants.css';
import './sound/sound.css';
import './export/export.css';
import './onboarding/onboarding.css';

// The CSP forbids eval; skip zod's `new Function` probe.
z.config({ jitless: true });

const log = rendererLog('app');
window.addEventListener('error', (event) => {
  log.error(`uncaught: ${errorMessage(event.error)}`);
});
window.addEventListener('unhandledrejection', (event) => {
  log.error(`unhandled rejection: ${errorMessage(event.reason)}`);
});

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
