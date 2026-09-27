import React, { useRef, useEffect, useState } from 'react';
import { Country, City } from 'country-state-city';
import countriesIso from 'i18n-iso-countries';
import zh from 'i18n-iso-countries/langs/zh.json';
import { Stay } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Globe, Compass, Eye, Map, Calendar, Locate } from 'lucide-react';

// Register Chinese locale for country ISO translation
countriesIso.registerLocale(zh);

interface TravelGlobeProps {
  stays: Stay[];
  onSelectStay?: (stay: Stay) => void;
}

// Simple coordinate mappings for fallback or reference
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Taiwan': { lat: 23.5937, lng: 121.0254 },
  '台灣': { lat: 23.5937, lng: 121.0254 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  '日本': { lat: 36.2048, lng: 138.2529 },
  'South Korea': { lat: 35.9078, lng: 127.7669 },
  '韓國': { lat: 35.9078, lng: 127.7669 },
  'Czechia': { lat: 49.8175, lng: 15.4730 },
  '捷克': { lat: 49.8175, lng: 15.4730 },
  'Austria': { lat: 47.5162, lng: 14.5501 },
  '奧地利': { lat: 47.5162, lng: 14.5501 },
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  '英國': { lat: 55.3781, lng: -3.4360 },
  'United States': { lat: 37.0902, lng: -95.7129 },
  '美國': { lat: 37.0902, lng: -95.7129 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  '德國': { lat: 51.1657, lng: 10.4515 },
  'France': { lat: 46.2276, lng: 2.2137 },
  '法國': { lat: 46.2276, lng: 2.2137 },
  'Thailand': { lat: 15.8700, lng: 100.9925 },
  '泰國': { lat: 15.8700, lng: 100.9925 },
  'Vietnam': { lat: 14.0583, lng: 108.2772 },
  '越南': { lat: 14.0583, lng: 108.2772 },
  'Malta': { lat: 35.9375, lng: 14.3754 },
  '馬爾他': { lat: 35.9375, lng: 14.3754 },
  'Poland': { lat: 51.9194, lng: 19.1451 },
  '波蘭': { lat: 51.9194, lng: 19.1451 },
  'Norway': { lat: 60.4720, lng: 8.4689 },
  '挪威': { lat: 60.4720, lng: 8.4689 },
  'Indonesia': { lat: -0.7893, lng: 113.9213 },
  '印尼': { lat: -0.7893, lng: 113.9213 },
};

const CUSTOM_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // 印尼 (Indonesia)
  '峇里島': { lat: -8.4095, lng: 115.1889 },
  'bali': { lat: -8.4095, lng: 115.1889 },
  '雅加達': { lat: -6.2088, lng: 106.8456 },
  'jakarta': { lat: -6.2088, lng: 106.8456 },

  // 日本 (Japan)
  '東京': { lat: 35.6762, lng: 139.6503 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  '大阪': { lat: 34.6937, lng: 135.5023 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  '京都': { lat: 35.0116, lng: 135.7681 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  '札幌': { lat: 43.0618, lng: 141.3545 },
  'sapporo': { lat: 43.0618, lng: 141.3545 },
  '福岡': { lat: 33.5902, lng: 130.4017 },
  'fukuoka': { lat: 33.5902, lng: 130.4017 },
  '名古屋': { lat: 35.1814, lng: 136.9064 },
  'nagoya': { lat: 35.1814, lng: 136.9064 },
  '橫濱': { lat: 35.4437, lng: 139.6380 },
  'yokohama': { lat: 35.4437, lng: 139.6380 },
  '神戶': { lat: 34.6901, lng: 135.1955 },
  'kobe': { lat: 34.6901, lng: 135.1955 },
  '奈良': { lat: 34.6851, lng: 135.8048 },
  'nara': { lat: 34.6851, lng: 135.8048 },
  '廣島': { lat: 34.3853, lng: 132.4553 },
  'hiroshima': { lat: 34.3853, lng: 132.4553 },
  '沖繩': { lat: 26.2124, lng: 127.6809 },
  'okinawa': { lat: 26.2124, lng: 127.6809 },
  '那霸': { lat: 26.2124, lng: 127.6809 },
  'naha': { lat: 26.2124, lng: 127.6809 },
  '九州': { lat: 33.1095, lng: 131.0150 },
  'kyushu': { lat: 33.1095, lng: 131.0150 },
  '北海道': { lat: 43.0641, lng: 141.3469 },
  'hokkaido': { lat: 43.0641, lng: 141.3469 },
  '熊本': { lat: 32.7801, lng: 130.7330 },
  'kumamoto': { lat: 32.7801, lng: 130.7330 },
  '鹿兒島': { lat: 31.5966, lng: 130.5571 },
  'kagoshima': { lat: 31.5966, lng: 130.5571 },

  // 台灣 (Taiwan)
  '台北': { lat: 25.0330, lng: 121.5654 },
  'taipei': { lat: 25.0330, lng: 121.5654 },
  '新北': { lat: 25.0160, lng: 121.4628 },
  'new taipei': { lat: 25.0160, lng: 121.4628 },
  '台中': { lat: 24.1477, lng: 120.6736 },
  'taichung': { lat: 24.1477, lng: 120.6736 },
  '台南': { lat: 22.9997, lng: 120.2270 },
  'tainan': { lat: 22.9997, lng: 120.2270 },
  '高雄': { lat: 22.6273, lng: 120.3014 },
  'kaohsiung': { lat: 22.6273, lng: 120.3014 },

  // 其他熱門國際城市 (Other Popular International Travel Spots)
  '曼谷': { lat: 13.7563, lng: 100.5018 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  '普吉島': { lat: 7.8804, lng: 98.3922 },
  'phuket': { lat: 7.8804, lng: 98.3922 },
  '清邁': { lat: 18.7883, lng: 98.9853 },
  'chiang mai': { lat: 18.7883, lng: 98.9853 },
  '芭達雅': { lat: 12.9236, lng: 100.8824 },
  'pattaya': { lat: 12.9236, lng: 100.8824 },
  '胡志明市': { lat: 10.8231, lng: 106.6297 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 },
  '河內': { lat: 21.0285, lng: 105.8542 },
  'hanoi': { lat: 21.0285, lng: 105.8542 },
  '峴港': { lat: 16.0544, lng: 108.2022 },
  'da nang': { lat: 16.0544, lng: 108.2022 },
  '首爾': { lat: 37.5665, lng: 126.9780 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  '釜山': { lat: 35.1796, lng: 129.0756 },
  'busan': { lat: 35.1796, lng: 129.0756 },
  '濟州': { lat: 33.4996, lng: 126.5312 },
  '濟州島': { lat: 33.4996, lng: 126.5312 },
  'jeju': { lat: 33.4996, lng: 126.5312 },
  '吉隆坡': { lat: 3.1390, lng: 101.6869 },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 },
  '檳城': { lat: 5.4141, lng: 100.3288 },
  'penang': { lat: 5.4141, lng: 100.3288 },
  '沙巴': { lat: 5.9788, lng: 116.1147 },
  'sabah': { lat: 5.9788, lng: 116.1147 },
  '馬尼拉': { lat: 14.5995, lng: 120.9842 },
  'manila': { lat: 14.5995, lng: 120.9842 },
  '長灘島': { lat: 11.9719, lng: 121.9248 },
  'boracay': { lat: 11.9719, lng: 121.9248 },
  '宿霧': { lat: 10.3157, lng: 123.8854 },
  'cebu': { lat: 10.3157, lng: 123.8854 },
  '新加坡': { lat: 1.3521, lng: 103.8198 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  '香港': { lat: 22.3193, lng: 114.1694 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  '澳門': { lat: 22.1987, lng: 113.5439 },
  'macau': { lat: 22.1987, lng: 113.5439 },
  '上海': { lat: 31.2304, lng: 121.4737 },
  'shanghai': { lat: 31.2304, lng: 121.4737 },
  '北京': { lat: 39.9042, lng: 116.4074 },
  'beijing': { lat: 39.9042, lng: 116.4074 },
  '倫敦': { lat: 51.5074, lng: -0.1278 },
  'london': { lat: 51.5074, lng: -0.1278 },
  '巴黎': { lat: 48.8566, lng: 2.3522 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  '布拉格': { lat: 50.0755, lng: 14.4378 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  '維也納': { lat: 48.2082, lng: 16.3738 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  '羅馬': { lat: 41.9028, lng: 12.4964 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  '巴塞隆納': { lat: 41.3851, lng: 2.1734 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  '慕尼黑': { lat: 48.1351, lng: 11.5820 },
  'munich': { lat: 48.1351, lng: 11.5820 },
  '紐約': { lat: 40.7128, lng: -74.0060 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  '洛杉磯': { lat: 34.0522, lng: -118.2437 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  '舊金山': { lat: 37.7749, lng: -122.4194 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  '溫東': { lat: 49.2827, lng: -123.1207 },
  '溫哥華': { lat: 49.2827, lng: -123.1207 },
  'vancouver': { lat: 49.2827, lng: -123.1207 },
};

export const parseCoordinateForCountry = (countryName: string, cityName?: string) => {
  // 1. If cityName is provided, try to match custom city coordinates first (highly accurate)
  if (cityName) {
    const cleanCity = cityName.trim().toLowerCase();
    if (CUSTOM_CITY_COORDS[cleanCity]) {
      return CUSTOM_CITY_COORDS[cleanCity];
    }
    const directKey = cityName.trim();
    if (CUSTOM_CITY_COORDS[directKey]) {
      return CUSTOM_CITY_COORDS[directKey];
    }
  }

  // 2. If no cityName, or city not in custom coordinates list:
  // Check if it's a known country structure in COUNTRY_COORDS and no city was specified
  if (COUNTRY_COORDS[countryName] && !cityName) {
    return COUNTRY_COORDS[countryName];
  }

  // 3. Dynamic lookup via country-state-city database
  const allCountries = Country.getAllCountries();
  const iso2 = countriesIso.getAlpha2Code(countryName, 'zh') || countriesIso.getAlpha2Code(countryName, 'en');
  const found = allCountries.find(
    (c) => c.isoCode.toLowerCase() === (iso2 || '').toLowerCase() || 
           c.name.toLowerCase() === countryName.toLowerCase() || 
           c.isoCode.toLowerCase() === countryName.toLowerCase()
  );

  if (found && found.latitude && found.longitude) {
    const lat = parseFloat(found.latitude);
    const lng = parseFloat(found.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (cityName) {
        const cities = City.getCitiesOfCountry(found.isoCode) || [];
        const cityMatch = cities.find(ct => ct.name.toLowerCase() === cityName.toLowerCase());
        if (cityMatch && cityMatch.latitude && cityMatch.longitude) {
          const clat = parseFloat(cityMatch.latitude);
          const clng = parseFloat(cityMatch.longitude);
          if (!isNaN(clat) && !isNaN(clng)) {
            return { lat: clat, lng: clng };
          }
        }
      }
      return { lat, lng };
    }
  }

  // 4. Default country center lookup as fallback
  if (COUNTRY_COORDS[countryName]) {
    return COUNTRY_COORDS[countryName];
  }

  return { lat: 20 + Math.random() * 20, lng: 10 + Math.random() * 80 };
};

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const sDate = new Date(start);
  const eDate = new Date(end);
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return 1;
  const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of start & end
  return diffDays;
}

type MapStyle = 'apple' | 'google' | 'calendar';

function getCountryFlag(country: string): string {
  const lower = country.toLowerCase().trim();
  const map: Record<string, string> = {
    'taiwan': '🇹🇼', '台灣': '🇹🇼', '臺灣': '🇹🇼',
    'japan': '🇯🇵', '日本': '🇯🇵',
    'south korea': '🇰🇷', 'korea': '🇰🇷', '韓國': '🇰🇷', '南韓': '🇰🇷',
    'czechia': '🇨🇿', 'czech': '🇨🇿', '捷克': '🇨🇿',
    'austria': '🇦🇹', '奧地利': '🇦🇹',
    'united kingdom': '🇬🇧', 'uk': '🇬🇧', '英國': '🇬🇧',
    'united states': '🇺🇸', 'us': '🇺🇸', 'usa': '🇺🇸', '美國': '🇺🇸',
    'germany': '🇩🇪', '德國': '🇩🇪',
    'france': '🇫🇷', '法國': '🇫🇷',
    'thailand': '🇹🇭', '泰國': '🇹🇭',
    'vietnam': '🇻🇳', '越南': '🇻🇳',
    'malta': '🇲🇹', '馬爾他': '🇲🇹',
    'poland': '🇵🇱', '波蘭': '🇵🇱',
    'norway': '🇳🇴', '挪威': '🇳🇴',
    'finland': '🇫🇮', '芬蘭': '🇫🇮',
    'italy': '🇮🇹', '義大利': '🇮🇹', '意大利': '🇮🇹',
    'spain': '🇪🇸', '西班牙': '🇪🇸',
    'canada': '🇨🇦', '加拿大': '🇨🇦',
    'australia': '🇦🇺', '澳洲': '🇦🇺',
    'china': '🇨🇳', '中國': '🇨🇳',
    'hong kong': '🇭🇰', '香港': '🇭🇰',
    'macao': '🇲🇴', '澳門': '🇲🇴',
    'singapore': '🇸🇬', '新加坡': '🇸🇬',
    'greece': '🇬🇷', '希臘': '🇬🇷',
  };
  if (map[lower]) return map[lower];

  try {
    const allCountries = Country.getAllCountries();
    const found = allCountries.find(
      c => c.name.toLowerCase() === lower || c.isoCode.toLowerCase() === lower
    );
    if (found) {
      return codeToEmoji(found.isoCode);
    }
  } catch (err) {
    console.error('Error finding country flags:', err);
  }
  return '📍';
}

function codeToEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function TravelGlobe({ stays, onSelectStay }: TravelGlobeProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  const [mapStyle, setMapStyle] = useState<MapStyle>('apple');
  const [activePinCount, setActivePinCount] = useState(0);
  const [selectedCountryInfo, setSelectedCountryInfo] = useState<{ country: string; days: number; pct: number } | null>(null);

  const handleShowUserLocation = () => {
    if (!navigator.geolocation) {
      alert('您的瀏覽器不支援定位功能。');
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocatingUser(false);
        const { latitude, longitude } = position.coords;
        const latlng: [number, number] = [latitude, longitude];

        if (!mapRef.current) return;

        // Fly to location
        mapRef.current.flyTo(latlng, 13, { duration: 1.5 });

        // Add or update marker for user location
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.setLatLng(latlng);
        } else {
          // Custom blue dot HTML div icon for user location (similar to iOS blue pulse)
          const userIconHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-6 h-6 rounded-full bg-apple-blue/30 animate-pulse pointer-events-none"></div>
              <div class="w-3 h-3 rounded-full bg-apple-blue border-2 border-white shadow-md relative z-10 animate-scale-in"></div>
            </div>
          `;
          const userIcon = L.divIcon({
            html: userIconHtml,
            className: 'user-location-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          userLocationMarkerRef.current = L.marker(latlng, { icon: userIcon })
            .bindPopup('<div class="text-xs font-bold text-center">您目前的位置</div>')
            .addTo(mapRef.current);
        }
      },
      (error) => {
        setLocatingUser(false);
        console.error('Error getting location:', error);
        alert('無法取得您的位置，請確認是否已允許定位權限。');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // States for Travel Calendar
  const [currentYear, setCurrentYear] = useState(() => {
    if (stays && stays.length > 0) {
      const sorted = [...stays].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      const d = new Date(sorted[0].startDate);
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (stays && stays.length > 0) {
      const sorted = [...stays].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      const d = new Date(sorted[0].startDate);
      if (!isNaN(d.getTime())) return d.getMonth();
    }
    return new Date().getMonth();
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const getCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    
    const daysArr = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      daysArr.push({
        dayNum: prevMonthDays - i,
        isCurrentMonth: false,
        monthOffset: -1
      });
    }
    for (let i = 1; i <= totalDays; i++) {
      daysArr.push({
        dayNum: i,
        isCurrentMonth: true,
        monthOffset: 0
      });
    }
    const remaining = 42 - daysArr.length;
    for (let i = 1; i <= remaining; i++) {
      daysArr.push({
        dayNum: i,
        isCurrentMonth: false,
        monthOffset: 1
      });
    }
    return daysArr;
  };

  // Stays mapping with calculated positions
  const stayCoordinates = React.useMemo(() => {
    return stays
      .map(stay => {
        const coords = parseCoordinateForCountry(stay.country, stay.city);
        return {
          ...stay,
          lat: coords.lat,
          lng: coords.lng
        };
      })
      .filter(s => !isNaN(s.lat) && !isNaN(s.lng));
  }, [stays]);

  // Handle map style configurations
  const styleUrls: Record<'apple' | 'google', string> = {
    apple: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    google: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  const styleAttributions: Record<'apple' | 'google', string> = {
    apple: '&copy; CartoDB Voyager',
    google: 'Tiles &copy; Esri',
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Leaflet Map instance
    const initialCenter: [number, number] = stayCoordinates.length > 0 
      ? [stayCoordinates[0].lat, stayCoordinates[0].lng]
      : [30, 15]; // Default central worldview

    const initialZoom = stayCoordinates.length > 0 ? 3 : 2;

    const mapInstance = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 1.5,
      maxZoom: 18,
      zoomControl: false, // Custom position style
      attributionControl: false // Minimal footer
    });

    mapRef.current = mapInstance;

    // Add scale indicator
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(mapInstance);

    // Initial tile layer setup
    const initialStyle = (mapStyle === 'calendar' ? 'apple' : mapStyle) as 'apple' | 'google';
    const layer = L.tileLayer(styleUrls[initialStyle], {
      attribution: styleAttributions[initialStyle]
    }).addTo(mapInstance);
    tileLayerRef.current = layer;

    // Initialize layer group for pins
    const markersGroup = L.layerGroup().addTo(mapInstance);
    markersGroupRef.current = markersGroup;

    // Clean up on component destruction
    return () => {
      mapInstance.remove();
      mapRef.current = null;
      userLocationMarkerRef.current = null;
    };
  }, []);

  // Update Tile Layer when MapStyle changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    if (mapStyle !== 'calendar') {
      const activeStyle = mapStyle as 'apple' | 'google';
      tileLayerRef.current.setUrl(styleUrls[activeStyle]);
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 50);
    }
  }, [mapStyle]);

  // Plot stays, paths, and fly to center as the stays record updates
  useEffect(() => {
    if (mapStyle === 'calendar') return;
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    setSelectedCountryInfo(null);

    // Clear previous markers
    markersGroup.clearLayers();

    // Clear previous flight paths
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    setActivePinCount(stayCoordinates.length);

    if (stayCoordinates.length === 0) return;

    // Sort chronologically (oldest to newest) to draw beautiful travel trajectory paths
    const chronologicalStays = [...stayCoordinates].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    // 1. Plot Custom HTML Leaflet DivIcons
    chronologicalStays.forEach((stay, index) => {
      const displayLabel = `${stay.country} · ${stay.city}`;
      
      const pinColor = mapStyle === 'google' ? '#f43f5e' : '#2563eb';
      const ringBg = mapStyle === 'google' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(37, 99, 235, 0.3)';

      const htmlContent = `
        <div class="relative group select-none flex items-center justify-center">
          <!-- Pulse animation concentric rings -->
          <div class="absolute w-8 h-8 rounded-full animate-ping pointer-events-none" style="background-color: ${ringBg};"></div>
          
          <!-- Pin Dot badge -->
          <div class="w-4 h-4 rounded-full flex items-center justify-center shadow-md border-2 border-white relative z-10 transition-all active:scale-125" style="background-color: ${pinColor};">
            <!-- Tiny index display -->
            <span class="text-[7px] text-white font-bold pb-px">${index + 1}</span>
          </div>

          <!-- Dynamic popup label visible at all times or hover -->
          <div class="absolute bottom-6 bg-slate-900/90 text-white border border-slate-700 text-[10px] whitespace-nowrap font-semibold px-2 py-0.5 rounded shadow-lg pointer-events-none transition-opacity duration-200">
            ${displayLabel}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: htmlContent,
        className: 'custom-div-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20] // centered perfectly
      });

      const marker = L.marker([stay.lat, stay.lng], { icon: customIcon });

      // Action when clicking on individual pin
      marker.on('click', () => {
        map.flyTo([stay.lat, stay.lng], 6, { duration: 1.5 });
        
        // Compute statistics for the clicked country
        const totalDuration = stays.reduce((sum, s) => sum + calculateDays(s.startDate, s.endDate), 0);
        const countryStays = stays.filter(s => s.country === stay.country);
        const countryDuration = countryStays.reduce((sum, s) => sum + calculateDays(s.startDate, s.endDate), 0);
        const percentage = totalDuration > 0 ? Math.round((countryDuration / totalDuration) * 100) : 0;
        
        setSelectedCountryInfo({
          country: stay.country,
          days: countryDuration,
          pct: percentage
        });

        if (onSelectStay) onSelectStay(stay);
      });

      marker.addTo(markersGroup);
    });

    // 2. Plot Trajectory Flight Path Polylines
    if (chronologicalStays.length > 1) {
      const latlngs = chronologicalStays.map(s => [s.lat, s.lng] as [number, number]);
      
      const trajectoryColor = mapStyle === 'google' ? '#f59e0b' : '#3b82f6';

      const polyline = L.polyline(latlngs, {
        color: trajectoryColor,
        weight: 2.5,
        opacity: 0.85,
        dashArray: '5, 10',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      polylineRef.current = polyline;
    }

    // Centering: Zoom to fit all coordinates nicely
    try {
      const bounds = L.latLngBounds(stayCoordinates.map(s => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, duration: 1.2 });
    } catch (e) {
      // safe fallback if bounding fails
      map.setView([stayCoordinates[0].lat, stayCoordinates[0].lng], 4);
    }
  }, [stayCoordinates, mapStyle]);

  // Map controls helper actions
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleRecenter = () => {
    if (!mapRef.current || stayCoordinates.length === 0) return;
    try {
      const bounds = L.latLngBounds(stayCoordinates.map(s => [s.lat, s.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], duration: 1 });
    } catch {
      mapRef.current.setView([stayCoordinates[0].lat, stayCoordinates[0].lng], 4);
    }
  };

  return (
    <div className="relative w-full max-w-sm h-72 rounded-3xl overflow-hidden border border-apple-gray-100 shadow-md bg-white select-none">
      
      {/* 3D Maps Switch Overlays Selector Button Row */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex justify-between items-center bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-apple-sm border border-apple-gray-50/80">
        <span className="text-[10px] font-black uppercase text-apple-gray-500 tracking-wider flex items-center gap-1">
          <Globe size={11} className="text-apple-blue shrink-0" />
          <span>{mapStyle === 'calendar' ? '旅遊月曆' : '軌跡地圖'}({mapStyle === 'calendar' ? stays.length : activePinCount})</span>
        </span>

        <div className="flex gap-1 p-0.5 bg-apple-gray-100 rounded-lg">
          <button
            onClick={() => setMapStyle('apple')}
            title="經典地圖"
            className={`p-1 rounded-md transition-all cursor-pointer outline-none flex items-center justify-center ${
              mapStyle === 'apple' ? 'bg-white text-apple-blue shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-apple-gray-400 hover:text-apple-gray-600'
            }`}
          >
            <Map size={13} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => setMapStyle('google')}
            title="衛星圖"
            className={`p-1 rounded-md transition-all cursor-pointer outline-none flex items-center justify-center ${
              mapStyle === 'google' ? 'bg-white text-apple-blue shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-apple-gray-400 hover:text-apple-gray-600'
            }`}
          >
            <Globe size={13} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => setMapStyle('calendar')}
            title="旅遊日曆"
            className={`p-1 rounded-md transition-all cursor-pointer outline-none flex items-center justify-center ${
              mapStyle === 'calendar' ? 'bg-white text-apple-blue shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-apple-gray-400 hover:text-apple-gray-600'
            }`}
          >
            <Calendar size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Actual Map Canvas Container element */}
      <div 
        ref={mapContainerRef} 
        className={`w-full h-full relative z-10 ${mapStyle === 'calendar' ? 'hidden' : 'block'}`} 
        style={{ backgroundColor: mapStyle === 'google' ? '#0a111a' : '#eef2f3' }} 
      />

      {/* Travel Calendar View */}
      {mapStyle === 'calendar' && (
        <div className="absolute inset-x-0 bottom-0 top-14 pb-2.5 px-3 flex flex-col justify-between bg-apple-gray-50/50 z-10 select-none animate-fade-in">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between px-1 mb-1 mt-1">
            <button 
              onClick={handlePrevMonth}
              className="w-5 h-5 rounded-md bg-white border border-apple-gray-100 flex items-center justify-center font-bold text-apple-gray-600 hover:bg-apple-gray-100 active:scale-90 transition-transform text-[8px]"
            >
              ◀
            </button>
            <span className="text-[10px] font-black text-apple-gray-800 tracking-wide">
              {currentYear} 年 {currentMonth + 1} 月
            </span>
            <button 
              onClick={handleNextMonth}
              className="w-5 h-5 rounded-md bg-white border border-apple-gray-100 flex items-center justify-center font-bold text-apple-gray-600 hover:bg-apple-gray-100 active:scale-90 transition-transform text-[8px]"
            >
              ▶
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-apple-gray-100/60 pb-1">
            {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
              <span key={idx} className={`text-[8px] font-black ${idx === 0 || idx === 6 ? 'text-red-500/80' : 'text-apple-gray-400'}`}>
                {day}
              </span>
            ))}
          </div>

          {/* Grid of Days (6 rows * 7 columns = 42 cells) */}
          <div className="grid grid-cols-7 gap-x-1 gap-y-1 mt-1 flex-grow">
            {getCalendarDays().map((cell, index) => {
              // Construct context for cell
              let cellYear = currentYear;
              let cellMonth = currentMonth + cell.monthOffset;
              if (cellMonth < 0) {
                cellMonth = 11;
                cellYear -= 1;
              } else if (cellMonth > 11) {
                cellMonth = 0;
                cellYear += 1;
              }
              const formatNum = (n: number) => String(n).padStart(2, '0');
              const dateStr = `${cellYear}-${formatNum(cellMonth + 1)}-${formatNum(cell.dayNum)}`;

              // Find stays covering this day
              const matchingStay = stays.find(stay => {
                const startStr = stay.startDate;
                const endStr = stay.endDate;
                return dateStr >= startStr && dateStr <= endStr;
              });

              const flag = matchingStay ? getCountryFlag(matchingStay.country) : null;
              const isToday = new Date().toISOString().substring(0, 10) === dateStr;

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (matchingStay && onSelectStay) {
                      onSelectStay(matchingStay);
                    }
                  }}
                  disabled={!matchingStay}
                  className={`relative flex flex-col items-center justify-center rounded-lg h-7 transition-all ${
                    !cell.isCurrentMonth ? 'opacity-25' : ''
                  } ${
                    matchingStay 
                      ? 'bg-apple-blue/5 border border-apple-blue/25 cursor-pointer shadow-apple-sm hover:scale-105 active:scale-95' 
                      : 'cursor-default'
                  } ${
                    isToday ? 'ring-1 ring-apple-blue/50 ring-offset-px' : ''
                  }`}
                  title={matchingStay ? `${matchingStay.country} · ${matchingStay.city} (${matchingStay.startDate} ~ ${matchingStay.endDate})` : dateStr}
                >
                  <span className={`text-[8px] font-black leading-none ${
                    matchingStay ? 'text-apple-blue font-black' : 'text-apple-gray-500'
                  }`}>
                    {cell.dayNum}
                  </span>
                  
                  {flag && (
                    <span className="text-[10px] leading-none mt-0.5 filter drop-shadow-[0_1px_0.5px_rgba(0,0,0,0.1)]">
                      {flag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Info text at the bottom */}
          <div className="mt-1 text-center">
            <p className="text-[7.5px] font-medium text-apple-gray-400">
              {stays.some(s => {
                const sd = new Date(s.startDate);
                return sd.getFullYear() === currentYear && sd.getMonth() === currentMonth;
              }) ? '💡 點擊有國旗的日期可查看詳細航程資訊' : '📅 該月份尚無建立任何旅程足跡資訊'}
            </p>
          </div>
        </div>
      )}

      {/* Floating map quick custom zoom controls (replicate real mobile maps UI) */}
      {mapStyle !== 'calendar' && (
        <div className="absolute bottom-3 right-3 z-25 flex flex-col gap-1.5">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-apple-gray-100 shadow-apple-sm flex items-center justify-center text-apple-gray-700 font-black text-sm active:scale-95 transition-transform"
            title="Zoom In"
          >
            ＋
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-apple-gray-100 shadow-apple-sm flex items-center justify-center text-apple-gray-700 font-black text-sm active:scale-95 transition-transform"
            title="Zoom Out"
          >
            －
          </button>
          <button
            onClick={handleShowUserLocation}
            disabled={locatingUser}
            className={`w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-apple-gray-100 shadow-apple-sm flex items-center justify-center text-apple-gray-700 active:scale-95 transition-transform ${locatingUser ? 'animate-pulse text-apple-blue' : ''}`}
            title="定位目前位置 (My Location)"
          >
            <Locate size={14} className={locatingUser ? 'animate-bounce text-apple-blue' : 'text-emerald-600'} />
          </button>
          <button
            onClick={handleRecenter}
            className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-apple-gray-100 shadow-apple-sm flex items-center justify-center text-apple-blue active:scale-95 transition-transform"
            title="Recenter Trajectory"
          >
            <Compass size={14} className="animate-spin-slow" />
          </button>
        </div>
      )}

      {selectedCountryInfo && mapStyle !== 'calendar' && (
        <div className="absolute bottom-12 left-2.5 right-2.5 z-30 bg-white/95 backdrop-blur-md border border-apple-gray-100/80 rounded-2xl p-3 shadow-lg flex flex-col transition-all duration-300 animate-fade-in">
          <div className="flex justify-between items-center border-b border-apple-gray-50 pb-1.5 mb-1.5">
            <span className="text-[9px] font-black text-apple-gray-400 bg-apple-gray-50 px-1.5 py-0.5 rounded uppercase">
              國境停留統計 / Stats
            </span>
            <button
              onClick={() => setSelectedCountryInfo(null)}
              className="text-[10px] text-apple-gray-400 hover:text-red-500 font-bold"
            >
              ✕ 關閉
            </button>
          </div>
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-apple-gray-800">{selectedCountryInfo.country}</h5>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-bold text-apple-blue bg-apple-blue/5 px-2 py-0.5 rounded-full">
                {selectedCountryInfo.days} 天
              </span>
              <span className="font-bold text-emerald-600 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                佔總停留 {selectedCountryInfo.pct}%
              </span>
            </div>
          </div>
        </div>
      )}

      {mapStyle !== 'calendar' && (
        <div className="absolute bottom-3 left-3 z-25 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[8px] text-white/80 pointer-events-none">
          {mapStyle === 'apple' ? 'Carto Voyager Style' : 'Esri Satellite Imagery'}
        </div>
      )}

    </div>
  );
}
