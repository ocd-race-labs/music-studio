import { newProfile } from '../domain/factory';
import type { Profile } from '../domain/types';

export const GUEST_ID = 'guest';

/** Guest: Daylight theme, an in-memory store, nothing kept after leaving. */
export const guestProfile: Profile = {
  ...newProfile('Guest', 'daylight', '#C2410C'),
  id: GUEST_ID,
  default_hat: 'musician',
};
