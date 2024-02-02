import { Component, Input, OnInit, WritableSignal, signal } from '@angular/core';
import { ElectronService } from '../../services/electron.service';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  selectedOpt: WritableSignal<string> = signal('clipboard');
  fileLinks: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  options=[
    {name: 'Clipboard', value: 'clipboard'},
    {name: 'File', value: 'file'},
    {name: 'Webpage', value: 'webpage'},
  ]

  constructor(public electron: ElectronService) { }

  ngOnInit() {
    this.electron.messages.subscribe((message)=>{
      console.log('message:', message);
      if(message.type === 'fileLinks'){
        const currentLinks = this.fileLinks.getValue();
        this.fileLinks.next([...currentLinks, message]);
      }
    })
  }

  async sourceChange(event: any) {
    switch(event){
      case('clipboard'): this.getUrlsFromClipboard().then(urls => {
        const currentLinks = this.fileLinks.getValue();
        this.fileLinks.next([...currentLinks, ...urls]);
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

}
