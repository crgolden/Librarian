import { Injectable, Signal, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const ADMIN_CLAIM_TYPE = 'curator.admin';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly auth = inject(AuthService);

  public readonly isAdmin: Signal<boolean> = computed(() =>
    this.auth
      .session()
      .some((claim) => claim.type === ADMIN_CLAIM_TYPE && claim.value.toLowerCase() === 'true'),
  );
}
