import { newProfile } from '../domain/factory';
import type { Profile } from '../domain/types';

export const GUEST_ID = 'guest';

/** Guest: Graphite theme, an in-memory store, nothing kept after leaving. */
export const guestProfile: Profile = {
  ...newProfile('Guest', 'graphite', '#74747A'),
  id: GUEST_ID,
  default_hat: 'musician',
};
