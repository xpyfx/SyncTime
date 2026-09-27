import React from 'react';
import {
  MapPin,
  ExternalLink
} from 'lucide-react';
import { LocationData } from '../types';

interface GoogleMapsLocationCardProps {
  location: LocationData;
  msgTime?: string;
  isMe?: boolean;
}

export const GoogleMapsLocationCard: React.FC<
  GoogleMapsLocationCardProps
> = ({
  location,
  msgTime
}) => {
  const query =
    location.query ||
    `${location.name} ${location.address || ''}`.trim();

  const mapsUrl =
    location.googleMapsUri ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;

  const handleOpenMaps = () => {
    window.open(
      mapsUrl,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      id={`location-card-${location.id}`}
      className="
        w-[270px]
        sm:w-[300px]
        bg-[#B6cada]
        rounded-[20px]
        p-3.5
        border border-[#035096]/25
        shadow-apple-xs
        text-left
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="
            flex items-center gap-1.5
            text-[#035096]
            font-bold
            text-[11px]
          "
        >
          <MapPin
            size={14}
            className="text-[#035096]"
          />

          <span>分享地點</span>
        </div>

        {msgTime && (
          <span className="text-[10px] text-[#035096]/70 font-medium">
            {msgTime}
          </span>
        )}
      </div>

      {/* Place Name */}
      <div className="font-extrabold text-[15px] text-[#17364D] leading-snug">
        {location.name}
      </div>

      {/* Address */}
      {location.address && (
        <div className="text-[11px] text-[#294B63] mt-1 leading-relaxed">
          {location.address}
        </div>
      )}

      {/* Google Maps Button */}
      <button
        type="button"
        onClick={handleOpenMaps}
        className="
          w-full
          mt-3
          h-10
          rounded-xl
          bg-[#035096]
          hover:bg-[#02457D]
          text-white
          text-xs
          font-bold
          flex items-center justify-center gap-1.5
          active:scale-[0.98]
          transition-all
          shadow-xs
        "
      >
        <span>在 Google Maps 查看</span>
        <ExternalLink size={13} />
      </button>
    </div>
  );
};