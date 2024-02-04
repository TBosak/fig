import { Component } from '@angular/core';
import { DownloadState, ElectronService } from './services/electron.service';
import { BehaviorSubject } from 'rxjs';
import { db, FileDownload } from './db/db';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'fig';
  fileLinks: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  tabs =[
    {name:'Downloads', path: ['/downloads']},
    {name: 'Files', path: ['/files']},
    {name: 'Options', path: ['/options']}
  ];
  activeLink = this.tabs[0].name;
  private downloadStates: { [fileId: number]: DownloadState } = {};
  private downloadStateSubjects: { [fileId: number]: BehaviorSubject<DownloadState> } = {};
  private allDownloadsSubject = new BehaviorSubject<{ [fileId: number]: DownloadState }>({});

  constructor(public electron: ElectronService) {}

  ngOnInit() {
    this.electron.messages.subscribe((message: any)=>{
      const messageObj = JSON.parse(message.toString());
      if(messageObj.fileLinks?.length > 0){
        messageObj.fileLinks?.forEach((link: string) => {
          this.addNewUrl(link);
        });
      }
    });
    this.electron.getAllDownloadStates().subscribe((states: any) => {
      console.log(states);
    });
  }


  async addNewUrl(link: string) {
    await db.fileDownloads.add({
      url: link
    });
  }
  }
