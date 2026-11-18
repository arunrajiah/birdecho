/**
 * Look for Wildlife Network Bases on the home network: browse mDNS for `_wlnw-base._tcp` (NSNetServiceBrowser
 * on iOS, NsdManager on Android, via @inthepocket/react-native-service-discovery) and try the .local names of
 * Bases this phone knows, then verify every address with /api/info (baseFind.ts).
 */
import { getBaseInfo } from './baseApi';
import { BASE_SERVICE, nameUrls, serviceUrls, verifyBases, type FoundBase, type FoundService } from './baseFind';

type Discovery = typeof import('@inthepocket/react-native-service-discovery');

function discovery(): Discovery | null {
  try {
    // Loaded lazily: the module builds a native event emitter on import, which throws if it is not linked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@inthepocket/react-native-service-discovery') as Discovery;
  } catch {
    return null;
  }
}

/** Browse mDNS for `browseMs`, collecting candidate addresses. Never throws; no module means no services. */
async function browse(browseMs: number): Promise<string[]> {
  const sd = discovery();
  if (!sd) return [];
  const urls: string[] = [];
  let sub: { remove: () => void } | null = null;
  try {
    sub = sd.addEventListener('serviceFound', (s: FoundService) => urls.push(...serviceUrls(s)));
    await sd.startSearch(BASE_SERVICE);
    await new Promise((r) => setTimeout(r, browseMs));
  } catch {
    // Local network permission refused, or discovery not available: fall back to names and manual entry.
  } finally {
    sub?.remove();
    await sd.stopSearch(BASE_SERVICE).catch(() => undefined);
  }
  return urls;
}

/**
 * Bases answering on this network. `knownNames` are hotspot names or label characters ("Wildlife Network-7A8D",
 * "7A8D") whose host names are worth trying even when mDNS browsing finds nothing.
 */
export async function findBases(knownNames: (string | null | undefined)[], browseMs = 5000): Promise<FoundBase[]> {
  const [fromNames, fromServices] = await Promise.all([verifyBases(nameUrls(knownNames), (u) => getBaseInfo(u, 3000)), browse(browseMs)]);
  const fromBrowse = await verifyBases(fromServices, (u) => getBaseInfo(u, 3000));
  const seen = new Set(fromBrowse.map((b) => b.info.hardwareId));
  return [...fromBrowse, ...fromNames.filter((b) => !seen.has(b.info.hardwareId))];
}
