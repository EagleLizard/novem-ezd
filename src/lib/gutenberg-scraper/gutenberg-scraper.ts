
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';

import puppeteer from 'puppeteer';
import _chunk from 'lodash.chunk';

import { DATA_DIR_PATH } from '../../constants';
import { getIntuitiveTimeString } from '../../util/print-util';
import { Timer } from '../../util/timer';
import { sleep } from '../../util/sleep';
import { mkdirIfNotExistRecursive } from '../../util/files';

const NUM_CPUS = os.cpus().length;
// const MAX_CONCURRENT_PAGES = Math.ceil(NUM_CPUS / 4);
// const MAX_CONCURRENT_PAGES = Math.ceil(NUM_CPUS / 2);
const MAX_CONCURRENT_PAGES = NUM_CPUS - 1;
// const MAX_CONCURRENT_PAGES = NUM_CPUS * 2;

console.log(`MAX_CONCURRENT_PAGES: ${MAX_CONCURRENT_PAGES}`);

const GUTENBERG_TOP_1000_URL = 'https://www.gutenberg.org/browse/scores/top1000.php';

const TOP_1000_MONTH_SELECTOR = 'ol > a[href=\'#authors-last30\']';

type ScrapedBook = {
  title: string;
  plaintextUrl: string;
};

export async function gutenbergScraperMain() {
  let browser: puppeteer.Browser;
  console.log('scraper');
  browser = await puppeteer.launch({
    // headless: false,
  });
  await scrapeTop1000(browser);
  await browser.close();
}

async function scrapeTop1000(browser: puppeteer.Browser) {
  let page: puppeteer.Page;
  let allBookLinks: string[], bookLinks: string[];
  let scrapedBooks: ScrapedBook[];
  let bookLinkChunks: string[][];

  let scrapeBooksTimer: Timer, scrapedBooksMs: number;
  let completedScrapeTasks: number;

  await mkdirIfNotExistRecursive(DATA_DIR_PATH);

  page = await browser.newPage();

  await page.goto(GUTENBERG_TOP_1000_URL);
  await page.waitForSelector(TOP_1000_MONTH_SELECTOR);
  allBookLinks = await page.evaluate((top1000MonthSelector) => {
    return [
      ...(
        // document.querySelectorAll('ol li a[href^=\'/ebooks/\']')
        document
          .querySelectorAll('ol li a[href^=\'/ebooks/\']')
      )
    ].map((anchorEl: HTMLAnchorElement) => {
      return anchorEl.href;
    });
  }, TOP_1000_MONTH_SELECTOR);
  console.log('allBookLinks.length');
  console.log(allBookLinks.length);
  bookLinks = [ ...(new Set(allBookLinks)) ];
  scrapedBooks = [];
  completedScrapeTasks = 0;

  bookLinkChunks = _chunk(bookLinks, MAX_CONCURRENT_PAGES);

  scrapeBooksTimer = Timer.start();
  for(let k = 0; k < bookLinkChunks.length; ++k) {
    let currBookLinkChunk: string[], bookLinkChunkPromises: Promise<ScrapedBook>[];
    let currChunkScrapedBooks: ScrapedBook[];
    currBookLinkChunk = bookLinkChunks[k];
    bookLinkChunkPromises = [];
    for(let i = 0; i < currBookLinkChunk.length; ++i) {
      let currBookLink: string, scrapedBook: ScrapedBook;
      let scrapeBookPromise: Promise<ScrapedBook>;
      currBookLink = bookLinks[i];
      scrapeBookPromise = getPlaintextLink(browser, currBookLink).then((res) => {
        completedScrapeTasks++;
        console.log(`Book ${completedScrapeTasks} / ${bookLinks.length}, ${getIntuitiveTimeString(scrapeBooksTimer.currentMs())}`);
        return res;
      });
      bookLinkChunkPromises.push(scrapeBookPromise);
    }
    currChunkScrapedBooks = await Promise.all(bookLinkChunkPromises);
    currChunkScrapedBooks.forEach(scrapedBook => {
      if(scrapedBook !== undefined) {
        scrapedBooks.push(scrapedBook);
      }
    });
  }

  scrapedBooksMs = scrapeBooksTimer.stop();

  console.log(`scraped ${scrapedBooks.length.toLocaleString()} ebooks in ${getIntuitiveTimeString(scrapedBooksMs)}`);
  await writeFile(`${DATA_DIR_PATH}${path.sep}scraped_ebooks.json`, JSON.stringify(scrapedBooks, null, 2));
}

async function getPlaintextLink(browser: puppeteer.Browser, bookLink: string): Promise<ScrapedBook> {
  let page: puppeteer.Page, title: string, plainTextLink: string;
  page = await browser.newPage();
  await page.goto(bookLink);
  // await page.waitForNavigation({
  //   waitUntil: 'domcontentloaded',
  // });
  await page.waitForSelector('#tabs');
  await page.waitForSelector('div.page_content');
  [ title, plainTextLink ] = await page.evaluate(() => {
    let anchorEl: HTMLAnchorElement, titleEl: HTMLElement;
    titleEl = document.querySelector('div.page_content [itemprop=\'name\']');
    anchorEl = document.querySelector('tr td[content=\'text/plain\'] a');
    if(anchorEl === null) {
      return [];
    }
    return [
      titleEl.textContent,
      anchorEl.href,
    ];
  });

  await page.close();

  if(plainTextLink === undefined) {
    return;
  }

  return {
    title,
    plaintextUrl: plainTextLink,
  };
}
