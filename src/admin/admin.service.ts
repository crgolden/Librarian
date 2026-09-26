import { Injectable, Signal, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ADMIN_CLAIM_VALUE, ClaimTypes } from '../shared/bff-contract';

export const ADMIN_CLAIM_TYPE = ClaimTypes.admin;

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly auth = inject(AuthService);

  public readonly isAdmin: Signal<boolean> = computed(() =>
    this.auth
      .session()
      .some((claim) => claim.type === ADMIN_CLAIM_TYPE && claim.value.toLowerCase() === ADMIN_CLAIM_VALUE),
  );
}
