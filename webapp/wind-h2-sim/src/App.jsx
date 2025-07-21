import React, { useEffect, useState } from "react";
import Papa from "papaparse";

// Function to simulate the entire timespan and find maximum values
const simulateEntireTimespan = (data, baseTurbines, caseMultiplier, electrolyzerEfficiency = 0.75, fuelCellEfficiency = 0.55) => {
  let storage = 0;
  let maxStorage = 0;
  let maxImportRate = 0;
  let totalImported = 0;

  const multiplier = (11 - caseMultiplier) / 10;
  const turbinesUsed = baseTurbines * multiplier;

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const adjustedSupplied = current.p_supplied_kw * turbinesUsed;
    const surplus = adjustedSupplied - current.p_consumed_kw;
    
    let importNeeded = 0;

    if (surplus > 0) {
      // Excess power goes to electrolyzer
      storage += surplus * electrolyzerEfficiency;
    } else if (surplus < 0) {
      // Need power from fuel cell
      const required = Math.abs(surplus) / fuelCellEfficiency;
      
      if (storage >= required) {
        // Use stored hydrogen
        storage -= required;
      } else {
        // Not enough stored hydrogen, need to import
        const shortfall = required - storage;
        importNeeded = shortfall;
        storage = 0;
        totalImported += importNeeded;
        maxImportRate = Math.max(maxImportRate, importNeeded);
      }
    }

    maxStorage = Math.max(maxStorage, storage);
  }

  return { maxStorage, maxImportRate, totalImported };
};

// Bar Component
function Bar({ label, value = 0, max = 1, color = "gray", midpoint = false }) {
  const percent = Math.min(Math.abs(value / max) * 100, 100);

  const colorClasses = {
    green: "bg-green-500",
    orange: "bg-orange-500", 
    teal: "bg-teal-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
    gray: "bg-gray-500"
  };

  return (
    <div className="flex flex-col items-center w-24 text-sm">
      <div className="h-48 w-6 bg-gray-200 relative overflow-hidden rounded">
        {midpoint ? (
          <>
            {/* Positive (upward) */}
            {value > 0 && (
              <div
                className={`absolute bottom-1/2 w-full ${colorClasses[color]} transition-all duration-300 ease-out`}
                style={{
                  height: `${percent / 2}%`,
                }}
              />
            )}
            {/* Negative (downward) */}
            {value < 0 && (
              <div
                className={`absolute top-1/2 w-full ${colorClasses[color]} transition-all duration-300 ease-out`}
                style={{
                  height: `${percent / 2}%`,
                }}
              />
            )}
            {/* Midpoint line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-black opacity-30" />
          </>
        ) : (
          <div
            className={`absolute bottom-0 w-full ${colorClasses[color]} transition-all duration-300 ease-out`}
            style={{
              height: `${percent}%`,
            }}
          />
        )}
      </div>
      <div className="text-center mt-2 whitespace-pre-wrap text-xs transition-opacity duration-300">{label}</div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxValues, setMaxValues] = useState({ supplied: 1, consumed: 1, surplus: 1, hydrogenStorage: 1, hydrogenImport: 1 });
  const [storageKWh, setStorageKWh] = useState(0);
  const [caseIndex, setCaseIndex] = useState(1);
  const [turbinesInCase1, setTurbinesInCase1] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hydrogenUnit, setHydrogenUnit] = useState('kWh'); // 'kWh', 'kg', 'mol'
  const [hydrogenImported, setHydrogenImported] = useState(0); // Total hydrogen imported
  const [currentImportRate, setCurrentImportRate] = useState(0); // Current import rate

  const electrolyzerEfficiency = 0.75;
  const fuelCellEfficiency = 0.55;
  
  // Conversion factors (approximate)
  const hydrogenEnergyDensity = 33.33; // kWh/kg
  const hydrogenMolarMass = 2.016; // g/mol

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter(
          (row) => row.p_supplied_kw !== undefined && row.p_consumed_kw !== undefined
        );

        if (parsed.length === 0) {
          alert("No valid data found in CSV");
          return;
        }

        const maxConsumed = Math.max(...parsed.map((d) => d.p_consumed_kw));
        const maxSupplied = Math.max(...parsed.map((d) => d.p_supplied_kw));
        const avgWindOutput = parsed.reduce((sum, d) => sum + d.p_supplied_kw, 0) / parsed.length;
        
        // Calculate turbines needed to meet peak demand on average wind
        const turbinesNeeded = Math.ceil(maxConsumed / avgWindOutput);

        // Calculate the maximum surplus across all possible scenarios
        const maxSurplus = Math.max(
          ...parsed.map((d) => Math.abs(d.p_supplied_kw * turbinesNeeded - d.p_consumed_kw))
        );

        // Pre-calculate maximum hydrogen storage and import for this configuration
        const simulationResults = simulateEntireTimespan(parsed, turbinesNeeded, 1, electrolyzerEfficiency, fuelCellEfficiency);
        
        setTurbinesInCase1(turbinesNeeded);
        
        // Set max values based on the maximum possible values across all cases
        setMaxValues({ 
          supplied: maxSupplied * turbinesNeeded, // Maximum possible supply
          consumed: maxConsumed, 
          surplus: maxSurplus,
          hydrogenStorage: simulationResults.maxStorage,
          hydrogenImport: simulationResults.maxImportRate
        });
        
        setData(parsed);
        setCurrentIndex(0);
        setStorageKWh(0);
        setHydrogenImported(0);
        setCurrentImportRate(0);
        setIsPlaying(false);
      },
    });
  };

  // Recalculate max values when case changes
  useEffect(() => {
    if (data.length === 0 || turbinesInCase1 === 0) return;
    
    const simulationResults = simulateEntireTimespan(data, turbinesInCase1, caseIndex, electrolyzerEfficiency, fuelCellEfficiency);
    setMaxValues(prev => ({
      ...prev,
      hydrogenStorage: simulationResults.maxStorage,
      hydrogenImport: simulationResults.maxImportRate
    }));
  }, [caseIndex, data, turbinesInCase1]);

  const resetSimulation = () => {
    setCurrentIndex(0);
    setStorageKWh(0);
    setHydrogenImported(0);
    setCurrentImportRate(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (data.length === 0 || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= data.length) {
          setIsPlaying(false);
          return prev;
        }

        const current = data[nextIndex];
        const multiplier = (11 - caseIndex) / 10;
        const turbinesUsed = turbinesInCase1 * multiplier;
        const adjustedSupplied = current.p_supplied_kw * turbinesUsed;
        const surplus = adjustedSupplied - current.p_consumed_kw;

        setStorageKWh((prevStorage) => {
          let importNeeded = 0;
          let newStorage = prevStorage;
          
          if (surplus > 0) {
            // Excess power goes to electrolyzer (with efficiency loss)
            newStorage = prevStorage + surplus * electrolyzerEfficiency;
          } else if (surplus < 0) {
            // Need power from fuel cell (with efficiency loss)
            const required = Math.abs(surplus) / fuelCellEfficiency;
            
            if (prevStorage >= required) {
              // Use stored hydrogen
              newStorage = prevStorage - required;
            } else {
              // Not enough stored hydrogen, need to import
              const shortfall = required - prevStorage;
              importNeeded = shortfall;
              newStorage = 0; // Storage depleted
              
              // Update imported hydrogen tracking
              setHydrogenImported(prev => prev + importNeeded);
              setCurrentImportRate(importNeeded);
            }
          } else {
            // No surplus or deficit
            setCurrentImportRate(0);
          }
          
          // Reset import rate if not importing this cycle
          if (surplus >= 0) {
            setCurrentImportRate(0);
          }
          
          return newStorage;
        });

        return nextIndex;
      });
    }, 250); // interval time

    return () => clearInterval(interval);
  }, [data, caseIndex, isPlaying, turbinesInCase1]);

  const convertHydrogen = (kWh, unit) => {
    switch (unit) {
      case 'kg':
        return kWh / hydrogenEnergyDensity;
      case 'mol':
        const kg = kWh / hydrogenEnergyDensity;
        return (kg * 1000) / hydrogenMolarMass; // Convert to grams then to moles
      default:
        return kWh;
    }
  };

  const getHydrogenDisplayValue = () => {
    const converted = convertHydrogen(storageKWh, hydrogenUnit);
    return converted.toFixed(hydrogenUnit === 'mol' ? 0 : 2);
  };

  const getHydrogenMaxValue = () => {
    return convertHydrogen(maxValues.hydrogenStorage, hydrogenUnit);
  };

  const getImportMaxValue = () => {
    return convertHydrogen(maxValues.hydrogenImport, hydrogenUnit);
  };

  const current = data[currentIndex] || {};
  const multiplier = (11 - caseIndex) / 10;
  const turbinesUsed = turbinesInCase1 * multiplier;
  const adjustedSupplied = current.p_supplied_kw ? current.p_supplied_kw * turbinesUsed : 0;
  const surplus = adjustedSupplied - (current.p_consumed_kw || 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-center">Wind-Hydrogen System Simulation</h1>
      
      <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          className="mb-4 w-full" 
        />
        <p className="text-sm text-gray-600">
          Upload a CSV file with columns: p_supplied_kw, p_consumed_kw, timestamp
        </p>
      </div>

      {data.length > 0 && (
        <>
          {/* Controls */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-4 py-2 rounded font-semibold ${
                    isPlaying 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={resetSimulation}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-semibold"
                >
                  Reset
                </button>
              </div>
              
              <div className="text-sm">
                Progress: {currentIndex + 1} / {data.length} hours
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label htmlFor="caseSlider" className="font-semibold whitespace-nowrap">
                Case {caseIndex}:
              </label>
              <input
                id="caseSlider"
                type="range"
                min="1"
                max="11"
                value={caseIndex}
                onChange={(e) => setCaseIndex(Number(e.target.value))}
                className="flex-grow"
              />
              <span className="whitespace-nowrap">{Math.round(turbinesUsed)} turbines</span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="font-semibold">Hydrogen Display:</span>
              {['kWh', 'kg', 'mol'].map((unit) => (
                <label key={unit} className="flex items-center space-x-1">
                  <input
                    type="radio"
                    name="hydrogenUnit"
                    value={unit}
                    checked={hydrogenUnit === unit}
                    onChange={(e) => setHydrogenUnit(e.target.value)}
                  />
                  <span>{unit}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Visualization Bars */}
          <div className="flex justify-center space-x-6 bg-white p-6 rounded-lg shadow">
            <Bar
              label={`Wind Supply\n${adjustedSupplied.toFixed(1)} kW`}
              value={adjustedSupplied}
              max={maxValues.supplied}
              color="green"
            />
            <Bar
              label={`Demand\n${(current.p_consumed_kw || 0).toFixed(1)} kW`}
              value={current.p_consumed_kw || 0}
              max={maxValues.consumed}
              color="orange"
            />
            <Bar
              label={`Surplus/Deficit\n${surplus.toFixed(1)} kW`}
              value={surplus}
              max={maxValues.surplus}
              color="teal"
              midpoint
            />
            <Bar
              label={`H₂ Storage\n${getHydrogenDisplayValue()} ${hydrogenUnit}`}
              value={convertHydrogen(storageKWh, hydrogenUnit)}
              max={getHydrogenMaxValue()}
              color="blue"
            />
            <Bar
              label={`H₂ Import Rate\n${convertHydrogen(currentImportRate, hydrogenUnit).toFixed(hydrogenUnit === 'mol' ? 0 : 2)} ${hydrogenUnit}/hr`}
              value={convertHydrogen(currentImportRate, hydrogenUnit)}
              max={getImportMaxValue()}
              color="red"
            />
          </div>

          {/* System Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-semibold mb-2">System Parameters</h3>
              <div>Electrolyzer Efficiency: {(electrolyzerEfficiency * 100).toFixed(0)}%</div>
              <div>Fuel Cell Efficiency: {(fuelCellEfficiency * 100).toFixed(0)}%</div>
              <div>Base Turbines (Case 1): {turbinesInCase1.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-semibold mb-2">Current Status</h3>
              <div>Storage: {storageKWh.toFixed(1)} kWh</div>
              <div>Active Turbines: {turbinesUsed.toFixed(1)}</div>
              <div>Net Power: {surplus > 0 ? '+' : ''}{surplus.toFixed(1)} kW</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}