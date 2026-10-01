import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, type Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { page, userEvent } from 'vitest/browser';
import { newId, newPercent, newText } from '@crgolden/modules/testing';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppPaths, RouteDataKeys } from '../app/app-paths';
import { CuratorApi } from '../curator/curator-api';
import {
  SizeSources,
  type CollectionGameResponse,
  type CollectionPreviewResponse,
  type SizeSource,
} from '../curator/curator.models';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { CollectionsComponent } from './collections.component';
import { CollectionsModes } from './collections.resolver';

const DESKTOP = e2eSettings.viewports.desktop;

function newGame(sizeSource: SizeSource): CollectionGameResponse {
  return {
    game_id: newId(),
    title: newText(),
    genre: newText(),
    aaa_tier: null,
    franchise: newText(),
    composite_score: newPercent(),
    rank_score: 1,
    size_gb: newPercent(),
    percent_completed: null,
    size_source: sizeSource,
  };
}

function paintedColorOf(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

describe('A collection preview in a real browser', () => {
  it('paints an unmeasured size as ordinary metadata and a measured one as measured', async () => {
    const queryParams: Params = {};
    await page.viewport(DESKTOP.width, DESKTOP.height);
    await TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([{ path: AppPaths.collections, children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
              data: { [RouteDataKeys.collections]: { mode: CollectionsModes.list, definitions: [], consoles: [] }, [RouteDataKeys.genres]: [] },
              queryParams,
            },
            queryParams: new BehaviorSubject<Params>(queryParams).asObservable(),
          },
        },
      ],
    }).compileComponents();
    await resolveTestComponentResources();
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await userEvent.click(required('#collections-new'));
    await userEvent.click(required('#collection-preview'));
    const included = [newGame(SizeSources.measured), newGame(SizeSources.default)];
    const preview: CollectionPreviewResponse = {
      included,
      excluded: [],
      included_total: included.length,
      excluded_total: 0,
      included_game_ids: [],
      used_gb: null,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    };

    TestBed.inject(HttpTestingController)
      .expectOne((request) => request.url === CuratorApi.collectionsPreview)
      .flush(preview);
    await expect.poll(() => document.querySelector('#preview-included-size-source-1') !== null).toBe(true);

    const muted = paintedColorOf('--color-text-muted');
    const danger = paintedColorOf('--color-danger');
    expect(muted, 'the token probe cannot tell muted from danger, so it proves nothing').not.toBe(danger);
    const unmeasured = getComputedStyle(required('#preview-included-size-source-1')).color;
    expect(unmeasured, 'the majority rung is painted as an alarm rather than as ordinary metadata').toBe(muted);
    expect(unmeasured).not.toBe(danger);
    expect(getComputedStyle(required('#preview-included-size-source-0')).color, 'a measured size is not marked as such').toBe(
      paintedColorOf('--color-ok'),
    );
  });
});
