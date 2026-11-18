import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, Platform, AppState } from 'react-native';
import {
  BASE_HOTSPOT_URL,
  BaseError,
  ackDetections,
  canJoinHotspot,
  getBaseInfo,
  getDetections,
  hotspotPassword,
  joinHotspot,
  leaveHotspot,
  normalizeSetupCode,
  routeToBase,
} from '../lib/base';
import { saveBase, type ManagedBase } from '../lib/secureStorage';
import { HOTSPOT_POLL, isBaseInfo, pollUntil } from '../lib/baseFind';
import { SetupCodeError, StoreError, runPickup, type PickupProgress } from '../lib/pickup';
import { fileOutbox, flushOutbox, getLastPickup, setLastPickup, waitingCounts, type LastPickup } from '../lib/outbox';
import { ago } from '../lib/baseHealth';

type Phase = 'idle' | 'joining' | 'manual-join' | 'collecting' | 'uploading';

const heading = 'mt-6 mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

function asPickupError(e: unknown): never {
  if (e instanceof BaseError && (e.status === 403 || e.status === 429)) throw new SetupCodeError(e.message);
  throw e;
}

/**
 * "Collect detections" for a Base with no 4G or Wi-Fi: join its hotspot, store each batch on the phone, then
 * acknowledge it. The outbox goes to Wildlife Network with the Base's own key whenever the phone is online.
 */
export default function CollectDetections({ base, onBaseChange }: { base: ManagedBase; onBaseChange: (b: ManagedBase) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<PickupProgress>({ batches: 0, collected: 0 });
  const [waiting, setWaiting] = useState<number | null>(null);
  const [last, setLast] = useState<LastPickup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedCode, setTypedCode] = useState('');
  const [askCode, setAskCode] = useState(!base.setupCode);
  const cancelled = useRef(false);
  const hasKey = !!base.apiKey;

  const refresh = useCallback(async () => {
    const [counts, lp] = await Promise.all([waitingCounts().catch(() => ({}) as Record<string, number>), getLastPickup(base.hardwareId)]);
    setWaiting(counts[base.hardwareId] ?? 0);
    setLast(lp);
  }, [base.hardwareId]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refresh();
    });
    return () => {
      cancelled.current = true;
      sub.remove();
    };
  }, [refresh]);

  const upload = useCallback(async () => {
    setPhase('uploading');
    const r = (await flushOutbox())[base.hardwareId];
    await refresh();
    setPhase('idle');
    if (r?.outcome === 'key') setError('Wildlife Network did not accept this Base\'s key. The detections stay on this phone.');
    else if (r?.outcome === 'rejected') setError('Wildlife Network refused these detections. They stay on this phone; check for an app update.');
    else if (r && r.sent > 0) setMessage(`Uploaded ${r.sent} detections to Wildlife Network.`);
    return r;
  }, [base.hardwareId, refresh]);

  /** Collect over the hotspot: the phone must already be on it (joined by the app or by the user). */
  const collect = useCallback(
    async (code: string) => {
      setPhase('collecting');
      setProgress({ batches: 0, collected: 0 });
      try {
        const info = await getBaseInfo(BASE_HOTSPOT_URL, 5000);
        if (info.hardwareId !== base.hardwareId) {
          throw new Error(`This phone is on another Base's Wi-Fi (${info.name ?? info.hostname}). Join ${base.ssid || 'this Base\'s Wi-Fi'} and try again.`);
        }
        const r = await runPickup({
          fetchBatch: () => getDetections(BASE_HOTSPOT_URL, 500).catch(asPickupError),
          store: (events) => fileOutbox.add(base.hardwareId, events),
          ack: async (cursor) => {
            await ackDetections(BASE_HOTSPOT_URL, code, cursor).catch(asPickupError);
          },
          onProgress: setProgress,
          cancelled: () => cancelled.current,
        });
        if (r.error instanceof SetupCodeError) {
          setAskCode(true);
          throw new Error(`${r.error.message} Type the code from the label below.`);
        }
        if (r.error instanceof StoreError) throw new Error(`Could not save on this phone (${r.error.message}). Nothing was taken from the Base. Free some space and try again.`);
        if (code !== base.setupCode && r.batches > 0) {
          const next = { ...base, setupCode: code };
          await saveBase(next);
          onBaseChange(next);
          setAskCode(false);
        }
        if (r.batches > 0 || r.done) {
          const lp = { at: new Date().toISOString(), collected: r.collected, batches: r.batches };
          await setLastPickup(base.hardwareId, lp);
        }
        if (r.error) {
          throw new Error(`Stopped after ${r.collected} detections: ${r.error.message} What was collected is safe on this phone; tap Collect again to go on.`);
        }
        setMessage(
          r.collected
            ? `Collected ${r.collected} detections in ${r.batches} batches. ${Platform.OS === 'ios' ? 'Switch back to your usual Wi-Fi: they' : 'They'} upload as soon as the phone has internet.`
            : 'Nothing was waiting on the Base.',
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not collect from the Base.');
      } finally {
        leaveHotspot();
        await refresh();
        setPhase('idle');
      }
      // Online again (Android leaves the hotspot at once): try the upload straight away.
      void upload();
    },
    [base, onBaseChange, refresh, upload],
  );

  const code = normalizeSetupCode(askCode ? typedCode : base.setupCode);

  async function start() {
    setError(null);
    setMessage(null);
    if (!code) return setError('Type the 8 character setup code from the label on the Base.');
    cancelled.current = false;
    if (canJoinHotspot() && base.ssid) {
      setPhase('joining');
      const r = await joinHotspot(base.ssid, code);
      if (r === 'connected') {
        routeToBase(true);
        return collect(code);
      }
      if (r !== 'unsupported') {
        setPhase('idle');
        return setError('Could not join the Base\'s Wi-Fi. Stand close to the Base and check the setup code.');
      }
    }
    setPhase('manual-join');
  }

  // Joining by hand: wait until this Base answers on its hotspot, then collect.
  const [waitRun, setWaitRun] = useState(0);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  useEffect(() => {
    if (phase !== 'manual-join' || !code) return;
    let stop = false;
    setWaitTimedOut(false);
    void pollUntil(
      async () => {
        const i = await getBaseInfo(BASE_HOTSPOT_URL, HOTSPOT_POLL.requestMs);
        return isBaseInfo(i) ? i : null;
      },
      { intervalMs: HOTSPOT_POLL.intervalMs, timeoutMs: HOTSPOT_POLL.timeoutMs, cancelled: () => stop },
    ).then((i) => {
      if (stop) return;
      if (i) void collect(code);
      else setWaitTimedOut(true);
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setWaitRun((n) => n + 1);
    });
    return () => {
      stop = true;
      sub.remove();
    };
  }, [phase, waitRun, code, collect]);

  const busy = phase !== 'idle' && phase !== 'manual-join';

  return (
    <View>
      <Text className={heading}>Collect detections</Text>
      <View className="rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
        <Text className="text-sm text-gray-700 dark:text-gray-200">
          {waiting == null ? 'Checking this phone' : waiting === 0 ? 'Nothing waiting to upload' : `${waiting} detections waiting to upload`}
        </Text>
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {last ? `Last pickup ${ago(last.at)}: ${last.collected} detections` : 'No pickup from this phone yet'}
        </Text>
      </View>

      {!hasKey ? (
        <Text className="mt-2 ml-1 text-sm text-gray-600 dark:text-gray-300">
          This phone cannot carry this Base&apos;s detections: it does not hold the Base&apos;s key, because the Base
          was registered before it was added here, or from another phone. Nothing is lost: the Base keeps its
          detections and sends them itself as soon as it has internet through Wi-Fi or a SIM. The phone that
          set the Base up can collect them.
        </Text>
      ) : (
        <>
          <Text className="mt-2 ml-1 text-xs text-gray-500 dark:text-gray-400">
            For a Base without Wi-Fi or a SIM. Stand near it: the phone joins its Wi-Fi, takes the detections and
            uploads them to Wildlife Network once it has internet again.
          </Text>
          {askCode ? (
            <TextInput
              className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 text-gray-900 dark:text-gray-50"
              value={typedCode}
              onChangeText={setTypedCode}
              placeholder="Setup code from the label, e.g. ABCD EFGH"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={11}
              accessibilityLabel="Setup code from the label"
            />
          ) : null}

          {phase === 'manual-join' && code ? (
            <View className="mt-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
              <Text className="text-sm text-gray-800 dark:text-gray-100">
                1. Open {Platform.OS === 'ios' ? 'Settings, then Wi-Fi' : 'Settings, then Wi-Fi (or Network and internet)'}.
              </Text>
              <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">2. Tap this network:</Text>
              <Text selectable className="mt-1 ml-4 text-[15px] font-semibold text-gray-900 dark:text-gray-50">{base.ssid || 'Wildlife Network-XXXX (on the label)'}</Text>
              <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">3. Enter this password:</Text>
              <Text selectable className="mt-1 ml-4 font-mono text-[15px] text-gray-900 dark:text-gray-50">{hotspotPassword(code)}</Text>
              <Text className="mt-2 text-sm text-gray-800 dark:text-gray-100">4. Come back to BirdEcho. Collecting starts by itself once the Base answers.</Text>
              {waitTimedOut ? (
                <Text className="mt-3 text-sm text-amber-700 dark:text-amber-300">The Base has not answered yet. Check the Wi-Fi and stand closer, then tap Try again.</Text>
              ) : (
                <View className="mt-3 flex-row items-center">
                  <ActivityIndicator color="#347F57" />
                  <Text className="ml-3 text-sm text-gray-600 dark:text-gray-300">Waiting for the Base</Text>
                </View>
              )}
              <View className="mt-3 flex-row gap-4">
                <Pressable accessibilityRole="button" onPress={() => setWaitRun((n) => n + 1)}>
                  <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Try again</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setPhase('idle')}>
                  <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {busy ? (
            <View className="mt-3 flex-row items-center rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5">
              <ActivityIndicator color="#347F57" />
              <Text className="ml-3 flex-1 text-sm text-gray-700 dark:text-gray-200">
                {phase === 'joining'
                  ? 'Joining the Base\'s Wi-Fi. Approve the connection when Android asks.'
                  : phase === 'uploading'
                    ? 'Uploading to Wildlife Network'
                    : `Collecting: ${progress.batches} batches, ${progress.collected} detections`}
              </Text>
            </View>
          ) : null}

          {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}
          {message ? <Text className="mt-3 text-sm text-green-800 dark:text-green-300">{message}</Text> : null}

          {phase === 'idle' ? (
            <Pressable accessibilityRole="button" className="mt-3 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" onPress={() => void start()}>
              <Text className="text-base font-semibold text-white">Collect detections</Text>
            </Pressable>
          ) : null}
          {phase === 'idle' && (waiting ?? 0) > 0 ? (
            <Pressable accessibilityRole="button" className="mt-2 items-center py-2 active:opacity-75" onPress={() => void upload()}>
              <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Upload now</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
