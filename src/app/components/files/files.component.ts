import { AfterViewInit, Component, Input, OnInit, ViewChild, WritableSignal, signal } from '@angular/core';
import { ElectronService } from '../../services/electron.service';
import { liveQuery } from 'dexie';
import { FileDownload, db } from '../../db/db';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, SelectionChangedEvent } from 'ag-grid-community';

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
  gridSelection: any;
  colDefs: ColDef<FileDownload>[] = [
    { field: "id", headerName: "", checkboxSelection: true, headerCheckboxSelection: true, width: 50},
    { field: "url", headerName: "URL", width: 500},
    {
      headerName: "Actions",
      minWidth: 150,
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

  constructor(public electron: ElectronService) { }

  ngOnInit() {

  }

  onSelectionChanged(event: SelectionChangedEvent) {
    const selectedData = this.gridApi.getSelectedRows();
    this.electron.sendMessage(JSON.stringify({download: Array.from(selectedData.map((row: any) => row.url))}));
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

  extractFileLinksFromText(text:string) {
    return text.match(/\bhttps?:\/\/\S+\.(pdf|zip|tar|gz|docx|xlsx|pptx|mp3|mp4|jpg|jpeg|png|gif|csv)\b/gi) || [];
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
}
