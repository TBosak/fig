import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-url-renderer',
  template: `
  <span class="flex">
  <span class="h-100">
  <mat-icon class="h-100 mt-10" (click)="openImagePreview(params.value)">{{fileIcon}}</mat-icon>
  </span>
  <span class="top">
    {{params.value}}
  </span>
  </span>
`,
  styles: `
  .flex {
    display: flex;
  }
  .mt-10 {
    margin-top: 10px;
  }
`
})
export class UrlRendererComponent implements ICellRendererAngularComp {
  public params: any;
  public isImage: boolean = false;
  public fileIcon: string = 'insert_drive_file'; // Default icon

  constructor(public dialog: MatDialog) {}

  agInit(params: any): void {
    this.params = params;
    this.isImage = this.isImageUrl(params.value) || this.isBase64Url(params.value);
    this.fileIcon = this.setIcon(params.value);
  }

  refresh(params: any): boolean {
    return false;
  }

  setIcon(url:string): string {
    if (this.isImage) return 'image';
    if (this.isDocumentUrl(url)) return 'description';
    if (this.isMultiMediaUrl(url)) return 'movie';
    if (this.isArchiveUrl(url)) return 'folder_zip';
    return 'insert_drive_file';
  }

  isImageUrl(url: string): boolean {
    return (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i).test(url);
  }

  isBase64Url(url: string): boolean {
    return (/^data:image\/[a-z]+;base64,/i).test(url);
  }

  isDocumentUrl(url: string): boolean {
    return (/\.(docx?|xlsx?|pptx?|pdf)$/i).test(url);
  }

  isMultiMediaUrl(url: string): boolean {
    return (/\.(mp4|webm|ogg|mp3|wav)$/i).test(url);
  }

  isArchiveUrl(url: string): boolean {
    return (/\.(zip|rar|7z|tar|gz|bz2)$/i).test(url);
  }

  openImagePreview(url: string): void {
    if (!this.isImage) return;
    this.dialog.open(UrlRendererDialogComponent, {
      width: '40vw',
      data: { imageUrl: url },
      panelClass: 'custom-dialog-container'
    });
  }
}

// Temporary component for dialog content
@Component({
  template: `<img [src]="data.imageUrl" style="max-width: 100%; max-height: 100%;" />`,
})
export class UrlRendererDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
