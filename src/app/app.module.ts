import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { RouterModule, RouterOutlet, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { DownloadsComponent } from './components/downloads/downloads.component';
import { FilesComponent } from './components/files/files.component';
import { OptionsComponent } from './components/options/options.component';
import { BrowserModule } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {MatTabsModule} from '@angular/material/tabs';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatCardModule} from '@angular/material/card';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatMenuModule} from '@angular/material/menu';
import {MatListModule} from '@angular/material/list';
import {MatDividerModule} from '@angular/material/divider';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {MatDialogModule} from '@angular/material/dialog';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSliderModule} from '@angular/material/slider';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatStepperModule} from '@angular/material/stepper';
import {MatCheckboxModule} from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ElectronService } from './services/electron.service';
import { MatOptionModule } from '@angular/material/core';
import { AgGridAngular } from 'ag-grid-angular';
import {CdkMenuModule} from '@angular/cdk/menu';
import { DownloadProgressRendererComponent } from './components/shared/progress.renderer';
import { FilesDialog } from './components/shared/files.dialog';

@NgModule({
  imports: [
    CommonModule,
    BrowserModule,
    RouterModule.forRoot(routes),
    RouterOutlet,
    ReactiveFormsModule,
    FormsModule,
    MatTabsModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatListModule,
    MatDividerModule,
    MatSidenavModule,
    MatGridListModule,
    MatExpansionModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatCheckboxModule,
    MatOptionModule,
    AgGridAngular,
    CdkMenuModule
  ],
  declarations: [AppComponent, DownloadsComponent, FilesComponent, OptionsComponent, DownloadProgressRendererComponent, FilesDialog],
  providers: [
    ElectronService,
    provideRouter(routes),
    provideAnimationsAsync()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
