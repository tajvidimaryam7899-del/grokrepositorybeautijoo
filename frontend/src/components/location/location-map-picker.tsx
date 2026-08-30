'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

export type MapPosition = { lat: number; lng: number };

type Props = {
  position: MapPosition | null;
  onPositionChange: (pos: MapPosition) => void;
  height?: string;
};

type LeafletMods = {
  MapContainer: typeof import('react-leaflet').MapContainer;
  TileLayer: typeof import('react-leaflet').TileLayer;
  Marker: typeof import('react-leaflet').Marker;
  useMapEvents: typeof import('react-leaflet').useMapEvents;
};

function MapEvents({ onPick, useMapEvents }: { onPick: (p: MapPosition) => void; useMapEvents: LeafletMods['useMapEvents'] }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function LocationMapInner({ position, onPositionChange, height = '280px' }: Props) {
  const [mods, setMods] = useState<LeafletMods | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import('leaflet/dist/leaflet.css');
      const L = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
      const rl = await import('react-leaflet');
      if (!cancelled) {
        setMods({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          useMapEvents: rl.useMapEvents,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : [32.4279, 53.6880];

  if (!mods) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-gray-light/40 text-sm text-gray"
        style={{ height }}
      >
        در حال بارگذاری نقشه…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, useMapEvents } = mods;

  return (
    <div className="relative z-0 overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={position ? 15 : 5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onPick={onPositionChange} useMapEvents={useMapEvents} />
        {position && (
          <Marker
            position={[position.lat, position.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onPositionChange({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

const LocationMapPicker = dynamic(() => Promise.resolve(LocationMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-border bg-gray-light/40 text-sm text-gray">
      در حال بارگذاری نقشه…
    </div>
  ),
});

export default LocationMapPicker;
