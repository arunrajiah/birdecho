import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Switch } from 'react-native';
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
import { fetchNear, registerDevice } from '../src/lib/wildnetwork';
import { saveBase } from '../src/lib/secureStorage';

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
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPsk, setWifiPsk] = useState('');
  const [apn, setApn] = useState('');
  const [progress, setProgress] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Never leave the app bound to the Base's network after this screen closes.
  useEffect(() => () => leaveHotspot(), []);

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
    } else {
      // Start from the phone's approximate area (whole degrees); the user refines it to about 1 km.
      void fetchNear().then((n) => {
        if (n) {
          setLat((v) => v || String(n.lat));
          setLon((v) => v || String(n.lon));
        }
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
        addedAt: new Date().toISOString(),
      });
      leaveHotspot();
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
            Open your phone&apos;s Wi-Fi settings and join this network, then come back here.
          </Text>
          <View className="mb-4 rounded-2xl bg-white dark:bg-gray-900 p-4">
            <Text selectable className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">{ssid}</Text>
            <Text selectable className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-200">Password: {hotspotPassword(setupCode)}</Text>
          </View>
          <Text className={hint}>If the phone says the network has no internet, choose to stay connected.</Text>
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <Button
            title="I am on the Base's Wi-Fi"
            onPress={() => {
              setStep('working');
              setProgress('Talking to the Base');
              readInfo(BASE_HOTSPOT_URL).catch((e) => {
                setStep('manual-join');
                setError(e instanceof Error ? e.message : 'Could not reach the Base.');
              });
            }}
          />
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
          <View className="flex-row gap-3">
            <TextInput className={`flex-1 ${input}`} value={lat} onChangeText={setLat} placeholder="Latitude, e.g. 13.08" keyboardType="numbers-and-punctuation" accessibilityLabel="Latitude" />
            <TextInput className={`flex-1 ${input}`} value={lon} onChangeText={setLon} placeholder="Longitude, e.g. 80.27" keyboardType="numbers-and-punctuation" accessibilityLabel="Longitude" />
          </View>
          <Text className={hint}>
            Started from your approximate area; adjust it to the Base&apos;s place. Only a position rounded to about 1 km is ever shared.
          </Text>
          <Text className={label}>Home Wi-Fi (optional)</Text>
          <TextInput className={input} value={wifiSsid} onChangeText={setWifiSsid} placeholder="Network name" autoCapitalize="none" autoCorrect={false} />
          <TextInput className={input} value={wifiPsk} onChangeText={setWifiPsk} placeholder="Password" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text className={hint}>With Wi-Fi or a SIM the Base sends its detections itself. Without either, this phone can carry them out later.</Text>
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
          <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You can see its health in Settings, under Bases.
          </Text>
          <Button title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </>
      )}
    </ScrollView>
  );
}
