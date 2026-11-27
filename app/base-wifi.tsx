import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BASE_HOTSPOT_URL, canJoinHotspot, configureBase, getBaseInfo, hotspotPassword, joinHotspot, leaveHotspot, routeToBase } from '../src/lib/base';
import { getBases, saveBase, type ManagedBase } from '../src/lib/secureStorage';
import { pickSetupCode } from '../src/lib/baseLocation';
import { WIFI_CHANGE_NOTE, buildWifiRequest, wifiErrorMessage } from '../src/lib/baseWifi';
import { BaseError } from '../src/lib/baseApi';

const input =
  'mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 text-gray-900 dark:text-gray-50';
const label = 'mb-1 text-sm font-medium text-gray-700 dark:text-gray-300';
const hint = 'mb-4 text-xs text-gray-500 dark:text-gray-400';

/**
 * Change the Wi-Fi of a Base, typically after it was moved: at a new place it cannot find its old Wi-Fi and turns
 * on its own (Wildlife Network-XXXX). This screen reaches it there (joining that Wi-Fi itself where the phone
 * allows it, else the user joins by hand), or at the address the Base page found it at, and sends POST /api/config
 * with only the Wi-Fi. The Base switches over by itself once the phone has left (wildnetwork-base wnnet.py).
 */
export default function BaseWifiScreen() {
  const { id, url } = useLocalSearchParams<{ id: string; url?: string }>();
  const [base, setBase] = useState<ManagedBase | null>(null);
  const [ssid, setSsid] = useState('');
  const [psk, setPsk] = useState('');
  const [showPsk, setShowPsk] = useState(false);
  const [code, setCode] = useState('');
  const [askCode, setAskCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ssid: string; warnings: string[] } | null>(null);
  const autoJoin = canJoinHotspot();

  useEffect(() => {
    void getBases().then((all) => {
      const b = all.find((x) => x.deviceId === id || x.hardwareId === id) ?? null;
      setBase(b);
      if (b && !pickSetupCode(b.setupCode, '').ok) setAskCode(true);
    });
    return () => leaveHotspot();
  }, [id]);

  /** The address this Base answers at now: the one the Base page found, else its own Wi-Fi. */
  async function reach(b: ManagedBase, setupCode: string): Promise<{ url: string; joined: boolean }> {
    const matches = async (u: string, ms: number) => (await getBaseInfo(u, ms).catch(() => null))?.hardwareId === b.hardwareId;
    if (url && (await matches(url, 4000))) return { url, joined: false };
    let joined = false;
    if (autoJoin && b.ssid) {
      setProgress(`Joining ${b.ssid}`);
      const r = await joinHotspot(b.ssid, setupCode);
      if (r === 'connected') {
        routeToBase(true);
        joined = true;
      }
    }
    setProgress('Looking for the Base');
    if (await matches(BASE_HOTSPOT_URL, 10_000)) return { url: BASE_HOTSPOT_URL, joined };
    const other = await getBaseInfo(BASE_HOTSPOT_URL, 3000).catch(() => null);
    if (other) throw new BaseError('A different Base answered. Check that you are next to the right one.', 409);
    throw new BaseError('Could not reach the Base.', 0);
  }

  function save() {
    if (!base) return;
    setError(null);
    const req = buildWifiRequest(ssid, psk, base.setupCode, askCode ? code : '');
    if (!req.ok) return setError(req.error);
    const name = req.value.config.wifi!.ssid;
    Alert.alert('Change the Wi-Fi?', `${base.name} will use ${name} instead of the Wi-Fi it has now. ${WIFI_CHANGE_NOTE}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change Wi-Fi',
        onPress: () =>
          void (async () => {
            setBusy(true);
            let joined = false;
            try {
              const at = await reach(base, req.value.code);
              joined = at.joined;
              setProgress('Saving the new Wi-Fi on the Base');
              const r = await configureBase(at.url, req.value.code, req.value.config);
              const updated: ManagedBase = { ...base, setupCode: req.value.code };
              await saveBase(updated);
              setBase(updated);
              setPsk('');
              setDone({ ssid: name, warnings: [...(r.warnings ?? []), ...(r.notes ?? [])] });
            } catch (e) {
              const m = wifiErrorMessage(e);
              if (m.askForCode) setAskCode(true);
              setError(m.message);
            } finally {
              // Leaving the Base's Wi-Fi is what lets it switch to the new network.
              if (joined) leaveHotspot();
              setProgress(null);
              setBusy(false);
            }
          })(),
      },
    ]);
  }

  if (!base) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator color="#347F57" />
      </View>
    );
  }

  if (done) {
    return (
      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">Wi-Fi saved</Text>
        <Text className="mt-3 text-base text-gray-800 dark:text-gray-100">{base.name} now uses {done.ssid}.</Text>
        <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">{WIFI_CHANGE_NOTE}</Text>
        {!autoJoin ? (
          <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            If this phone is still on {base.ssid || 'the Base’s Wi-Fi'}, switch it back to your usual Wi-Fi in Settings.
          </Text>
        ) : null}
        {done.warnings.length > 0 ? (
          <View className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-950 p-4" accessibilityRole="alert">
            <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300">The Base said</Text>
            {done.warnings.map((w) => (
              <Text key={w} className="mt-1 text-sm text-amber-800 dark:text-amber-300">{w}</Text>
            ))}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" className="mt-6 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" onPress={() => router.back()}>
          <Text className="text-base font-semibold text-white">Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const savedCode = pickSetupCode(base.setupCode, askCode ? code : '');
  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">Change Wi-Fi</Text>
      <Text className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-300">For {base.name}, for example after moving it.</Text>

      <View className="mb-5 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
        <Text className="text-sm text-gray-700 dark:text-gray-200">
          At a new place the Base cannot find its old Wi-Fi, so about 2 minutes after it is switched on it turns on its own Wi-Fi, {base.ssid || 'Wildlife Network-…'}. Stand next to the Base.
        </Text>
        {autoJoin ? (
          <Text className="mt-2 text-sm text-gray-700 dark:text-gray-200">This phone joins that Wi-Fi by itself when you save, and leaves it afterwards.</Text>
        ) : (
          <Text className="mt-2 text-sm text-gray-700 dark:text-gray-200">
            First join {base.ssid || 'the Base’s Wi-Fi'} in this phone’s Wi-Fi settings
            {savedCode.ok ? <>, password <Text className="font-semibold">{hotspotPassword(savedCode.value)}</Text></> : null}, then come back here.
          </Text>
        )}
      </View>

      <Text className={label}>New Wi-Fi name</Text>
      <TextInput className={input} value={ssid} onChangeText={setSsid} placeholder="Network name" autoCapitalize="none" autoCorrect={false} accessibilityLabel="New Wi-Fi name" />
      <Text className={label}>Wi-Fi password</Text>
      <TextInput
        className={input}
        value={psk}
        onChangeText={setPsk}
        placeholder="Password"
        secureTextEntry={!showPsk}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Wi-Fi password"
      />
      <Pressable accessibilityRole="button" className="-mt-1 mb-3 self-start" onPress={() => setShowPsk((v) => !v)}>
        <Text className="text-sm font-semibold text-green-700 dark:text-green-300">{showPsk ? 'Hide password' : 'Show password'}</Text>
      </Pressable>
      <Text className={hint}>The Base keeps one home Wi-Fi: this one replaces the old one. The password is only sent to the Base, never to Wildlife Network, and is not kept on this phone.</Text>

      {askCode ? (
        <>
          <Text className={label}>Setup code</Text>
          <TextInput className={input} value={code} onChangeText={setCode} placeholder="ABCD EFGH" autoCapitalize="characters" autoCorrect={false} maxLength={11} />
          <Text className={hint}>On the label on the Base, and in wildnetwork-setup.txt on its SD card. It stays on this phone and is only sent to the Base.</Text>
        </>
      ) : null}

      {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
      {progress ? <Text className="mb-3 text-sm text-gray-600 dark:text-gray-300">{progress}</Text> : null}
      <Pressable
        accessibilityRole="button"
        className={`mt-2 items-center rounded-2xl py-3.5 active:opacity-75 ${busy ? 'bg-gray-300 dark:bg-gray-700' : 'bg-green-700'}`}
        disabled={busy}
        onPress={save}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Save</Text>}
      </Pressable>
    </ScrollView>
  );
}
