
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { ezdCsvMain } from './lib/ezd-csv/ezd-csv';
import { txtMain } from './lib/txt/txt-main';
import { gutenbergScraperMain } from './lib/gutenberg-scraper/gutenberg-scraper';
import { dirWalkMain } from './lib/dir-walk/dir-walk';

(async () => {
  try {
    await main();
  } catch(e) {
    console.error(e);
    throw e;
  }
})();

async function main() {
  console.log(process.argv);
  // await ezdCsvMain();
  // await txtMain();
  await gutenbergScraperMain();
  // await dirWalkMain();
}
