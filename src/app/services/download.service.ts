import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';

export class DownloadState {
  progress!: number;
  completed!: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private ws!: WebSocket;
  private downloadStates: { [fileId: number]: DownloadState } = {};
  private downloadStateSubjects: { [fileId: number]: Subject<DownloadState> } = {};
  private allDownloadsSubject = new BehaviorSubject<{ [fileId: number]: DownloadState }>({});

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket('ws://localhost:8080');
    this.ws.onmessage = (messageEvent) => {
      const msg = JSON.parse(messageEvent.data);
      switch (msg.type) {
        case 'downloadProgress':
          this.updateDownloadState(msg.file, { progress: msg.progress, completed: false });
          break;
        case 'downloadComplete':
          this.updateDownloadState(msg.file, { progress: 100, completed: true });
          break;
        case 'downloadError':
          this.updateDownloadState(msg.file, { progress: 0, completed: false, error: msg.message });
          break;
      }
    };
  }

  private updateDownloadState(fileId: number, state: Partial<DownloadState>): void {
    if (!this.downloadStates[fileId]) {
      this.downloadStates[fileId] = { progress: 0, completed: false };
      this.downloadStateSubjects[fileId] = new Subject<DownloadState>();
    }

    // Update state
    this.downloadStates[fileId] = { ...this.downloadStates[fileId], ...state };
    this.downloadStateSubjects[fileId].next(this.downloadStates[fileId]);

    // Notify allDownloadsSubject subscribers about the update
    this.allDownloadsSubject.next(this.downloadStates);
  }

  public getDownloadState(fileId: number): Observable<DownloadState> {
    if (!this.downloadStateSubjects[fileId]) {
      this.downloadStateSubjects[fileId] = new BehaviorSubject<DownloadState>({ progress: 0, completed: false });
      this.downloadStates[fileId] = { progress: 0, completed: false };
    }
    return this.downloadStateSubjects[fileId].asObservable();
  }

  public getAllDownloadStates(): Observable<{ [fileId: number]: DownloadState }> {
    return this.allDownloadsSubject.asObservable();
  }
}
