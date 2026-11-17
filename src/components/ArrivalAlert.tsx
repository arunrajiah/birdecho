import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { fetchNear, subscribeAlert } from '../lib/wildnetwork';

const input = 'rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white';

/**
 * "Email me when it arrives near me": a Wildlife Network species alert (one email when the species turns up in the
 * area, about 550 km across, after weeks away). The town is pre-filled from the rough area Wildlife Network sees.
 */
export default function ArrivalAlert({ species, name }: { species: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open || place) return;
    void fetchNear().then((n) => { if (n?.city) setPlace((p) => p || n.city!); }).catch(() => {});
  }, [open, place]);

  async function send() {
    setBusy(true); setMsg(null);
    try { setMsg({ ok: true, text: await subscribeAlert({ email, species, place }) }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" className="mt-4 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5 active:opacity-75" onPress={() => setOpen(true)}>
        <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Email me when the {name} arrives near me</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-4 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5">
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">Email me when the {name} arrives near me</Text>
      <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        One email when it is recorded in your area (about 550 km across) after weeks away, at most once every two months. Sent by Wildlife Network; every email has a link to stop it.
      </Text>
      {msg?.ok ? (
        <Text className="mt-3 text-sm text-green-700 dark:text-green-300">{msg.text}</Text>
      ) : (
        <>
          <TextInput className={`${input} mt-3`} placeholder="Your email" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            value={email} onChangeText={setEmail} />
          <TextInput className={`${input} mt-2`} placeholder="Your town or city" value={place} onChangeText={setPlace} />
          {msg && !msg.ok ? <Text className="mt-2 text-sm text-red-600 dark:text-red-400">{msg.text}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} className={`mt-3 items-center rounded-2xl py-3 active:opacity-75 ${busy ? 'bg-gray-300' : 'bg-green-700'}`} onPress={() => void send()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Send me a confirmation email</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}
