import path from 'path';

export const BASE_DIR = path.resolve(__dirname, '..');

export const LOG_DIRNAME = 'logs';
export const LOG_DIR_PATH = [
  BASE_DIR,
  LOG_DIRNAME,
].join(path.sep);
export const STDOUT_LOG_FILE_NAME = 'stdout.log';
export const STDERR_LOG_FILE_NAME = 'stderr.log';

export const DATA_DIRNAME = 'data';
export const DATA_DIR_PATH = [
  BASE_DIR,
  DATA_DIRNAME,
].join(path.sep);

export const SCRAPED_EBOOKS_FILE_NAME = 'scraped_ebooks.json';
export const SCRAPED_EBOOKS_NOT_FOUND_FILE_NAME = 'not_found_scraped_ebooks.json';
export const SCRAPED_EBOOKS_FILE_PATH = [
  DATA_DIR_PATH,
  SCRAPED_EBOOKS_FILE_NAME,
].join(path.sep);
export const SCRAPED_EBOOKS_NOT_FOUND_FILE_PATH = [
  DATA_DIR_PATH,
  SCRAPED_EBOOKS_NOT_FOUND_FILE_NAME,
].join(path.sep);
