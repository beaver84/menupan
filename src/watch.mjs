import chokidar from 'chokidar';

export const DEFAULT_DEBOUNCE_MS = 300;
const WATCHED_EVENTS = ['change', 'add'];

export function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function watchFile(filePath, onChange, { debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
  const watcher = chokidar.watch(filePath, { ignoreInitial: true });
  const debouncedOnChange = debounce(onChange, debounceMs);
  for (const eventName of WATCHED_EVENTS) {
    watcher.on(eventName, debouncedOnChange);
  }
  return { close: () => watcher.close() };
}
