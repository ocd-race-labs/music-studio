// The rooms of a profile's studio. The hub is the map that leads to the other four; the instrument store opens from
// the hub and is not on the bar of rooms.
export type Room = 'hub' | 'store' | 'sounds' | 'musician' | 'producer' | 'songs';
export const ROOMS: Exclude<Room, 'hub' | 'store'>[] = ['sounds', 'musician', 'producer', 'songs'];
