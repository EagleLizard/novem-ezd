
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { ezdCsvMain } from './lib/ezd-csv/ezd-csv';
import { txtMain } from './lib/txt/txt-main';

(async () => {
  try {
    await main();
  } catch(e) {
    console.error(e);
    throw e;
  }
})();

async function main() {
  await ezdCsvMain();
  await txtMain();
}
