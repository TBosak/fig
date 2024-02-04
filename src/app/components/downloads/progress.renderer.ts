import { Component, OnDestroy, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Observable, Subscription } from 'rxjs';
import { DownloadService, DownloadState } from '../../services/download.service';

@Component({
  selector: 'app-download-progress-renderer',
  template: `
    <div *ngIf="downloadState">
      <mat-progress-bar mode="determinate" [value]="downloadState.progress"></mat-progress-bar>
      <span>{{ downloadState.completed ? 'Completed' : (downloadState.error ? 'Error: ' + downloadState.error : downloadState.progress + '%') }}</span>
    </div>
  `,
})
export class DownloadProgressRendererComponent implements ICellRendererAngularComp {
  public downloadState!: DownloadState;
  private subscription!: Subscription;

  constructor(public downloads: DownloadService){

  }
  agInit(params: any): void {
    // Assuming the params provide the Observable<DownloadState>
      this.subscription = this.downloads.getDownloadState(params.value).subscribe((state: DownloadState) => {
        this.downloadState = state;
      });
  }

  refresh(params: any): boolean {
    // Return false to indicate that the refresh can be done by updating the data
    return false;
  }
}
