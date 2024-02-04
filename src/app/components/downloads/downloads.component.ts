import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../services/electron.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.scss']
})
export class DownloadsComponent implements OnInit {
  private messagesSubscription!: Subscription;

  constructor(public electron: ElectronService) { }

  ngOnInit(): void {
    this.subscribeToMessages();
  }

  private subscribeToMessages(): void {
    this.messagesSubscription = this.electron.messages.subscribe((message: string) => {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'downloadProgress':
          // Handle download progress
          // data.file will contain the file name and data.progress will contain the progress percentage
          console.log(`Download progress for ${data.file}: ${data.progress}%`);
          break;
        case 'downloadComplete':
          // Handle download completion
          console.log(`Download complete for ${data.file}`);
          break;
        case 'downloadError':
          // Handle download error
          console.error(`Download error for ${data.file}: ${data.message}`);
          break;
        default:
          console.log('Received an unknown message type:', data);
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe to ensure no memory leaks
    this.messagesSubscription.unsubscribe();
  }
}

}
