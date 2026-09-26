import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUEST } from '@angular/core';
import { ssrAbsoluteUrlInterceptor } from './ssr-absolute-url.interceptor';
import { CuratorApi } from '../curator/curator-api';
import { newHostname, newHttpsAddress, newPathSegment, randomIntBetween } from '@crgolden/modules/testing';

const SSR_ORIGIN = `https://${newHostname()}:${randomIntBetween(1024, 65536)}`;
const EXTERNAL_URL = newHttpsAddress();

function configure(requestProviderValue: Request | null) {
  TestBed.configureTestingModule({
    providers: [
      { provide: REQUEST, useValue: requestProviderValue },
      provideHttpClient(withXhr(), withInterceptors([ssrAbsoluteUrlInterceptor])),
      provideHttpClientTesting(),
    ],
  });
}

describe('ssrAbsoluteUrlInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  afterEach(() => controller.verify());

  describe('in the browser (REQUEST is null)', () => {
    beforeEach(() => {
      configure(null);
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    it('passes relative URLs through unchanged', () => {
      http.get(CuratorApi.catalogGames).subscribe();

      const req = controller.expectOne(CuratorApi.catalogGames);
      expect(req.request.url).toBe(CuratorApi.catalogGames);
      req.flush([]);
    });
  });

  describe('under SSR (REQUEST provided)', () => {
    beforeEach(() => {
      configure(new Request(`${SSR_ORIGIN}/${newPathSegment()}`));
      http = TestBed.inject(HttpClient);
      controller = TestBed.inject(HttpTestingController);
    });

    it('rewrites a relative path to an absolute URL, because node fetch cannot send a relative one', () => {
      http.get(CuratorApi.catalogGames).subscribe();

      const req = controller.expectOne((r) => r.url.startsWith(SSR_ORIGIN));
      expect(req.request.url).toBe(`${SSR_ORIGIN}${CuratorApi.catalogGames}`);
      req.flush([]);
    });

    it('adds a leading slash when the relative URL lacks one', () => {
      http.get(CuratorApi.catalogGames.replace(/^\//, '')).subscribe();

      const req = controller.expectOne((r) => r.url.startsWith(SSR_ORIGIN));
      expect(req.request.url).toBe(`${SSR_ORIGIN}${CuratorApi.catalogGames}`);
      req.flush([]);
    });

    it('leaves an already-absolute URL alone, so it is never re-based onto our own origin', () => {
      http.get(EXTERNAL_URL).subscribe();

      const req = controller.expectOne(EXTERNAL_URL);
      expect(req.request.url).toBe(EXTERNAL_URL);
      req.flush([]);
    });
  });
});
