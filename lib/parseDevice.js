import { UAParser } from 'ua-parser-js';

export function parseDevice(userAgent) {
  if (!userAgent) return { device_type: 'unknown', browser: 'unknown', os: 'unknown' };
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  const browser = parser.getBrowser();
  const os = parser.getOS();

  let device_type = 'desktop';
  if (device.type === 'mobile') device_type = 'mobile';
  else if (device.type === 'tablet') device_type = 'tablet';

  return {
    device_type,
    browser: browser.name || 'unknown',
    os: os.name || 'unknown',
  };
}
