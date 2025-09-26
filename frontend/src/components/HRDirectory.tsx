import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, Eye, Edit, Plus, Download, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToExcel, EmployeeData } from '../utils/excelExport';
import { apiCall } from '../services/api';

interface AttendanceRecord {
  employee_id: string;
  present_days?: number;
  absent_days?: number;
  ot_hours?: number;
  late_minutes?: number;
  total_working_days?: number;
}

interface DirectoryData {
  id: number;
  employee_id: string;
  name: string;
  mobile_number: string;
  email: string;
  department: string;
  designation: string;
  is_active: boolean;
  basic_salary: number;
  shift_start_time: string;
  shift_end_time: string;
  last_salary: number;
  last_month: string;
  off_days: string;
  off_monday: boolean;
  off_tuesday: boolean;
  off_wednesday: boolean;
  off_thursday: boolean;
  off_friday: boolean;
  off_saturday: boolean;
  off_sunday: boolean;
}

const HRDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMenu, setShowMenu] = useState<boolean>(false);
  
  // Add pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const entriesPerPage = 15;

  // Add a new state to store the departments to be applied
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [pendingDepartments, setPendingDepartments] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);

  useEffect(() => {
    const loadEmployeeData = async () => {
      try {
        setLoading(true);
        
        // Fetch both directory and attendance data in parallel using authenticated API calls
        const [directoryResponse, attendanceResponse] = await Promise.all([
          apiCall('/api/employees/directory_data/?load_all=true'),
          apiCall('/api/attendance/')
        ]);
        
        if (!directoryResponse.ok || !attendanceResponse.ok) {
          throw new Error(`Failed to fetch data: ${directoryResponse.status}, ${attendanceResponse.status}`);
        }

        const directoryResponseData = await directoryResponse.json();
        // Handle new paginated directory response format
        const directoryData = directoryResponseData.results || directoryResponseData;
        
        
        const attendanceResponseData = await attendanceResponse.json();
        // Handle paginated response
        const attendanceData = attendanceResponseData.results || attendanceResponseData;
        
        // Process and combine the data - but the new API already includes attendance data
        const processedData = Array.isArray(directoryData) 
          ? directoryData.map((employee: {
              id: number;
              employee_id: string;
              name: string;
              mobile_number?: string;
              email?: string;
              department?: string;
              designation?: string;
              employment_type?: string;
              location_branch?: string;
              total_present?: number;
              total_absent?: number;
              total_ot_hours?: number;
              total_late_minutes?: number;
              attendance?: {
                attendance_percentage?: number;
                total_ot_hours?: number;
              };
              shift_start_time?: string;
              shift_end_time?: string;
              basic_salary?: number;
              is_active?: boolean;
              off_days?: string;
            }) => ({
              id: employee.id,
              employee_id: employee.employee_id,
              name: normalizeField(employee.name),
              mobile_number: normalizeField(employee.mobile_number),
              email: normalizeField(employee.email),
              department: normalizeField(employee.department),
              designation: normalizeField(employee.designation),
              employment_type: normalizeEmploymentType(employee.employment_type),
              branch_location: normalizeField(employee.location_branch),
              attendance: employee.attendance?.attendance_percentage ? `${employee.attendance.attendance_percentage}%` : '-',
              ot_hours: employee.attendance?.total_ot_hours ? `${employee.attendance.total_ot_hours} hrs` : '-',
              late_hours: employee.attendance?.total_late_minutes ? `${(employee.attendance.total_late_minutes / 60).toFixed(1)} hrs` : '-',
              shiftStartTime: normalizeField(employee.shift_start_time),
              shiftEndTime: normalizeField(employee.shift_end_time),
              basic_salary: normalizeField(employee.basic_salary),
              is_active: employee.is_active ?? true,
              off_days: normalizeField(employee.off_days, 'None')
            }))
          : processEmployeeData(directoryData, attendanceData);
        setEmployees(processedData);
        setError(null);
      } catch (err) {
        console.error('Error loading employee data:', err);
        setError('Failed to load employee data');
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to calculate attendance percentage, OT hours, and late hours for an employee
  const calculateEmployeeMetrics = (employeeId: string, attendanceRecords: AttendanceRecord[]) => {
    const employeeAttendance = attendanceRecords.filter(record => record.employee_id === employeeId);
    
    if (employeeAttendance.length === 0) {
      return {
        attendancePercentage: '-',
        totalOTHours: '-',
        totalLateHours: '-'
      };
    }

    // Calculate total present days, working days, OT hours, and late minutes from attendance records
    let totalPresent = 0;
    let totalWorkingDays = 0;
    let totalOTHours = 0;
    let totalLateMinutes = 0;

    employeeAttendance.forEach(record => {
      const present = parseFloat(record.present_days?.toString() || '0');
      const workingDays = parseFloat(record.total_working_days?.toString() || '0');
      const otHours = parseFloat(record.ot_hours?.toString() || '0');
      const lateMinutes = parseFloat(record.late_minutes?.toString() || '0');

      totalPresent += present;
      totalWorkingDays += workingDays;
      totalOTHours += otHours;
      totalLateMinutes += lateMinutes;
    });

    // Calculate attendance percentage using proper formula
    const attendancePercentage = totalWorkingDays > 0 
      ? `${((totalPresent / totalWorkingDays) * 100).toFixed(1)}%`
      : '-';

    // Format OT hours
    const formattedOTHours = totalOTHours > 0 
      ? `${totalOTHours.toFixed(2)} hrs`
      : '-';

    // Format late hours (convert minutes to hours)
    const formattedLateHours = totalLateMinutes > 0 
      ? `${(totalLateMinutes / 60).toFixed(1)} hrs`
      : '-';

    return {
      attendancePercentage,
      totalOTHours: formattedOTHours,
      totalLateHours: formattedLateHours
    };
  };

  // Function to process and combine directory and attendance data
  const processEmployeeData = (directoryData: DirectoryData[], attendanceRecords: AttendanceRecord[]): EmployeeData[] => {
    return directoryData.map(employee => {
      const metrics = calculateEmployeeMetrics(employee.employee_id, attendanceRecords);
      
      return {
        id: employee.id,
        employee_id: employee.employee_id,
        name: normalizeField(employee.name),
        mobile_number: normalizeField(employee.mobile_number),
        email: normalizeField(employee.email),
        department: normalizeField(employee.department),
        designation: normalizeField(employee.designation),
        employment_type: normalizeEmploymentType('FULL_TIME'), // Default value since DirectoryData interface doesn't include this field
        branch_location: normalizeField(employee.location_branch), // Default value since DirectoryData interface doesn't include this field
        attendance: metrics.attendancePercentage,
        ot_hours: metrics.totalOTHours,
        late_hours: metrics.totalLateHours,
        shiftStartTime: normalizeField(employee.shift_start_time),
        shiftEndTime: normalizeField(employee.shift_end_time),
        basic_salary: normalizeField(employee.basic_salary),
        is_active: employee.is_active,
        off_days: normalizeField(employee.off_days, 'None')
      };
    });
  };

  // Filter employees based on search query
  const filteredEmployees = employees.filter(employee => {
    if (selectedDepartments.length > 0 && !selectedDepartments.includes(employee.department)) {
      return false;
    }
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      employee.name.toLowerCase().includes(query) ||
      employee.employee_id.toLowerCase().includes(query) ||
      employee.department.toLowerCase().includes(query) ||
      employee.designation.toLowerCase().includes(query)
    );
  });

  // Calculate pagination values
  const totalPages = Math.ceil(filteredEmployees.length / entriesPerPage);
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredEmployees.slice(indexOfFirstEntry, indexOfLastEntry);

  // Handle page changes
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const handleExport = () => {
    exportToExcel(employees, 'employee_directory');
    setShowMenu(false);
  };

  const normalizeDepartment = (dept: string | undefined) => (dept && dept.trim() !== '' && dept !== '0') ? dept : '-';

  // Function to normalize employment type from API values to display format
  const normalizeEmploymentType = (employmentType: string | undefined) => {
    if (!employmentType) return '-';
    
    const employmentTypeMap: Record<string, string> = {
      'FULL_TIME': 'Full Time',
      'PART_TIME': 'Part Time', 
      'CONTRACT': 'Contract',
      'INTERN': 'Intern'
    };
    
    return employmentTypeMap[employmentType] || '-';
  };

  // Function to normalize any field value - return '-' if empty or null
  const normalizeField = (value: string | number | undefined | null, defaultValue: string = '-') => {
    if (value === null || value === undefined || value === '' || value === '0') {
      return defaultValue;
    }
    return value.toString();
  };

  // Unique departments for filter dropdown (derived from loaded employees)
  const departmentOptions = React.useMemo(() => {
    const setDep = new Set<string>();
    employees.forEach(emp => {
      setDep.add(normalizeDepartment(emp.department));
    });
    return Array.from(setDep).sort((a,b)=>a.localeCompare(b));
  }, [employees]);

  // Toggle employee active status
  const handleToggleActiveStatus = async (employeeId: number, currentStatus: boolean) => {
    try {
      const response = await apiCall(`/api/employees/${employeeId}/toggle_active_status/`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        // Update local state
        setEmployees(prev => 
          prev.map(emp => 
            emp.id === employeeId 
              ? { ...emp, is_active: !currentStatus }
              : emp
          )
        );
      } else {
        console.error('Failed to toggle employee status');
      }
    } catch (error) {
      console.error('Error toggling employee status:', error);
    }
  };

  return (
    
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="text-md p-4 flex justify-end items-end">
          <span className="font-medium text-teal-900">Total Employees:</span>
          <span className="ml-2 text-teal-700">{filteredEmployees.length}</span>
      </div>
      <div className="p-4">
        <div className="flex justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="flex items-center gap-2 px-3 py-2 bg-[#1A6262] text-white rounded-lg text-sm hover:bg-[#155252]"
              onClick={() => navigate('/hr-management/directory/add')}
            >
              
              <button className="flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 bg-transparent">
      <Plus size={16}/>
    </button>
              Add New Employee
            </button>
            
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-100" onClick={() => { setPendingDepartments(selectedDepartments); setShowFilter(true); }}>
              <img src="/img/filter.png" alt="Filter Icon" className="w-5 h-5" />
              Filter
            </button>
            
            <div className="relative">
              <button 
                className="p-2 border border-gray-200 rounded-lg"
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical size={16} />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100">
                  <button 
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={handleExport}
                  >
                    <Download size={16} className="text-gray-500" />
                    Export to Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500">Loading employee data...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky left-0 bg-gray-50 w-48">Employee ID</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky left-36 z-20 z-20 bg-gray-50">Employee Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Mobile Number</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Designation</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Employment Type</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Branch/Location</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Attendance %</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Total OT Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Total Late Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Shift Start Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Shift End Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Basic Salary</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Off Days</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="px-4 py-6 text-center text-gray-500">
                        No employee records found.
                      </td>
                    </tr>
                  ) : (
                    currentEntries.map((employee) => (
                      <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm sticky left-0 bg-white z-20">{employee.employee_id}</td>
                        <td className="px-4 py-3 text-sm sticky left-36 bg-white z-20">
                          <button
                            onClick={() => navigate(`/hr-management/employees/edit/${employee.employee_id}`)}
                            className="text-[#0B5E59] hover:underline text-left"
                          >
                            {employee.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{employee.mobile_number}</td>
                        <td className="px-4 py-3 text-sm">{employee.email}</td>
                        <td className="px-4 py-3 text-sm">{normalizeDepartment(employee.department)}</td>
                        <td className="px-4 py-3 text-sm">{employee.designation}</td>
                        <td className="px-4 py-3 text-sm">{employee.employment_type}</td>
                        <td className="px-4 py-3 text-sm">{employee.branch_location}</td>
                        <td className="px-4 py-3 text-sm">{employee.attendance}</td>
                        <td className="px-4 py-3 text-sm">{employee.ot_hours}</td>
                        <td className="px-4 py-3 text-sm">{employee.late_hours}</td>
                        <td className="px-4 py-3 text-sm">{employee.shiftStartTime}</td>
                        <td className="px-4 py-3 text-sm">{employee.shiftEndTime}</td>
                        <td className="px-4 py-3 text-sm">{employee.basic_salary}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {employee.off_days}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={employee.is_active}
                                onChange={() => handleToggleActiveStatus(employee.id, employee.is_active)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                            <span className="ml-2 text-xs text-gray-500">
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-teal-700 hover:text-teal-800"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEmployeeDetail(true);
                              }}
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="text-orange-500 hover:orange-700"
                              onClick={() => {
                                if (employee.employee_id) {
                                  navigate(`/hr-management/employees/edit/${employee.employee_id}`);
                                    }
                              }}
                              title="Edit Employee"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md 
                    ${currentPage === 1 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                    ${currentPage === totalPages 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{indexOfFirstEntry + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(indexOfLastEntry, filteredEmployees.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredEmployees.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center rounded-l-md px-2 py-2 
                        ${currentPage === 1 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    {getPageNumbers().map((pageNum, index) => (
                      <button
                        key={index}
                        onClick={() => typeof pageNum === 'number' ? handlePageChange(pageNum) : null}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium
                          ${pageNum === currentPage 
                            ? 'z-10 bg-teal-600  text-white focus:z-20 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600' 
                            : pageNum === '...' 
                              ? 'text-gray-700'
                              : 'text-gray-900 hover:bg-gray-50'}`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center rounded-r-md px-2 py-2 
                        ${currentPage === totalPages 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>

            {/* Employee Detail Modal */}
            {showEmployeeDetail && selectedEmployee && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto hide-scrollbar">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Employee Details</h2>
                    <button
                      onClick={() => {
                        setShowEmployeeDetail(false);
                        setSelectedEmployee(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Personal Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.employee_id}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Full Name</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.name}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.mobile_number}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.email || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Professional Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Department</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.department || 'Not assigned'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Designation</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.designation || 'Not assigned'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                          <p className="mt-1 text-sm text-gray-900">₹{parseInt(selectedEmployee.basic_salary || '0').toLocaleString()}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedEmployee.is_active 
                              ? 'bg-teal-100 text-teal-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Work Schedule */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Work Schedule
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Shift Timing</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedEmployee.shiftStartTime || '09:00'} - {selectedEmployee.shiftEndTime || '18:00'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Off Days</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.off_days}</p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Performance Metrics
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Attendance</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.attendance}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">OT Hours</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.ot_hours}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowEmployeeDetail(false);
                        setSelectedEmployee(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        if (selectedEmployee?.employee_id) {
                          setShowEmployeeDetail(false);
                          navigate(`/hr-management/employees/edit/${selectedEmployee.employee_id}`);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700"
                    >
                      <Edit size={16} />
                      Edit Employee
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Modal */}
            {showFilter && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
                <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs">
                  <h2 className="text-lg font-semibold mb-4">Filter</h2>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <div className="grid grid-cols-2 gap-2">
                      {departmentOptions.map(dept => (
                        <label key={dept} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pendingDepartments.includes(dept)}
                            onChange={e => {
                              if (e.target.checked) {
                                setPendingDepartments(prev => [...prev, dept]);
                              } else {
                                setPendingDepartments(prev => prev.filter(d => d !== dept));
                              }
                            }}
                            className="accent-teal-700"
                          />
                          {dept}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg" onClick={() => setShowFilter(false)}>Cancel</button>
                    <button className="px-5 py-2 bg-teal-700 text-white rounded-lg" onClick={() => { setSelectedDepartments(pendingDepartments); setShowFilter(false); }}>Apply</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HRDirectory; 