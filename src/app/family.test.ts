import { describe, expect, it } from 'vitest';
import { applyFamily, familyFromHash } from './Family';
import { memoryStore } from '../store/memory';
import { newProfile, newSong } from '../domain/factory';

describe('family link', () => {
  it('reads the names after #familia= or #family=', () => {
    expect(familyFromHash('#familia=Ana,Juan')).toEqual(['Ana', 'Juan']);
    expect(familyFromHash('#family=Mar%C3%ADa%2C%20Jos%C3%A9')).toEqual(['María', 'José']);
    expect(familyFromHash('#otra=cosa')).toBeNull();
    expect(familyFromHash('')).toBeNull();
    expect(familyFromHash('#familia=,,')).toBeNull();
  });

  it('creates the profiles from the design in the link order', async () => {
    const store = memoryStore();
    await applyFamily(store, ['Ana', 'Juan'], 'es', true);
    const list = await store.listProfiles();
    expect(list.map((p) => p.name)).toEqual(['Ana', 'Juan']);
    expect(list.map((p) => p.theme.preset)).toEqual(['midnight-jewel', 'daylight']);
    expect(list[0].instruments).toEqual(['violin', 'beats', 'lyrics']);
    expect(list[1].instruments).toEqual(['drums', 'guitar']);
    expect(list[1].default_hat).toBe('producer');
  });

  it('keeps a person already on the device with her songs, and hides test profiles', async () => {
    const store = memoryStore();
    const test = { ...newProfile('Prueba 4', 'daylight', '#C2410C'), order: 0 };
    const juan = { ...newProfile('juan', 'daylight', '#C2410C'), order: 1 };
    await store.saveProfile(test);
    await store.saveProfile(juan);
    await store.saveSong(newSong(juan.id, 'Mine'));
    await applyFamily(store, ['Ana', 'Juan'], 'es', true);
    const list = await store.listProfiles();
    expect(list.map((p) => p.name)).toEqual(['Ana', 'juan']);
    expect(list[1].id).toBe(juan.id);
    expect(await store.listSongs(juan.id)).toHaveLength(1);
    expect(await store.listSongs(test.id)).toHaveLength(0);
  });

  it('can keep the other profiles after the family', async () => {
    const store = memoryStore();
    await store.saveProfile({ ...newProfile('Prueba', 'daylight', '#C2410C'), order: 0 });
    await applyFamily(store, ['Ana'], 'en', false);
    expect((await store.listProfiles()).map((p) => p.name)).toEqual(['Ana', 'Prueba']);
  });
});
