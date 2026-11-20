import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Switch, AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  BASE_HOTSPOT_URL,
  BASE_SSID_PREFIX,
  BaseError,
  canJoinHotspot,
  configureBase,
  getBaseInfo,
  hotspotPassword,
  joinHotspot,
  leaveHotspot,
  normalizeSetupCode,
  roundCoord,
  routeToBase,
  ssidFor,
  type BaseInfo,
} from '../src/lib/base';
import { registerDevice } from '../src/lib/wildnetwork';
import { getPhoneLocation } from '../src/lib/phoneLocation';
import { getBases, saveBase } from '../src/lib/secureStorage';
import { findBases } from '../src/lib/baseDiscovery';
import { HOTSPOT_POLL, isBaseInfo, pollUntil, type FoundBase } from '../src/lib/baseFind';
import { baseLocalUrl, planBaseStation } from '../src/lib/baseStation';
import { useStationStore } from '../src/stores/stationStore';

type Step = 'code' | 'manual-join' | 'details' | 'working' | 'done';

const input =
  'mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 text-gray-900 dark:text-gray-50';
const label = 'mb-1 text-sm font-medium text-gray-700 dark:text-gray-300';
const hint = 'mb-4 text-xs text-gray-500 dark:text-gray-400';

function Button({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`mt-2 items-center rounded-2xl py-3.5 active:opacity-75 ${
        secondary ? 'border border-green-700 dark:border-green-400' : disabled ? 'bg-gray-300 dark:bg-gray-700' : 'bg-green-700'
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text className={`text-base font-semibold ${secondary ? 'text-green-700 dark:text-green-300' : 'text-white'}`}>{title}</Text>
    </Pressable>
  );
}

/**
 * "Add a Base" (wildnetwork/docs/BASE-FIELD-APP.md, flow 1): join the Base's hotspot, read /api/info, name and
 * place it, register it with Wildlife Network over the phone's own internet, then POST /api/config to the Base.
 */
export default function AddBaseScreen() {
  const [step, setStep] = useState<Step>('code');
  const [baseId, setBaseId] = useState('');
  const [code, setCode] = useState('');
  const [onHomeWifi, setOnHomeWifi] = useState(false);
  const [address, setAddress] = useState('');
  const [baseUrl, setBaseUrl] = useState(BASE_HOTSPOT_URL);
  const [info, setInfo] = useState<BaseInfo | null>(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPsk, setWifiPsk] = useState('');
  const [apn, setApn] = useState('');
  const [progress, setProgress] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [feedAdded, setFeedAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Never leave the app bound to the Base's network after this screen closes.
  useEffect(() => () => leaveHotspot(), []);

  // Joining by hand (iPhone, older Android): keep asking the hotspot address and go on once the Base answers.
  // Restarted when the app comes back from Settings, since timers pause while it is in the background.
  const [waitRun, setWaitRun] = useState(0);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  useEffect(() => {
    if (step !== 'manual-join') return;
    let cancelled = false;
    setWaitTimedOut(false);
    void pollUntil(
      async () => {
        const i = await getBaseInfo(BASE_HOTSPOT_URL, HOTSPOT_POLL.requestMs);
        return isBaseInfo(i) ? i : null;
      },
      { intervalMs: HOTSPOT_POLL.intervalMs, timeoutMs: HOTSPOT_POLL.timeoutMs, cancelled: () => cancelled },
    ).then((i) => {
      if (cancelled) return;
      if (!i) return setWaitTimedOut(true);
      setError(null);
      setStep('working');
      setProgress('Talking to the Base');
      readInfo(BASE_HOTSPOT_URL).catch((e) => {
        setStep('manual-join');
        setError(e instanceof Error ? e.message : 'Could not reach the Base.');
      });
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setWaitRun((n) => n + 1);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [step, waitRun]);

  // On home Wi-Fi: look for Bases (mDNS `_wlnw-base._tcp`, then known .local names), each checked with /api/info.
  const [found, setFound] = useState<FoundBase[] | null>(null);
  const [searchRun, setSearchRun] = useState(0);
  useEffect(() => {
    if (!onHomeWifi || step !== 'code') return;
    let live = true;
    setFound(null);
    void (async () => {
      const known = (await getBases()).map((b) => b.ssid);
      const list = await findBases([...known, baseId]).catch(() => []);
      if (live) setFound(list);
    })();
    return () => {
      live = false;
    };
    // baseId is read once per search; typing it does not restart the search ("Search again" does).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHomeWifi, step, searchRun]);

  const ssid = ssidFor(baseId);
  const setupCode = normalizeSetupCode(code);

  async function readInfo(url: string) {
    const i = await getBaseInfo(url);
    if (i.model !== 'wildnetwork-base') throw new BaseError('That device is not a Wildlife Network Base.');
    setInfo(i);
    setName(i.name ?? '');
    if (i.latitude != null && i.longitude != null) {
      setLat(String(i.latitude));
      setLon(String(i.longitude));
      setLocNote('This is where the Base was set before. Use this phone’s location if it stands somewhere else now.');
    } else {
      // Start quietly: GPS only when location was already allowed (no dialog here), else the phone's approximate
      // area (whole degrees). "Use this phone's location" asks for permission.
      void getPhoneLocation(false).then((r) => {
        if (!r.ok) return;
        setLat((v) => v || r.lat);
        setLon((v) => v || r.lon);
        setLocNote(r.note);
      });
    }
    setStep('details');
  }

  async function connect() {
    setError(null);
    if (!setupCode) return setError('The setup code is 8 letters and digits, printed on the label.');
    try {
      if (onHomeWifi) {
        const url = address.trim().replace(/\/$/, '');
        if (!/^https?:\/\/.+/.test(url)) return setError('Enter the Base address, for example http://192.168.1.50');
        setBaseUrl(url);
        setStep('working');
        setProgress('Talking to the Base');
        await readInfo(url);
        return;
      }
      if (!ssid) return setError(`Enter the 4 characters after "${BASE_SSID_PREFIX}" on the label.`);
      if (!canJoinHotspot()) {
        setStep('manual-join');
        return;
      }
      setStep('working');
      setProgress('Joining the Base’s Wi-Fi. Approve the connection when Android asks.');
      const r = await joinHotspot(ssid, setupCode);
      if (r === 'unsupported') return setStep('manual-join');
      if (r !== 'connected') {
        setStep('code');
        return setError('Could not join the Base’s Wi-Fi. Check the code, stay close to the Base and try again.');
      }
      routeToBase(true);
      setProgress('Talking to the Base');
      await readInfo(BASE_HOTSPOT_URL);
    } catch (e) {
      setStep('code');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  async function fillFromPhone() {
    setLocating(true);
    const r = await getPhoneLocation(true);
    setLocating(false);
    if (!r.ok) return setError(r.error);
    setError(null);
    setLat(r.lat);
    setLon(r.lon);
    setLocNote(r.note);
  }

  async function finish() {
    if (!info || !setupCode) return;
    setError(null);
    const latN = Number(lat), lonN = Number(lon);
    if (name.trim().length < 3) return setError('Give the Base a name of at least 3 characters.');
    if (!lat.trim() || !lon.trim() || !Number.isFinite(latN) || !Number.isFinite(lonN) || Math.abs(latN) > 90 || Math.abs(lonN) > 180) {
      return setError('Enter where the Base stands, as latitude and longitude.');
    }
    if (wifiSsid.trim() && wifiPsk.length < 8) return setError('The home Wi-Fi password needs at least 8 characters.');
    setStep('working');
    try {
      // A Base that already has a key (set up before, or registered itself over its own internet) keeps it:
      // registering again would create a second device. The Base never returns its key, so none is saved here.
      const alreadyRegistered = !!info.deviceId && info.registration === 'registered';
      let reg: { deviceId: string; apiKey: string } = { deviceId: info.deviceId ?? '', apiKey: '' };
      if (!alreadyRegistered) {
        // Register over the phone's own internet, not the Base's hotspot (it has none).
        setProgress('Registering the Base with Wildlife Network');
        routeToBase(false);
        reg = await registerDevice({
          name: name.trim(),
          model: 'wildnetwork-base',
          source: 'wildnetwork-base',
          hardwareId: info.hardwareId,
        });
      }
      setProgress('Saving the settings on the Base');
      routeToBase(true);
      const saved = await configureBase(baseUrl, setupCode, {
        name: name.trim(),
        latitude: roundCoord(latN),
        longitude: roundCoord(lonN),
        roundCoords: 2,
        ...(alreadyRegistered ? {} : { apiKey: reg.apiKey, deviceId: reg.deviceId }),
        ...(apn.trim() ? { apn: apn.trim() } : {}),
        ...(wifiSsid.trim() ? { wifi: { ssid: wifiSsid.trim(), psk: wifiPsk } } : {}),
      });
      setWarnings(saved.warnings ?? []);
      await saveBase({
        deviceId: reg.deviceId,
        hardwareId: info.hardwareId,
        name: name.trim(),
        ssid: ssid ?? '',
        setupCode,
        apiKey: reg.apiKey,
        latitude: roundCoord(latN),
        longitude: roundCoord(lonN),
        ...(baseLocalUrl(baseUrl, info) ? { address: baseLocalUrl(baseUrl, info)! } : {}),
        addedAt: new Date().toISOString(),
      });
      leaveHotspot();
      // The Base's BirdNET-Go becomes a station, so its detections show in the Feed (linked, never shared twice).
      const store = useStationStore.getState();
      const plan = planBaseStation(store.stations, { hardwareId: info.hardwareId, name: name.trim() }, info, baseUrl);
      if (plan.kind === 'add') {
        await store.connectBirdNetGo(plan.hostUrl, plan.stationName, info.hardwareId);
        setFeedAdded(plan.hostUrl);
      } else if (plan.kind === 'link') {
        await store.linkStationToBase(plan.stationId, info.hardwareId);
      }
      setStep('done');
    } catch (e) {
      routeToBase(true);
      setStep('details');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">Add a Base</Text>

      {step === 'code' && (
        <>
          <Text className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-300">
            Switch the Base on and stand near it. Its label shows the Wi-Fi name and an 8 character setup code.
          </Text>
          <View className="mb-4 flex-row items-center justify-between rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
            <Text className="flex-1 mr-3 text-sm text-gray-700 dark:text-gray-200">The Base is already on my home Wi-Fi</Text>
            <Switch value={onHomeWifi} onValueChange={setOnHomeWifi} trackColor={{ true: '#347F57' }} accessibilityLabel="The Base is already on my home Wi-Fi" />
          </View>
          {onHomeWifi ? (
            <>
              <Text className={label}>Bases on this Wi-Fi</Text>
              {found === null ? (
                <View className="mb-3 flex-row items-center rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5">
                  <ActivityIndicator color="#347F57" />
                  <Text className="ml-3 text-sm text-gray-600 dark:text-gray-300">Looking for Bases on this network</Text>
                </View>
              ) : found.length === 0 ? (
                <Text className={hint}>No Base found on this network. Enter its address below, or search again.</Text>
              ) : (
                <View className="mb-3 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
                  {found.map((b, i) => {
                    const chosen = address.trim().replace(/\/$/, '') === b.url;
                    return (
                      <Pressable
                        key={b.info.hardwareId}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        className={`px-4 py-3.5 active:opacity-80 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''} ${chosen ? 'bg-green-50 dark:bg-green-950' : ''}`}
                        onPress={() => setAddress(b.url)}
                      >
                        <Text className="text-[15px] font-medium text-gray-900 dark:text-gray-50">{b.info.name || b.info.hostname}</Text>
                        <Text className="text-xs text-gray-400 mt-0.5">
                          {b.url}{b.info.configured ? ' · already set up' : ' · new'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {found !== null ? (
                <Pressable accessibilityRole="button" className="mb-4 self-start" onPress={() => setSearchRun((n) => n + 1)}>
                  <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Search again</Text>
                </Pressable>
              ) : null}
              <Text className={label}>Base address</Text>
              <TextInput className={input} value={address} onChangeText={setAddress} placeholder="http://192.168.1.50" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            </>
          ) : (
            <>
              <Text className={label}>Wi-Fi name on the label</Text>
              <View className="mb-3 flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4">
                <Text className="text-gray-500 dark:text-gray-400">{BASE_SSID_PREFIX}</Text>
                <TextInput className="flex-1 py-3.5 text-gray-900 dark:text-gray-50" value={baseId} onChangeText={setBaseId} placeholder="A1B2" autoCapitalize="characters" autoCorrect={false} maxLength={4} accessibilityLabel="Last 4 characters of the Base Wi-Fi name" />
              </View>
            </>
          )}
          <Text className={label}>Setup code</Text>
          <TextInput className={input} value={code} onChangeText={setCode} placeholder="ABCD EFGH" autoCapitalize="characters" autoCorrect={false} maxLength={11} />
          <Text className={hint}>The code stays on this phone and is only sent to the Base.</Text>
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <Button title="Connect to the Base" onPress={() => void connect()} />
        </>
      )}

      {step === 'manual-join' && ssid && setupCode && (
        <>
          <Text className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-300">
            {Platform.OS === 'ios'
              ? 'iPhone does not let apps join a Wi-Fi network by themselves, so join the Base\'s Wi-Fi in Settings:'
              : 'Join the Base\'s Wi-Fi in your phone\'s settings:'}
          </Text>
          <View className="mb-4 rounded-2xl bg-white dark:bg-gray-900 p-4">
            <Text className="text-sm text-gray-800 dark:text-gray-100">
              1. Open {Platform.OS === 'ios' ? 'Settings, then Wi-Fi' : 'Settings, then Wi-Fi (or Network and internet)'}.
            </Text>
            <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">2. Tap this network:</Text>
            <Text selectable className="mt-1 ml-4 text-[15px] font-semibold text-gray-900 dark:text-gray-50">{ssid}</Text>
            <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">3. Enter this password (wn- and the setup code from the label):</Text>
            <Text selectable className="mt-1 ml-4 font-mono text-[15px] text-gray-900 dark:text-gray-50">{hotspotPassword(setupCode)}</Text>
            <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">
              4. If the phone says the network has no internet, choose to stay connected (on iPhone, just leave it joined).
            </Text>
            <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">5. Come back to BirdEcho.</Text>
          </View>
          {waitTimedOut ? (
            <Text className="mb-3 text-sm text-amber-700 dark:text-amber-300">
              The Base has not answered yet. Check that the phone is joined to {ssid} and that you are close to the Base, then tap the button below.
            </Text>
          ) : (
            <View className="mb-3 flex-row items-center">
              <ActivityIndicator color="#347F57" />
              <Text className="ml-3 flex-1 text-sm text-gray-600 dark:text-gray-300">
                Waiting for the Base. BirdEcho goes on by itself as soon as it answers.
              </Text>
            </View>
          )}
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <Button title="I am on the Base's Wi-Fi" onPress={() => setWaitRun((n) => n + 1)} />
          <Button secondary title="Back" onPress={() => setStep('code')} />
        </>
      )}

      {step === 'details' && info && (
        <>
          <Text className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-300">
            Connected to the Base{info.software?.wnbase ? ` (software ${info.software.wnbase})` : ''}. Give it a name and say where it stands.
          </Text>
          <Text className={label}>Name</Text>
          <TextInput className={input} value={name} onChangeText={setName} placeholder="e.g. Garden Base" maxLength={60} />
          <Text className={label}>Where it stands</Text>
          <Pressable accessibilityRole="button" className="mb-3 items-center rounded-2xl border border-green-700 dark:border-green-400 py-3 active:opacity-75" disabled={locating} onPress={() => void fillFromPhone()}>
            {locating ? <ActivityIndicator color="#347F57" /> : <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Use this phone&apos;s location</Text>}
          </Pressable>
          <View className="flex-row gap-3">
            <TextInput className={`flex-1 ${input}`} value={lat} onChangeText={setLat} placeholder="Latitude, e.g. 13.08" keyboardType="numbers-and-punctuation" accessibilityLabel="Latitude" />
            <TextInput className={`flex-1 ${input}`} value={lon} onChangeText={setLon} placeholder="Longitude, e.g. 80.27" keyboardType="numbers-and-punctuation" accessibilityLabel="Longitude" />
          </View>
          <Text className={hint}>
            {locNote ??
              'Stand next to the Base and use this phone’s location, or type where it stands. Only a position rounded to about 1 km is sent to the Base and shared.'}
          </Text>
          <Text className={label}>Home Wi-Fi (optional)</Text>
          <TextInput className={input} value={wifiSsid} onChangeText={setWifiSsid} placeholder="Network name" autoCapitalize="none" autoCorrect={false} />
          <TextInput className={input} value={wifiPsk} onChangeText={setWifiPsk} placeholder="Password" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text className={hint}>With Wi-Fi or a SIM the Base sends its detections itself. Without either, this phone can carry them out later with Collect detections on the Base page.</Text>
          <Text className={label}>SIM APN (only if a SIM card is fitted)</Text>
          <TextInput className={input} value={apn} onChangeText={setApn} placeholder="e.g. internet" autoCapitalize="none" autoCorrect={false} />
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <Button title="Set up the Base" onPress={() => void finish()} />
        </>
      )}

      {step === 'working' && (
        <View className="mt-10 items-center">
          <ActivityIndicator size="large" color="#347F57" />
          <Text className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">{progress}</Text>
        </View>
      )}

      {step === 'done' && (
        <>
          <Text className="mt-3 text-base text-gray-800 dark:text-gray-100">
            {name.trim()} is set up and registered with Wildlife Network. It starts sharing detections as soon as it has internet.
          </Text>
          {warnings.length > 0 ? (
            <View className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-950 p-4">
              <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300">Some settings were not applied</Text>
              {warnings.map((w) => (
                <Text key={w} className="mt-1 text-sm text-amber-800 dark:text-amber-300">{w}</Text>
              ))}
            </View>
          ) : null}
          {feedAdded ? (
            <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Its detections now show in the Feed (BirdNET-Go at {feedAdded}). The Base already shares them with Wildlife Network.
            </Text>
          ) : null}
          <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You can see its health in Settings, under Bases.
          </Text>
          <Button title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </>
      )}
    </ScrollView>
  );
}
