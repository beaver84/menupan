export const DEVICES = {
  signage: { width: 1080, height: 1920 },
  'tablet-land': { width: 1920, height: 1440 },
  'tablet-port': { width: 1440, height: 1920 },
  mobile: { width: 1080, height: 2160 },
};

const PADDING_RATIO = 0.085;

const FONT_RATIOS = {
  eyebrow: 0.0175,
  store: 0.058,
  sheet: 0.03,
  name: 0.03,
  price: 0.03,
  desc: 0.0185,
};

export function getLayout(device) {
  const size = DEVICES[device];
  if (!size) throw new Error(`알 수 없는 디바이스: ${device}`);

  const u = Math.min(size.width, size.height);
  const landscape = size.width > size.height;

  return {
    ...size,
    u,
    padding: Math.round(u * PADDING_RATIO),
    fonts: Object.fromEntries(Object.entries(FONT_RATIOS).map(([key, ratio]) => [key, Math.round(u * ratio)])),
    columns: landscape ? 2 : 1,
    showPhoto: !landscape,
  };
}

export function pickDevice(viewportWidth, viewportHeight) {
  const aspect = (width, height) => Math.log(width / height);
  const target = aspect(viewportWidth, viewportHeight);

  return Object.entries(DEVICES).reduce((best, [device, { width, height }]) => {
    const distance = Math.abs(aspect(width, height) - target);
    return distance < best.distance ? { device, distance } : best;
  }, { device: null, distance: Infinity }).device;
}
