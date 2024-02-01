import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'fig';
  tabs =[
    {name:'Downloads', path: ['/downloads']},
    {name: 'Files', path: ['/files']},
    {name: 'Options', path: ['/options']}
  ];
  activeLink = this.tabs[0].name;

  }
