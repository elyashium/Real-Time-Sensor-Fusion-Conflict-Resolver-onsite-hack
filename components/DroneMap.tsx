"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore, DroneState } from "@/lib/store/dashboard";

const SOURCE_COLORS: Record<string, string> = {
  GPS: "#60a5fa",
  LiDAR: "#a78bfa",
  IMU: "#fb923c",
  Video: "#f472b6",
};

const STATUS_MARKER_COLOR: Record<string, string> = {
  resolved: "#34d399",
  unresolved: "#fbbf24",
  stale: "#71717a",
};

interface DroneMapProps {
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
}

export default function DroneMap({ selectedDroneId, onSelectDrone }: DroneMapProps) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const circlesRef = useRef<Record<string, any>>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const drones = useDashboardStore((s) => s.drones);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current || !mapContainerRef.current) return;
    isInitialized.current = true;

    // Dynamically import leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default icon path issue with Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        center: [37.78, -122.42],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = { map, L };
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  // Update markers when drone data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const { map, L } = mapRef.current;

    const dronesWithPos = drones.filter(
      (d): d is DroneState & { latest_lat: number; latest_lon: number } =>
        d.latest_lat != null && d.latest_lon != null
    );

    dronesWithPos.forEach((drone) => {
      const color = STATUS_MARKER_COLOR[drone.latest_status] ?? "#71717a";
      const isSelected = drone.drone_id === selectedDroneId;

      // Create SVG icon
      const svgIcon = L.divIcon({
        html: `
          <div style="
            width: ${isSelected ? 20 : 14}px;
            height: ${isSelected ? 20 : 14}px;
            background: ${color};
            border-radius: 50%;
            border: ${isSelected ? "3px" : "2px"} solid white;
            box-shadow: 0 0 ${isSelected ? "12px" : "6px"} ${color}99;
            cursor: pointer;
            transition: all 0.2s;
          "></div>`,
        className: "",
        iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });

      if (markersRef.current[drone.drone_id]) {
        markersRef.current[drone.drone_id]
          .setLatLng([drone.latest_lat, drone.latest_lon])
          .setIcon(svgIcon);
      } else {
        const marker = L.marker([drone.latest_lat, drone.latest_lon], { icon: svgIcon })
          .addTo(map)
          .bindTooltip(
            `<div style="font-family:monospace;font-size:11px;line-height:1.4">
              <b>${drone.drone_id}</b><br/>
              Status: ${drone.latest_status}<br/>
              Source: ${drone.latest_source ?? "—"}<br/>
              Alt: ${drone.latest_alt?.toFixed(1) ?? "—"}m<br/>
              Conf: ${drone.latest_confidence?.toFixed(2) ?? "—"}
            </div>`,
            { permanent: false, direction: "top" }
          )
          .on("click", () => onSelectDrone(drone.drone_id));

        markersRef.current[drone.drone_id] = marker;
      }

      // Show red conflict zone circle for unresolved drones
      if (drone.unresolved_count > 0) {
        if (circlesRef.current[drone.drone_id]) {
          circlesRef.current[drone.drone_id].setLatLng([drone.latest_lat, drone.latest_lon]);
        } else {
          circlesRef.current[drone.drone_id] = L.circle(
            [drone.latest_lat, drone.latest_lon],
            { radius: 80, color: "#fbbf24", fillColor: "#fbbf24", fillOpacity: 0.08, weight: 1, dashArray: "4" }
          ).addTo(map);
        }
      } else if (circlesRef.current[drone.drone_id]) {
        circlesRef.current[drone.drone_id].remove();
        delete circlesRef.current[drone.drone_id];
      }
    });

    // Remove markers for drones that no longer exist
    Object.keys(markersRef.current).forEach((id) => {
      if (!dronesWithPos.find((d) => d.drone_id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Auto-fit to show all drones (only if there are any)
    if (dronesWithPos.length > 0 && Object.keys(markersRef.current).length > 0) {
      const group = L.featureGroup(Object.values(markersRef.current));
      try {
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 15 });
      } catch {}
    }
  }, [drones, selectedDroneId, onSelectDrone]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/8">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 320 }} />

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 z-[1000] text-xs space-y-1">
        {Object.entries(STATUS_MARKER_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-zinc-400 capitalize">{status}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <div className="w-2.5 h-2.5 rounded-full border border-amber-400/50 bg-amber-400/10" />
          <span className="text-zinc-400">Conflict zone</span>
        </div>
      </div>

      {/* Empty state */}
      {drones.filter((d) => d.latest_lat != null).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-[999] pointer-events-none">
          <p className="text-zinc-500 text-sm">Load fixtures to see drone positions on the map</p>
        </div>
      )}
    </div>
  );
}
