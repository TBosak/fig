import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
export class DownloadState {
  progress!: number;
  completed!: boolean;
  error?: string;
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
      switch (msg.type) {
        case 'downloadProgress':
          console.log(msg.file, msg.progress, msg.completed, msg.error)
          this.updateDownloadState(msg.file, { progress: msg.progress, completed: false });
          break;
        case 'downloadComplete':
          console.log(msg.file, msg.progress, msg.completed, msg.error)
          this.updateDownloadState(msg.file, { progress: 100, completed: true });
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

private updateDownloadState(fileId: number, state: Partial<DownloadState>): void {
  if (!this.downloadStates[fileId]) {
    this.downloadStates[fileId] = { progress: 0, completed: false };
    this.downloadStateSubjects[fileId] = new BehaviorSubject<DownloadState>({ progress: 0, completed: false });
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
