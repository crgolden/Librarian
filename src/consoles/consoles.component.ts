import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuratorService } from '../curator/curator.service';
import { ConsoleResponse, StorageDeviceResponse } from '../curator/curator.models';

type ConsolePlatform = 'PS5' | 'PS4';
type StorageKind = 'm2' | 'usb';

/** `/consoles` — CRUD for the caller's own consoles and swappable storage devices (WP3). Feeds the
 * console picker on the collections "capacity fill" form and hydrates/edits the per-console and
 * per-device install worklists that `capacity_fill` collections size against. */
@Component({
  selector: 'app-consoles',
  imports: [FormsModule],
  templateUrl: './consoles.component.html',
  styleUrl: './consoles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsolesComponent implements OnInit {
  private readonly curator = inject(CuratorService);

  // Consoles
  protected readonly consoles = signal<ConsoleResponse[]>([]);
  protected readonly consolesLoading = signal(true);
  protected readonly consolesError = signal<string | null>(null);

  protected readonly showConsoleForm = signal(false);
  protected readonly consoleName = signal('');
  protected readonly consolePlatform = signal<ConsolePlatform>('PS5');
  protected readonly consoleModel = signal('');
  protected readonly consoleCapacityGb = signal<number | null>(null);
  protected readonly consoleUpdateBufferGb = signal(0);
  protected readonly consoleRoutingGenres = signal('');
  protected readonly consoleFillOrder = signal(0);
  protected readonly creatingConsole = signal(false);
  protected readonly consoleFormError = signal<string | null>(null);
  protected readonly defaultCapacityNote = signal<string | null>(null);

  protected readonly editingConsoleId = signal<string | null>(null);
  protected readonly editConsoleName = signal('');
  protected readonly editConsoleCapacityGb = signal(0);
  protected readonly editConsoleUpdateBufferGb = signal(0);
  protected readonly editConsoleRoutingGenres = signal('');
  protected readonly editConsoleFillOrder = signal(0);
  protected readonly savingConsoleId = signal<string | null>(null);
  protected readonly consoleEditError = signal<string | null>(null);

  protected readonly confirmingDeleteConsoleId = signal<string | null>(null);
  protected readonly deletingConsoleId = signal<string | null>(null);

  // Storage devices
  protected readonly devices = signal<StorageDeviceResponse[]>([]);
  protected readonly devicesLoading = signal(true);
  protected readonly devicesError = signal<string | null>(null);

  protected readonly showDeviceForm = signal(false);
  protected readonly deviceName = signal('');
  protected readonly deviceKind = signal<StorageKind>('m2');
  protected readonly deviceCapacityGb = signal<number | null>(null);
  protected readonly deviceBufferGb = signal(0);
  protected readonly deviceConsoleId = signal('');
  protected readonly creatingDevice = signal(false);
  protected readonly deviceFormError = signal<string | null>(null);

  protected readonly editingDeviceId = signal<string | null>(null);
  protected readonly editDeviceName = signal('');
  protected readonly editDeviceCapacityGb = signal(0);
  protected readonly editDeviceBufferGb = signal(0);
  protected readonly savingDeviceId = signal<string | null>(null);
  protected readonly deviceEditError = signal<string | null>(null);

  protected readonly attachingDeviceId = signal<string | null>(null);
  protected readonly attachTargetConsoleId = signal<string>('');
  protected readonly attachError = signal<string | null>(null);

  protected readonly confirmingDeleteDeviceId = signal<string | null>(null);
  protected readonly deletingDeviceId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadConsoles();
    this.loadDevices();
  }

  private loadConsoles(): void {
    this.consolesLoading.set(true);
    this.consolesError.set(null);
    this.curator.listConsoles().subscribe({
      next: (consoles) => {
        this.consoles.set(consoles);
        this.consolesLoading.set(false);
      },
      error: () => {
        this.consolesError.set('Unable to load your consoles.');
        this.consolesLoading.set(false);
      },
    });
  }

  private loadDevices(): void {
    this.devicesLoading.set(true);
    this.devicesError.set(null);
    this.curator.listStorageDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.devicesLoading.set(false);
      },
      error: () => {
        this.devicesError.set('Unable to load your storage devices.');
        this.devicesLoading.set(false);
      },
    });
  }

  protected consoleLabel(consoleId: string): string {
    return this.consoles().find((console) => console.console_id === consoleId)?.name ?? 'Unknown console';
  }

  // ── Consoles ──────────────────────────────────────────────────────────────

  protected startCreatingConsole(): void {
    this.consoleName.set('');
    this.consolePlatform.set('PS5');
    this.consoleModel.set('');
    this.consoleCapacityGb.set(null);
    this.consoleUpdateBufferGb.set(0);
    this.consoleRoutingGenres.set('');
    this.consoleFillOrder.set(0);
    this.consoleFormError.set(null);
    this.defaultCapacityNote.set(null);
    this.showConsoleForm.set(true);
  }

  protected cancelCreatingConsole(): void {
    this.showConsoleForm.set(false);
  }

  protected createConsole(): void {
    const trimmedName = this.consoleName().trim();
    if (!trimmedName) {
      this.consoleFormError.set('Enter a name for this console.');
      return;
    }

    this.creatingConsole.set(true);
    this.consoleFormError.set(null);
    this.curator
      .createConsole({
        name: trimmedName,
        platform: this.consolePlatform(),
        raw_capacity_gb: this.consoleCapacityGb(),
        model: this.consoleModel().trim() || null,
        update_buffer_gb: this.consoleUpdateBufferGb(),
        routing_genres: this.consoleRoutingGenres()
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        fill_order: this.consoleFillOrder(),
      })
      .subscribe({
        next: (console) => {
          this.creatingConsole.set(false);
          this.showConsoleForm.set(false);
          this.consoles.update((consoles) => [...consoles, console]);
          if (console.capacity_is_default) {
            this.defaultCapacityNote.set(
              `We guessed ${console.raw_capacity_gb} GB for "${console.name}" from its platform/model — edit it below if that's wrong.`,
            );
          }
        },
        error: (err: HttpErrorResponse) => {
          this.creatingConsole.set(false);
          this.consoleFormError.set(err.status === 400 ? 'platform must be "PS5" or "PS4".' : 'Unable to create this console.');
        },
      });
  }

  protected startEditingConsole(console: ConsoleResponse): void {
    this.editingConsoleId.set(console.console_id);
    this.editConsoleName.set(console.name);
    this.editConsoleCapacityGb.set(console.raw_capacity_gb);
    this.editConsoleUpdateBufferGb.set(console.update_buffer_gb);
    this.editConsoleRoutingGenres.set(console.routing_genres.join(', '));
    this.editConsoleFillOrder.set(console.fill_order);
    this.consoleEditError.set(null);
  }

  protected cancelEditingConsole(): void {
    this.editingConsoleId.set(null);
  }

  protected saveConsole(consoleId: string): void {
    const trimmedName = this.editConsoleName().trim();
    if (!trimmedName) {
      this.consoleEditError.set('Enter a name for this console.');
      return;
    }

    this.savingConsoleId.set(consoleId);
    this.consoleEditError.set(null);
    this.curator
      .updateConsole(consoleId, {
        name: trimmedName,
        raw_capacity_gb: this.editConsoleCapacityGb(),
        update_buffer_gb: this.editConsoleUpdateBufferGb(),
        routing_genres: this.editConsoleRoutingGenres()
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        fill_order: this.editConsoleFillOrder(),
      })
      .subscribe({
        next: (updated) => {
          this.savingConsoleId.set(null);
          this.editingConsoleId.set(null);
          this.consoles.update((consoles) => consoles.map((console) => (console.console_id === consoleId ? updated : console)));
        },
        error: () => {
          this.savingConsoleId.set(null);
          this.consoleEditError.set('Unable to update this console.');
        },
      });
  }

  protected confirmDeleteConsole(consoleId: string): void {
    this.confirmingDeleteConsoleId.set(consoleId);
  }

  protected cancelDeleteConsole(): void {
    this.confirmingDeleteConsoleId.set(null);
  }

  protected deleteConsole(consoleId: string): void {
    this.deletingConsoleId.set(consoleId);
    this.curator.deleteConsole(consoleId).subscribe({
      next: () => {
        this.deletingConsoleId.set(null);
        this.confirmingDeleteConsoleId.set(null);
        this.consoles.update((consoles) => consoles.filter((console) => console.console_id !== consoleId));
        this.loadDevices();
      },
      error: () => {
        this.deletingConsoleId.set(null);
        this.consolesError.set('Unable to delete this console.');
      },
    });
  }

  // ── Storage devices ──────────────────────────────────────────────────────

  protected startCreatingDevice(): void {
    this.deviceName.set('');
    this.deviceKind.set('m2');
    this.deviceCapacityGb.set(null);
    this.deviceBufferGb.set(0);
    this.deviceConsoleId.set('');
    this.deviceFormError.set(null);
    this.showDeviceForm.set(true);
  }

  protected cancelCreatingDevice(): void {
    this.showDeviceForm.set(false);
  }

  protected createDevice(): void {
    const trimmedName = this.deviceName().trim();
    const capacityGb = this.deviceCapacityGb();
    if (!trimmedName) {
      this.deviceFormError.set('Enter a name for this device.');
      return;
    }
    if (capacityGb === null || capacityGb <= 0) {
      this.deviceFormError.set('Enter this device\'s capacity in GB.');
      return;
    }

    this.creatingDevice.set(true);
    this.deviceFormError.set(null);
    this.curator
      .createStorageDevice({
        name: trimmedName,
        kind: this.deviceKind(),
        capacity_gb: capacityGb,
        buffer_gb: this.deviceBufferGb(),
        console_id: this.deviceConsoleId() || null,
      })
      .subscribe({
        next: (device) => {
          this.creatingDevice.set(false);
          this.showDeviceForm.set(false);
          this.devices.update((devices) => [...devices, device]);
        },
        error: (err: HttpErrorResponse) => {
          this.creatingDevice.set(false);
          this.deviceFormError.set(err.status === 400 ? 'kind must be "m2" or "usb".' : 'Unable to create this device.');
        },
      });
  }

  protected startEditingDevice(device: StorageDeviceResponse): void {
    this.editingDeviceId.set(device.device_id);
    this.editDeviceName.set(device.name);
    this.editDeviceCapacityGb.set(device.capacity_gb);
    this.editDeviceBufferGb.set(device.buffer_gb);
    this.deviceEditError.set(null);
  }

  protected cancelEditingDevice(): void {
    this.editingDeviceId.set(null);
  }

  protected saveDevice(deviceId: string): void {
    const trimmedName = this.editDeviceName().trim();
    if (!trimmedName) {
      this.deviceEditError.set('Enter a name for this device.');
      return;
    }

    this.savingDeviceId.set(deviceId);
    this.deviceEditError.set(null);
    this.curator
      .updateStorageDevice(deviceId, {
        name: trimmedName,
        capacity_gb: this.editDeviceCapacityGb(),
        buffer_gb: this.editDeviceBufferGb(),
      })
      .subscribe({
        next: (updated) => {
          this.savingDeviceId.set(null);
          this.editingDeviceId.set(null);
          this.devices.update((devices) => devices.map((device) => (device.device_id === deviceId ? updated : device)));
        },
        error: () => {
          this.savingDeviceId.set(null);
          this.deviceEditError.set('Unable to update this device.');
        },
      });
  }

  protected startAttaching(deviceId: string): void {
    this.attachingDeviceId.set(deviceId);
    this.attachTargetConsoleId.set('');
    this.attachError.set(null);
  }

  protected cancelAttaching(): void {
    this.attachingDeviceId.set(null);
  }

  protected attachDevice(deviceId: string): void {
    const consoleId = this.attachTargetConsoleId();
    if (!consoleId) {
      this.attachError.set('Choose a console to attach this device to.');
      return;
    }
    this.curator.attachStorageDevice(deviceId, consoleId).subscribe({
      next: (updated) => {
        this.attachingDeviceId.set(null);
        this.devices.update((devices) => devices.map((device) => (device.device_id === deviceId ? updated : device)));
      },
      error: () => this.attachError.set('Unable to attach this device.'),
    });
  }

  protected detachDevice(deviceId: string): void {
    this.curator.detachStorageDevice(deviceId).subscribe({
      next: (updated) => {
        this.devices.update((devices) => devices.map((device) => (device.device_id === deviceId ? updated : device)));
      },
      error: () => this.devicesError.set('Unable to detach this device.'),
    });
  }

  protected confirmDeleteDevice(deviceId: string): void {
    this.confirmingDeleteDeviceId.set(deviceId);
  }

  protected cancelDeleteDevice(): void {
    this.confirmingDeleteDeviceId.set(null);
  }

  protected deleteDevice(deviceId: string): void {
    this.deletingDeviceId.set(deviceId);
    this.curator.deleteStorageDevice(deviceId).subscribe({
      next: () => {
        this.deletingDeviceId.set(null);
        this.confirmingDeleteDeviceId.set(null);
        this.devices.update((devices) => devices.filter((device) => device.device_id !== deviceId));
      },
      error: () => {
        this.deletingDeviceId.set(null);
        this.devicesError.set('Unable to delete this device.');
      },
    });
  }
}
