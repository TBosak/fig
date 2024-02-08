import { Component } from '@angular/core';
import { DownloadState, ElectronService } from './services/electron.service';
import { BehaviorSubject } from 'rxjs';
import { db, FileDownload } from './db/db';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'fig';
  fileLinks: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  tabs =[
    {name: 'Files', path: ['/files']},
    {name: 'Options', path: ['/options']}
  ];
  activeLink = this.tabs[0].name;
  private downloadStates: { [fileId: number]: DownloadState } = {};
  private downloadStateSubjects: { [fileId: number]: BehaviorSubject<DownloadState> } = {};
  private allDownloadsSubject = new BehaviorSubject<{ [fileId: number]: DownloadState }>({});

  constructor(public electron: ElectronService, public data: DataService) {}

  ngOnInit() {
    this.electron.messages.subscribe((message: any)=>{
      const messageObj = JSON.parse(message.toString());
      if(messageObj.fileLinks?.length > 0){
        messageObj.fileLinks?.forEach((link: string) => {
          this.addNewUrl(link);
        });
      }
      if(messageObj.defaultPath){
        this.data.setValue({defaultPath: messageObj.defaultPath});
        db.fileDownloads.toArray().then((fileDownloads: FileDownload[]) => {
          fileDownloads.forEach((fileDownload: FileDownload) => {
            db.fileDownloads.put({...fileDownload, path: messageObj.defaultPath});
          });
        });
      }
    });
  }


  async addNewUrl(link: string) {
    await db.fileDownloads.add({
      url: link
    });
  }
  }
