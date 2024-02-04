import { Component, OnDestroy, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Observable, Subscription } from 'rxjs';
import { DownloadState, ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-download-progress-renderer',
  template: `
    <ng-container *ngIf="downloadState | async as state">
      <mat-progress-bar mode="determinate" [value]="state.progress"></mat-progress-bar>
      <span>{{ state.completed ? 'Completed' : (state.error ? 'Error: ' + state.error : state.progress + '%') }}</span>
    </ng-container>
  `,
})
export class DownloadProgressRendererComponent implements ICellRendererAngularComp {
  public downloadState!: Observable<DownloadState>;

  constructor(public downloads: ElectronService){

  }
  agInit(params: any): void {
    // Assuming the params provide the Observable<DownloadState>
      console.log(params.data.id);
      this.downloadState = this.downloads.getDownloadState(params.data.id);
      this.downloadState.subscribe((state: DownloadState) => {
        console.log(state);
      });
  }

  refresh(params: any): boolean {
    // Return false to indicate that the refresh can be done by updating the data
    return false;
  }
}
