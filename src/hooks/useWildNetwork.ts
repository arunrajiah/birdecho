import { useQuery } from '@tanstack/react-query';
import { useStationStore } from '../stores/stationStore';
import { fetchCellArrivals, fetchRegionDrift, regionFor } from '../lib/wildnetwork';

const HOUR = 60 * 60 * 1000;
const DEMO_LOCATION = { lat: 42.36, lon: -71.06 };

/** Approximate location of the active station, or null if it has none yet. */
export function useStationLocation(): { lat: number; lon: number } | null {
  const station = useStationStore((s) => s.stations.find((st) => st.id === s.activeStationId));
  // The demo's sample birds are from the US north-east, so show that area's WildNetwork data.
  if (station?.connectionType === 'demo') return DEMO_LOCATION;
  if (typeof station?.latitude !== 'number' || typeof station?.longitude !== 'number') return null;
  if (station.latitude === 0 && station.longitude === 0) return null;
  return { lat: station.latitude, lon: station.longitude };
}

/** Seasonal timing for every species in the station's 5-degree cell. */
export function useCellArrivals() {
  const loc = useStationLocation();
  // The server works per 5-degree cell, so key on the cell to share cache between nearby stations.
  const cell = loc ? `${Math.floor(loc.lat / 5) * 5},${Math.floor(loc.lon / 5) * 5}` : null;
  return useQuery({
    queryKey: ['wildnetwork', 'arrivals', cell],
    queryFn: () => fetchCellArrivals(loc!.lat, loc!.lon),
    enabled: loc !== null,
    staleTime: 6 * HOUR,
  });
}

export function useRegionDrift() {
  const loc = useStationLocation();
  const region = loc ? regionFor(loc.lat, loc.lon) : null;
  return useQuery({
    queryKey: ['wildnetwork', 'drift', region],
    queryFn: () => fetchRegionDrift(region!),
    enabled: region !== null,
    staleTime: HOUR,
  });
}
