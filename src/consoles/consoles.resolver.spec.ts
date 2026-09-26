import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { consolesResolver, ConsolesPageData } from './consoles.resolver';
import { CuratorService } from '../curator/curator.service';
import { ConsoleResponse, StorageDeviceResponse } from '../curator/curator.models';
import { newId, newText } from '@crgolden/modules/testing';

const CONSOLES = [{ console_id: newId() }] as unknown as ConsoleResponse[];
const DEVICES = [{ device_id: newId() }] as unknown as StorageDeviceResponse[];

function run(curator: Partial<CuratorService>): Promise<ConsolesPageData | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = consolesResolver({} as ActivatedRouteSnapshot, {} as never);
      (result as Observable<ConsolesPageData | null>).subscribe(resolvePromise);
    });
  });
}

const fails = () => throwError(() => new Error(newText()));

describe('consolesResolver', () => {
  it('resolves consoles and storage devices together', async () => {
    const result = await run({ listConsoles: () => of(CONSOLES), listStorageDevices: () => of(DEVICES) });

    expect(result).toEqual({ consoles: CONSOLES, devices: DEVICES });
  });

  it('resolves null when either call fails, rather than a half-populated page', async () => {
    const consolesFailed = await run({ listConsoles: fails, listStorageDevices: () => of(DEVICES) });
    const devicesFailed = await run({ listConsoles: () => of(CONSOLES), listStorageDevices: fails });

    expect(consolesFailed).toBeNull();
    expect(devicesFailed).toBeNull();
  });
});
