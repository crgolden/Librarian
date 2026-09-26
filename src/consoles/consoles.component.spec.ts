import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConsolesComponent, DEVICE_LINK_LABELS } from './consoles.component';
import { ConsolesPageData } from './consoles.resolver';
import {
  CONSOLE_PLATFORM_OPTIONS,
  ConsoleDeviceLinkState,
  ConsoleDeviceLinkStates,
  ConsolePlatforms,
  ConsoleResponse,
  StorageDeviceResponse,
  StorageKinds,
} from '../curator/curator.models';
import { CuratorApi } from '../curator/curator-api';
import { AppUrls } from '../app/app-paths';
import {
  CONSOLE_NAME_REQUIRED_ERROR,
  CONSOLE_PLATFORM_ERROR,
  DEVICE_CAPACITY_REQUIRED_ERROR,
  defaultCapacityNoteFor,
} from './consoles.messages';
import { HttpMethods } from '../bff/http-headers';
import { newCount, newId, newMemberOf, newText } from '@crgolden/modules/testing';

const CONSOLE_ID = newId();
const CONSOLE_NAME = newText();
const CONSOLE_CAPACITY_GB = newCount();
const DEVICE_ID = newId();
const DEVICE_NAME = newText();
const DEVICE_CAPACITY_GB = newCount();
const LINKED_DEVICE_ID = newId();
const NEW_CONSOLE_NAME = newText();
const EDITED_CONSOLE_NAME = newText();
const EDITED_CONSOLE_CAPACITY_GB = newCount();
const EDITED_CONSOLE_BUFFER_GB = newCount();
const NEW_DEVICE_NAME = newText();
const NEW_DEVICE_CAPACITY_GB = newCount();
const EDITED_DEVICE_NAME = newText();
const EDITED_DEVICE_CAPACITY_GB = newCount();
const EDITED_DEVICE_BUFFER_GB = newCount();
const ROUTING_GENRES = [newText(), newText()];

function console_(overrides: Partial<ConsoleResponse> = {}): ConsoleResponse {
  return {
    console_id: CONSOLE_ID,
    name: CONSOLE_NAME,
    platform: ConsolePlatforms.ps5,
    raw_capacity_gb: CONSOLE_CAPACITY_GB,
    model: null,
    update_buffer_gb: 0,
    effective_capacity_gb: CONSOLE_CAPACITY_GB,
    routing_genres: [],
    fill_order: 0,
    capacity_is_default: false,
    device_link: null,
    ...overrides,
  };
}

function device(overrides: Partial<StorageDeviceResponse> = {}): StorageDeviceResponse {
  return {
    device_id: DEVICE_ID,
    console_id: null,
    name: DEVICE_NAME,
    kind: StorageKinds.m2,
    capacity_gb: DEVICE_CAPACITY_GB,
    buffer_gb: 0,
    effective_capacity_gb: DEVICE_CAPACITY_GB,
    ...overrides,
  };
}

interface ConsolesHarness {
  startCreatingConsole(): void;
  consoleName: { set(value: string): void };
  consolePlatform: { set(value: string): void };
  consoleCapacityGb: { set(value: number | null): void };
  createConsole(): void;
  startEditingConsole(console: ConsoleResponse): void;
  editConsoleName: { set(value: string): void };
  editConsoleCapacityGb: { set(value: number): void };
  editConsoleUpdateBufferGb: { set(value: number): void };
  editConsoleRoutingGenres: { set(value: string[]): void };
  editConsoleFillOrder: { set(value: number): void };
  saveConsole(consoleId: string): void;
  confirmDeleteConsole(consoleId: string): void;
  deleteConsole(consoleId: string): void;
  startCreatingDevice(): void;
  deviceName: { set(value: string): void };
  deviceKind: { set(value: string): void };
  deviceCapacityGb: { set(value: number | null): void };
  createDevice(): void;
  startEditingDevice(device: StorageDeviceResponse): void;
  editDeviceName: { set(value: string): void };
  editDeviceCapacityGb: { set(value: number): void };
  editDeviceBufferGb: { set(value: number): void };
  saveDevice(deviceId: string): void;
  startAttaching(deviceId: string): void;
  attachTargetConsoleId: { set(value: string | null): void };
  attachDevice(deviceId: string): void;
  detachDevice(deviceId: string): void;
  confirmDeleteDevice(deviceId: string): void;
  deleteDevice(deviceId: string): void;
}

function harness(fixture: ComponentFixture<ConsolesComponent>): ConsolesHarness {
  return fixture.componentInstance as unknown as ConsolesHarness;
}

describe('ConsolesComponent', () => {
  let httpMock: HttpTestingController;
  const routeData: { consoles: ConsolesPageData | null; genres: string[] } = { consoles: null, genres: [] };

  beforeEach(() => {
    routeData.consoles = { consoles: [], devices: [] };
    routeData.genres = [newText(), newText()];
    TestBed.configureTestingModule({
      imports: [ConsolesComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(consoles: ConsoleResponse[], devices: StorageDeviceResponse[]): ComponentFixture<ConsolesComponent> {
    routeData.consoles = { consoles, devices };
    const fixture = TestBed.createComponent(ConsolesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows empty states for consoles and storage devices', () => {
    const fixture = createAndLoad([], []);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#consoles-empty')).not.toBeNull();
    expect(compiled.querySelector('#devices-empty')).not.toBeNull();
  });

  it('says nothing about a PSN device link on a console that has none', () => {
    const fixture = createAndLoad([console_({ device_link: null })], []);

    expect((fixture.nativeElement as HTMLElement).querySelector('#console-device-link-0')).toBeNull();
  });

  it('names a healthy device link and offers the page that manages it', () => {
    const fixture = createAndLoad([console_({ device_link: { device_id: LINKED_DEVICE_ID, state: ConsoleDeviceLinkStates.linked } })], []);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#console-device-link-0')?.textContent).toContain(DEVICE_LINK_LABELS.linked);
    expect(compiled.querySelector('#console-device-link-account-0')?.getAttribute('href')).toBe(AppUrls.account);
  });

  it('reports a deactivated PSN device in words rather than as the raw state', () => {
    const state: ConsoleDeviceLinkState = ConsoleDeviceLinkStates.deviceDeactivated;
    const fixture = createAndLoad([console_({ device_link: { device_id: LINKED_DEVICE_ID, state } })], []);

    const rendered = (fixture.nativeElement as HTMLElement).querySelector('#console-device-link-0')?.textContent;
    expect(rendered).toContain(DEVICE_LINK_LABELS[state]);
    expect(rendered).not.toContain(state);
  });

  it('says a link went unchecked rather than claiming the device is gone', () => {
    const unchecked = createAndLoad(
      [console_({ device_link: { device_id: LINKED_DEVICE_ID, state: ConsoleDeviceLinkStates.notChecked } })],
      [],
    );
    expect((unchecked.nativeElement as HTMLElement).querySelector('#console-device-link-0')?.textContent).toContain(
      DEVICE_LINK_LABELS.not_checked,
    );

    const missing = createAndLoad([console_({ device_link: { device_id: LINKED_DEVICE_ID, state: ConsoleDeviceLinkStates.deviceMissing } })], []);
    expect((missing.nativeElement as HTMLElement).querySelector('#console-device-link-0')?.textContent).toContain(
      DEVICE_LINK_LABELS.device_missing,
    );
  });

  it('offers the route-resolved genres as routing-genre options', () => {
    const fixture = createAndLoad([], []);
    harness(fixture).startCreatingConsole();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('#consoleRoutingGenres');
    const labels = Array.from(select?.querySelectorAll('option') ?? []).map((option) => option.textContent?.trim());

    expect(labels).toEqual(routeData.genres);
  });

  it('offers every platform Curator accepts, not only PS5 and PS4', () => {
    const fixture = createAndLoad([], []);
    harness(fixture).startCreatingConsole();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('#consolePlatform');
    const labels = Array.from(select?.querySelectorAll('option') ?? []).map((option) => option.textContent?.trim());

    expect(labels).toEqual(CONSOLE_PLATFORM_OPTIONS);
  });

  it('creates a console on a legacy platform', () => {
    const platform = newMemberOf([
      ConsolePlatforms.ps3,
      ConsolePlatforms.psvita,
      ConsolePlatforms.psp,
      ConsolePlatforms.ps2,
      ConsolePlatforms.ps1,
    ]);
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();
    h.consoleName.set(NEW_CONSOLE_NAME);
    h.consolePlatform.set(platform);

    h.createConsole();

    const req = httpMock.expectOne(CuratorApi.consoles);
    expect(req.request.body).toEqual(expect.objectContaining({ name: NEW_CONSOLE_NAME, platform }));
    req.flush(console_({ console_id: newId(), name: NEW_CONSOLE_NAME, platform }));
  });

  it('answers a rejected platform with the platform message rather than the generic create error', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();
    h.consoleName.set(NEW_CONSOLE_NAME);

    h.createConsole();
    httpMock
      .expectOne(CuratorApi.consoles)
      .flush(null, { status: HttpStatusCode.BadRequest, statusText: HttpStatusCode[HttpStatusCode.BadRequest] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#console-form-error')?.textContent?.trim()).toBe(
      CONSOLE_PLATFORM_ERROR,
    );
  });

  it('lists consoles and storage devices with derived usable capacity', () => {
    const fixture = createAndLoad([console_()], [device({ console_id: CONSOLE_ID })]);
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(CONSOLE_NAME);
    expect(text).toContain(`${CONSOLE_CAPACITY_GB} GB usable of ${CONSOLE_CAPACITY_GB} GB`);
    expect(text).toContain(DEVICE_NAME);
    expect(text).toContain(`Attached to ${CONSOLE_NAME}`);
  });

  it('creates a console and flags an auto-assigned default capacity', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();
    h.consoleName.set(NEW_CONSOLE_NAME);
    fixture.detectChanges();

    h.createConsole();
    const req = httpMock.expectOne(CuratorApi.consoles);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(
      expect.objectContaining({ name: NEW_CONSOLE_NAME, platform: ConsolePlatforms.ps5, raw_capacity_gb: null }),
    );
    const created = console_({ console_id: newId(), name: NEW_CONSOLE_NAME, capacity_is_default: true });
    req.flush(created);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(NEW_CONSOLE_NAME);
    expect(compiled.querySelector('#console-default-capacity-note')?.textContent?.trim()).toBe(defaultCapacityNoteFor(created));
  });

  it('shows a validation error and makes no request when the console name is blank', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();

    h.createConsole();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(CONSOLE_NAME_REQUIRED_ERROR);
    httpMock.expectNone(CuratorApi.consoles);
  });

  it('edits a console via PATCH', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.startEditingConsole(console_());
    h.editConsoleName.set(EDITED_CONSOLE_NAME);
    h.editConsoleCapacityGb.set(EDITED_CONSOLE_CAPACITY_GB);
    h.editConsoleUpdateBufferGb.set(EDITED_CONSOLE_BUFFER_GB);
    h.editConsoleRoutingGenres.set(ROUTING_GENRES);
    h.editConsoleFillOrder.set(1);

    h.saveConsole(CONSOLE_ID);
    const req = httpMock.expectOne(CuratorApi.consolesByConsoleId(CONSOLE_ID));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.body).toEqual({
      name: EDITED_CONSOLE_NAME,
      raw_capacity_gb: EDITED_CONSOLE_CAPACITY_GB,
      update_buffer_gb: EDITED_CONSOLE_BUFFER_GB,
      routing_genres: ROUTING_GENRES,
      fill_order: 1,
    });
    req.flush(console_({ name: EDITED_CONSOLE_NAME, raw_capacity_gb: EDITED_CONSOLE_CAPACITY_GB }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(EDITED_CONSOLE_NAME);
  });

  it('deletes a console and refreshes the storage-device list (a device may have just been detached)', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.confirmDeleteConsole(CONSOLE_ID);
    h.deleteConsole(CONSOLE_ID);

    httpMock.expectOne({ url: CuratorApi.consolesByConsoleId(CONSOLE_ID), method: HttpMethods.delete }).flush(null);
    httpMock.expectOne(CuratorApi.storageDevices).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#consoles-empty')).not.toBeNull();
  });

  it('creates a storage device', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.startCreatingDevice();
    h.deviceName.set(NEW_DEVICE_NAME);
    h.deviceKind.set(StorageKinds.usb);
    h.deviceCapacityGb.set(NEW_DEVICE_CAPACITY_GB);
    fixture.detectChanges();

    h.createDevice();
    const req = httpMock.expectOne(CuratorApi.storageDevices);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(
      expect.objectContaining({ name: NEW_DEVICE_NAME, kind: StorageKinds.usb, capacity_gb: NEW_DEVICE_CAPACITY_GB }),
    );
    req.flush(device({ device_id: newId(), name: NEW_DEVICE_NAME, kind: StorageKinds.usb, capacity_gb: NEW_DEVICE_CAPACITY_GB }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(NEW_DEVICE_NAME);
  });

  it('shows a validation error and makes no request when the device capacity is missing', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingDevice();
    h.deviceName.set(NEW_DEVICE_NAME);

    h.createDevice();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(DEVICE_CAPACITY_REQUIRED_ERROR);
    httpMock.expectNone(CuratorApi.storageDevices);
  });

  it('edits a storage device via PATCH', () => {
    const fixture = createAndLoad([], [device()]);
    const h = harness(fixture);
    h.startEditingDevice(device());
    h.editDeviceName.set(EDITED_DEVICE_NAME);
    h.editDeviceCapacityGb.set(EDITED_DEVICE_CAPACITY_GB);
    h.editDeviceBufferGb.set(EDITED_DEVICE_BUFFER_GB);

    h.saveDevice(DEVICE_ID);
    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceId(DEVICE_ID));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.body).toEqual({ name: EDITED_DEVICE_NAME, capacity_gb: EDITED_DEVICE_CAPACITY_GB, buffer_gb: EDITED_DEVICE_BUFFER_GB });
    req.flush(device({ name: EDITED_DEVICE_NAME, capacity_gb: EDITED_DEVICE_CAPACITY_GB }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(EDITED_DEVICE_NAME);
  });

  it('attaches a storage device to a console', () => {
    const fixture = createAndLoad([console_()], [device()]);
    const h = harness(fixture);
    h.startAttaching(DEVICE_ID);
    h.attachTargetConsoleId.set(CONSOLE_ID);

    h.attachDevice(DEVICE_ID);
    const req = httpMock.expectOne({ url: CuratorApi.storageDevicesByDeviceIdAttachByConsoleId(DEVICE_ID, CONSOLE_ID), method: HttpMethods.put });
    req.flush(device({ console_id: CONSOLE_ID }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`Attached to ${CONSOLE_NAME}`);
  });

  it('detaches a storage device from its console', () => {
    const fixture = createAndLoad([console_()], [device({ console_id: CONSOLE_ID })]);
    const h = harness(fixture);
    h.detachDevice(DEVICE_ID);

    const req = httpMock.expectOne({ url: CuratorApi.storageDevicesByDeviceIdAttach(DEVICE_ID), method: HttpMethods.delete });
    req.flush(device({ console_id: null }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#device-attachment-0')?.hasAttribute('data-console-id')).toBe(false);
  });

  it('deletes a storage device', () => {
    const fixture = createAndLoad([], [device()]);
    const h = harness(fixture);
    h.confirmDeleteDevice(DEVICE_ID);
    h.deleteDevice(DEVICE_ID);

    httpMock.expectOne({ url: CuratorApi.storageDevicesByDeviceId(DEVICE_ID), method: HttpMethods.delete }).flush(null);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#devices-empty')).not.toBeNull();
  });
});
