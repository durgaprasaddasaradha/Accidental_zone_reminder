import React from 'react';
import { AccidentZone } from '../types/zone';
import { ShieldAlert, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

interface ZoneCardProps {
  zone: AccidentZone;
}

export const ZoneCard: React.FC<ZoneCardProps> = ({ zone }) => {
  const hasCoordinates = zone.latitude !== null && zone.longitude !== null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between">
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            {zone.source || 'OFFICIAL SOURCE'}
          </span>

          {hasCoordinates ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Coordinates Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
              Location Description Only (No GPS)
            </span>
          )}
        </div>

        {/* Zone Name */}
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
          {zone.name || 'Not available'}
        </h3>

        {/* Location Provenance Warning Standard */}
        <p className="text-xs text-slate-500 italic mb-4">
          Approaching an officially identified accident-prone / black-spot location.
        </p>

        {/* Key Attributes Grid */}
        <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-xs font-medium text-slate-400 block uppercase">State / District</span>
            <span className="font-semibold text-slate-800">
              {zone.state && zone.district ? `${zone.state}, ${zone.district}` : 'Not available'}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 block uppercase">Highway</span>
            <span className="font-semibold text-slate-800">
              {zone.highway || 'Not available'}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 block uppercase">Black Spot Code</span>
            <span className="font-mono text-xs font-semibold text-indigo-700">
              {zone.black_spot_code || 'Not available'}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 block uppercase">Priority</span>
            <span className="font-semibold text-slate-800">
              {zone.official_priority || 'Not available'}
            </span>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border border-slate-200 rounded-lg p-2.5 text-center bg-white">
            <span className="text-xs font-medium text-slate-500 block">Total Accidents</span>
            <span className="text-lg font-extrabold text-slate-900">
              {zone.accident_count !== null ? zone.accident_count : 'Not available'}
            </span>
          </div>
          <div className="border border-rose-100 rounded-lg p-2.5 text-center bg-rose-50/40">
            <span className="text-xs font-medium text-rose-600 block">Recorded Fatalities</span>
            <span className="text-lg font-extrabold text-rose-700">
              {zone.fatalities !== null ? zone.fatalities : 'Not available'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Details: GPS Coordinates & Provenance */}
      <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {hasCoordinates
              ? `${zone.latitude?.toFixed(5)}, ${zone.longitude?.toFixed(5)}`
              : 'Not available'}
          </span>
        </div>
        <div>
          <span className="font-medium text-slate-600">Radius: </span>
          <span>{zone.warning_radius}m</span>
        </div>
      </div>
    </div>
  );
};
