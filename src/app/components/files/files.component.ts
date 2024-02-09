import { Component, OnInit, WritableSignal, signal } from '@angular/core';
import {
  DownloadState,
  ElectronService,
} from '../../services/electron.service';
import { liveQuery } from 'dexie';
import { AppState, FileDownload, db } from '../../db/db';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ColDef, GridApi, SelectionChangedEvent } from 'ag-grid-community';
import { DownloadProgressRendererComponent } from '../shared/progress.renderer';
import { firstValueFrom, interval, take } from 'rxjs';
import { DataService } from '../../services/data.service';
import { MatDialog } from '@angular/material/dialog';
import { FilesDialog } from '../shared/files.dialog';
import { UrlRendererComponent } from '../shared/url.renderer';

function actionCellRenderer(params: any) {
  let eGui = document.createElement('div');
  eGui.innerHTML = `
  <span class="action-button download" data-action="download" title="Download">⬇️</span>
  <span class="action-button edit"  data-action="edit" title="Edit">📝</span>
  <span class="action-button delete" data-action="delete" title="Delete">❌</span>
`;
  return eGui;
}

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss'],
})
export class FilesComponent implements OnInit {
  public gridApi!: GridApi;
  downloadEnabled: boolean = false;
  gridSelection: any;
  downloadStatesCache: { [fileId: number]: DownloadState } = {};
  appState!: AppState;
  colDefs: ColDef<FileDownload>[] = [
    {
      field: 'id',
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
    },
    {
      field: 'url',
      headerName: 'URL',
      width: 150,
      cellRenderer: UrlRendererComponent,
    },
    {
      field: 'customPath',
      headerName: 'Path',
      cellRenderer: (params: any) =>
        params.value
          ? params.value
          : this.appState.defaultPath
          ? this.appState.defaultPath
          : 'System Default',
    },
    {
      field: 'id',
      comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
        // Check for 'Completed' status or default to progress, treating 'Completed' as 100%
        const getStatusProgress = (value:any) => {
            const state = this.downloadStatesCache[value];
            if (state?.completed === true) {
                return 100; // Treat 'Completed' as 100% progress
            }
            return state?.progress || 0; // Use progress or default to 0
        };

        const firstState = getStatusProgress(valueA);
        const secondState = getStatusProgress(valueB);

        return firstState - secondState;
    },
      headerName: 'Download Progress',
      cellRenderer: DownloadProgressRendererComponent,
    },
    {
      headerName: 'Actions',
      width: 100,
      cellRenderer: actionCellRenderer,
      editable: false,
      colId: 'action',
    },
  ];
  files: FileDownload[] = [];
  selectedOpt: WritableSignal<string> = signal('clipboard');
  options = [
    { name: 'Clipboard', value: 'clipboard' },
    { name: 'File', value: 'file' },
    { name: 'Webpage', value: 'webpage' },
  ];
  fileLinks = liveQuery(() => db.fileDownloads.toArray());

  constructor(
    public electron: ElectronService,
    public data: DataService,
    public dialog: MatDialog
  ) {}

  ngOnInit() {
    this.data.observable.subscribe((state) => {
      this.appState = state;
      this.gridApi?.refreshCells();
    });
    this.fileLinks.subscribe((fileLinks) => {
      this.files = fileLinks;
    });
    interval(500).subscribe(() => {
      this.updateDownloadStatesCache(this.files.map((file) => file.id ?? -1));
    });
  }

  onSelectionChanged(event: SelectionChangedEvent) {
    const selectedData = this.gridApi.getSelectedRows();
    if (selectedData.length > 0) {
      this.downloadEnabled = true;
    } else {
      this.downloadEnabled = false;
    }
  }

  downloadSelected() {
    const selectedData = this.gridApi.getSelectedRows();
    this.electron.sendMessage(
      JSON.stringify({ download: Array.from(selectedData) })
    );
  }

  async onGridReady(params: any) {
    this.gridApi = params.api;
  }

  extractFileLinksFromText(text: any) {
    // Matches both: URLs ending with specified file extensions and base64 encoded images
    const urlRegex =
      /\bhttps?:\/\/\S+\.(pdf|zip|rar|7z|tar|gz|bz2|docx|xlsx|pptx|mp3|mp4|ogg|wav|webm|jpg|jpeg|png|gif|csv)\b/gi;
    const base64ImageRegex = /data:image\/[a-zA-Z]+;base64,[^\s]+/gi;

    const fileLinks = text.match(urlRegex) || [];
    const base64Images = text.match(base64ImageRegex) || [];

    // Combine both arrays
    return [...fileLinks, ...base64Images];
  }

  onCellClicked(params: any) {
    // Handle click event for action cells
    if (
      params.column.colId === 'action' &&
      params.event.target.dataset.action
    ) {
      let action = params.event.target.dataset.action;

      if (action === 'download') {
        this.electron.sendMessage(
          JSON.stringify({ download: [params.node.data.url] })
        );
      }

      if (action === 'edit') {
        params.api.startEditingCell({
          rowIndex: params.node.rowIndex,
          // gets the first columnKey
          colKey: params.columnApi.getDisplayedCenterColumns()[0].colId,
        });
      }

      if (action === 'delete') {
        params.api.applyTransaction({
          remove: [params.node.data],
        });
        this.deleteFile(params.node.data.id);
      }

      if (action === 'update') {
        params.api.stopEditing(false);
      }

      if (action === 'cancel') {
        params.api.stopEditing(true);
      }
    }
  }

  //DB operations
  async addNewUrl(link: any) {
    await db.fileDownloads.add({
      url: link.url,
      type: link.type,
    });
  }

  async deleteFile(id: number) {
    await db.fileDownloads.delete(id);
  }

  async updateDownloadStatesCache(ids: number[]) {
    // Map each id to a promise that resolves to { id, state }
    const promises = ids.map(async (id: number) => {
      // Await the promise from getDownloadState to get the observable
      const downloadStateObservable = await this.electron.getDownloadState(id);

      // Now, use firstValueFrom to convert the Observable to a Promise
      const state = await firstValueFrom(downloadStateObservable);

      // Return the object with id and state
      return { id, state };
    });

    // Await all promises to resolve
    const results = await Promise.all(promises);

    // Update the cache with the resolved states
    results.forEach(({ id, state }) => {
      this.downloadStatesCache[id] = state;
    });
  }

  openDialog() {
    const dialogRef = this.dialog.open(FilesDialog, {
      width: '350px',
      data: {},
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result.fileLinks) {
        this.electron.sendMessage(
          JSON.stringify({ checkLinks: result.fileLinks })
        );
      }
      if (result.scrapeUrls) {
        this.electron.sendMessage(
          JSON.stringify({ scrapeUrls: result.scrapeUrls })
        );
      }
      if (result.files) {
      }
    });
  }
}
