import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { ConsoleResponse, StorageDeviceResponse } from '../curator/curator.models';

export interface ConsolesPageData {
  consoles: ConsoleResponse[];
  devices: StorageDeviceResponse[];
}

/**
 * Resolves both of /consoles' first payloads together. They were two independent `ngOnInit` fetches
 * with two loading flags, which meant the page could show its console list while the storage-device
 * list below it was still a placeholder -- a half-rendered page, not a loading one.
 *
 * `forkJoin` makes them one payload, so either both are on screen or the route hasn't activated.
 * Resolves to `null` if either fails, matching `psnStatusResolver`: the component renders its own
 * error state rather than the navigation failing.
 */
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
