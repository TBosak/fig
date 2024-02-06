import { Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

@Component({
  selector: 'files-dialog',
  template: `
  <h1 mat-dialog-title>Add Links</h1>
  <div mat-dialog-content>
    <mat-form-field appearance="fill">
      <textarea matInput placeholder="Paste file links here" matTextareaAutosize matAutosizeMinRows="4"></textarea>
    </mat-form-field>
    <mat-form-field appearance="fill">
      <textarea matInput placeholder="Paste urls to scrape here" matTextareaAutosize matAutosizeMinRows="4"></textarea>
    </mat-form-field>
    <input hidden="true" id="input-file-id" multiple type="file" />
    <label for="input-file-id" class="mat-raised-button">Choose File(s) with List(s)</label>
  </div>
  <div mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-button [mat-dialog-close]="data" cdkFocusInitial>Add Links</button>
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
