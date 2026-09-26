import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { psPlusRotationResolver, ResolvedPsPlusRotation } from './ps-plus.resolver';
import { CuratorService } from '../../curator/curator.service';
import { PsPlusRotationResponse } from '../../curator/curator.models';
import { ResolvedStatuses } from '../../shared/resolved-status';

const ROTATION: PsPlusRotationResponse = {
  catalog_walked_at: null,
  since: null,
  added: [],
  leaving: [],
  unclaimed: [],
  lapsed: [],
  categories: [],
};

function resolve(curator: Partial<CuratorService>): Promise<ResolvedPsPlusRotation> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = psPlusRotationResolver({} as ActivatedRouteSnapshot, {} as never);
      (result as Observable<ResolvedPsPlusRotation>).subscribe(resolvePromise);
    });
  });
}

describe('psPlusRotationResolver', () => {
  it('resolves the rotation Curator reports', async () => {
    const result = await resolve({ getPsPlusRotation: () => of(ROTATION) });

    expect(result).toEqual({ status: ResolvedStatuses.ok, rotation: ROTATION });
  });

  it('reads a 404 as "no PSN link" rather than as a failure', async () => {
    const result = await resolve({
      getPsPlusRotation: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.NotFound })),
    });

    expect(result).toEqual({ status: ResolvedStatuses.notLinked });
  });

  it('degrades any other failure to an error result rather than throwing', async () => {
    const result = await resolve({
      getPsPlusRotation: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.InternalServerError })),
    });

    expect(result).toEqual({ status: ResolvedStatuses.error });
  });
});
