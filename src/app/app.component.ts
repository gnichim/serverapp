import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, startWith, catchError } from 'rxjs/operators';
import { ServerService } from './service/server.service';
import { AppState } from './interface/app-state';
import { CustomResponse } from './interface/custom-response';
import { DataState } from './enum/data-state.enum';
import { Status } from './enum/status.enum';
import { NgForm } from '@angular/forms';
import { Server } from './interface/server';
import { NotifierService } from 'angular-notifier';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  appState$: Observable<AppState<CustomResponse>>;

  readonly DataState = DataState;

  readonly Status = Status;

  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse>(null);
  filterStatus$ = this.filterSubject.asObservable();

  // And then to push a new object in this dataSubject we use:
  // this.dataSubject.next()

  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  // private readonly notifier: NotifierService;

  constructor(
    private serverService: ServerService,
    private notifier: NotifierService
  ) {}

  ngOnInit(): void {
    this.appState$ = this.serverService.servers$.pipe(
      map((response) => {
        this.dataSubject.next(response);
        this.notifier.notify('success', 'You are awesome! Yes I mean that');
        return {
          dataState: DataState.LOADED_STATE,
          appData: {
            ...response,
            data: { servers: response.data.servers.reverse() },
          },
        };
      }),
      startWith({ dataState: DataState.LOADING_STATE }),
      catchError((error: string) => {
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  pingServer(ipAddress: string): void {
    this.filterSubject.next(ipAddress);
    this.appState$ = this.serverService.ping$(ipAddress).pipe(
      map((response) => {
        const index = this.dataSubject.value.data.servers.findIndex(
          (server) => server.id === response.data.server.id
        );
        this.dataSubject.value.data.servers[index] = response.data.server;
        this.filterSubject.next('');
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.filterSubject.next('');
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  saveServer(serverForm: NgForm): void {
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(serverForm.value as Server).pipe(
      map((response) => {
        this.dataSubject.next({
          ...response,
          data: {
            servers: [
              response.data.server,
              ...this.dataSubject.value.data.servers,
            ],
          },
        });
        document.getElementById('closeModal').click();
        this.isLoading.next(false);
        serverForm.resetForm({ status: this.Status.SERVER_DOWN });
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.isLoading.next(false);
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  // filterServers(status: Status): void {
  //   this.appState$ = this.serverService
  //     .filter$(status, this.dataSubject.value)
  //     .pipe(
  //       map((response) => {
  //         return { dataState: DataState.LOADED_STATE, appData: response };
  //       }),
  //       startWith({
  //         dataState: DataState.LOADED_STATE,
  //         appData: this.dataSubject.value,
  //       }),
  //       catchError((error: string) => {
  //         this.filterSubject.next('');
  //         return of({ dataState: DataState.ERROR_STATE, error });
  //       })
  //     );
  // }

  filterServers(status: string): void {
    let serverStatus = Status[status];
    this.appState$ = this.serverService
      .filter$(serverStatus, this.dataSubject.value)
      .pipe(
        map((response) => {
          // this.notifier.onDefault(response.message);
          return { dataState: DataState.LOADED_STATE, appData: response };
        }),
        startWith({
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        }),
        catchError((error: string) => {
          // this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }

  deleteServer(server: Server): void {
    this.appState$ = this.serverService.delete$(server.id).pipe(
      map((response) => {
        this.dataSubject.next({
          ...response,
          data: {
            servers: this.dataSubject.value.data.servers.filter(
              (s) => s.id !== server.id
            ),
          },
        });
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  printReport(): void {
    // to print the data as pdf
    // window.print();
    // to print the data as csv
    let dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    let tableSelect = document.getElementById('servers');
    let tableHtml = tableSelect.outerHTML.replace(/ /g, '%20');
    let downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    downloadLink.href = 'data:' + dataType + ', ' + tableHtml;
    downloadLink.download = 'server-report.xls';
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}
