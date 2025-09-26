import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { fetchSalaryData, SalaryData, TimePeriod, formatSalary } from '../services/salaryService';
import Dropdown, { DropdownOption } from './Dropdown';

const COLORS = ['#1A6262', '#FF6700', '#334155', '#E1A940', '#FF5252', '#91C499'];

interface HROverviewChartsProps {
  timePeriod: TimePeriod;
  selectedDepartment: string;
  // Callback to send the fetched salary data (including selectedPeriod) to parent
  onSalaryData?: (data: SalaryData) => void;
}

// Function to generate unique key for chart items
const generateUniqueKey = (item: { department?: string; name?: string; month?: string }, index: number, prefix: string = 'item'): string => {
  if (item.department) {
    return `${prefix}-${item.department.replace(/\s+/g, '-')}-${index}`;
  }
  if (item.name) {
    return `${prefix}-${item.name.replace(/\s+/g, '-')}-${index}`;
  }
  if (item.month) {
    return `${prefix}-${item.month.replace(/\s+/g, '-')}-${index}`;
  }
  return `${prefix}-${index}`;
};

const HROverviewCharts: React.FC<HROverviewChartsProps> = ({ timePeriod, selectedDepartment, onSalaryData }) => {
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add state for year filters
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYearOT, setSelectedYearOT] = useState<number | null>(null);
  const [selectedYearSalary, setSelectedYearSalary] = useState<number | null>(null);

  // Helper function to calculate rounded Y-axis values
  const calculateRoundedYAxis = (data: number[], roundTo: number = 5) => {
    const maxValue = Math.max(...data, 1);
    const buffer = maxValue * 0.2;
    const adjustedMax = maxValue + buffer;
    
    // Calculate a nice round number for the max value
    const magnitude = Math.pow(10, Math.floor(Math.log10(adjustedMax)));
    const normalizedMax = adjustedMax / magnitude;
    let niceMax;
    
    if (normalizedMax <= 1) niceMax = 1;
    else if (normalizedMax <= 2) niceMax = 2;
    else if (normalizedMax <= 5) niceMax = 5;
    else niceMax = 10;
    
    const roundedMax = niceMax * magnitude;
    
    // Generate nice tick intervals
    const tickCount = 5;
    const step = roundedMax / (tickCount - 1);
    
    // Round step to a nice number
    const stepMagnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const normalizedStep = step / stepMagnitude;
    let niceStep;
    
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;
    
    const finalStep = niceStep * stepMagnitude;
    
    // Generate ticks in descending order for horizontal bar chart
    const ticks = [];
    for (let i = tickCount - 1; i >= 0; i--) {
      ticks.push(Math.round(i * finalStep));
    }
    
    return {
      roundedMax: Math.round(roundedMax),
      ticks
    };
  };

  useEffect(() => {
    const loadSalaryData = async () => {
      try {
        setLoading(true);
        // Filter by both timePeriod and selectedDepartment
        const data = await fetchSalaryData(timePeriod, selectedDepartment || 'All');
        setSalaryData(data);
        // Notify parent (App) about the loaded salary data so other components (cards) can sync
        if (typeof onSalaryData === 'function') {
          try { onSalaryData(data); } catch (e) { /* swallow */ }
        }

        // Extract available years from the actual data
        const years = new Set<number>();

        // Function to extract years from month strings
        const extractYears = (items: Array<{ month?: string }>) => {
          items.forEach(item => {
            if (!item.month) return;

            const monthStr = String(item.month || '');
            const yearPatterns = [
              /\s(\d{4})$/,  // "Jan 2024"
              /(\d{4})$/,    // "Jan2024" or "2024"
              /-(\d{4})$/,   // "Jan-2024"
              /\/(\d{4})$/   // "Jan/2024"
            ];

            for (const pattern of yearPatterns) {
              const match = monthStr.match(pattern);
              if (match && match[1]) {
                const year = parseInt(match[1], 10);
                if (!isNaN(year)) {
                  years.add(year);
                  break;
                }
              }
            }
          });
        };

        // Extract years from OT trends and salary trends
        if (data.otTrends && data.otTrends.length > 0) {
          extractYears(data.otTrends);
        }

        if (data.salaryTrends && data.salaryTrends.length > 0) {
          extractYears(data.salaryTrends);
        }

        // Convert to array and sort in descending order (newest first)
        const yearArray = Array.from(years).sort((a, b) => b - a);
        console.log('Available years from data:', yearArray);

        setAvailableYears(yearArray);

        // Set default selected year to the most recent
        if (yearArray.length > 0) {
          setSelectedYearOT(yearArray[0]);
          setSelectedYearSalary(yearArray[0]);
        }

        setError(null);
      } catch {
        setError('Failed to load salary data');
        setSalaryData(null);
      } finally {
        setLoading(false);
      }
    };

    loadSalaryData();
  }, [timePeriod, selectedDepartment]);

  // Helper function to filter data by year
  const filterDataByYear = (data: Array<{ month?: string }>, year: number | null) => {
    if (!year || !data) return data;

    // Filter data to only show items from the selected year
    return data.filter(item => {
      if (!item.month) {
        console.warn('Item missing month property:', item);
        return false;
      }

      // Extract year from the month property in various formats
      const monthStr = String(item.month || '');

      // Try to find a year pattern in the month string
      const yearPatterns = [
        /\s(\d{4})$/,  // "Jan 2024"
        /(\d{4})$/,    // "Jan2024" or "2024"
        /-(\d{4})$/,   // "Jan-2024"
        /\/(\d{4})$/   // "Jan/2024"
      ];

      for (const pattern of yearPatterns) {
        const match = monthStr.match(pattern);
        if (match && match[1]) {
          const extractedYear = parseInt(match[1], 10);
          console.log(`Extracted year ${extractedYear} from month string: "${monthStr}"`);
          return extractedYear === year;
        }
      }

      console.warn(`Could not extract year from month string: "${monthStr}"`);
      return false;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading HR data...</div>
      </div>
    );
  }

  if (error || !salaryData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          {error || 'Failed to load HR data'}
        </div>
      </div>
    );
  }

  if ((salaryData && salaryData.departmentData && salaryData.departmentData.length === 0) || (salaryData && salaryData.departmentDistribution && salaryData.departmentDistribution.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg font-semibold">No data found for the selected filter.</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: { name: string; value: number; color?: string; fill?: string }, index: number) => {
            // Format the value based on what type of data it is
            let formattedValue: string | number = entry.value;

            if (entry.name.includes('Salary')) {
              formattedValue = formatSalary(entry.value);
            } else if (entry.name.includes('Percentage')) {
              formattedValue = `${Number(entry.value).toFixed(1)}%`;
            } else if (entry.name.includes('Hours')) {
              formattedValue = `${Number(entry.value).toFixed(1)} hrs`;
            } else if (typeof entry.value === 'number') {
              formattedValue = Number(entry.value).toFixed(1);
            }

            return (
              <p key={`tooltip-${index}`} style={{ color: entry.color || entry.fill }}>
                {entry.name}: {formattedValue}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Filter OT and Salary trends data by selected years
  const filteredOTTrends = filterDataByYear(salaryData.otTrends || [], selectedYearOT);
  const filteredSalaryTrends = filterDataByYear(salaryData.salaryTrends || [], selectedYearSalary);

  const renderOTYearFilter = () => {
    if (availableYears.length <= 1) return null;

    const yearOptions: DropdownOption[] = [
      { value: '', label: 'All Years' },
      ...availableYears.map(year => ({ value: year.toString(), label: year.toString() }))
    ];

    return (
      <Dropdown
        options={yearOptions}
        value={selectedYearOT?.toString() || ''}
        onChange={(value) => setSelectedYearOT(value ? parseInt(value) : null)}
        className="w-24"
        placeholder="Year"
      />
    );
  };

  // Function removed - was not being used

  // Ensure we have valid data to avoid errors
  const departmentData = salaryData.departmentData || [];
  const departmentDistribution = salaryData.departmentDistribution || [];
  const topSalariedEmployees = salaryData.topSalariedEmployees || [];

  // Determine if a specific department filter is active (not 'All' and not empty)
  const isDepartmentFiltered = Boolean(selectedDepartment && selectedDepartment !== 'All');




  return (
    <div className="space-y-6">
      {/* First row of charts */}
      {!isDepartmentFiltered && (
        <div className="grid grid-cols-2 gap-6">
        {/* Department Distribution Line Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-6">Department Distribution</h3>
          <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
              <LineChart data={departmentDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                     <XAxis
                       dataKey="department"
                       axisLine={false}
                       tickLine={false}
                  tick={{ fill: '#666666', fontSize: 12 }}
                  textAnchor="end"
                  angle={-45}
                  height={80}
                     />
                     <YAxis
                       axisLine={false}
                       tickLine={false}
                  tick={{ fill: '#666666', fontSize: 12 }}
                  tickFormatter={(value) => Math.round(value).toString()}
                     />
                     <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#1A6262"
                  strokeWidth={3}
                  dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                  name="Employee Count"
                />
              </LineChart>
                 </ResponsiveContainer>
          </div>
        </div>

        {/* Department-wise Attendance Line Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-6">Department-wise Attendance</h3>
          <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
              <LineChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                     <XAxis
                       dataKey="department"
                       axisLine={false}
                       tickLine={false}
                  tick={{ fill: '#666666', fontSize: 12 }}
                  textAnchor="end"
                  angle={-45}
                  height={80}
                     />
                     <YAxis
                       axisLine={false}
                       tickLine={false}
                  tick={{ fill: '#666666', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                       domain={[0, 100]}
                     />
                     <Tooltip
                       formatter={(value) => [`${value}%`, "Attendance"]}
                       cursor={{ fill: "rgba(60, 122, 122, 0.1)" }}
                     />
                <Line
                  type="monotone"
                  dataKey="attendancePercentage"
                  stroke="#1A6262"
                  strokeWidth={3}
                  dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                  name="Attendance %"
                />
              </LineChart>
                 </ResponsiveContainer>
          </div>
        </div>
        </div>
      )}
      {/* Second row of charts */}
      {!isDepartmentFiltered && (
        <div className="grid grid-cols-2 gap-6">
        {/* OT Hours vs Department Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 relative">
          <h3 className="font-semibold mb-6">OT Hours by Department</h3>

          <div className="flex relative">
            {/* Fixed Y-axis - positioned absolutely to stay in place */}
            <div 
              className="absolute left-0 top-0 z-10 bg-white"
              style={{ 
                width: '80px', 
                height: `${departmentData.length * 30}px`,
                paddingTop: '20px',
                paddingBottom: '20px'
              }}
            >
              <div className="h-full relative">
                {(() => {
                  const maxOT = Math.max(...departmentData.map(d => d.totalOTHours), 1);
                  const buffer = maxOT * 0.2;
                  const adjustedMax = maxOT + buffer;
                  const domainMax = Math.ceil(adjustedMax / 10) * 10; // Same calculation as chart domain
                  
                  const step = domainMax / 4;
                  const ticks = [
                    domainMax,
                    domainMax - step,
                    domainMax - step * 2,
                    domainMax - step * 3,
                    0
                  ];
                  
                  const chartHeight = departmentData.length * 30 - 35; // 65px for bottom padding
                  const tickSpacing = chartHeight / 4;
                  
                  return ticks.map((value, index) => (
                    <div 
                      key={index}
                      className="absolute text-xs text-gray-600 text-right pr-2"
                      style={{ 
                        top: `${index * tickSpacing}px`,
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        width: '100%'
                      }}
                    >
                      {Math.round(value)}h
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Scrollable chart content */}
            <div
              ref={(el) => {
                if (!el) return;
                const updateOverflow = () =>
                  el.dataset.overflow =
                  el.scrollWidth > el.clientWidth ? "true" : "false";
                updateOverflow();
                new ResizeObserver(updateOverflow).observe(el);
              }}
              className="flex-1 overflow-x-auto scroll-hidden ml-20"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none"
              }}
            >
              <style>{`
                .scroll-hidden {
                  -ms-overflow-style: none; 
                  scrollbar-width: none; 
                }
                .scroll-hidden::-webkit-scrollbar {
                  display: none;
                }
              `}</style>

              <div
                style={{
                  height: `${departmentData.length * 35}px`,
                  width: `${departmentData.length * 120}px`
                }}
              >
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart
                     data={departmentData}
                     layout="horizontal"
                     barCategoryGap="10%"
                     barSize={30}
                     margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                   >
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                     <XAxis
                       dataKey="department"
                       type="category"
                       axisLine={false}
                       tickLine={false}
                       width={100}
                       tick={{ fill: "#666666", fontSize: 12, dy: 25 }}
                     />
                     <YAxis
                       type="number"
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: "transparent" }}
                       domain={[0, (() => {
                    const maxOT = Math.max(...departmentData.map(d => d.totalOTHours), 1);
                    const buffer = maxOT * 0.2;
                    const adjustedMax = maxOT + buffer;
                    return Math.ceil(adjustedMax / 10) * 10; // Round up to nearest 10
                  })()]}
                       width={0}
                     />
                     <Tooltip content={<CustomTooltip />} />
                     <Bar dataKey="totalOTHours" name="OT Hours" radius={[4,4,0,0]}>
                       {departmentData.map((entry, index) => (
                         <Cell
                           key={generateUniqueKey(entry, index, "dept-ot")}
                           fill={index % 2 === 0 ? "#3C7A7A" : "#1A626299"}
                         />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 relative">
           <h3 className="font-semibold mb-6">Dept. Salary Comparison</h3>

           <div className="flex relative">
             {/* Fixed Y-axis - positioned absolutely to stay in place */}
             <div 
               className="absolute left-0 top-0 z-10 bg-white"
               style={{ 
                 width: '80px', 
                 height: `${departmentData.length * 30}px`,
                 paddingTop: '0px',
                 paddingBottom: '20px'
               }}
             >
               <div className="h-full relative">
                {(() => {
                  if (departmentData.length === 0) return null;
                  
                  // Custom Y-axis ticks as requested: 0, 15000, 30000, 45000, 60000
                  const customTicks = [60000, 45000, 30000, 15000, 0]; // Reverse order for top-to-bottom display
                  
                  // Calculate the actual chart area height (excluding margins)
                  const chartHeight = departmentData.length * 32 - 50; // Match the chart container height
                  const tickSpacing = chartHeight / 4;
                  
                  return customTicks.map((value, index) => (
                    <div 
                      key={index}
                      className="absolute text-xs text-gray-600 text-right pr-2"
                      style={{ 
                        top: `${index * tickSpacing + 10}px`, // Add small offset for better alignment
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        width: '100%'
                      }}
                    >
                      {value.toLocaleString()}
                    </div>
                  ));
                })()}
               </div>
             </div>

             {/* Scrollable chart content */}
             <div
               ref={(el) => {
                 if (!el) return;
                 const updateOverflow = () =>
                   el.dataset.overflow =
                   el.scrollWidth > el.clientWidth ? "true" : "false";
                 updateOverflow();
                 new ResizeObserver(updateOverflow).observe(el);
               }}
               className="flex-1 overflow-x-auto scroll-hidden ml-20"
               style={{
                 scrollbarWidth: "none",
                 msOverflowStyle: "none"
               }}
             >
               <style>{`
                 .scroll-hidden {
                   -ms-overflow-style: none; 
                   scrollbar-width: none; 
                 }
                 .scroll-hidden::-webkit-scrollbar {
                   display: none;
                 }
               `}</style>

               <div
                 style={{
                   height: `${departmentData.length * 35}px`,
                   width: `${departmentData.length * 120}px`
                 }}
               >
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart
                     data={departmentData}
                     layout="horizontal"
                     barCategoryGap="10%"
                     barSize={30}
                     margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                   >
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                     <XAxis
                       dataKey="department"
                       type="category"
                       axisLine={false}
                       tickLine={false}
                       width={100}
                       tick={{ fill: "#666666", fontSize: 12, dy: 25 }}
                     />
                     <YAxis
                       type="number"
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: "transparent" }}
                       domain={[0, 60000]}
                       width={0}
                     />
                     <Tooltip content={<CustomTooltip />} />
                     <Bar dataKey="averageSalary" name="Average Salary" radius={[4,4,0,0]}>
                       {departmentData.map((entry, index) => (
                         <Cell
                           key={generateUniqueKey(entry, index, "dept-salary-comparison")}
                           fill={index % 2 === 0 ? "#3C7A7A" : "#1A626299"}
                         />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </div>
           </div>
         </div>
        </div>
      )}

      {/* Third row of charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Average OT Trends Line Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold">Avg. OT Trends</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredOTTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666666' }}
                  textAnchor="end"
                  fontSize={12}
                  dy={20}
                  height={60}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666666' }}
                  tickFormatter={(value) => `${Math.round(value)}h`}
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="averageOTHours"
                  stroke="#1A6262"
                  strokeWidth={3}
                  dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                  name="Avg OT Hours"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Enhanced Salary Trends Area Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold">Salary Trends</h3>
            <div className="flex items-center text-xs text-gray-500">
              <span>Average by month</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredSalaryTrends}>
                <defs>
                  <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A6262" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#1A6262" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666666' }}
                  textAnchor="end"
                  fontSize={12}
                  dy={40}
                  padding={{ left: 30}}
                  height={60}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666666' }}
                  fontSize={12}
                  tickFormatter={(value) => formatSalary(value).replace('₹', '').replace(',', '')}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="averageSalary"
                  name="Average Salary"
                  stroke="#1A6262"
                  fillOpacity={1}
                  fill="url(#colorSalary)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fourth row of charts - Original line charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Salary Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-6">Salary Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salaryData.salaryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="range"
                >
                  {salaryData.salaryDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  formatter={(value) => (
                    <span style={{ color: '#666666' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-6">Top Salaried Employees</h3>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topSalariedEmployees}
                layout="vertical"
                barCategoryGap="20%"
                barSize={20}
                margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />

                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666666", fontSize: 12, dy: 0 }}
                  interval={0}
                  padding={{ bottom: 0 }}
                />

                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666666", fontSize: 12 }}
                  domain={[0, (() => {
                    const maxSalary = Math.max(...topSalariedEmployees.map(d => d.salary), 1);
                    const buffer = maxSalary * 0.2;
                    const adjustedMax = maxSalary + buffer;
                    return Math.ceil(adjustedMax / 10000) * 10000; // Round up to nearest 10k
                  })()]}
                />

                <Tooltip content={<CustomTooltip />} />

                <Bar dataKey="salary" name="Salary" radius={[4, 4, 0, 0]}>
                  {topSalariedEmployees.map((entry, index) => (
                    <Cell
                      key={generateUniqueKey(entry, index, "top-salary")}
                      fill={index % 2 === 0 ? "#3C7A7A" : "#1A626299"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

         
      </div>
    </div>
  );
};

export default HROverviewCharts; 