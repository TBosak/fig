import { Component, OnInit, WritableSignal, signal } from '@angular/core';
import { DownloadState, ElectronService } from '../../services/electron.service';
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

function actionCellRenderer(params:any) {
  let eGui = document.createElement("div");
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
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  public gridApi!: GridApi;
  downloadEnabled: boolean = false;
  gridSelection: any;
  downloadStatesCache: { [fileId: number]: DownloadState } = {};
  appState!: AppState;
  colDefs: ColDef<FileDownload>[] = [
    { field: "id", headerName: "", checkboxSelection: true, headerCheckboxSelection: true, width: 50},
    {
      field: "url",
      headerName: "URL",
      width: 150,
      cellRenderer: UrlRendererComponent,
    },
    {
      field: "customPath",
      headerName: "Path",
      cellRenderer: (params: any) => params.value ? params.value : (this.appState.defaultPath ? this.appState.defaultPath : "System Default")
    },
    {
      field: "id",
      comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
        const firstState = this.downloadStatesCache[valueA]?.progress || 0;
        const secondState = this.downloadStatesCache[valueB]?.progress || 0;

        // Normal comparison logic based on progress
        if (firstState === secondState) {
          return 0; // Equal progress
        } else if (firstState > secondState) {
          return isDescending ? -1 : 1; // Higher progress
        } else {
          return isDescending ? 1 : -1; // Lower progress
        }
      },
      headerName: 'Download Progress',
      cellRenderer: DownloadProgressRendererComponent,
    },
    {
      headerName: "Actions",
      width: 100,
      cellRenderer: actionCellRenderer,
      editable: false,
      colId: "action"
    }
  ]
  files: FileDownload[] = [];
  selectedOpt: WritableSignal<string> = signal('clipboard');
  options=[
    {name: 'Clipboard', value: 'clipboard'},
    {name: 'File', value: 'file'},
    {name: 'Webpage', value: 'webpage'},
  ]
  fileLinks = liveQuery(() => db.fileDownloads.toArray());

  constructor(public electron: ElectronService, public data: DataService, public dialog: MatDialog) { }

  ngOnInit() {
    this.data.observable.subscribe((state) => {
      this.appState = state;
      this.gridApi?.refreshCells();
    });
    this.fileLinks.subscribe((fileLinks) => {
      this.files = fileLinks;
    });
    interval(500).subscribe(() => {
      this.updateDownloadStatesCache(this.files.map(file => file.id ?? -1));
    });
  }

  onSelectionChanged(event: SelectionChangedEvent) {
    const selectedData = this.gridApi.getSelectedRows();
    if (selectedData.length > 0) {
      this.downloadEnabled = true;
    }
    else {
      this.downloadEnabled = false;
    }
  }

  downloadSelected() {
    const selectedData = this.gridApi.getSelectedRows();
    this.electron.sendMessage(JSON.stringify({download: Array.from(selectedData)}));
  }

  async onGridReady(params: any) {
    this.gridApi = params.api;
  }

  async sourceChange(event: any) {
    switch(event){
      case('clipboard'): this.getUrlsFromClipboard().then(urls => {
        urls.forEach((link: string) => {
          this.addNewUrl(link);
        });
      }); break;
    }
  }

  async updateSelectedOpt(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedOpt.set(target.value);
  }

  async getUrlsFromClipboard() {
    try {
      return await navigator.clipboard.readText().then(text => {
        const urls = this.extractFileLinksFromText(text)
        return urls || [];
      });
    } catch (err) {
      console.error('Failed to read from clipboard:', err);
      return Promise.resolve([]);
    }
  }

  extractFileLinksFromText(text: any) {
    // Matches both: URLs ending with specified file extensions and base64 encoded images
    const urlRegex = /\bhttps?:\/\/\S+\.(pdf|zip|rar|7z|tar|gz|bz2|docx|xlsx|pptx|mp3|mp4|ogg|wav|webm|jpg|jpeg|png|gif|csv)\b/gi;
    const base64ImageRegex = /data:image\/[a-zA-Z]+;base64,[^\s]+/gi;

    const fileLinks = text.match(urlRegex) || [];
    const base64Images = text.match(base64ImageRegex) || [];

    // Combine both arrays
    return [...fileLinks, ...base64Images];
  }

  onCellClicked(params:any) {
    // Handle click event for action cells
    if (params.column.colId === "action" && params.event.target.dataset.action) {
      let action = params.event.target.dataset.action;

      if (action === "download") {
        this.electron.sendMessage(JSON.stringify({download: [params.node.data.url]}));
      }

      if (action === "edit") {
        params.api.startEditingCell({
          rowIndex: params.node.rowIndex,
          // gets the first columnKey
          colKey: params.columnApi.getDisplayedCenterColumns()[0].colId
        });
      }

      if (action === "delete") {
        params.api.applyTransaction({
          remove: [params.node.data]
        });
        this.deleteFile(params.node.data.id);
      }

      if (action === "update") {
        params.api.stopEditing(false);
      }

      if (action === "cancel") {
        params.api.stopEditing(true);
      }
    }
  }

  //DB operations
  async addNewUrl(link: string) {
    await db.fileDownloads.add({
      url: link
    });
  }

  async deleteFile(id: number) {
    await db.fileDownloads.delete(id);
  }

async updateDownloadStatesCache(ids: number[]){
  const promises = ids.map((id: number) =>
    firstValueFrom(this.electron.getDownloadState(id))
      .then(state => ({ id, state }))
  );

  const results = await Promise.all(promises);
  results.forEach(({ id, state }) => {
    this.downloadStatesCache[id] = state;
  });
}

openDialog(){
  const dialogRef = this.dialog.open(FilesDialog, {
    width: '350px',
    data: {}
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result.fileLinks) {
      this.extractFileLinksFromText(result.fileLinks).forEach((link: string) => {
      this.addNewUrl(link);
    });
  }
  if (result.scrapeUrls) {
    this.electron.sendMessage(JSON.stringify({scrapeUrls: result.scrapeUrls}));
  }
  if (result.files) {

  }
  });
}
}
