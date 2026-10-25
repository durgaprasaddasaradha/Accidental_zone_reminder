/**
 * Accident Zone Data Service
 * 
 * ARCHITECTURE RULE:
 * This service communicates exclusively with the FastAPI backend (/api/zones).
 * Supabase is NEVER accessed directly from the client.
 */

import { AccidentZone, ZoneListResponse, ZoneQueryParams, ZoneStats } from '../types/zone';

// Use environment variable if defined, otherwise relative path handled by Vite proxy or Vercel
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const zoneService = {
  /**
   * Retrieves active accident black-spot zones with optional filters.
   */
  async fetchZones(params: ZoneQueryParams = {}): Promise<ZoneListResponse> {
    const searchParams = new URLSearchParams();

    if (params.state) {
      searchParams.append('state', params.state);
    }
    if (params.district) {
      searchParams.append('district', params.district);
    }
    if (params.has_coordinates !== undefined) {
      searchParams.append('has_coordinates', String(params.has_coordinates));
    }
    if (params.limit !== undefined) {
      searchParams.append('limit', String(params.limit));
    }
    if (params.offset !== undefined) {
      searchParams.append('offset', String(params.offset));
    }

    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/zones${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch zones (${response.status}): ${errorText}`);
    }

    return response.json();
  },

  /**
   * Retrieves a single accident zone by its identifier.
   */
  async fetchZoneById(id: string): Promise<AccidentZone> {
    const url = `${API_BASE_URL}/api/zones/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch zone details (${response.status}): ${errorText}`);
    }

    return response.json();
  },

  /**
   * Retrieves aggregated summary statistics for accident black spots.
   */
  async fetchZoneStats(): Promise<ZoneStats> {
    const url = `${API_BASE_URL}/api/zones/stats`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch zone statistics (${response.status}): ${errorText}`);
    }

    return response.json();
  },
};
