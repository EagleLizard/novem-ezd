
import path from 'path';
import { createReadStream, ReadStream } from 'fs';

import { parser as CsvParser, parse as csvParse } from 'csv';

import { DATA_DIR_PATH } from '../../constants';
import { checkFile } from '../../util/files';
import { Timer } from '../../util/timer';


export async function ezdCsvMain() {
  let csvPath: string;
  let recordIdx: number;
  csvPath = [
    DATA_DIR_PATH,
    '2022_11_03.csv',
  ].join(path.sep);

  recordIdx = 0;

  const recordCb = (record: unknown) => {
    recordIdx++;
  };

  await parseCsv(csvPath, recordCb);
  console.log(`# records: ${(recordIdx + 1).toLocaleString()}`);
}

async function parseCsv(csvPath: string, recordCb: (record: unknown) => void) {
  let fileExists: boolean;
  let csvParsePromise: Promise<void>;
  let csvParser: CsvParser.Parser, csvRs: ReadStream;
  let recordCount: number;

  fileExists = await checkFile(csvPath);
  if(!fileExists) {
    throw new Error(`File doesn't exist at path: ${csvPath}`);
  }

  recordCount = 0;

  csvParser = csvParse();
  csvRs = createReadStream(csvPath);

  csvParsePromise = new Promise<void>((resolve, reject) => {
    csvParser.on('readable', () => {
      let record: unknown;
      while((record = csvParser.read()) !== null) {
        recordCb(record);
      }
    });
    csvParser.on('error', (err) => {
      reject(err);
    });
    csvParser.on('end', () => {
      resolve();
    });
  });
  csvRs.pipe(csvParser);
  await csvParsePromise;
}
