// src/components/Diagram.jsx
import React from "react";
import { Wind, Droplet, Truck, Zap } from "lucide-react";
import Bar from "./Bar";

export default function Diagram({
  values, // contains { supplied, consumed, surplus, storage, importRate }
  maxValues, 
  hydrogenUnit,
  getHydrogenDisplayValue,
  getImportDisplayValue
}) {
  const { supplied, consumed, surplus, storage, importRate } = values;

  // Active glow conditions
  const glowWindToLoad = true;
  const glowWindToHydrogen = surplus > 0;
  const glowHydrogenToLoad = surplus < 0;
  const glowTruckToHydrogen = surplus < 0 && storage <= 0;

  const arrowClass = (active) =>
    `h-2 w-10 rounded-full ${active ? "bg-yellow-400 animate-pulse" : "bg-gray-300"}`;

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Top Row: Truck icon and downward arrow */}
      <div className="flex justify-center items-center space-x-4">
        <Truck size={24} />
        <div className={arrowClass(glowTruckToHydrogen)} />
      </div>

      {/* Middle Row: Main Diagram */}
      <div className="flex items-end justify-center space-x-12 relative">
        {/* Wind Turbine + Supply */}
        <div className="flex flex-col items-center space-y-2">
          <Wind size={32} />
          <Bar label={`Supply\n${supplied.toFixed(1)} kW`} value={supplied} max={maxValues.supplied} color="green" />
        </div>

        {/* Arrow: Wind -> Hydrogen */}
        <div className={arrowClass(glowWindToHydrogen)} />

        {/* Hydrogen Tank: Surplus + Storage + Import */}
        <div className="flex flex-col items-center space-y-2">
          <Droplet size={32} />
          <Bar label={`Surplus\n${surplus.toFixed(1)} kW`} value={surplus} max={maxValues.surplus} color="teal" midpoint />
          <Bar label={`H₂ Storage\n${getHydrogenDisplayValue()} ${hydrogenUnit}`} value={storage} max={maxValues.hydrogenStorage} color="blue" />
          <Bar label={`Import Rate\n${getImportDisplayValue()} ${hydrogenUnit}/hr`} value={importRate} max={maxValues.hydrogenImport} color="red" />
        </div>

        {/* Arrow: Hydrogen -> Load */}
        <div className={arrowClass(glowHydrogenToLoad)} />

        {/* Load: Demand */}
        <div className="flex flex-col items-center space-y-2">
          <Zap size={32} />
          <Bar label={`Demand\n${consumed.toFixed(1)} kW`} value={consumed} max={maxValues.consumed} color="orange" />
        </div>
      </div>

      {/* Bottom Arrow: Wind bypasses to load */}
      <div className="flex justify-center mt-2">
        <div className={arrowClass(glowWindToLoad)} style={{ width: "20rem", height: "4px" }} />
      </div>
    </div>
  );
}
