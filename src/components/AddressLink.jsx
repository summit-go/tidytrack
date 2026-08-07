import React from "react";
import { MapPin } from "lucide-react";

export function AddressLink({ address, icon = "pin", className = "", label = null }) {
  if (!address) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const openMaps = (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <span
      onClick={openMaps}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openMaps(e);
      }}
      className={`inline-flex items-center gap-1 cursor-pointer hover:underline active:opacity-60 ${className}`}
      title={`Open in maps: ${address}`}
    >
      {icon === "pin" && <MapPin size={11} className="flex-shrink-0" />}
      <span className="truncate">{label || address}</span>
    </span>
  );
}
