
import path from 'path';
import { createWriteStream, Dirent, WriteStream } from 'fs';
import { readdir, readFile } from 'fs/promises';

import fetch, { Response } from 'node-fetch';

import { EBOOKS_DATA_DIR_PATH, SCRAPED_EBOOKS_DIR_PATH, SCRAPED_EBOOKS_FILE_NAME } from '../../constants';
import { checkDir, checkFile, mkdirIfNotExistRecursive } from '../../util/files';
import { gutenbergScrapeMain, ScrapedBook } from '../gutenberg-scrape/gutenberg-scrape';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/print-util';
import { sleep } from '../../util/sleep';

type ScrapedBookWithFile = {
  fileName: string;
  filePath: string;
} & ScrapedBook;

const TXT_SCRAPE_COMMAND = 'scrape';

const MAX_CONCURRENT_DOWNLOADS = 25;

export async function txt2Main(argv: string[]) {
  let cliArgs: string[], cmdArg: string;
  cliArgs = argv.slice(2);
  cmdArg = cliArgs[0];
  if(cmdArg === TXT_SCRAPE_COMMAND) {
    await gutenbergScrapeMain();
  } else {
    await initBooks();
  }
}

async function initBooks() {
  let scrapedBooks: ScrapedBookWithFile[];
  console.log(`MAX_CONCURRENT_DOWNLOADS: ${MAX_CONCURRENT_DOWNLOADS}`);
  await mkdirIfNotExistRecursive(EBOOKS_DATA_DIR_PATH);
  scrapedBooks = await loadScrapedBooksMeta();
  // await downloadBooksSync(scrapedBooks);
  await downloadBooks(scrapedBooks);
}

async function downloadBooks(scrapedBooks: ScrapedBookWithFile[]) {
  let downloadBooksTimer: Timer, downloadBooksMs: number;
  let doneBookCount: number, donePercent: number;
  let runningDownloads: number;
  runningDownloads = 0;
  doneBookCount = 0;
  console.log('');
  downloadBooksTimer = Timer.start();
  for(let i = 0; i < scrapedBooks.length; ++i) {
    let scrapedBook: ScrapedBookWithFile;
    while(runningDownloads >= MAX_CONCURRENT_DOWNLOADS) {
      await sleep(1);
    }
    scrapedBook = scrapedBooks[i];
    runningDownloads++;
    (async () => {
      await downloadBook(scrapedBook);
      runningDownloads--;
      doneBookCount++;
      donePercent = doneBookCount / scrapedBooks.length;
      if((doneBookCount % 100) === 0) {
        process.stdout.write(`${(donePercent * 100).toFixed(1)}%`);
      } else if((doneBookCount % 10) === 0) {
        process.stdout.write('.');
      }
      // console.log(`Downloaded ${scrapedBook.title}`);
      // console.log(`${doneBookCount}/${scrapedBooks.length}`);
      // console.log(`${(donePercent * 100).toFixed(1)}%, ${getIntuitiveTimeString(downloadBooksTimer.currentMs())}`);
    })();
  }
  while(runningDownloads > 0) {
    await sleep(10);
  }
  console.log('');
  downloadBooksMs = downloadBooksTimer.stop();
  console.log(`Downloaded ${doneBookCount.toLocaleString()} books in ${getIntuitiveTimeString(downloadBooksMs)}`);
}

async function downloadBooksSync(scrapedBooks: ScrapedBookWithFile[]) {
  let downloadBooksTimer: Timer, downloadBooksMs: number;
  let doneBookCount: number, donePercent: number;
  doneBookCount = 0;
  downloadBooksTimer = Timer.start();
  for(let i = 0; i < scrapedBooks.length; ++i) {
    let scrapedBook: ScrapedBookWithFile;
    scrapedBook = scrapedBooks[i];
    await downloadBook(scrapedBook);
    doneBookCount++;
    donePercent = doneBookCount / scrapedBooks.length;
    console.log(`Downloaded ${scrapedBook.title}`);
    console.log(`${doneBookCount}/${scrapedBooks.length}`);
    console.log(`${(donePercent * 100).toFixed(1)}%, ${getIntuitiveTimeString(downloadBooksTimer.currentMs())}`);
  }
  downloadBooksMs = downloadBooksTimer.stop();
  console.log(`Downloaded ${doneBookCount.toLocaleString()} books in ${getIntuitiveTimeString(downloadBooksMs)}`);
}

async function downloadBook(scrapedBook: ScrapedBookWithFile) {
  let filePath: string, fileExists: boolean;
  let resp: Response, ws: WriteStream;
  filePath = scrapedBook.filePath;
  fileExists = await checkFile(filePath);
  if(fileExists) {
    return;
  }
  try {
    resp = await fetch(scrapedBook.plaintextUrl);
  } catch(e) {
    // console.log(resp.status);
    console.log(e);
    console.log(e.code);
    throw e;
  }
  ws = createWriteStream(filePath);
  return new Promise<void>((resolve, reject) => {
    ws.on('close', () => {
      resolve();
    });
    ws.on('error', err => {
      reject(err);
    });
    resp.body.pipe(ws);
  });
}

async function loadScrapedBooksMeta(): Promise<ScrapedBookWithFile[]> {
  let scrapedDirExists: boolean, scrapedMetaDirents: Dirent[];
  let scrapedBookMetaPaths: string[], scrapedBooksMeta: ScrapedBook[];
  let scrapedBooksWithFileNames: ScrapedBookWithFile[];
  scrapedDirExists = await checkDir(SCRAPED_EBOOKS_DIR_PATH);
  if(!scrapedDirExists) {
    throw new Error(`Directory doesn't exist, expected: ${SCRAPED_EBOOKS_DIR_PATH}`);
  }
  scrapedMetaDirents = await readdir(SCRAPED_EBOOKS_DIR_PATH, {
    withFileTypes: true,
  });
  scrapedBookMetaPaths = scrapedMetaDirents.reduce((acc, curr) => {
    if(
      curr.name.includes(SCRAPED_EBOOKS_FILE_NAME)
      && curr.isFile()
    ) {
      acc.push([
        SCRAPED_EBOOKS_DIR_PATH,
        curr.name,
      ].join(path.sep));
    }
    return acc;
  }, [] as string[]);
  
  scrapedBooksMeta = [];

  for(let i = 0; i < scrapedBookMetaPaths.length; ++i) {
    let currScrapedBookMetaPath: string;
    let currBooksMeta: ScrapedBook[], metaFileData: Buffer;
    currScrapedBookMetaPath = scrapedBookMetaPaths[i];
    metaFileData = await readFile(currScrapedBookMetaPath);
    currBooksMeta = JSON.parse(metaFileData.toString());
    console.log(`${currScrapedBookMetaPath}: ${currBooksMeta.length}`);
    for(let k = 0; k < currBooksMeta.length; ++k) {
      let currBookMeta: ScrapedBook;
      let foundBooksMetaIdx: number;
      currBookMeta = currBooksMeta[k];
      foundBooksMetaIdx = scrapedBooksMeta.findIndex(scrapedBookMeta => {
        return (scrapedBookMeta.plaintextUrl === currBookMeta.plaintextUrl);
      });
      if(foundBooksMetaIdx === -1) {
        scrapedBooksMeta.push(currBookMeta);
      }
    }
  }
  console.log(scrapedBooksMeta.length);
  scrapedBooksWithFileNames = scrapedBooksMeta.map(getScrapedBookWithFileName);
  return scrapedBooksWithFileNames;
}

function getScrapedBookWithFileName(scrapedBook: ScrapedBook): ScrapedBookWithFile {
  let withFileName: ScrapedBookWithFile;
  let titleNoPunct: string, titleKebabCase: string;
  titleNoPunct = scrapedBook.title.replace(/[^\p{L} ]/gu, '');
  titleKebabCase = titleNoPunct
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .join('-')
  ;
  withFileName = {
    ...scrapedBook,
    fileName: titleKebabCase,
    filePath: [
      EBOOKS_DATA_DIR_PATH,
      `${titleKebabCase}.txt`,
    ].join(path.sep)
  };
  return withFileName;
}
