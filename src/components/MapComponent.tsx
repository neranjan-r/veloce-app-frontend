"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapEffects({ pickup, dropoff, routeGeometry }: any) {
  const map = useMap();
  
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      if (routeGeometry?.coordinates) {
         routeGeometry.coordinates.forEach((coord: any) => {
           bounds.extend([coord[1], coord[0]]);
         });
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14);
    }
  }, [map, pickup, dropoff, routeGeometry]);

  return null;
}

export default function Map({ pickup, dropoff, routeGeometry, onPickupDragEnd, onDropoffDragEnd }: any) {
  // Decode OSRM geometry
  const routePoints = routeGeometry?.coordinates?.map((coord: any) => [coord[1], coord[0]]) || [];

  return (
    <div style={{ height: "100%", width: "100%", position: "relative", zIndex: 1, filter: "invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}>
      <MapContainer 
        center={[28.6315, 77.2167]} // Default CP, Delhi
        zoom={13} 
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup && (
          <Marker 
            position={[pickup.lat, pickup.lng]} 
            draggable={true}
            eventHandlers={{
              dragend: (e) => onPickupDragEnd(e.target.getLatLng())
            }}
          />
        )}
        {dropoff && (
          <Marker 
            position={[dropoff.lat, dropoff.lng]} 
            draggable={true}
            eventHandlers={{
              dragend: (e) => onDropoffDragEnd(e.target.getLatLng())
            }}
          />
        )}
        {routePoints.length > 0 && (
          <Polyline positions={routePoints} color="#d4af37" weight={4} />
        )}
        <MapEffects pickup={pickup} dropoff={dropoff} routeGeometry={routeGeometry} />
      </MapContainer>
    </div>
  );
}
