import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LibraryComponent } from './library.component';

describe('LibraryComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('triggers a refresh, polls until succeeded, and shows a success message', async () => {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush({ run_id: 'r1', status: 'running', error: null });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush({ run_id: 'r1', status: 'succeeded', error: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Library catalogued.');

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/library/refresh/r1');
  });

  it('shows the job error message on a failed refresh', async () => {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/library/refresh/r1')
      .flush({ run_id: 'r1', status: 'failed', error: 'PSN entitlement fetch failed.' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('PSN entitlement fetch failed.');

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/library/refresh/r1');
  });

  it('shows an error when the refresh trigger itself fails', () => {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to start a library refresh.');
  });
});
