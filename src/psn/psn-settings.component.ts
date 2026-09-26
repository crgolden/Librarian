import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonGhostDangerDirective,
  ButtonGhostDirective,
  ButtonGhostSmallDirective,
  ButtonPrimaryDirective,
  ButtonPrimarySmallDirective,
  CardDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
import { catchError, finalize, Observable, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { MeService } from '../curator/me.service';
import {
  AccountActionResponse,
  ConsoleResponse,
  FriendRequestResponse,
  DeviceResponse,
  DevicesResponse,
  EnrichmentKeyStatusResponse,
  IdentityResponse,
  PresenceResponse,
  PsnPreferencesResponse,
  RefreshCadence,
  PsnPreferenceKeys,
  RefreshCadences,
  RefreshScheduleResponse,
  TrophySummaryResponse,
} from '../curator/curator.models';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { CatalogMetaDirective, CatalogTitleDirective, SpineLabelDirective } from '../shared/primitives/typography';
import { PsnStatus, ResolvedPsnStatus } from './psn-status.resolver';
import { CuratorApi } from '../curator/curator-api';
import { AppUrls, RouteDataKeys } from '../app/app-paths';
import {
  ACCOUNT_DELETE_ERROR,
  ACTION_HISTORY_FILE_NAME,
  ACCOUNT_CHANGES_MESSAGE,
  ACTION_HISTORY_LOAD_ERROR,
  CHAT_WRITES_DISCLOSURE,
  DEVICE_LINK_CONSOLE_REQUIRED_ERROR,
  DEVICE_LINK_PLACEHOLDER,
  FRIEND_WRITES_DISCLOSURE,
  GENERIC_LINK_ERROR_MESSAGE,
  RAWG_KEY_SAVE_ERROR,
  REFRESH_CADENCE_LABELS,
  SCHEDULE_COST_MESSAGE,
  SCHEDULE_PAUSED_FALLBACK_LABEL,
  SCHEDULE_PAUSED_LABELS,
  LINK_ERROR_MESSAGES,
  LINK_STATUS_LOAD_ERROR,
  NPSSO_LENGTH,
  npssoLengthError,
  NPSSO_REQUIRED_ERROR,
  PREFERENCE_UPDATE_ERROR,
  PSN_LINKED_MESSAGE,
  PSN_UNLINKED_MESSAGE,
  PSN_UNLINK_ERROR,
  RAWG_KEY_REQUIRED_ERROR,
} from './psn-settings.messages';
import { ContentTypes } from '../shared/content-types';

type MeResponse = PsnStatus;

function extractErrorDetail(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse) || typeof err.error !== 'object' || err.error === null) {
    return null;
  }
  const detail: unknown = (err.error as Record<string, unknown>)['detail'];
  return typeof detail === 'string' ? detail : null;
}

function linkErrorMessage(err: HttpErrorResponse): string {
  const code = (err.error as { detail?: { error?: string } } | null)?.detail?.error;
  return (code ? LINK_ERROR_MESSAGES[code] : undefined) ?? GENERIC_LINK_ERROR_MESSAGE;
}

@Component({
  selector: 'app-psn-settings',
  imports: [
    FormsModule,
    DatePipe,
    LoadingOverlayComponent,
    RouterLink,
    ButtonGhostDangerDirective,
    ButtonGhostDirective,
    ButtonGhostSmallDirective,
    ButtonPrimaryDirective,
    ButtonPrimarySmallDirective,
    CardDirective,
    PageSectionDirective,
    CatalogMetaDirective,
    CatalogTitleDirective,
    SpineLabelDirective,
  ],
  templateUrl: './psn-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsnSettingsComponent implements OnInit {
  protected readonly appUrls = AppUrls;
  protected readonly cadenceOptions = Object.values(RefreshCadences);
  protected readonly cadenceLabels = REFRESH_CADENCE_LABELS;
  protected readonly scheduleCostMessage = SCHEDULE_COST_MESSAGE;
  protected readonly accountChangesMessage = ACCOUNT_CHANGES_MESSAGE;
  protected readonly friendWritesDisclosure = FRIEND_WRITES_DISCLOSURE;
  protected readonly chatWritesDisclosure = CHAT_WRITES_DISCLOSURE;
  protected readonly deviceLinkPlaceholder = DEVICE_LINK_PLACEHOLDER;
  protected readonly psnPreferenceKeys = PsnPreferenceKeys;

  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly curator = inject(CuratorService);
  private readonly me = inject(MeService);

  protected readonly npsso = signal('');
  protected readonly linked = signal(false);
  protected readonly accessTokenExpiresAt = signal<string | null>(null);
  protected readonly refreshTokenExpiresAt = signal<string | null>(null);
  protected readonly linking = signal(false);
  protected readonly unlinking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly confirmingDelete = signal(false);
  protected readonly deletingAccount = signal(false);
  protected readonly deleted = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly actions = signal<AccountActionResponse[] | null>(null);
  protected readonly actionsLoading = signal(false);
  protected readonly actionsError = signal<string | null>(null);

  protected readonly preferences = signal<PsnPreferencesResponse | null>(null);
  protected readonly preferencesError = signal<string | null>(null);
  protected readonly savingPreference = signal<keyof PsnPreferencesResponse | null>(null);

  protected readonly trophySummary = signal<TrophySummaryResponse | null>(null);
  protected readonly trophySummaryLoading = signal(false);
  protected readonly trophySummaryError = signal<string | null>(null);

  protected readonly identity = signal<IdentityResponse | null>(null);
  protected readonly identityLoading = signal(false);
  protected readonly identityError = signal<string | null>(null);

  protected readonly friendRequests = signal<FriendRequestResponse[] | null>(null);
  protected readonly friendRequestsError = signal<string | null>(null);
  protected readonly friendRequestPending = signal<string | null>(null);
  protected readonly friendRequestAccepted = signal<string | null>(null);

  protected readonly presence = signal<PresenceResponse | null>(null);
  protected readonly presenceLoading = signal(false);
  protected readonly presenceError = signal<string | null>(null);

  protected readonly devices = signal<DevicesResponse | null>(null);
  protected readonly devicesLoading = signal(false);
  protected readonly devicesError = signal<string | null>(null);

  protected readonly consoles = signal<ConsoleResponse[]>([]);
  protected readonly deviceLinkPending = signal<string | null>(null);
  protected readonly deviceLinkError = signal<string | null>(null);
  protected readonly linkingDeviceId = signal<string | null>(null);
  protected readonly linkTargetConsoleId = signal<string | null>(null);

  protected readonly schedule = signal<RefreshScheduleResponse | null>(null);
  protected readonly scheduleError = signal<string | null>(null);
  protected readonly scheduleSaving = signal(false);
  protected readonly scheduleCadence = signal<RefreshCadence>(RefreshCadences.weekly);
  protected readonly schedulePsPlusWatch = signal(false);

  protected readonly enrichmentKeyStatus = signal<EnrichmentKeyStatusResponse | null>(null);
  protected readonly enrichmentKeyStatusError = signal<string | null>(null);

  protected readonly rawgKeyInput = signal('');
  protected readonly settingRawgKey = signal(false);
  protected readonly deletingRawgKey = signal(false);
  protected readonly rawgKeyError = signal<string | null>(null);

  protected readonly opencriticKeyInput = signal('');
  protected readonly settingOpencriticKey = signal(false);
  protected readonly deletingOpencriticKey = signal(false);
  protected readonly opencriticKeyError = signal<string | null>(null);

  protected readonly noRefreshToken = computed(
    () => this.linked() && this.accessTokenExpiresAt() !== null && this.refreshTokenExpiresAt() === null,
  );

  protected readonly overlayVisible = computed(
    () =>
      this.linking() ||
      this.unlinking() ||
      this.deletingAccount() ||
      this.savingPreference() !== null ||
      this.settingRawgKey() ||
      this.deletingRawgKey() ||
      this.settingOpencriticKey() ||
      this.deletingOpencriticKey(),
  );

  ngOnInit(): void {
    const resolved = this.route.snapshot.data[RouteDataKeys.status] as ResolvedPsnStatus;
    if (resolved.status === null) {
      this.error.set(LINK_STATUS_LOAD_ERROR);
      return;
    }
    this.enrichmentKeyStatus.set(resolved.enrichmentKeys);
    if (resolved.schedule !== null) {
      this.applySchedule(resolved.schedule);
    }
    this.applyStatus(resolved.status);
    this.preferences.set(resolved.preferences);
    this.trophySummary.set(resolved.trophySummary);
    this.identity.set(resolved.identity);
    this.friendRequests.set(resolved.friendRequests ?? []);
    this.presence.set(resolved.presence);
    this.devices.set(resolved.devices);
    this.consoles.set(resolved.consoles);
  }

  private applyStatus(me: MeResponse): void {
    this.linked.set(me.linked);
    this.accessTokenExpiresAt.set(me.psn?.access_token_expires_at ?? null);
    this.refreshTokenExpiresAt.set(me.psn?.refresh_token_expires_at ?? null);
  }

  private applySchedule(schedule: RefreshScheduleResponse): void {
    this.schedule.set(schedule);
    this.scheduleCadence.set(schedule.cadence);
    this.schedulePsPlusWatch.set(schedule.ps_plus_watch);
  }

  protected saveSchedule(): void {
    this.scheduleSaving.set(true);
    this.scheduleError.set(null);
    this.curator
      .setRefreshSchedule({ cadence: this.scheduleCadence(), ps_plus_watch: this.schedulePsPlusWatch() })
      .subscribe({
        next: (schedule) => {
          this.applySchedule(schedule);
          this.scheduleSaving.set(false);
        },
        error: () => {
          this.scheduleError.set('Unable to save your refresh schedule.');
          this.scheduleSaving.set(false);
        },
      });
  }

  protected cancelSchedule(): void {
    this.scheduleSaving.set(true);
    this.scheduleError.set(null);
    this.curator.deleteRefreshSchedule().subscribe({
      next: () => {
        this.schedule.set(null);
        this.scheduleSaving.set(false);
      },
      error: () => {
        this.scheduleError.set('Unable to cancel your refresh schedule.');
        this.scheduleSaving.set(false);
      },
    });
  }

  protected pausedReasonLabel(reason: string): string {
    return SCHEDULE_PAUSED_LABELS[reason] ?? SCHEDULE_PAUSED_FALLBACK_LABEL;
  }

  private loadEnrichmentKeyStatus(): void {
    this.enrichmentKeyStatusError.set(null);
    this.curator.getEnrichmentKeyStatus().subscribe({
      next: (status) => this.enrichmentKeyStatus.set(status),
      error: () => this.enrichmentKeyStatusError.set('Unable to load enrichment key status.'),
    });
  }

  private reloadStatus(): Observable<MeResponse | null> {
    this.me.invalidate();
    return this.http.get<MeResponse>(CuratorApi.me).pipe(
      catchError(() => {
        this.error.set(LINK_STATUS_LOAD_ERROR);
        return of(null);
      }),
    );
  }

  private applyReloadedStatus(me: MeResponse | null): void {
    if (me === null) {
      return;
    }
    this.applyStatus(me);
    if (me.linked) {
      this.loadPreferences();
    }
  }

  private loadPreferences(): void {
    this.preferencesError.set(null);
    this.curator.getPsnPreferences().subscribe({
      next: (prefs) => {
        this.preferences.set(prefs);
        if (prefs.harvest_trophies) {
          this.loadTrophySummary();
        }
        if (prefs.harvest_identity) {
          this.loadIdentity();
          this.loadFriendRequests();
        }
        if (prefs.harvest_presence) {
          this.loadPresence();
        }
        if (prefs.harvest_devices) {
          this.loadDevices();
        }
      },
      error: () => {
        this.preferences.set(null);
      },
    });
  }

  private loadTrophySummary(): void {
    this.trophySummaryLoading.set(true);
    this.trophySummaryError.set(null);
    this.curator.getTrophySummary().subscribe({
      next: (summary) => {
        this.trophySummary.set(summary);
        this.trophySummaryLoading.set(false);
      },
      error: () => {
        this.trophySummaryError.set('Unable to load trophy summary.');
        this.trophySummaryLoading.set(false);
      },
    });
  }

  private loadIdentity(): void {
    this.identityLoading.set(true);
    this.identityError.set(null);
    this.curator.getIdentity().subscribe({
      next: (identity) => {
        this.identity.set(identity);
        this.identityLoading.set(false);
      },
      error: () => {
        this.identityError.set('Unable to load PSN identity.');
        this.identityLoading.set(false);
      },
    });
  }

  private loadFriendRequests(): void {
    this.friendRequestsError.set(null);
    this.curator.getFriendRequests().subscribe({
      next: (response) => this.friendRequests.set(response.requests),
      error: () => {
        this.friendRequests.set(null);
        this.friendRequestsError.set('Unable to load friend requests.');
      },
    });
  }

  protected acceptFriendRequest(request: FriendRequestResponse): void {
    const onlineId = request.online_id;
    if (onlineId === null) {
      return;
    }
    this.friendRequestPending.set(onlineId);
    this.friendRequestsError.set(null);
    this.friendRequestAccepted.set(null);
    this.curator.acceptFriendRequest(onlineId).subscribe({
      next: () => {
        this.friendRequestPending.set(null);
        this.friendRequestAccepted.set(onlineId);
        this.friendRequests.update((requests) => requests?.filter((entry) => entry.online_id !== onlineId) ?? null);
      },
      error: () => {
        this.friendRequestPending.set(null);
        this.friendRequestsError.set(`Unable to accept ${onlineId}'s request.`);
      },
    });
  }

  private loadPresence(): void {
    this.presenceLoading.set(true);
    this.presenceError.set(null);
    this.curator.getPresence().subscribe({
      next: (presence) => {
        this.presence.set(presence);
        this.presenceLoading.set(false);
      },
      error: () => {
        this.presenceError.set('Unable to load online presence.');
        this.presenceLoading.set(false);
      },
    });
  }

  private loadDevices(): void {
    this.devicesLoading.set(true);
    this.devicesError.set(null);
    this.curator.getDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.devicesLoading.set(false);
      },
      error: () => {
        this.devicesError.set('Unable to load registered devices.');
        this.devicesLoading.set(false);
      },
    });
    this.curator.listConsoles().subscribe({
      next: (consoles) => this.consoles.set(consoles),
      error: () => this.consoles.set([]),
    });
  }

  protected linkedConsoleName(device: DeviceResponse): string | null {
    if (!device.linked_console_id) {
      return null;
    }
    const linked = this.consoles().find((console) => console.console_id === device.linked_console_id);
    return linked?.name ?? device.linked_console_id;
  }

  protected startLinking(device: DeviceResponse): void {
    this.linkingDeviceId.set(device.device_id);
    this.linkTargetConsoleId.set(null);
    this.deviceLinkError.set(null);
  }

  protected cancelLinking(): void {
    this.linkingDeviceId.set(null);
    this.linkTargetConsoleId.set(null);
    this.deviceLinkError.set(null);
  }

  protected linkDevice(device: DeviceResponse): void {
    const consoleId = this.linkTargetConsoleId();
    if (consoleId === null) {
      this.deviceLinkError.set(DEVICE_LINK_CONSOLE_REQUIRED_ERROR);
      return;
    }
    this.deviceLinkPending.set(device.device_id);
    this.deviceLinkError.set(null);
    this.curator.linkConsoleDevice(consoleId, device.device_id).subscribe({
      next: () => {
        this.deviceLinkPending.set(null);
        this.linkingDeviceId.set(null);
        this.linkTargetConsoleId.set(null);
        this.loadDevices();
      },
      error: () => {
        this.deviceLinkPending.set(null);
        this.deviceLinkError.set('Unable to link that console.');
      },
    });
  }

  protected unlinkDevice(device: DeviceResponse): void {
    if (!device.linked_console_id) {
      return;
    }
    this.deviceLinkPending.set(device.device_id);
    this.deviceLinkError.set(null);
    this.curator.unlinkConsoleDevice(device.linked_console_id).subscribe({
      next: () => {
        this.deviceLinkPending.set(null);
        this.loadDevices();
      },
      error: () => {
        this.deviceLinkPending.set(null);
        this.deviceLinkError.set('Unable to unlink that console.');
      },
    });
  }

  protected onToggle(category: keyof PsnPreferencesResponse, newValue: boolean): void {
    const current = this.preferences();
    if (!current) {
      return;
    }

    const previous = current[category];
    this.preferences.set({ ...current, [category]: newValue });
    this.savingPreference.set(category);
    this.preferencesError.set(null);

    this.curator.setPsnPreferences({ ...current, [category]: newValue }).subscribe({
      next: () => {
        this.savingPreference.set(null);
        if (newValue) {
          this.loadForCategory(category);
        } else {
          this.clearForCategory(category);
        }
      },
      error: () => {
        const reverted = this.preferences();
        if (reverted) {
          this.preferences.set({ ...reverted, [category]: previous });
        }
        this.savingPreference.set(null);
        this.preferencesError.set(PREFERENCE_UPDATE_ERROR);
      },
    });
  }

  private loadForCategory(category: keyof PsnPreferencesResponse): void {
    switch (category) {
      case PsnPreferenceKeys.harvestTrophies:
        this.loadTrophySummary();
        break;
      case PsnPreferenceKeys.harvestIdentity:
        this.loadIdentity();
        this.loadFriendRequests();
        break;
      case PsnPreferenceKeys.harvestPresence:
        this.loadPresence();
        break;
      case PsnPreferenceKeys.harvestDevices:
        this.loadDevices();
        break;
    }
  }

  private clearForCategory(category: keyof PsnPreferencesResponse): void {
    switch (category) {
      case PsnPreferenceKeys.harvestTrophies:
        this.trophySummary.set(null);
        break;
      case PsnPreferenceKeys.harvestIdentity:
        this.identity.set(null);
        break;
      case PsnPreferenceKeys.harvestPresence:
        this.presence.set(null);
        break;
      case PsnPreferenceKeys.harvestDevices:
        this.devices.set(null);
        break;
    }
  }

  protected trophiesEarnedTotal(summary: TrophySummaryResponse): number {
    const { bronze, silver, gold, platinum } = summary.earned;
    return bronze + silver + gold + platinum;
  }

  protected link(): void {
    const token = this.npsso().trim();
    if (!token) {
      this.error.set(NPSSO_REQUIRED_ERROR);
      return;
    }
    if (!token.startsWith('{') && token.length !== NPSSO_LENGTH) {
      this.error.set(npssoLengthError(token.length));
      return;
    }

    this.linking.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http
      .post(CuratorApi.psnLink, { npsso: token })
      .pipe(
        switchMap(() => this.reloadStatus()),
        finalize(() => this.linking.set(false)),
      )
      .subscribe({
        next: (me) => {
          this.success.set(PSN_LINKED_MESSAGE);
          this.npsso.set('');
          this.applyReloadedStatus(me);
        },
        error: (err: HttpErrorResponse) => this.error.set(linkErrorMessage(err)),
      });
  }

  protected unlink(): void {
    this.unlinking.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http
      .delete(CuratorApi.psnLink)
      .pipe(
        switchMap(() => this.reloadStatus()),
        finalize(() => this.unlinking.set(false)),
      )
      .subscribe({
        next: (me) => {
          this.success.set(PSN_UNLINKED_MESSAGE);
          this.applyReloadedStatus(me);
        },
        error: () => this.error.set(PSN_UNLINK_ERROR),
      });
  }

  protected loadMyActions(): void {
    this.actionsLoading.set(true);
    this.actionsError.set(null);

    this.curator.getMyActions().subscribe({
      next: (response) => {
        this.actions.set(response.actions);
        this.actionsLoading.set(false);
      },
      error: () => {
        this.actionsError.set(ACTION_HISTORY_LOAD_ERROR);
        this.actionsLoading.set(false);
      },
    });
  }

  protected downloadMyActions(): void {
    const actions = this.actions();
    if (!actions) {
      return;
    }

    const blob = new Blob([JSON.stringify(actions, null, 2)], { type: ContentTypes.json });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ACTION_HISTORY_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected setRawgKey(): void {
    const key = this.rawgKeyInput().trim();
    if (!key) {
      this.rawgKeyError.set(RAWG_KEY_REQUIRED_ERROR);
      return;
    }

    this.settingRawgKey.set(true);
    this.rawgKeyError.set(null);

    this.curator.setRawgKey(key).subscribe({
      next: () => {
        this.settingRawgKey.set(false);
        this.rawgKeyInput.set('');
        this.loadEnrichmentKeyStatus();
      },
      error: (err: unknown) => {
        this.settingRawgKey.set(false);
        this.rawgKeyError.set(extractErrorDetail(err) ?? RAWG_KEY_SAVE_ERROR);
      },
    });
  }

  protected deleteRawgKey(): void {
    this.deletingRawgKey.set(true);
    this.rawgKeyError.set(null);

    this.curator.deleteRawgKey().subscribe({
      next: () => {
        this.deletingRawgKey.set(false);
        this.loadEnrichmentKeyStatus();
      },
      error: () => {
        this.deletingRawgKey.set(false);
        this.rawgKeyError.set('Failed to remove RAWG key.');
      },
    });
  }

  protected setOpenCriticKey(): void {
    const key = this.opencriticKeyInput().trim();
    if (!key) {
      this.opencriticKeyError.set('Enter an OpenCritic (RapidAPI) key.');
      return;
    }

    this.settingOpencriticKey.set(true);
    this.opencriticKeyError.set(null);

    this.curator.setOpenCriticKey(key).subscribe({
      next: () => {
        this.settingOpencriticKey.set(false);
        this.opencriticKeyInput.set('');
        this.loadEnrichmentKeyStatus();
      },
      error: (err: unknown) => {
        this.settingOpencriticKey.set(false);
        this.opencriticKeyError.set(extractErrorDetail(err) ?? 'Failed to save OpenCritic key.');
      },
    });
  }

  protected deleteOpenCriticKey(): void {
    this.deletingOpencriticKey.set(true);
    this.opencriticKeyError.set(null);

    this.curator.deleteOpenCriticKey().subscribe({
      next: () => {
        this.deletingOpencriticKey.set(false);
        this.loadEnrichmentKeyStatus();
      },
      error: () => {
        this.deletingOpencriticKey.set(false);
        this.opencriticKeyError.set('Failed to remove OpenCritic key.');
      },
    });
  }

  protected requestDeleteMyData(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDeleteMyData(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDeleteMyData(): void {
    this.deletingAccount.set(true);
    this.deleteError.set(null);

    this.http.delete(CuratorApi.me).subscribe({
      next: () => {
        this.deletingAccount.set(false);
        this.confirmingDelete.set(false);
        this.deleted.set(true);
        this.me.invalidate();
      },
      error: () => {
        this.deletingAccount.set(false);
        this.deleteError.set(ACCOUNT_DELETE_ERROR);
      },
    });
  }
}
