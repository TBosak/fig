import { Routes } from '@angular/router';
import { DownloadsComponent } from './components/downloads/downloads.component';
import { FilesComponent } from './components/files/files.component';
import { OptionsComponent } from './components/options/options.component';

export const routes: Routes = [
  { path: '', redirectTo: 'files', pathMatch: 'full'},
  // { path: 'downloads', component: DownloadsComponent, pathMatch: 'full'},
  { path: 'files', component: FilesComponent, pathMatch: 'full'},
  { path: 'options', component: OptionsComponent, pathMatch: 'full'},
];
