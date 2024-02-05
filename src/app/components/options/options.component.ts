import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.css']
})
export class OptionsComponent implements OnInit {

  constructor(public electron: ElectronService) { }

  ngOnInit() {
  }

  setDefaultPath(){
    this.electron.sendMessage(JSON.stringify({setDefaultPath: true}));
  }

}
