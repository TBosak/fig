import Dexie, { Table } from 'dexie';

export interface FileDownload {
  id?: number;
  url: string;
  path?: string;
  customPath?: string;
  type?: string;
  status?: string;
  progress?: number;
  error?: string;
}

export interface AppState {
  id: number;
  defaultPath?: string;
  activeDownloads?: FileDownload[];
}

export class AppDB extends Dexie {
  fileDownloads!: Table<FileDownload, number>;
  appState!: Table<AppState, number>;

  constructor() {
    super('ngdexieliveQuery');
    this.version(3).stores({
      fileDownloads: '++id',
      appState: 'id',
    });
  }
}

export const db = new AppDB();
