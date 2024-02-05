import { Injectable } from "@angular/core";
import { AppState, FileDownload, db } from "../db/db";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private state!: BehaviorSubject<AppState>;
  private partialState!: BehaviorSubject<Partial<AppState>>;

  constructor() {
    this.state = new BehaviorSubject<AppState>({id: 1, defaultPath: '', activeDownloads: [] as FileDownload[]});
    db.appState.get(1).then((state: AppState | undefined) => {
      if (!state) {
        let newState = {id: 1, defaultPath: '', activeDownloads: [] as FileDownload[]};
        db.appState.add(newState).then(() => {
          this.state.next(newState);
        });
      } else {
        this.state.next(state);
      }
    });

    this.partialState = new BehaviorSubject<Partial<AppState>>({});
  }

  public getState(): any {
    return this.state;
  }

  public setValue(newState: any): void {
    this.state.next({ ...this.currentValue, ...newState });
    this.partialState.next(newState);
  }

  public get currentValue(): AppState {
    return this.state.getValue();
  }

  public get observable(): Observable<AppState> {
    return this.state.asObservable();
  }

  public get partialObservable(): Observable<Partial<AppState>> {
    return this.partialState.asObservable();
  }

}
