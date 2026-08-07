import React, { useState } from "react";

export function ZoomableImage({ src, alt }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="w-full h-full flex items-start justify-center p-2">
      <img
        loading="lazy"
        src={src}
        alt={alt || ""}
        onClick={() => setZoomed((z) => !z)}
        className={
          zoomed
            ? "cursor-zoom-out max-w-none"
            : "cursor-zoom-in max-w-full max-h-[80vh] object-contain rounded-xl shadow-lg"
        }
        style={zoomed ? { touchAction: "pinch-zoom" } : {}}
      />
    </div>
  );
}
