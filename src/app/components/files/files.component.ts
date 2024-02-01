import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  selectedOpt: string = 'clipboard';
  options=[
    {name: 'Clipboard', value: 'clipboard'},
    {name: 'File', value: 'file'},
    {name: 'Webpage', value: 'webpage'},
  ]

  constructor() { }

  ngOnInit() {
  }

}
