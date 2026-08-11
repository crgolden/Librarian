import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ConsolesComponent } from './consoles.component';
import { ConsolesPageData } from './consoles.resolver';
import { ConsoleResponse, StorageDeviceResponse } from '../curator/curator.models';

function console_(overrides: Partial<ConsoleResponse> = {}): ConsoleResponse {
  return {
    console_id: 'c1',
    name: 'Living room PS5',
    platform: 'PS5',
    raw_capacity_gb: 825,
    model: null,
    update_buffer_gb: 0,
    effective_capacity_gb: 825,
    routing_genres: [],
    fill_order: 0,
    capacity_is_default: false,
    ...overrides,
  };
}

function device(overrides: Partial<StorageDeviceResponse> = {}): StorageDeviceResponse {
  return {
    device_id: 'sd1',
    console_id: null,
    name: 'Samsung T7',
    kind: 'm2',
    capacity_gb: 1000,
    buffer_gb: 0,
    effective_capacity_gb: 1000,
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
  editConsoleRoutingGenres: { set(value: string): void };
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
  attachTargetConsoleId: { set(value: string): void };
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
  const routeData: { consoles: ConsolesPageData | null } = { consoles: null };

  beforeEach(() => {
    routeData.consoles = { consoles: [], devices: [] };
    TestBed.configureTestingModule({
      imports: [ConsolesComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Both lists now arrive from the route resolver, so the page starts fully rendered. */
  function createAndLoad(consoles: ConsoleResponse[], devices: StorageDeviceResponse[]): ComponentFixture<ConsolesComponent> {
    routeData.consoles = { consoles, devices };
    const fixture = TestBed.createComponent(ConsolesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows empty states for consoles and storage devices', () => {
    const fixture = createAndLoad([], []);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No consoles yet.');
    expect(text).toContain('No storage devices yet.');
  });

  it('lists consoles and storage devices with derived usable capacity', () => {
    const fixture = createAndLoad([console_()], [device({ console_id: 'c1' })]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Living room PS5');
    expect(text).toContain('825 GB usable of 825 GB');
    expect(text).toContain('Samsung T7');
    expect(text).toContain('Attached to Living room PS5');
  });

  it('creates a console and flags an auto-assigned default capacity', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();
    h.consoleName.set('New PS5');
    fixture.detectChanges();

    h.createConsole();
    const req = httpMock.expectOne('/curator/api/consoles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({ name: 'New PS5', platform: 'PS5', raw_capacity_gb: null }),
    );
    req.flush(console_({ console_id: 'c2', name: 'New PS5', capacity_is_default: true }));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('New PS5');
    expect(text).toContain('We guessed');
  });

  it('shows a validation error and makes no request when the console name is blank', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingConsole();

    h.createConsole();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a name for this console.');
    httpMock.expectNone('/curator/api/consoles');
  });

  it('edits a console via PATCH', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.startEditingConsole(console_());
    h.editConsoleName.set('Bedroom PS5');
    h.editConsoleCapacityGb.set(700);
    h.editConsoleUpdateBufferGb.set(10);
    h.editConsoleRoutingGenres.set('RPG, Action');
    h.editConsoleFillOrder.set(1);

    h.saveConsole('c1');
    const req = httpMock.expectOne('/curator/api/consoles/c1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: 'Bedroom PS5',
      raw_capacity_gb: 700,
      update_buffer_gb: 10,
      routing_genres: ['RPG', 'Action'],
      fill_order: 1,
    });
    req.flush(console_({ name: 'Bedroom PS5', raw_capacity_gb: 700 }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bedroom PS5');
  });

  it('deletes a console and refreshes the storage-device list (a device may have just been detached)', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.confirmDeleteConsole('c1');
    h.deleteConsole('c1');

    httpMock.expectOne({ url: '/curator/api/consoles/c1', method: 'DELETE' }).flush(null);
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No consoles yet.');
  });

  it('creates a storage device', () => {
    const fixture = createAndLoad([console_()], []);
    const h = harness(fixture);
    h.startCreatingDevice();
    h.deviceName.set('USB Drive');
    h.deviceKind.set('usb');
    h.deviceCapacityGb.set(500);
    fixture.detectChanges();

    h.createDevice();
    const req = httpMock.expectOne('/curator/api/storage-devices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({ name: 'USB Drive', kind: 'usb', capacity_gb: 500 }),
    );
    req.flush(device({ device_id: 'sd2', name: 'USB Drive', kind: 'usb', capacity_gb: 500 }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('USB Drive');
  });

  it('shows a validation error and makes no request when the device capacity is missing', () => {
    const fixture = createAndLoad([], []);
    const h = harness(fixture);
    h.startCreatingDevice();
    h.deviceName.set('USB Drive');

    h.createDevice();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Enter this device's capacity in GB.");
    httpMock.expectNone('/curator/api/storage-devices');
  });

  it('edits a storage device via PATCH', () => {
    const fixture = createAndLoad([], [device()]);
    const h = harness(fixture);
    h.startEditingDevice(device());
    h.editDeviceName.set('Renamed drive');
    h.editDeviceCapacityGb.set(2000);
    h.editDeviceBufferGb.set(50);

    h.saveDevice('sd1');
    const req = httpMock.expectOne('/curator/api/storage-devices/sd1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Renamed drive', capacity_gb: 2000, buffer_gb: 50 });
    req.flush(device({ name: 'Renamed drive', capacity_gb: 2000 }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Renamed drive');
  });

  it('attaches a storage device to a console', () => {
    const fixture = createAndLoad([console_()], [device()]);
    const h = harness(fixture);
    h.startAttaching('sd1');
    h.attachTargetConsoleId.set('c1');

    h.attachDevice('sd1');
    const req = httpMock.expectOne({ url: '/curator/api/storage-devices/sd1/attach/c1', method: 'PUT' });
    req.flush(device({ console_id: 'c1' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Attached to Living room PS5');
  });

  it('detaches a storage device from its console', () => {
    const fixture = createAndLoad([console_()], [device({ console_id: 'c1' })]);
    const h = harness(fixture);
    h.detachDevice('sd1');

    const req = httpMock.expectOne({ url: '/curator/api/storage-devices/sd1/attach', method: 'DELETE' });
    req.flush(device({ console_id: null }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not attached');
  });

  it('deletes a storage device', () => {
    const fixture = createAndLoad([], [device()]);
    const h = harness(fixture);
    h.confirmDeleteDevice('sd1');
    h.deleteDevice('sd1');

    httpMock.expectOne({ url: '/curator/api/storage-devices/sd1', method: 'DELETE' }).flush(null);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No storage devices yet.');
  });
});
