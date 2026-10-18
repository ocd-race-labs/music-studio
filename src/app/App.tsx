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
import { t } from './i18n';
import { GROUND, useAppearance } from './prefs';
import { useUpdateAvailable } from './update';

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
  // The guest's stars and last kit live in memory only, like the guest's songs.
  const [guest, setGuest] = useState<Profile>(guestProfile);
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [uiLang, setUiLang] = useState<Lang>('en');
  const [storageError, setStorageError] = useState<string | null>(null);
  const { appearance, mode, setAppearance, toggle: toggleMode } = useAppearance();
  const updateReady = useUpdateAvailable();

  useEffect(() => {
    openBrowserStore()
      .then(async (s) => {
        setStore(s);
        const list = await s.listProfiles();
        setProfiles(list);
        const browserLang: Lang = /^es\b/i.test(navigator.language) ? 'es' : 'en';
        setUiLang((await s.getMeta<Lang>('ui_lang')) ?? browserLang);
        setRoute(list.length ? { name: 'home' } : { name: 'setup' });
        requestPersistence().catch(() => undefined);
      })
      .catch((e: unknown) => setStorageError(String(e)));
  }, []);

  const reloadProfiles = useCallback(async () => {
    if (store) setProfiles(await store.listProfiles());
  }, [store]);

  const profileFor = (id: string): Profile | undefined =>
    id === GUEST_ID ? guest : profiles.find((p) => p.id === id);

  // Each screen wears its profile's theme; home and setup wear the guest theme.
  const themed: ThemePreset = (route.name === 'studio' || route.name === 'settings')
    ? profileFor(route.profileId)?.theme.preset ?? 'daylight'
    : 'daylight';
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.studio = themed;
    root.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[themed][mode]);
  }, [themed, mode]);

  // One language per device: the home switch and the setting in profile settings change the same thing.
  useEffect(() => { document.documentElement.lang = uiLang; }, [uiLang]);
  const changeLang = async (lang: Lang) => {
    setUiLang(lang);
    await store?.setMeta('ui_lang', lang);
  };
  const lang = uiLang;
  const look = { mode, onToggleMode: toggleMode };
  const updateBar = updateReady && (
    <div className="update-bar" role="status">
      <span>{t('updateReady', lang)}</span>
      <button type="button" className="btn primary" onClick={() => window.location.reload()}>{t('updateNow', lang)}</button>
    </div>
  );

  const screen = (() => {
    if (storageError) {
      return (
        <div className="home"><div className="card stack">
          <h1 className="display">{t('storageBlockedTitle', lang)}</h1>
          <p className="muted">{t('storageBlockedBody', lang)}</p>
          <p className="small mono">{storageError}</p>
        </div></div>
      );
    }

    if (!store || route.name === 'loading') return <div className="home"><p className="muted">{t('loading', lang)}</p></div>;

    if (route.name === 'setup') {
      return (
        <Setup
          lang={lang}
          onLang={changeLang}
          {...look}
          onDone={async (people) => {
            const start = profiles.reduce((m, x) => Math.max(m, (x.order ?? -1) + 1), profiles.length);
            for (const [i, p] of people.entries()) {
              await store.saveProfile({ ...newProfile(p.name, p.preset, p.ring), ui_lang: lang, instruments: p.instruments, order: start + i });
            }
            await reloadProfiles();
            setRoute({ name: 'home' });
          }}
        />
      );
    }

    if (route.name === 'lab') return <Lab store={store} lang={lang} onHome={() => setRoute({ name: 'home' })} />;

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
            lang={lang}
            onLang={changeLang}
            appearance={appearance}
            mode={mode}
            onAppearance={setAppearance}
            onStartOver={async () => {
              await store.clearAll();
              setProfiles([]);
              setRoute({ name: 'setup' });
            }}
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
          lang={lang}
          onLang={changeLang}
          {...look}
          onHome={() => setRoute({ name: 'home' })}
          onSettings={() => profile.id !== GUEST_ID && setRoute({ name: 'settings', profileId: profile.id })}
          onProfile={(p) => {
            if (p.id === GUEST_ID) { setGuest(p); return; }
            setProfiles((list) => list.map((x) => (x.id === p.id ? p : x)));
            store.saveProfile(p).catch(() => undefined);
          }}
        />
      );
    }

    return (
      <Home
        profiles={profiles}
        lang={lang}
        onLang={changeLang}
        {...look}
        onOpen={(id) => setRoute({ name: 'studio', profileId: id })}
        onSettings={() => profiles[0] && setRoute({ name: 'settings', profileId: profiles[0].id })}
        onLab={() => setRoute({ name: 'lab' })}
        onAddPerson={() => setRoute({ name: 'setup' })}
      />
    );
  })();

  return <>{screen}{updateBar}</>;
}
