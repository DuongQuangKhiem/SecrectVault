import RNFS from 'react-native-fs';
import { LanguageType } from './types';

export const VAULT_DIR = RNFS.DocumentDirectoryPath + '/vault_secure_storage';
export const CACHE_DIR = RNFS.CachesDirectoryPath + '/vault_temp_decrypted';
export const INDEX_FILE = VAULT_DIR + '/vault_index.enc';
export const XOR_HEADER_SIZE = 512;

export const PATTERN_SIZE = 260;
export const GRID_SIZE = PATTERN_SIZE / 3;

export const ABOUT_CONTENT_KEY = [118, 97, 117, 108, 116, 115, 101, 99, 114, 101, 116, 50, 48, 50, 54]
  .map((c) => String.fromCharCode(c)).join('');

export const ABOUT_CONTENT_ENCODED: Record<LanguageType, string> = {
  vi: 'U2FsdGVkX18RYepDHTYOo2v6ipvHbZz1w9BFJHht4kASr3HaebHznuOLJxXL6tjROjzRQfmwXC7GxIs9AXqXH4YHei+K5f1/8wr5bQ6l4I9O3V4gXkv7GY2xoBJKTkBY',
  en: 'U2FsdGVkX1/QBgPrAxJ72HleFT2/z7KIl43teUUTyxbN19oyLjBl+GGFw3wLrL+WQt0QC2VawqfOCvB6/HyYZhShOcQZpQSKp+dQ5VoDaDA=',
};

export const APP_LABEL_ENCODED: Record<LanguageType, string> = {
  vi: 'U2FsdGVkX18J58QS7dV4YM6YbNZ4+ynXa4iLZ+LDgOQ=',
  en: 'U2FsdGVkX1+GLy8k6i8Vbbn3fKCbv+p6SLs4hsdP5qM=',
};