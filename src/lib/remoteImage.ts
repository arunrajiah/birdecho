import type { ImageURISource } from 'react-native';

/**
 * Wikimedia (and the Wikipedia API) answer 403 to clients without a
 * descriptive User-Agent, and React Native on Android sends okhttp's default
 * one. Every remote image and Wikipedia request carries this instead.
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */
export const USER_AGENT = 'BirdEcho (https://github.com/arunrajiah/birdecho)';

export function remoteImage(uri: string): ImageURISource {
  return { uri, headers: { 'User-Agent': USER_AGENT } };
}
