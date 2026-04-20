export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Detection {
  id: string;
  speciesId: string;
  commonName: string;
  scientificName: string;
  timestamp: string;
  confidence: number;
  soundscapeUrl?: string;
  imageUrl?: string;
}

export interface RecordsPage {
  records: Detection[];
  cursor?: string;
}

export interface Stats {
  totalRecords: number;
  uniqueSpecies: number;
  recordsToday: number;
}

export interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  imageUrl?: string;
  count: number;
}
