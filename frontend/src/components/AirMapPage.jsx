import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, RefreshCw, AlertTriangle, Hospital, Phone, 
  ExternalLink, Wind, Droplets, Thermometer, Radio, 
  Compass, Activity, Sparkles, Home
} from 'lucide-react';
import { fetchSatelliteAirAndWeather } from '../services/openMeteoService';
import { saveSatelliteEnvironmentData } from '../api';
import { NATIONAL_AMBULANCE_SERVICES, getNearbyHospitalsSorted } from '../data/hospitalsData';
import { BANGLADESH_LOCATIONS, DEFAULT_LOCATION } from '../data/bangladeshLocations';

export default function AirMapPage({ realtimeTelemetry, currentUser }) {
  // Cascading Location Selector State (Default: 36CF+54R, Kaliakair, Gazipur, Dhaka)
  const [selectedDivision, setSelectedDivision] = useState(DEFAULT_LOCATION.division);
  const [selectedDistrict, setSelectedDistrict] = useState(DEFAULT_LOCATION.district);
  const [selectedUpazila, setSelectedUpazila] = useState(DEFAULT_LOCATION.upazila);

  // Active Coordinates & Location Display Name
  const [activeLocation, setActiveLocation] = useState({
    lat: DEFAULT_LOCATION.lat,
    lon: DEFAULT_LOCATION.lon,
    displayName: `${DEFAULT_LOCATION.code} (${DEFAULT_LOCATION.district})`
  });

  const [satelliteData, setSatelliteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locatingUser, setLocatingUser] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Map DOM & Leaflet Object References
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const riskCirclesRef = useRef([]);
  const hospitalMarkersRef = useRef([]);

  // Compute available districts in currently selected division
  const currentDivisionObj = BANGLADESH_LOCATIONS.find((d) => d.division === selectedDivision) || BANGLADESH_LOCATIONS[0];
  const availableDistricts = currentDivisionObj.districts;

  // Compute available upazilas in currently selected district
  const currentDistrictObj = availableDistricts.find((dist) => dist.name === selectedDistrict) || availableDistricts[0];
  const availableUpazilas = currentDistrictObj ? currentDistrictObj.upazilas : [];

  // When Division changes, select its first district & upazila
  const handleDivisionChange = (e) => {
    const newDiv = e.target.value;
    setSelectedDivision(newDiv);
    const divObj = BANGLADESH_LOCATIONS.find((d) => d.division === newDiv);
    if (divObj && divObj.districts.length > 0) {
      const firstDist = divObj.districts[0];
      setSelectedDistrict(firstDist.name);
      if (firstDist.upazilas.length > 0) {
        const firstUpz = firstDist.upazilas[0];
        setSelectedUpazila(firstUpz.name);
        setActiveLocation({
          lat: firstUpz.lat,
          lon: firstUpz.lon,
          displayName: `${firstUpz.name}, ${firstDist.name}`
        });
      }
    }
  };

  // When District changes, select its first upazila
  const handleDistrictChange = (e) => {
    const newDist = e.target.value;
    setSelectedDistrict(newDist);
    const distObj = availableDistricts.find((d) => d.name === newDist);
    if (distObj && distObj.upazilas.length > 0) {
      const firstUpz = distObj.upazilas[0];
      setSelectedUpazila(firstUpz.name);
      setActiveLocation({
        lat: firstUpz.lat,
        lon: firstUpz.lon,
        displayName: `${firstUpz.name}, ${newDist}`
      });
    }
  };

  // When Upazila changes, update coordinates immediately
  const handleUpazilaChange = (e) => {
    const newUpz = e.target.value;
    setSelectedUpazila(newUpz);
    const upzObj = availableUpazilas.find((u) => u.name === newUpz);
    if (upzObj) {
      setActiveLocation({
        lat: upzObj.lat,
        lon: upzObj.lon,
        displayName: `${upzObj.name}, ${selectedDistrict}`
      });
    }
  };

  // Fetch Open-Meteo Satellite Data on Coordinates Change
  useEffect(() => {
    let isMounted = true;

    async function loadSatelliteFeeds() {
      setLoading(true);
      setGeoError(null);
      try {
        const data = await fetchSatelliteAirAndWeather(activeLocation.lat, activeLocation.lon);
        if (isMounted) {
          setSatelliteData(data);
          // Persist satellite atmospheric pollutant breakdown & outdoor weather into Database
          if (data && data.airQuality) {
            saveSatelliteEnvironmentData({
              location_name: activeLocation.displayName,
              latitude: activeLocation.lat,
              longitude: activeLocation.lon,
              outdoor_temperature: data.weather?.temperature,
              outdoor_humidity: data.weather?.humidity,
              pm10: data.airQuality?.pm10,
              pm2_5: data.airQuality?.pm25,
              ozone: data.airQuality?.ozone,
              nitrogen_dioxide: data.airQuality?.nitrogenDioxide,
              carbon_monoxide: data.airQuality?.carbonMonoxide,
              sulphur_dioxide: data.airQuality?.sulphurDioxide,
              uv_index: data.airQuality?.uvIndex,
              aqi: data.airQuality?.aqi,
              user_id: currentUser?.id
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Error fetching satellite feeds:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSatelliteFeeds();
    return () => {
      isMounted = false;
    };
  }, [activeLocation.lat, activeLocation.lon]);

  // Initialize Leaflet Map once with Free OpenStreetMap Tiles (Zero API Key Watermark)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeLocation.lat, activeLocation.lon],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // Free, OpenStreetMap global tile servers with dark CSS styling
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        className: 'dark-forest-tiles'
      }).addTo(map);

      // Custom Zoom Control top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Compute ONLY the closest 5 hospitals dynamically
  const sortedHospitals = getNearbyHospitalsSorted(activeLocation.lat, activeLocation.lon);
  const displayedHospitals = sortedHospitals.slice(0, 5);

  // Update map center, user pin, multiple risk circles, and the 5 closest hospitals
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([activeLocation.lat, activeLocation.lon], 12);

    // 1. User / Patient Monitored Location Pin (Pulsing Radar)
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(0, 229, 153, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #00e599; border: 3px solid #062319; box-shadow: 0 0 14px #00e599; display: flex; align-items: center; justify-content: center;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const userMarker = L.marker([activeLocation.lat, activeLocation.lon], { icon: userIcon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family: inherit; color: #fff; background: #092c20; padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(0, 229, 153, 0.4); min-width: 170px;">
          <strong style="color: #00e599; font-size: 12px; display: block; margin-bottom: 2px;">Patient Site</strong>
          <span style="font-size: 11px; color: #cbd5e1;">${activeLocation.displayName}</span>
          <div style="margin-top: 4px; font-size: 10px; color: #94a3b8; font-family: monospace;">
            ${activeLocation.lat.toFixed(4)}, ${activeLocation.lon.toFixed(4)}
          </div>
        </div>
      `);
    userMarkerRef.current = userMarker;

    // 2. Multiple Concentric Risk Radii (1.5 km, 3.5 km, 6.5 km)
    riskCirclesRef.current.forEach((c) => c.remove());
    riskCirclesRef.current = [];

    const riskLevel = satelliteData?.risk?.level || 'Yellow';
    const baseColor = 
      riskLevel === 'Green' ? '#10b981' : 
      riskLevel === 'Yellow' ? '#f59e0b' : '#ef4444';

    // Circle 1: Immediate Zone (1.5 km)
    const circle1 = L.circle([activeLocation.lat, activeLocation.lon], {
      radius: 1500,
      color: baseColor,
      weight: 2,
      opacity: 0.9,
      fillColor: baseColor,
      fillOpacity: 0.16
    }).addTo(map).bindTooltip('Immediate Inhalation Zone (1.5 km)', { permanent: false, direction: 'top' });

    // Circle 2: Local Dispersion Zone (3.5 km)
    const circle2 = L.circle([activeLocation.lat, activeLocation.lon], {
      radius: 3500,
      color: baseColor,
      weight: 1.8,
      dashArray: '6, 6',
      opacity: 0.65,
      fillColor: baseColor,
      fillOpacity: 0.08
    }).addTo(map).bindTooltip('Local Atmospheric Dispersion (3.5 km)', { permanent: false, direction: 'top' });

    // Circle 3: Macro Regional Airshed (6.5 km)
    const circle3 = L.circle([activeLocation.lat, activeLocation.lon], {
      radius: 6500,
      color: baseColor,
      weight: 1.2,
      dashArray: '3, 6',
      opacity: 0.45,
      fillColor: baseColor,
      fillOpacity: 0.04
    }).addTo(map).bindTooltip('Regional Airshed Exposure (6.5 km)', { permanent: false, direction: 'top' });

    riskCirclesRef.current = [circle1, circle2, circle3];

    // 3. Closest 5 Hospital Markers on Map
    hospitalMarkersRef.current.forEach((m) => m.remove());
    hospitalMarkersRef.current = [];

    displayedHospitals.forEach((hosp, idx) => {
      const isNearest = idx === 0;
      const hospitalIcon = L.divIcon({
        className: 'custom-hospital-marker',
        html: `
          <div style="position: relative; width: 28px; height: 28px; background: #07231a; border: 2px solid ${isNearest ? '#ef4444' : '#00e599'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${isNearest ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 229, 153, 0.4)'}; cursor: pointer;">
            <span style="color: ${isNearest ? '#ef4444' : '#00e599'}; font-weight: 900; font-size: 14px; line-height: 1;">+</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const hospMarker = L.marker([hosp.lat, hosp.lon], { icon: hospitalIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; color: #f8fafc; background: #092c20; padding: 10px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.4); min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                ${hosp.distanceKm} km away
              </span>
              <span style="color: #4ade80; font-size: 10px; font-weight: bold;">Emergency</span>
            </div>
            <h4 style="font-size: 12px; font-weight: bold; color: #fff; margin: 0 0 3px 0;">${hosp.name}</h4>
            <p style="font-size: 10px; color: #94a3b8; margin: 0 0 6px 0;">${hosp.address}</p>
            <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 3px;">
              Hotline: <a href="tel:${hosp.hotline}" style="color: #00e599; text-decoration: none; font-weight: bold;">${hosp.hotline}</a>
            </div>
            <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">
              Ambulance: <a href="tel:${hosp.ambulance}" style="color: #f87171; text-decoration: none; font-weight: bold;">${hosp.ambulance}</a>
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${hosp.lat},${hosp.lon}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 6px 0; background: #00e599; color: #062319; font-size: 10px; font-weight: bold; border-radius: 6px; text-decoration: none;">
              Get Directions ↗
            </a>
          </div>
        `);

      hospitalMarkersRef.current.push(hospMarker);
    });

  }, [activeLocation, satelliteData]);

  // Focus on specific hospital and open its popup
  const handleFocusHospital = (hosp) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([hosp.lat, hosp.lon], 14, { duration: 0.8 });
    const target = hospitalMarkersRef.current.find((m) => {
      const p = m.getLatLng();
      return Math.abs(p.lat - hosp.lat) < 0.001 && Math.abs(p.lng - hosp.lon) < 0.001;
    });
    if (target) {
      target.openPopup();
    }
  };

  // Fit view to include patient site and all 5 closest hospitals
  const handleFitHospitals = () => {
    const map = mapInstanceRef.current;
    if (!map || displayedHospitals.length === 0) return;
    const points = [
      [activeLocation.lat, activeLocation.lon],
      ...displayedHospitals.map((h) => [h.lat, h.lon])
    ];
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14 });
  };

  // Recenter map on monitored patient site
  const handleCenterPatient = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([activeLocation.lat, activeLocation.lon], 12, { duration: 0.8 });
    if (userMarkerRef.current) {
      userMarkerRef.current.openPopup();
    }
  };

  // Live GPS Location Detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('GPS Geolocation is not supported by your browser.');
      return;
    }

    setLocatingUser(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setActiveLocation({
          lat,
          lon,
          displayName: `Live GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`
        });
        setLocatingUser(false);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setLocatingUser(false);
        setGeoError('Could not obtain live GPS signal. Defaulting to selected Upazila.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Reset back to Default: 36CF+54R, Kaliakair
  const handleResetToKaliakair = () => {
    setSelectedDivision('Dhaka');
    setSelectedDistrict('Gazipur');
    setSelectedUpazila('Kaliakair (36CF+54R)');
    setActiveLocation({
      lat: DEFAULT_LOCATION.lat,
      lon: DEFAULT_LOCATION.lon,
      displayName: `${DEFAULT_LOCATION.code} (${DEFAULT_LOCATION.district})`
    });
  };

  // Refresh satellite telemetry
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchSatelliteAirAndWeather(activeLocation.lat, activeLocation.lon);
      setSatelliteData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Micro vs Macro Comparison metrics
  const indoorPM25 = realtimeTelemetry?.pm2_5 ?? 12.8;
  const indoorTemp = realtimeTelemetry?.temperature ?? 25.4;
  const indoorHumidity = realtimeTelemetry?.humidity ?? 58.2;

  const outdoorPM25 = satelliteData?.airQuality?.pm2_5 ?? 25.4;
  const outdoorTemp = satelliteData?.weather?.temperature ?? 26.3;
  const outdoorHumidity = satelliteData?.weather?.humidity ?? 68;

  const pmDelta = Math.round(((outdoorPM25 - indoorPM25) / Math.max(0.1, indoorPM25)) * 100);
  const isOutdoorWorse = outdoorPM25 > indoorPM25;

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      
      {/* ==================================================================== */}
      {/* 1. CLEAN TOP HEADER & CASCADING SELECTORS (Division -> District -> Upazila) */}
      {/* ==================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-300">Live Satellite Feed</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Air Quality & Hospital Map
            </h2>
            <p className="text-emerald-100/75 text-xs sm:text-sm mt-0.5 max-w-xl leading-relaxed">
              Regional atmospheric pollution and closest respiratory emergency routing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToKaliakair}
              title="Reset to 36CF+54R, Kaliakair"
              className="px-3 py-2 rounded-xl bg-forest-900/90 hover:bg-forest-800 text-xs font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Kaliakair</span>
            </button>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locatingUser}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00e599] text-forest-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 hover:brightness-110 transition cursor-pointer"
            >
              <Navigation className={`w-3.5 h-3.5 ${locatingUser ? 'animate-spin' : ''}`} />
              <span>{locatingUser ? 'Locating...' : 'My Live GPS'}</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-forest-900/90 hover:bg-forest-800 text-slate-300 hover:text-white border border-forest-700 transition cursor-pointer"
              title="Refresh satellite telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* CLEAN CASCADING SELECTORS (NO EMOJIS) */}
        <div className="pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Division Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-200/80 mb-1">
              1. Division
            </label>
            <select
              value={selectedDivision}
              onChange={handleDivisionChange}
              className="w-full px-3 py-2 bg-forest-950/90 hover:bg-forest-900 text-white font-semibold text-xs rounded-xl border border-emerald-500/30 focus:outline-none focus:border-emerald-400 transition cursor-pointer"
            >
              {BANGLADESH_LOCATIONS.map((div) => (
                <option key={div.division} value={div.division}>
                  {div.division} Division
                </option>
              ))}
            </select>
          </div>

          {/* 2. District Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-200/80 mb-1">
              2. District
            </label>
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              className="w-full px-3 py-2 bg-forest-950/90 hover:bg-forest-900 text-white font-semibold text-xs rounded-xl border border-emerald-500/30 focus:outline-none focus:border-emerald-400 transition cursor-pointer"
            >
              {availableDistricts.map((dist) => (
                <option key={dist.name} value={dist.name}>
                  {dist.name} District
                </option>
              ))}
            </select>
          </div>

          {/* 3. Upazila Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-200/80 mb-1">
              3. Upazila
            </label>
            <select
              value={selectedUpazila}
              onChange={handleUpazilaChange}
              className="w-full px-3 py-2 bg-forest-950/90 hover:bg-forest-900 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/40 focus:outline-none focus:border-emerald-400 transition cursor-pointer"
            >
              {availableUpazilas.map((upz) => (
                <option key={upz.name} value={upz.name}>
                  {upz.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {geoError && (
        <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. MAIN MAP & CLOSEST 5 HOSPITALS */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Map Container (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="aura-card p-4 relative overflow-hidden border border-emerald-500/25">
            <div
              ref={mapContainerRef}
              className="w-full h-[460px] sm:h-[490px] rounded-2xl z-10 relative overflow-hidden"
              style={{ background: '#071f17' }}
            />

            {/* Map Legend */}
            <div className="absolute bottom-6 left-6 z-20 bg-forest-950/95 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/25 text-xs shadow-2xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Risk Radii
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-3 h-0.5 bg-emerald-400" />
                <span className="text-slate-300">1.5 km (Immediate)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-3 h-0.5 border-b border-dashed border-amber-400" />
                <span className="text-slate-300">3.5 km (Local)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-3 h-0.5 border-b border-dotted border-rose-400" />
                <span className="text-slate-300">6.5 km (Regional)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-forest-800">
                <span className="w-3 h-3 rounded-full bg-rose-600 text-[9px] flex items-center justify-center font-bold text-white">+</span>
                <span className="text-slate-300">Hospital Marker</span>
              </div>
            </div>

            {/* Map Top Status Badge */}
            <div className="absolute top-6 left-6 z-20 bg-forest-950/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-emerald-500/30 flex items-center gap-2 text-xs shadow-2xl">
              <span className={`w-2 h-2 rounded-full ${satelliteData?.risk?.level === 'Green' ? 'bg-emerald-400' : satelliteData?.risk?.level === 'Yellow' ? 'bg-amber-400' : 'bg-rose-400'} animate-pulse`} />
              <div>
                <span className="font-bold text-white block leading-tight">{activeLocation.displayName}</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  PM2.5: {satelliteData?.airQuality?.pm2_5 || '--'} µg/m³ • AQI: {satelliteData?.airQuality?.usAqi || '--'}
                </span>
              </div>
            </div>

            {/* Map Top Right Controls */}
            <div className="absolute top-6 right-14 z-20 hidden sm:flex items-center gap-1.5 bg-forest-950/90 backdrop-blur-md p-1 rounded-xl border border-emerald-500/30 shadow-xl">
              <button
                type="button"
                onClick={handleCenterPatient}
                title="Recenter Map on Monitored Site"
                className="px-2.5 py-1 rounded-lg bg-forest-900 hover:bg-forest-800 text-[10px] font-bold text-emerald-300 border border-emerald-500/20 transition cursor-pointer"
              >
                Center Site
              </button>
              <button
                type="button"
                onClick={handleFitHospitals}
                title="Zoom to Fit Monitored Site & 5 Closest Hospitals"
                className="px-2.5 py-1 rounded-lg bg-forest-900 hover:bg-forest-800 text-[10px] font-bold text-slate-200 hover:text-white border border-forest-700 transition cursor-pointer"
              >
                Fit 5 Centers
              </button>
            </div>
          </div>

          {/* Outdoor Activity Feasibility */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            satelliteData?.risk?.level === 'Green'
              ? 'bg-emerald-950/40 border-emerald-500/30'
              : satelliteData?.risk?.level === 'Yellow'
              ? 'bg-amber-950/40 border-amber-500/30'
              : 'bg-rose-950/40 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${satelliteData?.risk?.badgeBg}`}>
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Outdoor Feasibility</span>
                <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  {satelliteData?.risk?.outdoorSafety || 'Analyzing air quality...'}
                </h4>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-400 block font-medium">Regional AQI</span>
              <span className={`text-sm font-extrabold font-mono ${satelliteData?.risk?.safetyColor || 'text-white'}`}>
                {satelliteData?.airQuality?.usAqi} USAQI
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Closest 5 Emergency Centers (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="aura-card p-5 border border-emerald-500/25 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-forest-800 mb-3.5">
                <div className="flex items-center gap-2">
                  <Hospital className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Closest Centers</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Top 5 Nearest
                </span>
              </div>

              {/* Closest 5 Hospital Cards Stream */}
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {displayedHospitals.map((hosp, idx) => (
                  <div
                    key={hosp.id}
                    onClick={() => handleFocusHospital(hosp)}
                    title="Click to locate on map"
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      idx === 0 
                        ? 'bg-forest-900/90 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-950/30' 
                        : 'bg-forest-950/70 border-emerald-500/15 hover:border-emerald-400/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        {idx === 0 ? (
                          <span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-0.5">
                            Nearest Center
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] font-medium text-slate-400 mb-0.5">
                            {hosp.type?.split('(')[0] || 'Medical Center'}
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-white leading-snug">
                          {hosp.name}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        {hosp.distanceKm} km
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-1 mb-2">
                      {hosp.address}
                    </p>

                    {/* Contacts */}
                    <div className="space-y-0.5 pt-1.5 border-t border-forest-800/80 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Hotline:</span>
                        <a 
                          href={`tel:${hosp.hotline}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="font-mono font-bold text-emerald-400 hover:underline"
                        >
                          {hosp.hotline}
                        </a>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Ambulance:</span>
                        <a 
                          href={`tel:${hosp.ambulance}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="font-mono font-bold text-rose-400 hover:underline"
                        >
                          {hosp.ambulance}
                        </a>
                      </div>
                    </div>

                    {/* Actions: Locate on Map & Directions */}
                    <div className="mt-2 pt-1.5 border-t border-forest-800/60 flex items-center justify-between">
                      <span className="text-[9px] text-emerald-400/80 font-medium">
                        Click card to view pin
                      </span>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${hosp.lat},${hosp.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-200 hover:text-white font-bold bg-forest-800 hover:bg-forest-700 px-2.5 py-1 rounded-lg border border-forest-700 transition"
                      >
                        <span>Directions</span>
                        <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Hotline 999 & 16263 */}
            <div className="mt-3 pt-3 border-t border-forest-800 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                24/7 Emergency Dispatch
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:999"
                  className="p-2 rounded-xl bg-rose-950/70 border border-rose-500/40 text-center hover:bg-rose-900 transition flex flex-col items-center"
                >
                  <span className="text-[9px] text-rose-300 font-semibold">National Ambulance</span>
                  <span className="text-sm font-black font-mono text-white">999</span>
                </a>
                <a
                  href="tel:16263"
                  className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-center hover:bg-emerald-900 transition flex flex-col items-center"
                >
                  <span className="text-[9px] text-emerald-300 font-semibold">Shastho Batayon</span>
                  <span className="text-sm font-black font-mono text-white">16263</span>
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. INDOOR (ESP32) VS OUTDOOR (SATELLITE) COMPARISON */}
      {/* ==================================================================== */}
      <div className="aura-card p-5 sm:p-6 border border-emerald-500/25">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Indoor IoT vs Outdoor Satellite Telemetry
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {activeLocation.displayName}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-3.5">
          
          {/* PM2.5 */}
          <div className="p-3.5 rounded-2xl bg-forest-950/80 border border-emerald-500/15 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
              PM2.5 Particulates
            </span>

            <div className="grid grid-cols-2 gap-2 my-2.5">
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Indoor (ESP32)</span>
                <span className="text-base font-black font-mono text-emerald-400">{indoorPM25}</span>
                <span className="text-[9px] text-slate-500 block">µg/m³</span>
              </div>
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Outdoor (Satellite)</span>
                <span className="text-base font-black font-mono text-white">{outdoorPM25}</span>
                <span className="text-[9px] text-slate-500 block">µg/m³</span>
              </div>
            </div>

            <div className="text-[10px] pt-1.5 border-t border-forest-800 flex items-center justify-between">
              <span className="text-slate-400">Variance:</span>
              <span className={`font-mono font-bold ${isOutdoorWorse ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pmDelta > 0 ? `+${pmDelta}%` : `${pmDelta}%`} {isOutdoorWorse ? 'Higher Outdoor' : 'Lower Outdoor'}
              </span>
            </div>
          </div>

          {/* Temperature */}
          <div className="p-3.5 rounded-2xl bg-forest-950/80 border border-emerald-500/15 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              Temperature
            </span>

            <div className="grid grid-cols-2 gap-2 my-2.5">
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Indoor</span>
                <span className="text-base font-black font-mono text-amber-300">{indoorTemp}°C</span>
              </div>
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Outdoor</span>
                <span className="text-base font-black font-mono text-white">{outdoorTemp}°C</span>
              </div>
            </div>

            <div className="text-[10px] pt-1.5 border-t border-forest-800 flex items-center justify-between">
              <span className="text-slate-400">Delta:</span>
              <span className="font-mono font-bold text-slate-200">
                {Math.abs(Math.round((outdoorTemp - indoorTemp) * 10) / 10)}°C
              </span>
            </div>
          </div>

          {/* Relative Humidity */}
          <div className="p-3.5 rounded-2xl bg-forest-950/80 border border-emerald-500/15 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-teal-400" />
              Relative Humidity
            </span>

            <div className="grid grid-cols-2 gap-2 my-2.5">
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Indoor</span>
                <span className="text-base font-black font-mono text-teal-300">{indoorHumidity}%</span>
              </div>
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <span className="text-[9px] text-slate-400 block">Outdoor</span>
                <span className="text-base font-black font-mono text-white">{outdoorHumidity}%</span>
              </div>
            </div>

            <div className="text-[10px] pt-1.5 border-t border-forest-800 flex items-center justify-between">
              <span className="text-slate-400">Delta:</span>
              <span className="font-mono font-bold text-slate-200">
                {Math.abs(Math.round(outdoorHumidity - indoorHumidity))}%
              </span>
            </div>
          </div>


        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. SATELLITE POLLUTANT BREAKDOWN */}
      {/* ==================================================================== */}
      {satelliteData?.airQuality && (
        <div className="aura-card p-5 sm:p-6 border border-emerald-500/25">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Satellite Atmospheric Pollutant Breakdown
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeLocation.lat.toFixed(3)}, {activeLocation.lon.toFixed(3)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            
            {/* PM10 */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">PM10 (Dust)</span>
              <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                {satelliteData.airQuality.pm10}
              </span>
              <span className="text-[9px] text-slate-500">µg/m³</span>
            </div>

            {/* Ozone */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">Ozone (O₃)</span>
              <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                {satelliteData.airQuality.ozone}
              </span>
              <span className="text-[9px] text-slate-500">µg/m³</span>
            </div>

            {/* Nitrogen Dioxide */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">NO₂</span>
              <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                {satelliteData.airQuality.nitrogenDioxide}
              </span>
              <span className="text-[9px] text-slate-500">µg/m³</span>
            </div>

            {/* Carbon Monoxide */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">CO</span>
              <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                {satelliteData.airQuality.carbonMonoxide}
              </span>
              <span className="text-[9px] text-slate-500">µg/m³</span>
            </div>

            {/* Sulphur Dioxide */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">SO₂</span>
              <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                {satelliteData.airQuality.sulphurDioxide}
              </span>
              <span className="text-[9px] text-slate-500">µg/m³</span>
            </div>

            {/* UV Index */}
            <div className="p-3 rounded-xl bg-forest-950/80 border border-forest-800">
              <span className="text-[10px] text-slate-400 block font-medium">UV Index</span>
              <span className="text-base font-extrabold font-mono text-amber-300 mt-0.5 block">
                {satelliteData.airQuality.uvIndex}
              </span>
              <span className="text-[9px] text-slate-500">Index</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
