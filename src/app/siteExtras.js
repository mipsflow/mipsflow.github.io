// Feedback button and optional Google Analytics, driven by src/site.config.js.
import { siteConfig } from '../site.config.js';

for (const link of document.querySelectorAll('#open-feedback, #open-feedback-mobile'))
  link.href = siteConfig.feedbackUrl || siteConfig.issuesUrl;

const gaId = siteConfig.googleAnalyticsId;
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
if (/^G-[A-Z0-9]+$/.test(gaId) && !isLocal) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', gaId);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.append(script);
  // Count which parts of the simulator students actually use.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-arch],[data-mode],[data-pipe-panel],#track-program,#run-selftest,#open-feedback,#open-feedback-mobile');
    if (!button) return;
    const name = button.dataset.arch || button.dataset.mode || button.dataset.pipePanel || button.id;
    window.gtag('event', 'select_feature', { feature: name });
  });
  const note = document.getElementById('privacy-note');
  if (note) note.hidden = false;
}
