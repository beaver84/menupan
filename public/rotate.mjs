export function createRotator({ onChange }) {
  let index = 0;
  let pageCount = 0;
  let timer = null;
  let currentSec = 0;

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  const start = (autoRotateSec) => {
    stop();
    if (autoRotateSec > 0) {
      timer = setInterval(() => {
        index = (index + 1) % pageCount;
        onChange(index);
      }, autoRotateSec * 1000);
    }
  };

  return {
    get index() {
      return index;
    },

    update({ pageCount: nextPageCount, autoRotateSec }) {
      pageCount = nextPageCount;
      index = Math.min(index, Math.max(pageCount - 1, 0));
      if (autoRotateSec !== currentSec || timer === null) {
        currentSec = autoRotateSec;
        start(autoRotateSec);
      }
    },

    stop,
  };
}
