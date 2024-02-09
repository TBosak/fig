import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Observable, Subscription } from 'rxjs';
import {
  DownloadState,
  ElectronService,
} from '../../services/electron.service';
import { db } from '../../db/db';

@Component({
  selector: 'app-download-progress-renderer',
  template: `
  <ng-container *ngIf="downloadState | async as state">
    <progress max="100" [attr.data-label]="
      state.completed
        ? 'Completed'
        : state.error
        ? 'Error: ' + state.error
        : state.progress + '%'" [value]="state.progress"></progress>
  </ng-container>
`,
  styles: `progress {
    text-align: center;
    height: 1.5em;
    width: 100%;
    -webkit-appearance: none;
    border: none;
    position: relative; /* Ensure progress bar is positioned relatively */
  }

  progress:before {
    content: attr(data-label);
    font-size: 0.8em;

    /* Center text vertically */
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%); /* Adjust vertical position to center */

    /* Ensure text is centered horizontally */
    text-align: center;
  }

  progress::-webkit-progress-bar {
    background-color: #c9c9c9;
  }

  progress::-webkit-progress-value {
    background-color: #7cc4ff;
  }

  progress::-moz-progress-bar {
    background-color: #7cc4ff;
  }`
})
export class DownloadProgressRendererComponent
  implements ICellRendererAngularComp
{
  public downloadState?: Observable<DownloadState>;
  private subscription?: Subscription;

  constructor(private electron: ElectronService) {}

  agInit(params: any): void {
    this.setupDownloadState(params.data.id);
  }

  private setupDownloadState(fileId: number) {
    // Since agInit cannot be async, handle the promise without await
    this.electron
      .getDownloadState(fileId)
      .then((observable) => {
        this.downloadState = observable;
        this.subscription = this.downloadState.subscribe({
          next: (state: DownloadState) => {
            db.fileDownloads
              .update(fileId, {
                progress: state.progress,
                status: state.completed
                  ? 'Completed'
                  : state.error
                  ? 'Error'
                  : 'Downloading',
              })
              .then(() => {
                console.log(`Updated IndexedDB for fileId ${fileId}`);
              })
              .catch((error) => {
                console.error(
                  `Error updating IndexedDB for fileId ${fileId}:`,
                  error
                );
              });
          },
        });
      })
      .catch((error) => console.error('Error getting download state:', error));
  }

  refresh(params: any): boolean {
    // Optionally, update the downloadState if params.data.id changes
    if (params.data.id && this.downloadState) {
      this.setupDownloadState(params.data.id);
    }
    return true;
  }
}
