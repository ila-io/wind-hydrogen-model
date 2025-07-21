// src/components/Bar.jsx
import React from "react";

export default function Bar({ label, value = 0, max = 1, color = "gray", midpoint = false }) {
  const percent = Math.min(Math.abs(value / max) * 100, 100);

  return (
    <div className="flex flex-col items-center w-24 text-sm">
      <div className="h-48 w-6 bg-gray-200 relative overflow-hidden rounded">
        {midpoint ? (
          <>
            {/* Positive (upward) */}
            <div
              className="absolute bottom-1/2 w-full"
              style={{
                height: value > 0 ? `${percent / 2}%` : 0,
                backgroundColor: color,
              }}
            />
            {/* Negative (downward) */}
            <div
              className="absolute top-1/2 w-full"
              style={{
                height: value < 0 ? `${percent / 2}%` : 0,
                backgroundColor: color,
              }}
            />
            {/* Midpoint line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-black opacity-30" />
          </>
        ) : (
          <div
            className="absolute bottom-0 w-full"
            style={{
              height: `${percent}%`,
              backgroundColor: color,
            }}
          />
        )}
      </div>
      <div className="text-center mt-2 whitespace-pre-wrap">{label}</div>
    </div>
  );
}
