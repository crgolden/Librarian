import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { ConsoleResponse, StorageDeviceResponse } from '../curator/curator.models';

export interface ConsolesPageData {
  consoles: ConsoleResponse[];
  devices: StorageDeviceResponse[];
}

export const consolesResolver: ResolveFn<ConsolesPageData | null> = () => {
  const curator = inject(CuratorService);

  return forkJoin({
    consoles: curator.listConsoles(),
    devices: curator.listStorageDevices(),
  }).pipe(
    map((data): ConsolesPageData | null => data),
    catchError(() => of(null)),
  );
};
