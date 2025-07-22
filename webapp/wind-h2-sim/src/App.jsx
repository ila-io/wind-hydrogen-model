import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Wind, Zap, Truck, Lightbulb } from "lucide-react";

// Function to simulate the entire timespan and find maximum values
const simulateEntireTimespan = (data, turbineCount, electrolyzerEfficiency = 0.75, fuelCellEfficiency = 0.55) => {
  let storage = 0;
  let maxStorage = 0;
  let maxImportRate = 0;
  let totalImported = 0;

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const adjustedSupplied = current.p_supplied_kw * turbineCount;
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

// Animated Arrow Component
function AnimatedArrow({ active, direction = "right", color = "blue", className = "" }) {
  const arrowPath = direction === "right" 
    ? "M2 12h16m-4-4l4 4-4 4" 
    : direction === "down" 
    ? "M12 2v16m4-4l-4 4-4-4"
    : "M2 12h16m-4-4l4 4-4 4";

  const colorMap = {
    green: { stroke: active ? 'stroke-green-500' : 'stroke-gray-300', glow: 'drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]' },
    blue: { stroke: active ? 'stroke-blue-500' : 'stroke-gray-300', glow: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' },
    red: { stroke: active ? 'stroke-red-500' : 'stroke-gray-300', glow: 'drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' },
    orange: { stroke: active ? 'stroke-orange-500' : 'stroke-gray-300', glow: 'drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]' }
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        width="32" 
        height="24" 
        viewBox="0 0 24 24" 
        className={`transition-all duration-500 ${colors.stroke} ${active ? `${colors.glow} opacity-100` : 'opacity-50'} ${active ? 'animate-pulse' : ''}`}
        strokeWidth="3"
        fill="none"
      >
        <path d={arrowPath} />
      </svg>
    </div>
  );
}

// Bar Component
function Bar({ label, value = 0, max = 1, color = "gray", midpoint = false, position = "bottom" }) {
  const percent = Math.min(Math.abs(value / max) * 100, 100);

  const colorClasses = {
    green: "bg-green-500",
    orange: "bg-orange-500", 
    teal: "bg-teal-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
    gray: "bg-gray-500"
  };

  const barElement = (
    <div className="h-32 w-4 bg-gray-200 relative overflow-hidden rounded">
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
  );

  return (
    <div className="flex flex-col items-center text-xs space-y-2 w-20">
      {position === "top" && (
        <div className="text-center min-h-[3rem] flex items-end justify-center w-full">
          <div className="leading-tight">{label}</div>
        </div>
      )}
      <div className="flex justify-center">{barElement}</div>
      {position === "bottom" && (
        <div className="text-center min-h-[3rem] flex items-start justify-center w-full">
          <div className="leading-tight">{label}</div>
        </div>
      )}
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
  const [customTurbineInput, setCustomTurbineInput] = useState(false);
  const [customTurbines, setCustomTurbines] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hydrogenUnit, setHydrogenUnit] = useState('MWh');
  const [hydrogenImported, setHydrogenImported] = useState(0);
  const [currentImportRate, setCurrentImportRate] = useState(0);

  const electrolyzerEfficiency = 0.75;
  const fuelCellEfficiency = 0.55;
  
  // Conversion factors
  const hydrogenEnergyDensity = 33.33; // kWh/kg
  const hydrogenMolarMass = 2.016; // g/mol

  // Calculate current turbine count
  const getCurrentTurbineCount = () => {
    if (customTurbineInput) {
      return customTurbines;
    } else {
      const multiplier = (11 - caseIndex) / 10;
      return turbinesInCase1 * multiplier;
    }
  };

  const processData = (results) => {
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
    
    const turbinesNeeded = Math.ceil(maxConsumed / avgWindOutput);
    const maxSurplus = Math.max(
      ...parsed.map((d) => Math.abs(d.p_supplied_kw * turbinesNeeded - d.p_consumed_kw))
    );

    // Calculate initial simulation results with case 1 turbines
    const simulationResults = simulateEntireTimespan(parsed, turbinesNeeded, electrolyzerEfficiency, fuelCellEfficiency);
    
    setTurbinesInCase1(turbinesNeeded);
    setCustomTurbines(turbinesNeeded); // Initialize custom turbines to case 1 value
    setMaxValues({ 
      supplied: maxSupplied * turbinesNeeded,
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
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: processData,
    });
  };

  // Load default data on component mount
  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        const response = await fetch('/data.csv');
        if (response.ok) {
          const csvText = await response.text();
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: processData,
          });
        }
      } catch (error) {
        console.log('No default data.csv found in public folder');
      }
    };

    loadDefaultData();
  }, []);

  // Recalculate max values when turbine configuration changes
  useEffect(() => {
    if (data.length === 0 || turbinesInCase1 === 0) return;

    const currentTurbineCount = getCurrentTurbineCount();
    const simulationResults = simulateEntireTimespan(data, currentTurbineCount, electrolyzerEfficiency, fuelCellEfficiency);
    
    // Calculate new max values based on current turbine count
    const maxSupplied = Math.max(...data.map((d) => d.p_supplied_kw * currentTurbineCount));
    const maxSurplus = Math.max(
      ...data.map((d) => Math.abs(d.p_supplied_kw * currentTurbineCount - d.p_consumed_kw))
    );

    setMaxValues(prev => ({
      ...prev,
      supplied: maxSupplied,
      surplus: maxSurplus,
      hydrogenStorage: simulationResults.maxStorage,
      hydrogenImport: simulationResults.maxImportRate
    }));
  }, [caseIndex, data, turbinesInCase1, customTurbineInput, customTurbines]);

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
        const turbinesUsed = getCurrentTurbineCount();
        const adjustedSupplied = current.p_supplied_kw * turbinesUsed;
        const surplus = adjustedSupplied - current.p_consumed_kw;

        setStorageKWh((prevStorage) => {
          let importNeeded = 0;
          let newStorage = prevStorage;
          
          if (surplus > 0) {
            newStorage = prevStorage + surplus * electrolyzerEfficiency;
            setCurrentImportRate(0);
          } else if (surplus < 0) {
            const required = Math.abs(surplus) / fuelCellEfficiency;
            
            if (prevStorage >= required) {
              newStorage = prevStorage - required;
              setCurrentImportRate(0);
            } else {
              const shortfall = required - prevStorage;
              importNeeded = shortfall;
              newStorage = 0;
              
              setHydrogenImported(prev => prev + importNeeded);
              setCurrentImportRate(importNeeded);
            }
          } else {
            setCurrentImportRate(0);
          }
          
          return newStorage;
        });

        return nextIndex;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [data, caseIndex, isPlaying, turbinesInCase1, customTurbineInput, customTurbines]);

  const convertHydrogen = (kWh, unit) => {
    const mWh = kWh / 1000; // Convert to MWh first
    switch (unit) {
      case 'kg':
        return kWh / hydrogenEnergyDensity;
      case 'mol':
        const kg = kWh / hydrogenEnergyDensity;
        return (kg * 1000) / hydrogenMolarMass;
      default:
        return mWh;
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
  const turbinesUsed = getCurrentTurbineCount();
  const adjustedSupplied = current.p_supplied_kw ? current.p_supplied_kw * turbinesUsed : 0;
  const surplus = adjustedSupplied - (current.p_consumed_kw || 0);

  // Flow states
  const windToHydrogen = surplus > 0;
  const hydrogenToLoad = surplus < 0 && storageKWh > 0;
  const importToHydrogen = surplus < 0 && storageKWh <= 0;
  const directWindToLoad = adjustedSupplied > 0 && (current.p_consumed_kw || 0) > 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
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

            <div className="flex items-center space-x-4 flex-wrap">
              <div className="flex items-center space-x-2">
                <label className="font-semibold">Custom Turbines:</label>
                <input
                  type="checkbox"
                  checked={customTurbineInput}
                  onChange={() => setCustomTurbineInput(!customTurbineInput)}
                />
              </div>

              {customTurbineInput ? (
                <div className="flex items-center space-x-2">
                  <label htmlFor="customTurbines" className="font-semibold"># Turbines:</label>
                  <input
                    type="number"
                    id="customTurbines"
                    value={customTurbines}
                    min="1"
                    step="1"
                    onChange={(e) => setCustomTurbines(Number(e.target.value))}
                    className="border px-2 py-1 rounded w-20"
                  />
                </div>
              ) : (
                <>
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
                    className="flex-grow max-w-xs"
                  />
                </>
              )}

              <span className="whitespace-nowrap font-semibold">
                Active: {Math.round(turbinesUsed)} turbines
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="font-semibold">Hydrogen Display:</span>
              {['MWh', 'kg', 'mol'].map((unit) => (
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

          {/* Main System Diagram */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            {/* Import truck at top */}
            <div className="flex justify-center mb-4">
              <div className="flex flex-col items-center">
                <Truck size={32} className={`transition-all duration-500 ${importToHydrogen ? 'text-red-500' : 'text-gray-400'}`} />
                <AnimatedArrow active={importToHydrogen} direction="down" color="red" className="mt-1" />
                <Bar
                  label={`H₂ Import\n${convertHydrogen(currentImportRate, hydrogenUnit).toFixed(hydrogenUnit === 'mol' ? 0 : 2)} ${hydrogenUnit}/hr`}
                  value={convertHydrogen(currentImportRate, hydrogenUnit)}
                  max={getImportMaxValue()}
                  color="red"
                  position="bottom"
                />
              </div>
            </div>

            {/* Main flow diagram */}
            <div className="flex items-center justify-center space-x-6">
              
              {/* Wind Generation */}
              <div className="flex flex-col items-center space-y-3">
                <Wind size={48} className="text-green-600" />
                <Bar
                  label={`${(adjustedSupplied / 1000).toFixed(1)} MW`}
                  value={adjustedSupplied}
                  max={maxValues.supplied}
                  color="green"
                  position="bottom"
                />
              </div>

              {/* Arrow to Electrolyzer */}
              <AnimatedArrow active={windToHydrogen} color="green" />

              {/* Electrolyzer */}
              <div className="flex flex-col items-center space-y-3">
                <div className={`p-3 rounded-lg transition-all duration-500 ${
                  windToHydrogen ? 'bg-green-200 shadow-lg shadow-green-300' : 'bg-gray-100'
                }`}>
                  <Zap size={32} className={`transition-all duration-500 ${
                    windToHydrogen ? 'text-green-600' : 'text-gray-400'
                  }`} />
                </div>
                <div className="text-xs text-center w-20">Electrolyzer</div>
              </div>

              {/* Arrow to Hydrogen Tank */}
              <AnimatedArrow active={windToHydrogen} color="green" />

              {/* Hydrogen System */}
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-16 bg-blue-100 border-2 border-blue-400 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xs">H₂</span>
                </div>
                <div className="flex space-x-2">
                  <Bar
                    label={`Surplus\n${(surplus / 1000).toFixed(1)} MW`}
                    value={surplus}
                    max={maxValues.surplus}
                    color="teal"
                    midpoint
                    position="bottom"
                  />
                  <Bar
                    label={`Storage\n${getHydrogenDisplayValue()} ${hydrogenUnit}`}
                    value={convertHydrogen(storageKWh, hydrogenUnit)}
                    max={getHydrogenMaxValue()}
                    color="blue"
                    position="bottom"
                  />
                </div>
              </div>

              {/* Arrow to Fuel Cell */}
              <AnimatedArrow active={hydrogenToLoad} color="blue" />

              {/* Fuel Cell */}
              <div className="flex flex-col items-center space-y-3">
                <div className={`p-3 rounded-lg transition-all duration-500 ${
                  hydrogenToLoad ? 'bg-blue-200 shadow-lg shadow-blue-300' : 'bg-gray-100'
                }`}>
                  <Zap size={32} className={`transition-all duration-500 ${
                    hydrogenToLoad ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                </div>
                <div className="text-xs text-center w-20">Fuel Cell</div>
              </div>

              {/* Arrow to Load */}
              <AnimatedArrow active={hydrogenToLoad} color="orange" />

              {/* Load */}
              <div className="flex flex-col items-center space-y-3">
                <Lightbulb size={48} className="text-yellow-500" />
                <Bar
                  label={`${((current.p_consumed_kw || 0) / 1000).toFixed(1)} MW`}
                  value={current.p_consumed_kw || 0}
                  max={maxValues.consumed}
                  color="orange"
                  position="bottom"
                />
              </div>
            </div>

            {/* Direct connection line with arrows */}
            <div className="relative mt-8">
              <div className="flex justify-center">
                <div className="relative w-3/5">
                  {/* Left arrow tail */}
                  <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
                    <svg width="16" height="16" viewBox="0 0 16 16" className={`transition-all duration-500 ${directWindToLoad ? 'text-orange-400' : 'text-gray-300'}`} fill="currentColor">
                      <path d="M8 2l-2 2h1v8h2V4h1L8 2z"/>
                    </svg>
                  </div>
                  
                  {/* Main connection line */}
                  <div className="h-1 bg-gray-300 rounded">
                    <div className={`h-full rounded transition-all duration-500 ${directWindToLoad ? 'bg-orange-400 opacity-90' : 'bg-gray-300'}`}></div>
                  </div>
                  
                  {/* Right arrow tail */}
                  <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
                    <svg width="16" height="16" viewBox="0 0 16 16" className={`transition-all duration-500 ${directWindToLoad ? 'text-orange-400' : 'text-gray-300'}`} fill="currentColor">
                      <path d="M8 2l-2 2h1v8h2V4h1L8 2z"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="text-center text-xs text-gray-500 mt-4">
                Direct Wind → Load Connection
              </div>
            </div>
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
              <div>Storage: {(storageKWh / 1000).toFixed(1)} MWh</div>
              <div>Active Turbines: {turbinesUsed.toFixed(1)} {customTurbineInput && "(Custom)"}</div>
              <div>Net Power: {surplus > 0 ? '+' : ''}{(surplus / 1000).toFixed(1)} MW</div>
            </div>
            <div className="bg-gray-50 p-3 rounded col-span-2">
              <h3 className="font-semibold mb-2">Cumulative Imported Hydrogen</h3>
              <div>
                {convertHydrogen(hydrogenImported, hydrogenUnit).toFixed(hydrogenUnit === 'mol' ? 0 : 2)} {hydrogenUnit}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded col-span-2">
              <h3 className="font-semibold mb-2">Info</h3>
              <div>
                <p>Graphs for historic data and proper system efficiency implementation under development.</p>
                <p>Example data from the following:</p>
                <p>
                  Hourly load data is sourced from the{" "}
                  <a
                    href="https://www.ercot.com/gridinfo/load/load_hist/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1e90ff", textDecoration: "underline" }}
                  >
                    ERCOT archive
                  </a>
                  , using reduced SCENT data from January 1, 2025, to April 30, 2025.
                </p>                

                <p>
                  Hourly wind data is obtained from Avenger Field Airport in Sweetwater, Texas, via the{" "}
                  <a
                    href="https://www.ncei.noaa.gov/maps/hourly/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1e90ff", textDecoration: "underline" }}
                  >
                    NOAA Hourly Weather Database
                  </a>
                  , and is used to simulate conditions at the nearby Roscoe Wind Farm, which uses 1 MW Mitsubishi wind turbines.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}