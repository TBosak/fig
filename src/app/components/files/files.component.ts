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
  selectedRowIds: Set<number> = new Set();
  fileSelected: boolean = false;
  gridSelection: any;
  downloadStatesCache: { [fileId: number]: DownloadState } = {};
  appState!: AppState;
  colDefs: ColDef<FileDownload>[] = [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      filter: true
    },
    {
      field: 'url',
      headerName: 'URL',
      width: 150,
      cellRenderer: UrlRendererComponent,
      filter: true
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
      setTimeout(() => this.reselectRows(), 0);
    });
    interval(500).subscribe(() => {
      this.updateDownloadStatesCache(this.files.map((file) => file.id ?? -1));
    });
  }

  reselectRows() {
    this.gridApi.forEachNode(node => {
      if (this.selectedRowIds.has(node.data.id)) {
        node.setSelected(true);
      }
    });
  }

  onSelectionChanged(event: SelectionChangedEvent) {
    const selectedNodes = this.gridApi.getSelectedNodes();
    this.selectedRowIds = new Set(selectedNodes.map(node => node.data.id));
    this.fileSelected = this.selectedRowIds.size > 0;
  }

  downloadSelected() {
    const selectedData = this.gridApi.getSelectedRows();
    this.electron.sendMessage(
      JSON.stringify({ download: Array.from(selectedData) })
    );
  }

  deleteSelected(){
    const selectedData = this.gridApi.getSelectedRows();
    this.gridApi.applyTransaction({
      remove: selectedData
    });
    selectedData.forEach((file: FileDownload) => {
      this.electron.sendMessage(JSON.stringify({ cancelToken: [file.cancelToken] }));
      this.deleteFile(file.id || -1);
    });
  }

  clearCompleted(){
    this.files.forEach((file: FileDownload) => {
      if(this.downloadStatesCache[file.id || -1]?.completed){
        this.gridApi.applyTransaction({
          remove: [file]
        });
        this.deleteFile(file.id || -1);
      }
    });
  }

  async onGridReady(params: any) {
    this.gridApi = params.api;
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
        this.electron.sendMessage(JSON.stringify({ cancelToken: [params.node.data.cancelToken] }));
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
