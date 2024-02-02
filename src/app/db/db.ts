import Dexie, { Table } from 'dexie';

export interface FileDownload {
  id?: number;
  url: string;
}

export class AppDB extends Dexie {
  fileDownloads!: Table<FileDownload, number>;

  constructor() {
    super('ngdexieliveQuery');
    this.version(3).stores({
      fileDownloads: '++id',
    });
  }
}

export const db = new AppDB();
