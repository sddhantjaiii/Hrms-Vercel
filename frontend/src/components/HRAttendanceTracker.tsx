import React, { useEffect, useState } from 'react';
import DatePicker from './DatePicker';
import { Search } from 'lucide-react';
import { TimePeriod } from '../services/salaryService';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../services/api';
import Dropdown, { DropdownOption } from './Dropdown';

interface AttendanceRecord {
  id: number;
  employee_id: string;
  name: string;
  department?: string;
  date: string;
  calendar_days: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  attendance_percentage?: number;
  ot_hours: string | number;
  late_minutes: number;
}

interface AggregatedRecord {
  id?: number;
  employee_id: string;
  name: string;
  department?: string;
  date?: string;
  month?: string;
  year?: number;
  calendar_days: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  attendance_percentage?: number;
  ot_hours: number;
  late_minutes: number;
}

interface MonthInfo {
  month: string;
  year: number;
  totalDays: number;
  workingDays: number;
}

type FilterType = TimePeriod | 'custom' | 'custom_range' | 'one_day';

const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const HRAttendanceTracker: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('last_5_years');

  const filterTypeOptions: DropdownOption[] = [
    { value: 'one_day', label: 'One Day' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'last_5_years', label: 'Last 5 Years' },
    { value: 'custom_range', label: 'Custom Range' },
    
  ];
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  // Custom range state
  const [rangeStartDate, setRangeStartDate] = useState<string>(''); // ISO string YYYY-MM-DD
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  // One day filter state
  const [selectedDate, setSelectedDate] = useState<string>(''); // ISO string YYYY-MM-DD
  const [availableMonths, setAvailableMonths] = useState<{month: string, year: number}[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<{
    is_active: boolean;
    message: string;
    total_active_employees: number;
    employees_with_records: number;
    tracking_mode: string;
    has_daily_tracking: boolean;
  } | null>(null);
  const navigate = useNavigate();

  // Function to get days in a month
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Function to get working days in a month (excluding Sundays)
  const getWorkingDaysInMonth = (year: number, month: number): number => {
    const totalDays = getDaysInMonth(year, month);
    let workingDays = 0;
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      if (date.getDay() !== 0) { // 0 is Sunday
        workingDays++;
      }
    }
    
    return workingDays;
  };

  // Function to get month info for a specific period
  const getMonthsInfo = (startDate: Date, endDate: Date): MonthInfo[] => {
    const months: MonthInfo[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthIndex = currentDate.getMonth();
      const year = currentDate.getFullYear();
      
      months.push({
        month: monthNames[monthIndex],
        year: year,
        totalDays: getDaysInMonth(year, monthIndex),
        workingDays: getWorkingDaysInMonth(year, monthIndex)
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  };

  // Function to get unique months from data
  const extractAvailableMonths = (data: AttendanceRecord[]) => {
    const uniqueMonths = new Set<string>();
    const months: {month: string, year: number}[] = [];

    data.forEach(record => {
      const date = new Date(record.date);
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const key = `${month}-${year}`;
      
      if (!uniqueMonths.has(key)) {
        uniqueMonths.add(key);
        months.push({ month, year });
      }
    });

    return months.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return monthNames.indexOf(b.month) - monthNames.indexOf(a.month);
    });
  };

  // Function to get the latest date from data
  const getLatestDate = (data: AttendanceRecord[]): Date => {
    if (data.length === 0) return new Date(2025, 0, 1); // Default to Jan 2025
    
    const sortedDates = [...data].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    return new Date(sortedDates[0].date);
  };

  // Function to filter and aggregate data based on time period
  const filterAndAggregateData = (data: AttendanceRecord[], filterType: FilterType): AggregatedRecord[] => {
    // Use real current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const latestDate = getLatestDate(data);
    let filteredData: AttendanceRecord[] = [];
    let monthsInfo: MonthInfo[] = [];

    if (filterType === 'custom') {
      const monthIndex = monthNames.indexOf(selectedMonth);
      monthsInfo = getMonthsInfo(
        new Date(selectedYear, monthIndex, 1),
        new Date(selectedYear, monthIndex + 1, 0)
      );
      filteredData = data.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === monthIndex && recordDate.getFullYear() === selectedYear;
      });
    } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
      const start = new Date(rangeStartDate);
      const end = new Date(rangeEndDate);
      end.setDate(end.getDate() + 1); // Include the end date
      monthsInfo = getMonthsInfo(start, end);
      // Data returned by the API is already scoped to the custom range, so no further filtering is required.
      filteredData = data;
    } else if (filterType === 'one_day' && selectedDate) {
      // Filter data for a specific day
      console.log('🔍 One day filter - selectedDate:', selectedDate);
      console.log('🔍 One day filter - total data records:', data.length);
      
      // Since the API is not filtering correctly, we need to filter on the frontend
      // The API might be returning data for a different date, so we filter it here
      filteredData = data.filter(record => {
        const recordDate = new Date(record.date);
        const targetDate = new Date(selectedDate);
        
        // Compare dates more robustly
        const recordDateStr = recordDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        const matches = recordDateStr === targetDateStr;
        
        // Debug: Show date comparison for first few records
        if (data.indexOf(record) < 3) {
          console.log('🔍 Date comparison:', {
            record_date: record.date,
            record_date_parsed: recordDateStr,
            target_date: selectedDate,
            target_date_parsed: targetDateStr,
            matches: matches
          });
        }
        
        if (matches) {
          console.log('✅ Record matches date:', record.date, 'for employee:', record.employee_id);
        }
        return matches;
      });
      console.log('🔍 One day filter - filtered data records:', filteredData.length);
      
      // If no records found for the selected date, show a helpful message
      if (filteredData.length === 0 && data.length > 0) {
        console.log('⚠️ No records found for selected date. API returned data for different dates.');
        console.log('⚠️ Available dates in API response:', [...new Set(data.map(record => record.date))]);
        console.log('⚠️ This indicates a backend API bug - the API should filter by the selected date.');
        console.log('⚠️ Backend API is not correctly filtering by start_date and end_date parameters.');
      }
      
      // For one day, we don't need months info as it's just one day
      monthsInfo = [];
    } else {
      const startDate = (() => {
        switch (filterType) {
          case 'this_month':
            // Use the real current month and year
            return new Date(currentYear, currentMonth, 1);
          case 'last_6_months': {
            const date = new Date(latestDate);
            date.setMonth(date.getMonth() - 5);
            return date;
          }
          case 'last_12_months': {
            const date = new Date(latestDate);
            date.setMonth(date.getMonth() - 11);
            return date;
          }
          case 'last_5_years': {
            const date = new Date(latestDate);
            date.setFullYear(date.getFullYear() - 4);
            return date;
          }
          default:
            return new Date(currentYear, currentMonth, 1);
        }
      })();
      // For 'this_month', end date is the end of the current month
      const endDate = filterType === 'this_month'
        ? new Date(currentYear, currentMonth + 1, 0)
        : latestDate;
      monthsInfo = getMonthsInfo(startDate, endDate);
      filteredData = data.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    // Calculate total calendar days and working days for the period
    const totalCalendarDays = monthsInfo.reduce((sum, month) => sum + month.totalDays, 0);
    const totalWorkingDays = monthsInfo.reduce((sum, month) => sum + month.workingDays, 0);

    // Aggregate data by employee
    const aggregatedMap = new Map<string, AggregatedRecord>();
    
    filteredData.forEach(record => {
      const existing = aggregatedMap.get(record.employee_id);
      
      // Convert values, handling any potential invalid data
      const presentDays = record.present_days || 0;
      const absentDays = record.absent_days || 0;
      const otHours = typeof record.ot_hours === 'string' ? parseFloat(record.ot_hours) || 0 : record.ot_hours || 0;
      const lateMinutes = record.late_minutes || 0;
      
      if (existing) {
        existing.present_days += presentDays;
        existing.absent_days += absentDays;
        existing.ot_hours += otHours;
        existing.late_minutes += lateMinutes;
      } else {
        aggregatedMap.set(record.employee_id, {
          id: record.id,
          employee_id: record.employee_id,
          name: record.name,
          department: record.department,
          ...(filterType === 'this_month' || filterType === 'custom' || filterType === 'custom_range' || filterType === 'one_day' ? {
            date: record.date
          } : {}),
          calendar_days: totalCalendarDays,
          total_working_days: totalWorkingDays,
          present_days: presentDays,
          absent_days: absentDays,
          attendance_percentage: record.attendance_percentage,
          ot_hours: otHours,
          late_minutes: lateMinutes
        });
      }
    });

    return Array.from(aggregatedMap.values());
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching attendance data for filter:', filterType);
      
      // Build query parameters for time period filtering
      const params = new URLSearchParams();
      params.append('time_period', filterType);
      
      if (filterType === 'custom' && selectedMonth && selectedYear) {
        const monthIndex = monthNames.indexOf(selectedMonth) + 1; // Convert to 1-based month
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
        params.append('start_date', rangeStartDate);
        params.append('end_date', rangeEndDate);
        // Backend expects time_period=custom_range to differentiate from other custom modes
        params.set('time_period', 'custom_range');
      } else if (filterType === 'one_day' && selectedDate) {
        params.append('start_date', selectedDate);
        params.append('end_date', selectedDate);
        // Backend expects time_period=custom_range to differentiate from other custom modes
        params.set('time_period', 'custom_range');
        console.log('🔍 One day API call - selectedDate:', selectedDate);
        console.log('🔍 One day API call - params:', Object.fromEntries(params.entries()));
      }
      
      // Fetch attendance data with pagination handling
      let allAttendanceRecords: any[] = [];
      let totalCount = 0;
      let page = 1;
      const pageSize = 100; // Larger page size to reduce number of requests
      let hasMorePages = true;
      
      console.log('🔄 Starting paginated data fetch...');
      
      while (hasMorePages) {
        try {
          // Add page parameter to the URL
          const paginatedParams = new URLSearchParams(params);
          paginatedParams.set('page', page.toString());
          paginatedParams.set('page_size', pageSize.toString());
          
          const url = `/api/attendance/?${paginatedParams.toString()}`;
          console.log(`📄 Fetching page ${page}: ${url}`);
          console.log(`📄 Query parameters:`, Object.fromEntries(paginatedParams.entries()));
          
          const response = await apiCall(url);
          console.log(`📡 Response status: ${response.status}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch attendance data: ${response.status}`);
          }
          
          const apiResponse = await response.json();
          
          // Debug: Show sample records for one_day filter
          if (filterType === 'one_day' && apiResponse.results && apiResponse.results.length > 0) {
            console.log('🔍 Sample records for one_day filter:');
            apiResponse.results.slice(0, 3).forEach((record: any, index: number) => {
              console.log(`  Record ${index + 1}:`, {
                employee_id: record.employee_id,
                name: record.name,
                date: record.date,
                present_days: record.present_days,
                absent_days: record.absent_days
              });
            });
          }
          
          if (apiResponse.results && Array.isArray(apiResponse.results)) {
            // Standard paginated format: { results: [...], count: X, next: ..., previous: ... }
            allAttendanceRecords = allAttendanceRecords.concat(apiResponse.results);
            totalCount = apiResponse.count;
            
            console.log(`✅ Page ${page}: ${apiResponse.results.length} records. Total: ${allAttendanceRecords.length}/${totalCount}`);
            
            // Check if there are more pages
            hasMorePages = !!apiResponse.next;
            page++;
            
            // Safety check to prevent infinite loops
            if (page > 50) {
              console.warn('⚠️ Stopping pagination after 50 pages to prevent infinite loop');
              break;
            }
          } else if (Array.isArray(apiResponse)) {
            // Fallback: Direct array format
            allAttendanceRecords = allAttendanceRecords.concat(apiResponse);
            hasMorePages = false;
            console.log(`✅ Direct array: ${apiResponse.length} records. Total: ${allAttendanceRecords.length}`);
          } else {
            throw new Error('Unexpected API response format');
          }
        } catch (pageError) {
          console.error(`❌ Error fetching page ${page}:`, pageError);
          // Continue with what we have so far
          break;
        }
      }
      
      console.log(`🎉 Completed pagination: ${allAttendanceRecords.length} total records (${totalCount} expected)`);
      
      // Set attendance status based on the response data
      if (totalCount > 0) {
        setAttendanceStatus({
          is_active: true,
          message: 'Attendance tracking is active',
          total_active_employees: totalCount,
          employees_with_records: totalCount,
          tracking_mode: 'monthly_summary',
          has_daily_tracking: true
        });
      }
      
      const attendanceRecords = allAttendanceRecords;
      
      // If no records found, show appropriate message
      if (!attendanceRecords || attendanceRecords.length === 0) {
        setError('No attendance data available yet');
        setAttendanceData([]);
        setAttendanceStatus({
          is_active: false,
          message: 'Attendance tracking will be available once data is uploaded',
          total_active_employees: 0,
          employees_with_records: 0,
          tracking_mode: 'none',
          has_daily_tracking: false
        });
        return;
      }
      
      // Transform data to AttendanceRecord format
      // The standard API returns attendance records directly
      const transformedData: AttendanceRecord[] = transformStandardToAttendanceRecords(attendanceRecords);
      setAttendanceData(transformedData);
      
      // Extract and set available months
      const months = extractAvailableMonths(transformedData);
      setAvailableMonths(months);
      
      // Auto-select month/year only when user is in custom month mode
      if (filterType === 'custom' && !selectedMonth && months.length > 0) {
        setSelectedMonth(months[0].month);
        setSelectedYear(months[0].year);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setError('Failed to load attendance data');
      setAttendanceData([]);
      setAttendanceStatus({
        is_active: false,
        message: 'Failed to load attendance data',
        total_active_employees: 0,
        employees_with_records: 0,
        tracking_mode: 'error',
        has_daily_tracking: false
      });
    } finally {
      setLoading(false);
    }
  };

  // Standard periods
  useEffect(() => {
    if (['this_month', 'last_6_months', 'last_12_months', 'last_5_years'].includes(filterType)) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // Custom single month
  useEffect(() => {
    if (filterType === 'custom' && selectedMonth && selectedYear) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, selectedMonth, selectedYear]);

  // Custom range
  useEffect(() => {
    if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, rangeStartDate, rangeEndDate]);

  // One day filter
  useEffect(() => {
    if (filterType === 'one_day' && selectedDate) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, selectedDate]);

  // Filter data based on search query
  const filteredBySearch = attendanceData.filter(record => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      record.name.toLowerCase().includes(query) ||
      record.employee_id.toLowerCase().includes(query)
    );
  });

  // Transform standard API response to AttendanceRecord format
  const transformStandardToAttendanceRecords = (attendanceRecords: Array<{
    id: number;
    employee_id: string;
    name: string;
    department?: string;
    date: string;
    calendar_days: number;
    total_working_days: number;
    present_days: number;
    absent_days: number;
    ot_hours: string | number;
    late_minutes: number;
    attendance_percentage?: number;
  }>): AttendanceRecord[] => {
    // The standard API returns attendance records directly
    return attendanceRecords.map((record) => ({
      id: record.id,
      employee_id: record.employee_id,
      name: record.name,
      department: record.department,
      date: record.date,
      calendar_days: record.calendar_days,
      total_working_days: record.total_working_days,
      present_days: record.present_days,
      absent_days: record.absent_days,
      ot_hours: record.ot_hours,
      late_minutes: record.late_minutes,
      attendance_percentage: record.attendance_percentage
    }));
  };

  // Apply time period filter and aggregation
  const finalData = filterAndAggregateData(filteredBySearch, filterType);

  const normalizeDepartment = (dept: string | undefined) => (dept && dept.trim() !== '' && dept !== '0') ? dept : 'N/A';

  // KPI calculations
  const totalEmployees = finalData.length;
  const totalOtHours = finalData.reduce((sum, r) => sum + (typeof r.ot_hours === 'string' ? parseFloat(r.ot_hours) || 0 : r.ot_hours), 0);
  const totalLateMinutes = finalData.reduce((sum, r) => sum + r.late_minutes, 0);
  const totalPresentDays = finalData.reduce((sum, r) => sum + r.present_days, 0);
  const totalWorkingDaysAgg = finalData.reduce((sum, r) => sum + (r.present_days + r.absent_days), 0);
  const avgPresentPerc = totalWorkingDaysAgg > 0 ? (totalPresentDays / totalWorkingDaysAgg) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B5E59]"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Dropdown
            options={filterTypeOptions}
            value={filterType}
            onChange={(value) => setFilterType(value as FilterType)}
            placeholder="Select Filter"
            className="w-40"
          />

          {filterType === 'custom' && (
            <Dropdown
              options={availableMonths.map(({ month, year }) => ({
                value: `${month}-${year}`,
                label: `${month} ${year}`
              }))}
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(value) => {
                const [month, year] = value.split('-');
                setSelectedMonth(month);
                setSelectedYear(parseInt(year));
              }}
              placeholder="Select Month"
              className="w-32"
            />
          )}

          {/* Custom date range picker */}
          {filterType === 'custom_range' && (
            <div className="flex items-center gap-2">
              <DatePicker
                value={rangeStartDate}
                onChange={setRangeStartDate}
                maxDate={rangeEndDate ? new Date(rangeEndDate) : new Date()}
                placeholder="Start date"
                className="w-36"
              />
              <span className="text-gray-500">to</span>
              <DatePicker
                value={rangeEndDate}
                onChange={setRangeEndDate}
                minDate={rangeStartDate ? new Date(rangeStartDate) : undefined}
                maxDate={new Date()}
                placeholder="End date"
                className="w-36"
              />
            </div>
          )}

          {/* One day date picker */}
          {filterType === 'one_day' && (
            <div className="flex items-center gap-2">
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                maxDate={new Date()}
                placeholder="Select date"
                className="w-36"
              />
            </div>
          )}

          
        </div>
      </div>

      

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500">Total Employees</div>
          <div className="text-2xl font-semibold text-[#0B5E59]">{loading ? '...' : totalEmployees}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500">Total OT Hours</div>
          <div className="text-2xl font-semibold text-[#0B5E59]">{loading ? '...' : totalOtHours.toFixed(1)}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500">Total Late Minutes</div>
          <div className="text-2xl font-semibold text-[#0B5E59]">{loading ? '...' : totalLateMinutes}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center">
          <div className="text-sm text-gray-500">Average Present %</div>
          <div className="text-2xl font-semibold text-[#0B5E59]">{loading ? '...' : `${avgPresentPerc.toFixed(1)}%`}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500">Loading attendance data...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (
        <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Employee ID</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Name</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Department</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Present Days</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Absent Days</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {finalData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                        {attendanceStatus?.is_active ? 'No attendance records found.' : 'Attendance tracking will be available from June 22, 2025.'}
                    </td>
                  </tr>
                  ) : (
                    finalData.map((record, index) => {
                      const totalDays = record.present_days + record.absent_days;
                      const attendancePercentage = totalDays > 0 
                        ? (record.present_days / totalDays * 100) 
                        : 0;
                      
                      // Data source column removed
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{record.employee_id}</td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => navigate(`/hr-management/directory/${record.employee_id}`)}
                              className="text-[#0B5E59] hover:underline text-left"
                            >
                              {record.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm">{normalizeDepartment(record.department)}</td>
                          <td className="px-4 py-3 text-sm">{record.present_days.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm">{record.absent_days.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm">{(typeof record.ot_hours === 'string' ? parseFloat(record.ot_hours) || 0 : record.ot_hours || 0).toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm">{record.late_minutes.toFixed(0)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              attendancePercentage >= 90 ? 'bg-teal-100 text-teal-800' :
                              attendancePercentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {attendancePercentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRAttendanceTracker; 