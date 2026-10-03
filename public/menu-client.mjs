const MENU_URL = '/api/menu';
const EVENTS_URL = '/events';
const UPDATE_EVENT = 'menu-updated';

export function createMenuClient({
  fetchImpl = (...args) => fetch(...args),
  createEventSource = (url) => new EventSource(url),
  onData,
}) {
  const refresh = async () => onData(await (await fetchImpl(MENU_URL)).json());

  return {
    refresh,

    async start() {
      await refresh();
      createEventSource(EVENTS_URL).addEventListener(UPDATE_EVENT, refresh);
    },
  };
}
