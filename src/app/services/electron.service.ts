import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { db } from '../db/db';
export class DownloadState {
  progress!: number;
  completed!: boolean;
  error?: string;
  speed?: string;
  hoster?: string;
  cancelToken?: string;
}
@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ws: WebSocket | undefined;
  private messagesSubject = new Subject<any>();
  public messages = this.messagesSubject.asObservable();
  private downloadStates: { [fileId: number]: DownloadState } = {};
  private downloadStateSubjects: { [fileId: number]: BehaviorSubject<DownloadState> } = {};
  private allDownloadsSubject = new BehaviorSubject<{ [fileId: number]: DownloadState }>({});

  constructor() {
    this.connect();
  }

  connect(): void {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log('WebSocket connection established');
    };

    this.ws.onmessage = (messageEvent) => {
      this.messagesSubject.next(messageEvent.data);
      const msg = JSON.parse(messageEvent.data);
      console.log('WebSocket message:', msg);
      switch (msg.type) {
        case 'downloadProgress':
          console.log(msg.file, msg.progress, msg.completed, msg.error)
          this.updateDownloadState(msg.file, { progress: msg.progress, completed: false, speed: msg.speed, hoster: msg.hoster, cancelToken: msg.cancelToken});
          break;
        case 'downloadComplete':
          console.log(msg.file, msg.progress, msg.completed, msg.error)
          this.updateDownloadState(msg.file, { progress: 100, completed: true, speed: msg.speed, hoster: msg.hoster});
          break;
        case 'downloadError':
          console.log(msg.file, msg.progress, msg.completed, msg.error)
          this.updateDownloadState(msg.file, { progress: 0, completed: false, error: msg.message });
          break;
        }
      };

    this.ws.onerror = (errorEvent) => {
      console.error('WebSocket error:', errorEvent);
    };

    this.ws.onclose = (closeEvent) => {
      console.log('WebSocket connection closed:', closeEvent);
      // Optionally: Reconnect or handle closure
    };
  }

  sendMessage(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      console.error('WebSocket is not open. Message not sent:', message);
    }
  }

private async updateDownloadState(fileId: number, state: Partial<DownloadState>): Promise<void>{
  if (!this.downloadStates[fileId]) {
    const dbState = await db.fileDownloads.get(fileId);
    this.downloadStates[fileId] = { progress: dbState?.progress || 0, completed: (dbState?.status === 'Completed') || false};
    this.downloadStateSubjects[fileId] = new BehaviorSubject<DownloadState>({ progress: dbState?.progress || 0, completed: (dbState?.status === 'Completed') || false });
  }

  // Update state
  this.downloadStates[fileId] = { ...this.downloadStates[fileId], ...state };
  this.downloadStateSubjects[fileId].next(this.downloadStates[fileId]);

  // Notify allDownloadsSubject subscribers about the update
  this.allDownloadsSubject.next(this.downloadStates);
}

public async getDownloadState(fileId: number): Promise<Observable<DownloadState>> {
  if (!this.downloadStates[fileId]) {
    const dbState = await db.fileDownloads.get(fileId);
    this.downloadStates[fileId] = { progress: dbState?.progress || 0, completed: (dbState?.status === 'Completed') || false};
    this.downloadStateSubjects[fileId] = new BehaviorSubject<DownloadState>({ progress: dbState?.progress || 0, completed: (dbState?.status === 'Completed') || false });
  }
  return this.downloadStateSubjects[fileId].asObservable();
}

public getAllDownloadStates(): Observable<{ [fileId: number]: DownloadState }> {
  return this.allDownloadsSubject.asObservable();
}
}
