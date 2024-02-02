import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ws: WebSocket | undefined;
  private messagesSubject = new Subject<any>();
  public messages = this.messagesSubject.asObservable();

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
}
