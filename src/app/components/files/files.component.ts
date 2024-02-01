import { Component, OnInit, Signal, WritableSignal, signal } from '@angular/core';
import { text } from 'cheerio/lib/api/manipulation';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  selectedOpt: WritableSignal<string> = signal('clipboard');
  fileLinks: string[] = [];
  options=[
    {name: 'Clipboard', value: 'clipboard'},
    {name: 'File', value: 'file'},
    {name: 'Webpage', value: 'webpage'},
  ]

  constructor() { }

  ngOnInit() {
    toObservable(this.selectedOpt).subscribe((value) => {
      switch(value){
        case('clipboard'): this.getUrlsFromClipboard().then(urls => this.fileLinks = urls); break;
      }
    });
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
