import { Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

@Component({
  selector: 'files-dialog',
  template: `
  <h1 mat-dialog-title align="center" class="w-100">Add Files</h1>
  <div mat-dialog-content align="center">
    <mat-form-field appearance="fill">
      <textarea matInput placeholder="Paste file links here" matTextareaAutosize matAutosizeMinRows="4" [(ngModel)]="data.fileLinks"></textarea>
    </mat-form-field>
    <mat-form-field appearance="fill">
      <textarea matInput placeholder="Paste urls to scrape here" matTextareaAutosize matAutosizeMinRows="4" [(ngModel)]="data.scrapeUrls"></textarea>
    </mat-form-field>
    <!-- <input hidden="true" id="input-file-id" multiple type="file" [(ngModel)]="data.files" />
    <label for="input-file-id" class="mat-raised-button">Choose File(s) with List(s)</label> -->
  </div>
  <div mat-dialog-actions align="center" class="w-100 m-0">
  <button mat-raised-button [mat-dialog-close]="data" cdkFocusInitial class="w-100">Add Links</button>
  <button mat-raised-button mat-dialog-close class="w-100 m-0">Cancel</button>
  </div>
  `
})
export class FilesDialog {
  constructor(
    public dialogRef: MatDialogRef<FilesDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
