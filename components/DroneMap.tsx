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
  resolved: "#10b981", // emerald-500
  unresolved: "#f59e0b", // amber-500
  stale: "#a1a1aa", // zinc-400
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
  // Only auto-fit once — never snap the viewport after user has panned/zoomed
  const hasFitBounds = useRef(false);

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
            { radius: 80, color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.1, weight: 1, dashArray: "4" }
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

    // Auto-fit ONCE on first data load — never again so user pan/zoom is preserved
    if (!hasFitBounds.current && dronesWithPos.length > 0 && Object.keys(markersRef.current).length > 0) {
      const group = L.featureGroup(Object.values(markersRef.current));
      try {
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 15, animate: false });
        hasFitBounds.current = true;
      } catch {}
    }
  }, [drones, selectedDroneId, onSelectDrone]);

  return (
    <div className="relative w-full h-full overflow-hidden border-b border-border z-0">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 320 }} />

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm rounded-md px-3 py-2 border border-border shadow-sm z-[1000] text-[10px] space-y-1 font-semibold uppercase tracking-wider text-muted-foreground">
        {Object.entries(STATUS_MARKER_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span>{status}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-border">
          <div className="w-2.5 h-2.5 rounded-full border border-amber-500/50 bg-amber-500/10" />
          <span>Conflict zone</span>
        </div>
      </div>

      {/* Empty state */}
      {drones.filter((d) => d.latest_lat != null).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-[999] pointer-events-none backdrop-blur-sm">
          <p className="text-muted-foreground text-[11px] font-medium">Load fixtures to see drone positions on the map</p>
        </div>
      )}
    </div>
  );
}
