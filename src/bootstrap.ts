const reload = document.getElementById('startup-reload');
reload?.addEventListener('click', () => window.location.reload());

function startupError(message: string) {
  const status = document.getElementById('startup-message');
  if (!status) return; // React has already mounted.
  status.textContent = message;
  document.getElementById('startup-reload')?.removeAttribute('hidden');
}

const timer = window.setTimeout(() => {
  startupError('Loading is taking longer than expected. Keep the Vite terminal running, then reload. If this persists, use Ctrl+Shift+R to refresh cached files.');
}, 15000);

void import('./main').catch((error: unknown) => {
  window.clearTimeout(timer);
  console.error('GhostCoach startup failed:', error);
  startupError(`The studio could not start: ${error instanceof Error ? error.message : String(error)}. Check the Vite terminal, then reload.`);
});
