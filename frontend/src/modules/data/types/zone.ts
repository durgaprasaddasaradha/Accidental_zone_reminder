/**
 * Accident Zone TypeScript Types
 * Corresponds to backend Pydantic models in api/schemas/zone.py
 */

export type LocationSource = 'OFFICIAL' | 'VERIFIED_DERIVED' | 'UNKNOWN';
export type LocationAccuracy = 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';

export interface AccidentZone {
  id: string;
  name: string;
  state: string;
  district: string;
  highway: string | null;
  road_type: string | null;
  black_spot_code: string | null;
  latitude: number | null;
  longitude: number | null;
  accident_count: number | null;
  fatalities: number | null;
  severity: string | null;
  official_priority: string | null;
  warning_radius: number;
  source: string;
  source_url: string | null;
  source_date: string | null;
  data_period_start: string | null;
  data_period_end: string | null;
  location_source: LocationSource;
  location_accuracy: LocationAccuracy;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ZoneStats {
  total_zones: number;
  zones_with_coordinates: number;
  zones_without_coordinates: number;
  total_fatalities: number;
  total_accidents: number;
  states_count: number;
  states_represented: string[];
}

export interface ZoneListResponse {
  zones: AccidentZone[];
  total: number;
  limit: number;
  offset: number;
}

export interface ZoneQueryParams {
  state?: string;
  district?: string;
  has_coordinates?: boolean;
  limit?: number;
  offset?: number;
}
