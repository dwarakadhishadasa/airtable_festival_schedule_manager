import { initializeBlock } from '@airtable/blocks/ui';
import React from 'react';
import App from './App';

// Kick off Tailwind CDN download at module load time — before React even renders —
// so styles are available as early as possible.
if (!document.querySelector('#tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
}

initializeBlock(() => <App />);
