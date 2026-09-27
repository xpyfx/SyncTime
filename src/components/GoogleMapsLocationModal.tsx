import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Search,
  X,
  Send,
  ExternalLink,
  Loader2,
  Check
} from 'lucide-react';
import { LocationData } from '../types';

interface GoogleMapsLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendLocation: (location: LocationData) => void;
}

interface PhotonPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const GoogleMapsLocationModal: React.FC<GoogleMapsLocationModalProps> = ({
  isOpen,
  onClose,
  onSendLocation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PhotonPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PhotonPlace | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  if (!isOpen) return null;

  const buildAddress = (properties: any) => {
    const streetLine = [
      properties.housenumber,
      properties.street
    ]
      .filter(Boolean)
      .join(' ');

    const parts = [
      streetLine,
      properties.district,
      properties.locality,
      properties.city,
      properties.county,
      properties.state,
      properties.postcode,
      properties.country
    ].filter(Boolean);

    // 避免重複城市 / 州 / 國家名稱
    return [...new Set(parts)].join(', ');
  };

  const buildGoogleMapsUrl = (
  name: string,
  address: string,
  lat: number,
    lng: number
  ) => {
    const query = address
      ? `${name}, ${address}`
      : `${lat},${lng}`;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();

    if (!query) return;

    setIsSearching(true);
    setSearchError('');
    setSelectedPlace(null);

    try {
      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Photon request failed: ${response.status}`);
      }

      const data = await response.json();

      const places: PhotonPlace[] = (data.features || [])
        .map((feature: any, index: number) => {
          const properties = feature.properties || {};
          const coordinates = feature.geometry?.coordinates || [];

          const lng = Number(coordinates[0]);
          const lat = Number(coordinates[1]);

          const name =
            properties.name ||
            properties.street ||
            properties.city ||
            query;

          const address = buildAddress(properties);

          return {
            id:
              `${properties.osm_type || 'osm'}_` +
              `${properties.osm_id || index}`,
            name,
            address,
            lat,
            lng
          };
        })
        .filter(
          (place: PhotonPlace) =>
            Number.isFinite(place.lat) &&
            Number.isFinite(place.lng)
        );

      setResults(places);

      if (places.length === 0) {
        setSearchError('找不到符合的地點，請嘗試輸入更完整的名稱。');
      }
    } catch (error) {
      console.error('Photon place search failed:', error);
      setResults([]);
      setSearchError('目前無法取得地點搜尋結果，請稍後再試。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSend = () => {
    if (!selectedPlace) return;

    const googleMapsUri = buildGoogleMapsUrl(
      selectedPlace.name,
      selectedPlace.address,
      selectedPlace.lat,
      selectedPlace.lng
    );

    const location: LocationData = {
      id: `loc_${Date.now()}`,
      name: selectedPlace.name,
      address: selectedPlace.address,
      query: `${selectedPlace.name} ${selectedPlace.address}`.trim(),
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      googleMapsUri,
      createdAt: new Date().toISOString()
    };

    onSendLocation(location);

    resetAndClose();
  };

  const resetAndClose = () => {
    setSearchQuery('');
    setResults([]);
    setSelectedPlace(null);
    setSearchError('');
    setIsSearching(false);
    onClose();
  };

  const selectedMapsUrl = selectedPlace
  ? buildGoogleMapsUrl(
      selectedPlace.name,
      selectedPlace.address,
      selectedPlace.lat,
      selectedPlace.lng
    )
  : '';

  return (
    <div
      className="
        fixed inset-0 z-[120]
        flex items-center justify-center
        p-4
        bg-black/50 backdrop-blur-xs
      "
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="
          bg-white
          rounded-3xl
          max-w-sm sm:max-w-md
          w-full
          p-5
          shadow-2xl
          border border-apple-gray-100
          max-h-[85vh]
          flex flex-col
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="
                w-9 h-9
                rounded-full
                bg-[#B6cada]/40
                flex items-center justify-center
                text-[#035096]
              "
            >
              <MapPin size={19} />
            </div>

            <div>
              <h3 className="font-bold text-apple-gray-900 text-base">
                分享地點
              </h3>

              <p className="text-[11px] text-apple-gray-400 mt-0.5">
                搜尋並選擇要分享的地點
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetAndClose}
            className="
              w-8 h-8
              rounded-full
              bg-apple-gray-100
              flex items-center justify-center
              text-apple-gray-500
              hover:bg-apple-gray-200
              transition-colors
            "
          >
            <X size={17} />
          </button>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2 shrink-0"
        >
          <div
            className="
              flex-1
              flex items-center gap-2
              bg-apple-gray-50
              border border-apple-gray-200
              focus-within:border-[#035096]
              focus-within:ring-2
              focus-within:ring-[#B6cada]/60
              rounded-2xl
              px-3.5
              h-11
              transition-all
            "
          >
            <Search
              size={16}
              className="text-apple-gray-400 shrink-0"
            />

            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedPlace(null);
              }}
              placeholder="例如：台北 101、東京鐵塔"
              className="
                flex-1
                bg-transparent
                outline-none
                text-sm
                text-apple-gray-900
                placeholder:text-apple-gray-400
              "
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!searchQuery.trim() || isSearching}
            className="
              h-11
              px-4
              rounded-2xl
              bg-[#035096]
              hover:bg-[#02457D]
              text-white
              text-xs
              font-bold
              disabled:opacity-40
              flex items-center justify-center
              min-w-[58px]
              active:scale-95
              transition-all
              shadow-xs
            "
          >
            {isSearching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              '搜尋'
            )}
          </button>
        </form>

        {/* Search Error */}
        {searchError && (
          <div className="mt-3 text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {searchError}
          </div>
        )}

        {/* Candidate Results */}
        {results.length > 0 && (
          <div className="mt-4 overflow-y-auto no-scrollbar flex-1 min-h-0">
            <div className="text-[11px] font-bold text-apple-gray-400 mb-2 px-1">
              搜尋結果
            </div>

            <div className="space-y-2">
              {results.map((place) => {
                const isSelected = selectedPlace?.id === place.id;

                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedPlace(place)}
                    className={`
                      w-full
                      text-left
                      p-3
                      rounded-2xl
                      border
                      transition-all
                      flex items-start
                      gap-3
                      ${
                        isSelected
                          ? 'bg-[#B6cada]/30 border-[#035096] ring-1 ring-[#035096]/30 shadow-xs'
                          : 'bg-white border-apple-gray-200 hover:bg-[#B6cada]/10'
                      }
                    `}
                  >
                    <div
                      className={`
                        w-8 h-8
                        rounded-xl
                        flex items-center justify-center
                        shrink-0
                        transition-colors
                        ${
                          isSelected
                            ? 'bg-[#035096] text-white shadow-2xs'
                            : 'bg-[#B6cada]/35 text-[#035096]'
                        }
                      `}
                    >
                      {isSelected ? (
                        <Check size={16} />
                      ) : (
                        <MapPin size={16} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm leading-snug ${isSelected ? 'text-[#035096]' : 'text-apple-gray-900'}`}>
                        {place.name}
                      </div>

                      {place.address && (
                        <div className="text-[11px] text-apple-gray-500 mt-1 leading-relaxed">
                          {place.address}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Place Actions */}
        {selectedPlace && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="
              mt-4
              pt-4
              border-t border-[#B6cada]/40
              shrink-0
            "
          >
            <div className="text-[11px] font-bold text-[#035096]/70 mb-1.5 flex items-center gap-1">
              <span>已選擇地點</span>
            </div>

            <div className="p-3 bg-[#B6cada]/20 rounded-2xl border border-[#035096]/20">
              <div className="font-bold text-sm text-[#035096]">
                📍 {selectedPlace.name}
              </div>

              {selectedPlace.address && (
                <div className="text-[11px] text-apple-gray-600 mt-1 leading-relaxed">
                  {selectedPlace.address}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <a
                href={selectedMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex-1
                  h-10
                  rounded-xl
                  bg-white
                  border border-[#035096]/30
                  text-[#035096]
                  hover:bg-[#B6cada]/20
                  text-xs
                  font-bold
                  flex items-center justify-center
                  gap-1.5
                  transition-all
                "
              >
                <ExternalLink size={13} />
                先查看
              </a>

              <button
                type="button"
                onClick={handleSend}
                className="
                  flex-1
                  h-10
                  rounded-xl
                  bg-[#035096]
                  hover:bg-[#02457D]
                  text-white
                  text-xs
                  font-bold
                  flex items-center justify-center
                  gap-1.5
                  active:scale-95
                  transition-all
                  shadow-xs
                "
              >
                <Send size={13} />
                發送地點
              </button>
            </div>
          </motion.div>
        )}

        {/* Attribution */}
        <div className="mt-3 text-center shrink-0">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-apple-gray-300 hover:text-apple-gray-500"
          >
            Search data © OpenStreetMap contributors · Photon
          </a>
        </div>
      </motion.div>
    </div>
  );
};