
import path from 'path';

import { checkFile, mkdirIfNotExistRecursive } from '../../util/files';
import {
  EBookTxtFile,
  EBookTxtFileSrc,
  EBOOK_ENUM,
  EBOOK_ENUM_ARRAY,
  EBOOK_TXT_FILE_URI_MAP,
  TXT_DATA_DIR_PATH,
  TXT_OUT_DIR_PATH,
} from './txt-constants';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/print-util';
import {
  downloadEBook,
  readEBook,
} from './e-book/e-book-service';
import { createWriteStream, WriteStream } from 'fs';

type CountCharsResult = {
  charCountMap: Record<string, number>;
  totalCharCount: number;
  lineCount: number;
  ms: number;
};

const STATS_DELIM_START = '<!--';
const STATS_DELIM_END = '-->';

export async function txtMain() {
  let eBookTxtFiles: EBookTxtFile[];
  let countCharsResultTuples: [ EBookTxtFile, CountCharsResult ][];
  let countCharsTotalTimer: Timer, countCharsTotalMs: number;

  eBookTxtFiles = [];

  await mkdirIfNotExistRecursive(TXT_DATA_DIR_PATH);
  await mkdirIfNotExistRecursive(TXT_OUT_DIR_PATH);

  for(let i = 0; i < EBOOK_ENUM_ARRAY.length; ++i) {
    let eBookTxtFileSrc: EBookTxtFileSrc, eBookTxtFile: EBookTxtFile;
    let fileExists: boolean;
    let eBookGetTimer: Timer, eBookGetMs: number;
    eBookTxtFileSrc = EBOOK_TXT_FILE_URI_MAP[EBOOK_ENUM_ARRAY[i]];
    eBookTxtFile = getEbookTxtFileWithPath(eBookTxtFileSrc);
    fileExists = await checkFile(eBookTxtFile.filePath);
    if(fileExists) {
      console.log(`'${eBookTxtFile.title}' exists.`);
    }  else {
      console.log(`Downloading ${eBookTxtFile.title}: ${eBookTxtFile.uri}`);
      eBookGetTimer = Timer.start();
      await downloadEBook(eBookTxtFile);
      eBookGetMs = eBookGetTimer.stop();
      console.log(`Downloaded ${eBookTxtFile.title} in ${getIntuitiveTimeString(eBookGetMs)}.`);
    }
    eBookTxtFiles.push(eBookTxtFile);
  }

  countCharsResultTuples = [];

  countCharsTotalTimer = Timer.start();

  for(let i = 0; i < eBookTxtFiles.length; ++i) {
    let currEBookTxtFile: EBookTxtFile;
    let countCharsResult: CountCharsResult;
    currEBookTxtFile = eBookTxtFiles[i];

    countCharsResult = await countChars(currEBookTxtFile);

    countCharsResultTuples.push([
      currEBookTxtFile,
      countCharsResult,
    ]);
  }

  countCharsTotalMs = countCharsTotalTimer.stop();

  for(let i = 0; i < countCharsResultTuples.length; ++i) {
    let currCountCharsResultTuple: [ EBookTxtFile, CountCharsResult ];
    let currEBookTxtFile: EBookTxtFile, currCountCharsResult: CountCharsResult;
    currCountCharsResultTuple = countCharsResultTuples[i];
    [ currEBookTxtFile, currCountCharsResult ] = currCountCharsResultTuple;
    console.log(currEBookTxtFile.title);
    console.log(`${getIntuitiveTimeString(currCountCharsResult.ms)}`);
    console.log(`lines: ${currCountCharsResult.lineCount.toLocaleString()}`);
    console.log(`totalChars: ${currCountCharsResult.totalCharCount.toLocaleString()}`);

    console.log('');
    await writeCharCountTxtOutput(currEBookTxtFile, currCountCharsResult);
  }

  console.log(`Counting chars for all ebooks took ${getIntuitiveTimeString(countCharsTotalMs)}`);
}

async function writeCharCountTxtOutput(eBookTxtFile: EBookTxtFile, countCharsResult: CountCharsResult) {
  let outFilePath: string, ws: WriteStream;
  let charCountTuples: [ string, number ][];

  outFilePath = `${TXT_OUT_DIR_PATH}${path.sep}${eBookTxtFile.title}.char-count.txt`;
  charCountTuples = Object.entries(countCharsResult.charCountMap);

  charCountTuples.sort((a, b) => {
    let aCount: number, bCount: number;
    aCount = a[1];
    bCount = b[1];
    if(aCount > bCount) {
      return -1;
    } else if(aCount < bCount) {
      return 1;
    } else {
      return 0;
    }
  });

  ws = createWriteStream(outFilePath);

  await new Promise<void>((resolve, reject) => {
    ws.on('error', err => {
      reject(err);
    });
    ws.once('ready', () => {
      ws.write(`${STATS_DELIM_START} stats ${STATS_DELIM_END}\n`);
      ws.write(`ms : ${countCharsResult.ms}\n`);
      ws.write(`lineCount : ${countCharsResult.lineCount}\n`);
      ws.write(`totalCharCount : ${countCharsResult.totalCharCount}\n`);
      ws.write(`${STATS_DELIM_START} charCount ${STATS_DELIM_END}\n`);
      for(let i = 0; i < charCountTuples.length; ++i) {
        let charCountTuple: [ string, number ];
        charCountTuple = charCountTuples[i];
        ws.write(`'${charCountTuple[0]}' : ${charCountTuple[1]}\n`);
      }
      ws.end(() => {
        resolve();
      });
    });
  });
}

async function countChars(eBookTxtFile: EBookTxtFile): Promise<CountCharsResult> {
  let countCharsResult: CountCharsResult;
  let charCountMap: Record<string, number>;
  let lineCount: number, totalCharCount: number;
  let readTimer: Timer, readMs: number;

  charCountMap = {};
  totalCharCount = 0;
  lineCount = 0;

  const lineCb = (line: string) => {
    for(let i = 0; i < line.length; ++i) {
      let currChar: string;
      currChar = line[i];
      if(charCountMap[currChar] === undefined) {
        charCountMap[currChar] = 0;
      }
      charCountMap[currChar]++;
      totalCharCount++;
    }
    lineCount++;
  };

  readTimer = Timer.start();
  await readEBook(eBookTxtFile, {
    lineCb,
  });
  readMs = readTimer.stop();

  countCharsResult = {
    charCountMap,
    totalCharCount,
    lineCount,
    ms: readMs,
  };

  return countCharsResult;
}

function getEbookTxtFileWithPath(eBookMetaSrc: EBookTxtFileSrc): EBookTxtFile {
  let filePath: string;
  filePath = `${TXT_DATA_DIR_PATH}${path.sep}${eBookMetaSrc.title}.txt`;
  return {
    key: eBookMetaSrc.key,
    title: eBookMetaSrc.title,
    uri: eBookMetaSrc.uri,
    filePath,
  };
}
