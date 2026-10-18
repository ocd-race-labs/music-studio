// The rooms of a profile's studio. The hub is the map that leads to the other four.
export type Room = 'hub' | 'sounds' | 'musician' | 'producer' | 'songs';
export const ROOMS: Exclude<Room, 'hub'>[] = ['sounds', 'musician', 'producer', 'songs'];
