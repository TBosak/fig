import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { DownloadService, DownloadState } from '../../services/download.service';
import { FileDownload, db } from '../../db/db';
import { liveQuery } from 'dexie';
import { ColDef } from 'ag-grid-community';
import { DownloadProgressRendererComponent } from './progress.renderer';
@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.scss']
})
export class DownloadsComponent {
  private allDownloadsSubscription!: Subscription;
  public allDownloadStates!: { [fileId: string]: DownloadState };
  colDefs: ColDef<any>[] = [
    { field: "id", headerName: "", checkboxSelection: true, headerCheckboxSelection: true, width: 50},
    { field: "url", headerName: "URL", width: 500},
    {
      headerName: 'Download Progress',
      field: 'status',
      cellRenderer: DownloadProgressRendererComponent,
    },
  ]
  public downloadStatuses = liveQuery(() => db.fileDownloads.toArray().then((files: FileDownload[]) => {
    return files.map((file: FileDownload) => {
      return {
        id: file.id,
        url: file.url,
        status: file.id
      };
    });
  }));

  constructor(public downloads: DownloadService) {}

  ngOnInit() {
  }



}
