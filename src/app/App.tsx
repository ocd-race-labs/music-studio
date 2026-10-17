import { useCallback, useEffect, useMemo, useState } from 'react';
import { newProfile } from '../domain/factory';
import type { Lang, Profile, ThemePreset } from '../domain/types';
import { openBrowserStore, requestPersistence } from '../store/store';
import type { SongStore } from '../store/store';
import { memoryStore } from '../store/memory';
import Home from './Home';
import Setup from './Setup';
import Studio from './Studio';
import Settings from './Settings';
import Lab from './Lab';
import { GUEST_ID, guestProfile } from './guest';

type Route =
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'home' }
  | { name: 'studio'; profileId: string }
  | { name: 'settings'; profileId: string }
  | { name: 'lab' };

export default function App() {
  const [store, setStore] = useState<SongStore | null>(null);
  const guestStore = useMemo(() => memoryStore(), []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [uiLang, setUiLang] = useState<Lang>('en');
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    openBrowserStore()
      .then(async (s) => {
        setStore(s);
        const list = await s.listProfiles();
        setProfiles(list);
        setUiLang((await s.getMeta<Lang>('ui_lang')) ?? 'en');
        setRoute(list.length ? { name: 'home' } : { name: 'setup' });
        requestPersistence().catch(() => undefined);
      })
      .catch((e: unknown) => setStorageError(String(e)));
  }, []);

  const reloadProfiles = useCallback(async () => {
    if (store) setProfiles(await store.listProfiles());
  }, [store]);

  const profileFor = (id: string): Profile | undefined =>
    id === GUEST_ID ? guestProfile : profiles.find((p) => p.id === id);

  // Each screen wears its profile's theme; home and setup wear the guest theme.
  const themed: ThemePreset = (route.name === 'studio' || route.name === 'settings')
    ? profileFor(route.profileId)?.theme.preset ?? 'daylight'
    : 'daylight';
  useEffect(() => {
    document.documentElement.dataset.studio = themed;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', themed === 'graphite' ? '#0E0E0F' : themed === 'midnight-jewel' ? '#120F1F' : '#F3F4F6');
  }, [themed]);

  const changeLang = async (lang: Lang) => {
    setUiLang(lang);
    await store?.setMeta('ui_lang', lang);
  };

  if (storageError) {
    return (
      <div className="home"><div className="card stack">
        <h1 className="display">This browser blocked storage</h1>
        <p className="muted">Music Studio saves songs in the browser. Private browsing can block that; open it in a normal window.</p>
        <p className="small mono">{storageError}</p>
      </div></div>
    );
  }

  if (!store || route.name === 'loading') return <div className="home"><p className="muted">Loading…</p></div>;

  if (route.name === 'setup') {
    return (
      <Setup
        onDone={async (people) => {
          for (const p of people) await store.saveProfile(newProfile(p.name, p.preset, p.ring));
          await reloadProfiles();
          setRoute({ name: 'home' });
        }}
      />
    );
  }

  if (route.name === 'lab') return <Lab store={store} onHome={() => setRoute({ name: 'home' })} />;

  if (route.name === 'studio' || route.name === 'settings') {
    const profile = profileFor(route.profileId);
    if (!profile) {
      setRoute({ name: 'home' });
      return null;
    }
    if (route.name === 'settings') {
      return (
        <Settings
          store={store}
          profile={profile}
          profiles={profiles}
          onSwitch={(id) => setRoute({ name: 'settings', profileId: id })}
          onSaved={reloadProfiles}
          onHome={() => setRoute({ name: 'home' })}
          onStudio={() => setRoute({ name: 'studio', profileId: profile.id })}
        />
      );
    }
    return (
      <Studio
        key={profile.id}
        store={profile.id === GUEST_ID ? guestStore : store}
        profile={profile}
        onHome={() => setRoute({ name: 'home' })}
        onSettings={() => profile.id !== GUEST_ID && setRoute({ name: 'settings', profileId: profile.id })}
      />
    );
  }

  return (
    <Home
      profiles={profiles}
      lang={uiLang}
      onLang={changeLang}
      onOpen={(id) => setRoute({ name: 'studio', profileId: id })}
      onSettings={() => profiles[0] && setRoute({ name: 'settings', profileId: profiles[0].id })}
      onLab={() => setRoute({ name: 'lab' })}
      onAddPerson={() => setRoute({ name: 'setup' })}
    />
  );
}
