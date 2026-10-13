// Parses Pharmadepot/GPC listing pages off the web server's main thread (see createListingParser).
import { parentPort } from 'node:worker_threads';
import { PHARMADEPOT_PLATFORM, parsePharmadepotListingHtml } from './pharmadepot.js';

parentPort.on('message', ({ id, html, sourceId }) => {
  try {
    const platform = Object.values(PHARMADEPOT_PLATFORM).find((p) => p.sourceId === sourceId);
    parentPort.postMessage({ id, products: parsePharmadepotListingHtml(html, null, platform) });
  } catch (error) {
    parentPort.postMessage({ id, error: error?.message || String(error) });
  }
});
