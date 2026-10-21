"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Configure default icon fallback in case any raw Leaflet marker is created
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  coordinates?: [number, number][];
}

interface MapProps {
  pickup?: LocationPoint | null;
  dropoff?: LocationPoint | null;
  driverLocation?: LocationPoint | null;
  routeGeometry?: RouteGeometry | null;
  onPickupDragEnd?: (latLng: { lat: number; lng: number }) => void;
  onDropoffDragEnd?: (latLng: { lat: number; lng: number }) => void;
}

function MapEffects({
  pickup,
  dropoff,
  driverLocation,
  routeGeometry
}: {
  pickup?: LocationPoint | null;
  dropoff?: LocationPoint | null;
  driverLocation?: LocationPoint | null;
  routeGeometry?: RouteGeometry | null;
}) {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate map size so Leaflet recalculates dimensions properly inside cards
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    if (pickup && dropoff) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      if (routeGeometry?.coordinates && routeGeometry.coordinates.length > 0) {
        routeGeometry.coordinates.forEach((coord: [number, number]) => {
          bounds.extend([coord[1], coord[0]]);
        });
      }
      if (driverLocation) {
        bounds.extend([driverLocation.lat, driverLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14);
    } else if (driverLocation) {
      map.setView([driverLocation.lat, driverLocation.lng], 14);
    }
    return () => clearTimeout(timer);
  }, [map, pickup, dropoff, driverLocation, routeGeometry]);

  return null;
}

export default function Map({
  pickup,
  dropoff,
  driverLocation,
  routeGeometry,
  onPickupDragEnd,
  onDropoffDragEnd
}: MapProps) {
  // Safe coordinate validation to ensure Leaflet never receives NaN or undefined coordinates
  const validPickup = useMemo(() => {
    if (pickup && typeof pickup.lat === "number" && !isNaN(pickup.lat) && typeof pickup.lng === "number" && !isNaN(pickup.lng)) {
      return pickup;
    }
    return null;
  }, [pickup]);

  const validDropoff = useMemo(() => {
    if (dropoff && typeof dropoff.lat === "number" && !isNaN(dropoff.lat) && typeof dropoff.lng === "number" && !isNaN(dropoff.lng)) {
      return dropoff;
    }
    return null;
  }, [dropoff]);

  const validDriver = useMemo(() => {
    if (driverLocation && typeof driverLocation.lat === "number" && !isNaN(driverLocation.lat) && typeof driverLocation.lng === "number" && !isNaN(driverLocation.lng)) {
      return driverLocation;
    }
    return null;
  }, [driverLocation]);

  // Decode OSRM geometry [lng, lat] to [lat, lng]
  const routePoints: [number, number][] = useMemo(() => {
    if (routeGeometry?.coordinates && routeGeometry.coordinates.length > 0) {
      return routeGeometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
    }
    // Fallback straight line between pickup and dropoff if geometry not provided
    if (validPickup && validDropoff) {
      return [
        [validPickup.lat, validPickup.lng],
        [validDropoff.lat, validDropoff.lng]
      ];
    }
    return [];
  }, [routeGeometry, validPickup, validDropoff]);

  // Luxury Pickup Pin (Emerald & Gold)
  const pickupIcon = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return L.divIcon({
      className: "veloce-pickup-marker",
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;background:transparent;border:none;">
          <div style="background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(16,185,129,0.7),0 4px 10px rgba(0,0,0,0.6);border:2.5px solid #ffffff;font-weight:700;font-size:13px;font-family:sans-serif;">
            A
          </div>
          <div style="width:3px;height:8px;background:#10b981;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
          <div style="width:8px;height:4px;border-radius:50%;background:rgba(0,0,0,0.5);filter:blur(1px);"></div>
        </div>
      `,
      iconSize: [34, 46],
      iconAnchor: [17, 44],
    });
  }, []);

  // Luxury Dropoff Pin (Metallic Veloce Gold)
  const dropoffIcon = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return L.divIcon({
      className: "veloce-dropoff-marker",
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;background:transparent;border:none;">
          <div style="background:linear-gradient(135deg,#f59e0b,#d4af37);color:#0a0a0a;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(212,175,55,0.85),0 4px 10px rgba(0,0,0,0.6);border:2.5px solid #ffffff;font-weight:700;font-size:13px;font-family:sans-serif;">
            B
          </div>
          <div style="width:3px;height:8px;background:#d4af37;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
          <div style="width:8px;height:4px;border-radius:50%;background:rgba(0,0,0,0.5);filter:blur(1px);"></div>
        </div>
      `,
      iconSize: [34, 46],
      iconAnchor: [17, 44],
    });
  }, []);

  // Luxury Driver Car Pin (Radar Pulse)
  const driverIcon = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return L.divIcon({
      className: "veloce-driver-marker",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;background:transparent;border:none;">
          <span style="position:absolute;width:42px;height:42px;border-radius:50%;background:rgba(212,175,55,0.35);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <div style="background:linear-gradient(135deg,#1f1f1f,#0a0a0a);width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(212,175,55,0.95),0 4px 12px rgba(0,0,0,0.8);border:2px solid #d4af37;font-size:15px;z-index:2;">
            🚗
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }, []);

  const defaultCenter: [number, number] = validPickup 
    ? [validPickup.lat, validPickup.lng] 
    : validDriver 
    ? [validDriver.lat, validDriver.lng] 
    : [28.6315, 77.2167];

  return (
    <div style={{ height: "100%", width: "100%", minHeight: "350px", position: "relative", zIndex: 1, backgroundColor: "#0f0f11" }}>
      <MapContainer 
        center={defaultCenter}
        zoom={13} 
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", minHeight: "350px", backgroundColor: "#0f0f11" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="veloce-dark-tiles"
          maxZoom={19}
        />
        {validPickup && pickupIcon && (
          <Marker 
            position={[validPickup.lat, validPickup.lng]} 
            icon={pickupIcon}
            draggable={Boolean(onPickupDragEnd)}
            eventHandlers={{
              dragend: (e) => onPickupDragEnd?.(e.target.getLatLng())
            }}
          />
        )}
        {validDropoff && dropoffIcon && (
          <Marker 
            position={[validDropoff.lat, validDropoff.lng]} 
            icon={dropoffIcon}
            draggable={Boolean(onDropoffDragEnd)}
            eventHandlers={{
              dragend: (e) => onDropoffDragEnd?.(e.target.getLatLng())
            }}
          />
        )}
        {validDriver && driverIcon && (
          <Marker 
            position={[validDriver.lat, validDriver.lng]}
            icon={driverIcon}
          />
        )}
        {routePoints.length > 0 && (
          <Polyline positions={routePoints} color="#d4af37" weight={5} opacity={0.9} />
        )}
        <MapEffects 
          pickup={validPickup} 
          dropoff={validDropoff} 
          driverLocation={validDriver} 
          routeGeometry={routeGeometry} 
        />
      </MapContainer>
    </div>
  );
}

