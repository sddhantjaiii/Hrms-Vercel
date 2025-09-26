import React, { useState, useEffect } from 'react';
import { Save, Search, UserCheck, UserX, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../services/api';
import DatePicker from './DatePicker';
import './TimeInput.css';
import Dropdown from './Dropdown';

interface Employee {
  id: number;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  department: string;
  is_active: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  default_status?: string;
  late_minutes?: number;
  ot_hours?: number;
  has_off_day?: boolean;
}

interface AttendanceEntry {
  employee_id: string;
  name: string;
  department: string;
  status: 'present' | 'absent' | 'off';
  clock_in: string;   // HH:MM
  clock_out: string;  // HH:MM
  ot_hours: number;
  late_minutes: number;
  has_off_day: boolean;
  _shiftStart?: string;
  _shiftEnd?: string;
  _prevClockIn?: string;
  _prevClockOut?: string;
  _prevOt?: number;
  _prevLate?: number;
}

const HRAttendanceLog: React.FC = () => {
  const navigate = useNavigate();
  // (employees state not used anymore)
  const [attendanceEntries, setAttendanceEntries] = useState<Map<string, AttendanceEntry>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [dayName, setDayName] = useState<string>('');
  const [dateLoading, setDateLoading] = useState<boolean>(false);
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [progressiveLoadingComplete, setProgressiveLoadingComplete] = useState<boolean>(false); // Track if all loading is complete

  // Add cache and request tracking to prevent duplicate calls
  const [cache, setCache] = useState<Map<string, { data: Employee[]; dayName: string }>>(new Map());
  const [ongoingRequests, setOngoingRequests] = useState<Set<string>>(new Set());

  // Function to fetch dates with attendance logged
  const fetchAttendanceDates = async () => {
    console.log('🔍 fetchAttendanceDates function called!');
    try {
      console.log('🔍 Fetching attendance dates...');
      console.log('🔍 API URL:', '/api/attendance/dates_with_attendance/');
      console.log('🔍 Auth token:', localStorage.getItem('access'));
      console.log('🔍 Tenant subdomain:', localStorage.getItem('tenantSubdomain'));
      
      // Check if user is authenticated
      const token = localStorage.getItem('access');
      if (!token) {
        console.error('❌ No authentication token found');
        // Set empty array as fallback
        setAttendanceDates([]);
        return;
      }
      
      const response = await apiCall('/api/attendance/dates_with_attendance/');
      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('📅 Attendance dates received:', data.dates);
        console.log('📅 Full response data:', data);
        setAttendanceDates(data.dates || []);
      } else {
        console.error('❌ Failed to fetch attendance dates:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        // Set empty array as fallback
        setAttendanceDates([]);
      }
    } catch (error) {
      console.error('Error fetching attendance dates:', error);
      // Set empty array as fallback
      setAttendanceDates([]);
    }
  };

  // Set hasFetched after first eligibleEmployees or error received
  useEffect(() => {
    if (eligibleEmployees.length > 0 || error !== null) {
      setHasFetched(true);
    }
    // If the currently selected department is no longer present in eligible employees, reset to 'All'
    const departments = new Set(eligibleEmployees.map(e => e.department || 'General'));
    if (selectedDepartment !== 'All' && !departments.has(selectedDepartment)) {
      setSelectedDepartment('All');
    }
  }, [eligibleEmployees, error]);

  // Fetch attendance dates on component mount
  useEffect(() => {
    console.log('🚀 Component mounted, fetching attendance dates...');
    console.log('🚀 About to call fetchAttendanceDates...');
    fetchAttendanceDates();
    console.log('🚀 fetchAttendanceDates called');
  }, []);

  // Debug attendance dates state
  useEffect(() => {
    console.log('📊 Attendance dates state updated:', attendanceDates);
  }, [attendanceDates]);

  // Handle date change with loading state
  const handleDateChange = async (newDate: string) => {
    setDateLoading(true);
    setSelectedDate(newDate);
  };

  useEffect(() => {
    // Add abort controller to prevent duplicate requests
    const abortController = new AbortController();

    const loadData = async () => {
      await fetchEligibleEmployees(abortController.signal);
      setDateLoading(false);
    };

    loadData();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // PROGRESSIVE LOADING: Fetch employees with automatic background loading
  const fetchEligibleEmployees = async (signal?: AbortSignal) => {
    const cacheKey = `eligible-employees-${selectedDate}`;

    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setEligibleEmployees(cachedData.data);
        setDayName(cachedData.dayName);
        initializeAttendanceEntries(cachedData.data);
        setLoading(false);
        return;
      }
    }

    // Check if request is already ongoing
    if (ongoingRequests.has(cacheKey)) {
      return;
    }

    try {
      setLoading(true);
      setOngoingRequests(prev => new Set(prev).add(cacheKey));

      console.log('🚀 PROGRESSIVE LOADING: Starting for', selectedDate);

      // STEP 1: Load initial 500 employees instantly (increased from 50)
      console.log('📋 API Call 1: Loading initial 500 employees...');
      const initialResponse = await apiCall(`/api/eligible-employees/?date=${selectedDate}&initial=true`, {
        signal
      });

      if (!initialResponse.ok) {
        throw new Error(`Initial load failed: ${initialResponse.status}`);
      }

      const initialData = await initialResponse.json();
      console.log(`✅ Loaded ${initialData.total_count} employees in ${initialData.performance.query_time}`);

      const firstBatch = initialData.eligible_employees || [];
      const dayName = initialData.day_name || '';

      // Set initial employees immediately for instant UI update
      setEligibleEmployees(firstBatch);
      setDayName(dayName);
      initializeAttendanceEntries(firstBatch);
      setLoading(false); // User can start working immediately
      setProgressiveLoadingComplete(false); // Mark as incomplete until all loaded

      // STEP 2: Auto-trigger background loading if there are more employees
      if (initialData.progressive_loading?.has_more && initialData.progressive_loading?.auto_trigger_remaining) {
        const remainingCount = initialData.progressive_loading.remaining_employees;
        console.log(`🔄 Auto-triggering background load for ${remainingCount} remaining employees...`);

        // Add recommended delay before background load
        const delay = initialData.progressive_loading.recommended_delay_ms || 100;
        setTimeout(async () => {
          await loadRemainingEmployees(selectedDate, dayName, firstBatch, signal);
        }, delay);
      } else {
        // Cache the complete data if no more employees
        setCache(prev => new Map(prev).set(cacheKey, { data: firstBatch, dayName }));
        setProgressiveLoadingComplete(true); // Mark as complete
      }

      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }
      console.error('Error loading eligible employees:', err);
      setError('Failed to load eligible employees for this date');
      setEligibleEmployees([]);
    } finally {
      setLoading(false);
      setOngoingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  };

  // STEP 2: Load remaining employees in background
  const loadRemainingEmployees = async (date: string, dayName: string, initialEmployees: Employee[], signal?: AbortSignal) => {
    try {
      console.log(`📋 API Call 2: Background loading remaining employees for ${date}...`);

      const remainingResponse = await apiCall(`/api/eligible-employees/?date=${date}&remaining=true`, {
        signal
      });

      if (!remainingResponse.ok) {
        throw new Error(`Background load failed: ${remainingResponse.status}`);
      }

      const remainingData = await remainingResponse.json();
      console.log(`✅ Background loaded ${remainingData.total_count} employees in ${remainingData.performance.query_time}`);

      const remainingEmployees = remainingData.eligible_employees || [];

      // STEP 3: Merge data while preserving user changes
      const allEmployees = mergeEmployeesWithUserChanges(initialEmployees, remainingEmployees);

      // Update state with all employees
      setEligibleEmployees(allEmployees);

      // Update attendance entries for new employees only (preserve existing user changes)
      setAttendanceEntries(prevEntries => {
        const newEntries = new Map(prevEntries);

        remainingEmployees.forEach((emp: Employee) => {
          // Only add if not already present (to preserve user changes)
          if (!newEntries.has(emp.employee_id)) {
            const status: 'present' | 'absent' | 'off' = emp.default_status === 'off' ? 'off' : (emp.default_status === 'present' ? 'present' : 'absent');
            newEntries.set(emp.employee_id, createAttendanceEntry(emp, status));
          }
        });

        return newEntries;
      });

      // Cache the complete merged data
      const cacheKey = `eligible-employees-${date}`;
      setCache(prev => new Map(prev).set(cacheKey, { data: allEmployees, dayName }));

      console.log(`🎉 Progressive loading complete: ${allEmployees.length} total employees loaded`);
      setProgressiveLoadingComplete(true); // Mark progressive loading as complete

    } catch (error) {
      console.error('❌ Background loading failed:', error);
      // Don't show error for background loading failure - initial data is still available
      // Still mark as complete since initial batch is available
      setProgressiveLoadingComplete(true);
    }
  };

  // Helper function to merge employees while preserving user changes
  const mergeEmployeesWithUserChanges = (existingEmployees: Employee[], newEmployees: Employee[]): Employee[] => {
    const existingMap = new Map<string, Employee>();
    existingEmployees.forEach(emp => {
      existingMap.set(emp.employee_id, emp);
    });

    // Start with existing employees (which may have user changes in attendance entries)
    const allEmployees = [...existingEmployees];

    // Add new employees that don't exist yet
    for (const newEmp of newEmployees) {
      if (!existingMap.has(newEmp.employee_id)) {
        allEmployees.push(newEmp);
      }
    }

    console.log(`🔄 Merged employees: ${existingEmployees.length} existing + ${newEmployees.length} new = ${allEmployees.length} total`);
    return allEmployees;
  };

  // Helper function to initialize attendance entries
  const initializeAttendanceEntries = (employees: Employee[]) => {
    const initialEntries = new Map<string, AttendanceEntry>();
    employees.forEach((emp: Employee) => {
      const status: 'present' | 'absent' | 'off' = emp.default_status === 'off' ? 'off' : (emp.default_status === 'present' ? 'present' : 'absent');
      initialEntries.set(emp.employee_id, createAttendanceEntry(emp, status));
    });
    setAttendanceEntries(initialEntries);
  };

  // Helper function to create attendance entry
  const createAttendanceEntry = (emp: Employee, status: 'present' | 'absent' | 'off'): AttendanceEntry => {
    return {
      employee_id: emp.employee_id,
      name: emp.name || 'Unknown',
      department: emp.department || 'General',
      status: status,
      clock_in: (() => {
        const minutes = emp.late_minutes || 0;
        const origShiftStart = emp.shift_start_time || '09:00';
        const [h, m] = origShiftStart.split(':').map(Number);
        const date = new Date(0, 0, 0, h, m + minutes);
        return date.toTimeString().slice(0, 5);
      })(),
      clock_out: (() => {
        const hours = emp.ot_hours || 0;
        const origShiftEnd = emp.shift_end_time || '18:00';
        const [h, m] = origShiftEnd.split(':').map(Number);
        const date = new Date(0, 0, 0, h + hours, m);
        return date.toTimeString().slice(0, 5);
      })(),
      ot_hours: emp.ot_hours || 0,
      late_minutes: emp.late_minutes || 0,
      has_off_day: emp.has_off_day || false,
      _shiftStart: emp.shift_start_time || '09:00',
      _shiftEnd: emp.shift_end_time || '18:00'
    };
  };

  const updateAttendanceEntry = (employeeId: string, field: keyof AttendanceEntry, value: string | number | boolean) => {
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(employeeId);
      if (entry) {
        // If changing status away from 'present', reset OT, late, clock times
        const updated = { ...entry, [field]: value } as AttendanceEntry;
        if (field === 'status') {
          if (value !== 'present') {
            // Save current inputs so we can restore later
            updated._prevClockIn = entry.clock_in;
            updated._prevClockOut = entry.clock_out;
            updated._prevOt = entry.ot_hours;
            updated._prevLate = entry.late_minutes;

            // Reset values for absent/off
            updated.ot_hours = 0;
            updated.late_minutes = 0;
            updated.clock_in = entry._shiftStart || entry.clock_in;
            updated.clock_out = entry._shiftEnd || entry.clock_out;
          } else {
            // Switching back to present: restore previous values if any
            const prevIn = entry._prevClockIn;
            const prevOut = entry._prevClockOut;
            const prevOt = entry._prevOt;
            const prevLate = entry._prevLate;
            if (prevIn) updated.clock_in = prevIn;
            if (prevOut) updated.clock_out = prevOut;
            if (typeof prevOt === 'number') updated.ot_hours = prevOt;
            if (typeof prevLate === 'number') updated.late_minutes = prevLate;
          }
        }
        newMap.set(employeeId, updated);
      }
      return newMap;
    });
  };

  const saveAttendance = async () => {
    try {
      setSaving(true);

      // Convert attendance entries to array format for API
      const attendanceData = Array.from(attendanceEntries.values()).map(entry => ({
        employee_id: entry.employee_id,
        name: entry.name,
        department: entry.department,
        date: selectedDate,
        status: entry.status,
        present_days: entry.status === 'present' ? 1 : 0,
        absent_days: entry.status === 'absent' ? 1 : 0,
        ot_hours: entry.ot_hours,
        late_minutes: entry.late_minutes,
        calendar_days: 1,
        total_working_days: 1
      }));

      // Extract employee IDs for summary update
      const employeeIds = attendanceData.map(entry => entry.employee_id);

      // 🚀 PRIMARY: Lightning-fast attendance upload (wait for this)
      const attendanceResponse = await apiCall('/api/bulk-update-attendance/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          attendance_records: attendanceData
        })
      });

      // Check attendance response (primary operation)
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        console.log('✅ Attendance uploaded:', attendanceResult);

        // Show success message immediately
        alert(attendanceResult.message || 'Attendance saved successfully!');
        setError(null);

        // ⚡ BACKGROUND: Start async summary update (don't wait for this)
        apiCall('/api/update-monthly-summaries/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: selectedDate,
            employee_ids: employeeIds
          })
        }).then(async (summaryResponse) => {
          if (summaryResponse.ok) {
            const summaryResult = await summaryResponse.json();
            console.log('✅ Monthly summaries updated in background:', summaryResult);
          } else {
            console.warn('⚠️ Summary update failed, but attendance was saved successfully');
          }
        }).catch((error) => {
          console.error('⚠️ Summary API error (background):', error);
          // Don't show error to user since attendance was successful
        });

      } else {
        // Primary attendance upload failed
        const errorResult = await attendanceResponse.json();
        throw new Error(errorResult.error || `Failed to save attendance: ${attendanceResponse.status}`);
      }

    } catch (err) {
      console.error('Error saving attendance:', err);
      setError('Failed to save attendance');
    } finally {
      setSaving(false);
    }
    
    // Refresh attendance dates after saving
    fetchAttendanceDates();
  };

  // Filter employees based on search query and month
  const filteredEmployees = eligibleEmployees.filter(emp => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      emp.employee_id.toLowerCase().includes(query) ||
      (emp.department && emp.department.toLowerCase().includes(query))
    );
  });

  // Apply department filter
  const departmentFilteredEmployees = filteredEmployees.filter(emp => {
    if (!selectedDepartment || selectedDepartment === 'All') return true;
    return (emp.department || 'General') === selectedDepartment;
  });

  // Pagination state (move above tabFilteredEmployees and paginatedEmployees)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'absent' | 'off'>('all');

  // Tab-based filtering (respect department filter)
  const tabFilteredEmployees = departmentFilteredEmployees.filter(emp => {
    const entry = attendanceEntries.get(emp.employee_id);
    if (!entry) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'present') return entry.status === 'present';
    if (activeTab === 'absent') return entry.status === 'absent';
    if (activeTab === 'off') return entry.status === 'off';
    return true;
  });

  // Sort employees by name (first_name + last_name, fallback to name), then paginate
  const sortedEmployees = [...tabFilteredEmployees].sort((a, b) => {
    const nameA = (a.first_name && a.last_name)
      ? `${a.first_name} ${a.last_name}`.toLowerCase()
      : (a.name || '').toLowerCase();
    const nameB = (b.first_name && b.last_name)
      ? `${b.first_name} ${b.last_name}`.toLowerCase()
      : (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  const paginatedEmployees = sortedEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const totalPages = Math.ceil(tabFilteredEmployees.length / rowsPerPage);

  const markAllPresent = () => {
    // Only allow if progressive loading is complete
    if (!progressiveLoadingComplete) return;

    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      newMap.forEach((entry, employeeId) => {
        newMap.set(employeeId, { ...entry, status: 'present' });
      });
      return newMap;
    });
  };

  const markAllAbsent = () => {
    // Only allow if progressive loading is complete
    if (!progressiveLoadingComplete) return;

    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      newMap.forEach((entry, employeeId) => {
        newMap.set(employeeId, { ...entry, status: 'absent' });
      });
      return newMap;
    });
  };

  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const recalcOtLate = (employeeId: string, clockIn: string, clockOut: string, shiftStart: string, shiftEnd: string) => {
    const late = Math.max(timeToMinutes(clockIn) - timeToMinutes(shiftStart), 0);
    const otMinutes = Math.max(timeToMinutes(clockOut) - timeToMinutes(shiftEnd), 0);
    const otHours = parseFloat((otMinutes / 60).toFixed(1));
    updateAttendanceEntry(employeeId, 'late_minutes', late);
    updateAttendanceEntry(employeeId, 'ot_hours', otHours);
  };

  const updateClockIn = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_in', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      recalcOtLate(emp.employee_id, value, attendanceEntries.get(emp.employee_id)!.clock_out, emp.shift_start_time, emp.shift_end_time);
    }
  };

  const updateClockOut = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_out', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      recalcOtLate(emp.employee_id, attendanceEntries.get(emp.employee_id)!.clock_in, value, emp.shift_start_time, emp.shift_end_time);
    }
  };

  // ...existing code...

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B5E59]"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            
            {/* Department filter dropdown */}
            <div className="ml-3">
              <Dropdown
                options={[
                  { value: 'All', label: 'All Departments' },
                  ...Array.from(new Set(eligibleEmployees.map(e => e.department || 'General'))).map(d => ({ value: d, label: d }))
                ]}
                value={selectedDepartment}
                onChange={(val) => setSelectedDepartment(val || 'All')}
                placeholder="Department"
                className="w-48"
              />
            </div>
          </div>
          <button
            onClick={saveAttendance}
            disabled={saving}
            className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex items-center justify-between">
        {departmentFilteredEmployees.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Total Employees:</span>
                  <span className="ml-2 text-teal-700">{departmentFilteredEmployees.length}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Present:</span>
                  <span className="ml-2 text-teal-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'present'
                    ).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-red-900">Absent:</span>
                  <span className="ml-2 text-red-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'absent'
                    ).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Off Day:</span>
                  <span className="ml-2 text-teal-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'off'
                    ).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
        <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">{dayName}</span>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              maxDate={new Date()}
              attendanceDates={attendanceDates}
              loading={dateLoading}
              placeholder="Select attendance date"
              className="min-w-[180px]"
            />
            {/* Debug button - remove after testing */}
            <button
              onClick={fetchAttendanceDates}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
            >
              Test API
            </button>
        </div>
          <button
            onClick={markAllPresent}
            disabled={!progressiveLoadingComplete}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${progressiveLoadingComplete
                ? 'bg-teal-100 hover:bg-teal-200 text-teal-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            title={!progressiveLoadingComplete ? 'Please wait for all employees to load' : ''}
          >
            <UserCheck size={16} />
            Mark All Present
          </button>
          <button
            onClick={markAllAbsent}
            disabled={!progressiveLoadingComplete}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${progressiveLoadingComplete
                ? 'bg-red-100 hover:bg-red-200 text-red-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            title={!progressiveLoadingComplete ? 'Please wait for all employees to load' : ''}
          >
            <UserX size={16} />
            Mark All Absent
          </button>
        </div>

      </div>


      {/* Attendance Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500 animate-pulse">Loading eligible employees for {dayName} {selectedDate}...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (!loading && hasFetched && departmentFilteredEmployees.length === 0) ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500 animate-pulse">
              No employees found for {dayName} {selectedDate}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Employee ID</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Name</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Department</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Status</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Clock In</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Clock Out</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Minutes</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500 animate-pulse">
                      {searchQuery ? 'No employees found matching your search.' : `Loading eligible employees for ${dayName} ${selectedDate}...`}
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((employee) => {
                    const entry = attendanceEntries.get(employee.employee_id);
                    if (!entry) return null;

                    return (
                      <tr key={employee.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{employee.employee_id}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => navigate(`/hr-management/employees/edit/${employee.employee_id}`)}
                            className="text-[#0B5E59] hover:underline text-left"
                          >
                            {employee.first_name && employee.last_name
                              ? `${employee.first_name} ${employee.last_name}`
                              : employee.name || 'Unknown'
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{employee.department || 'General'}</td>
                        <td className="px-4 py-3">
                          {entry.has_off_day ? (
                            <span className="px-3 py-1 rounded text-sm font-medium bg-teal-100 text-teal-800 border border-teal-200">
                              OFF DAY
                            </span>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateAttendanceEntry(employee.employee_id, 'status', 'present')}
                                className={`px-3 py-1 rounded text-sm font-medium ${entry.status === 'present'
                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                              >
                                Present
                              </button>
                              <button
                                onClick={() => updateAttendanceEntry(employee.employee_id, 'status', 'absent')}
                                className={`px-3 py-1 rounded text-sm font-medium ${entry.status === 'absent'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                              >
                                Absent
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.has_off_day ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <input
                              type="time"
                              value={entry.clock_in}
                              disabled={entry.status !== 'present'}
                              onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker && (e.currentTarget as HTMLInputElement).showPicker()}
                              onChange={(e) => updateClockIn(employee, e.target.value)}
                              className={`time-input-styled w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none transition-colors duration-200 ${entry.status === 'present'
                                  ? 'focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                }`}
                            />)}
                        </td>
                        <td className="px-4 py-3">
                          {entry.has_off_day ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <input
                              type="time"
                              value={entry.clock_out}
                              disabled={entry.status !== 'present'}
                              onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker && (e.currentTarget as HTMLInputElement).showPicker()}
                              onChange={(e) => updateClockOut(employee, e.target.value)}
                              className={`time-input-styled w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none transition-colors duration-200 ${entry.status === 'present'
                                  ? 'focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                }`}
                            />)}
                        </td>
                        <td className="px-4 py-3">
                          {entry.has_off_day ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span>{entry.ot_hours * 60}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.has_off_day ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span>{entry.late_minutes}</span>
                          )}
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={e => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {[10, 20, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRAttendanceLog;