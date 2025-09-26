import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Edit } from 'lucide-react';
import { apiRequest } from '../services/api';
import { getDropdownOptions, DropdownOptions } from '../services/dropdownService';
import CustomDateInput from './CustomDateInput';
import Dropdown, { DropdownOption } from './Dropdown';

// Define types for API responses
interface EmployeeProfileResponse {
  employee: EmployeeProfileData;
}

interface AttendanceApiResponse {
  results?: AttendanceRecord[];
}

interface AttendanceRecord {
  date: string;
  ot_hours: number;
  late_minutes: number;
  attendance_status?: string;
  status: 'Present' | 'Absent' | 'Half Day';
}

interface EmployeeProfileData {
  id?: number;
  employee_id: string;
  name: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  date_of_birth: string;
  marital_status: string;
  gender: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  branch_location: string;
  shift_start_time: string;
  shift_end_time: string;
  basic_salary: string;
  tds_percentage: string;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  'Full Time': 'FULL_TIME',
  'Part Time': 'PART_TIME',
  'Contract': 'CONTRACT',
  'Intern': 'INTERN',
  'FULL_TIME': 'FULL_TIME',
  'PART_TIME': 'PART_TIME',
  'CONTRACT': 'CONTRACT',
  'INTERN': 'INTERN',
};

function formatTimeToHHMM(time: string) {
  // Accepts '09:00', '09:00:00', '09:00 AM', '17:30', etc. Returns 'HH:mm'.
  if (!time) return '';
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.slice(0, 5);
  // Handle AM/PM
  const match = time.match(/^(\d{1,2}):(\d{2}) ?([AP]M)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return time;
}

const HREmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('personal');
  const [employeeData, setEmployeeData] = useState<EmployeeProfileData | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<EmployeeProfileData> | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    departments: [],
    locations: [],
    designations: [],
    cities: [],
    states: []
  });

  // Convert to dropdown format
  const departmentOptions: DropdownOption[] = dropdownOptions.departments.map(dept => ({
    value: dept,
    label: dept
  }));

  // Static dropdown options
  const maritalStatusOptions: DropdownOption[] = [
    { value: '', label: 'Marital Status' },
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
    { value: 'DIVORCED', label: 'Divorced' },
    { value: 'WIDOWED', label: 'Widowed' }
  ];

  const genderOptions: DropdownOption[] = [
    { value: '', label: 'Gender' },
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' }
  ];

  const nationalityOptions: DropdownOption[] = [
    { value: '', label: 'Nationality' },
    { value: 'India', label: 'India' },
    { value: 'USA', label: 'USA' },
    { value: 'UK', label: 'UK' }
  ];

  const employmentTypeOptions: DropdownOption[] = [
    { value: '', label: 'Employment Type' },
    { value: 'FULL_TIME', label: 'Full-time' },
    { value: 'PART_TIME', label: 'Part-time' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'INTERN', label: 'Intern' }
  ];

  const locationOptions: DropdownOption[] = [
    { value: '', label: 'Select Office Location' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Mumbai', label: 'Mumbai' }
  ];

  // Move fetchEmployeeData outside useEffect so it can be called after save
  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/excel/employees/profile_by_employee_id/?employee_id=${id}`) as EmployeeProfileResponse;
      // Extract the employee data from the profile_by_employee_id response
      setEmployeeData(data.employee);
      setError(null);
    } catch (err) {
      console.error('Error fetching employee data:', err);
      setError('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const data = await apiRequest(`/api/excel/daily-attendance/?employee_id=${id}&page_size=100`) as AttendanceApiResponse | AttendanceRecord[];

        // Support paginated responses (data.results) or plain list
        const attendanceArrayRaw = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);

        const attendanceArray = attendanceArrayRaw as AttendanceRecord[];
        
        // Process attendance records
        const processedRecords = attendanceArray.map((record: AttendanceRecord) => {
          return {
            date: record.date,
            ot_hours: parseFloat(record.ot_hours?.toString() || '0'),
            late_minutes: Number(record.late_minutes) || 0,
            status: record.attendance_status ?
              (record.attendance_status === 'PRESENT' ? 'Present' :
               record.attendance_status === 'HALF_DAY' ? 'Half Day' : 'Absent') : 'Absent'
          } as AttendanceRecord;
        });

        setAttendanceRecords(processedRecords);
      } catch (err) {
        console.error('Error fetching attendance data:', err);
        setError('Failed to fetch attendance data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEmployeeData();
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load dropdown options from the database
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const options = await getDropdownOptions();
        setDropdownOptions(options);
      } catch (error) {
        console.error('Failed to load dropdown options:', error);
        // Keep default empty state if loading fails
      }
    };

    loadDropdownOptions();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  if (error || !employeeData) {
    return <div className="text-red-500 text-center">{error || 'Employee not found'}</div>;
  }

  // Helper function to check if a field has valid data
  const hasValidData = (value: string | undefined) => {
    return value && value !== '-' && value.trim() !== '';
  };

  const handleSave = async () => {
    if (!editData || !employeeData) return;
    // Only include fields that have changed and are not empty/null
    const updatedFields: Partial<EmployeeProfileData> = {};
    Object.keys(editData).forEach((key) => {
      const k = key as keyof EmployeeProfileData;
      let newValue = editData[k];
      let oldValue = employeeData[k];
      // Fix employment_type
      if (k === 'employment_type') {
        newValue = EMPLOYMENT_TYPE_MAP[newValue as string] || newValue;
        oldValue = EMPLOYMENT_TYPE_MAP[oldValue as string] || oldValue;
      }
      // Fix time fields
      if (k === 'shift_start_time' || k === 'shift_end_time') {
        newValue = formatTimeToHHMM(newValue as string);
        oldValue = formatTimeToHHMM(oldValue as string);
      }
      if (newValue !== oldValue && newValue !== '' && newValue !== null && newValue !== undefined) {
        (updatedFields as Record<string, unknown>)[k] = newValue;
      }
    });
    if (Object.keys(updatedFields).length === 0) {
      setIsEditing(false);
      setEditData(null);
      return; // Nothing to update
    }
    try {
      // Use the database ID from employeeData (required for PATCH operation)
      if (!employeeData?.id) {
        alert('Cannot save: Employee database ID not found');
        return;
      }
      
      await apiRequest(
        `/api/excel/employees/${employeeData.id}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields),
        }
      );
      // Instead of using returned data, refresh from backend
      await fetchEmployeeData();
      setIsEditing(false);
      setEditData(null);
      alert('✅ Employee profile saved successfully!');
    } catch {
      alert('Failed to save changes');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb and edit button */}
      <div className="bg-white rounded-lg p-6 shadow-sm relative">
  {/* Main content */}
  <div className="flex justify-between">
    <div>
      <h1 className="text-2xl font-semibold mb-1">
        {`${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee'}
      </h1>
      <p className="text-gray-500">
        {hasValidData(employeeData.department) ? employeeData.department : '-'}
      </p>
    </div>

    {/* Button vertically centered */}
    <div className="flex flex-col justify-center">
      {!isEditing ? (
        <button
          onClick={() => {
            setEditData({ ...employeeData });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#0B5E59] text-white rounded-lg hover:bg-[#094947] transition-colors"
        >
          <Edit size={16} />
          Edit Profile
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#0B5E59] text-white rounded-lg hover:bg-[#094947] transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditData(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  </div>
</div>

      {/* Editing State Banner */}
      {isEditing ? (
        <div className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Edit className="h-5 w-5 text-teal-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-teal-700">
                 You can now edit the employee details. Click "Save" to save your changes or "Cancel" to discard them.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Edit className="h-5 w-5 text-gray-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">
                 Employee details are currently read-only. Click the "Edit Profile" button above to enable editing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b">
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'personal'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('personal')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" />
              <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" />
            </svg>
            Personal Information
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'professional'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('professional')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Professional Information
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'attendance'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('attendance')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
            Attendance
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'personal' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.first_name || '' : employeeData.first_name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="First Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.last_name || '' : employeeData.last_name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Last Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.mobile_number || '' : employeeData.mobile_number || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Mobile Number"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, mobile_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={isEditing ? editData?.email || '' : employeeData.email || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Email Address"
                  
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Date of Birth
                </label>
                <CustomDateInput
                  value={isEditing ? editData?.date_of_birth || '' : employeeData.date_of_birth || ''}
                  onChange={(date) => isEditing && setEditData(prev => ({ ...prev, date_of_birth: date }))}
                  placeholder="Date of Birth"
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  readOnly={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Marital Status
                </label>
                  <Dropdown
                  options={maritalStatusOptions}
                  value={isEditing ? editData?.marital_status || '' : employeeData.marital_status || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, marital_status: value }))}
                  placeholder="Marital Status"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Gender
                </label>
                <Dropdown
                  options={genderOptions}
                  value={isEditing ? editData?.gender || '' : employeeData.gender || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, gender: value }))}
                  placeholder="Gender"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Nationality
                </label>
                  <input
                  type="text"
                  value={isEditing ? editData?.nationality || '' : employeeData.nationality || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Nationality"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, nationality: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Address
                </label>
                <textarea
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Address"
                  rows={3}
                  value={isEditing ? editData?.address || '' : employeeData.address || ''}
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, address: e.target.value }))}
                ></textarea>
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  City
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.city || '' : employeeData.city || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="City"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  State
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.state || '' : employeeData.state || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="State"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
            </div>
          )}

          {activeTab === 'professional' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.employee_id || '' : employeeData.employee_id || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Employee ID"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, employee_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  User Name
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.name || '' : employeeData.name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="User Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Employment Type
                </label>
                <Dropdown
                  options={employmentTypeOptions}
                  value={isEditing ? editData?.employment_type || '' : employeeData.employment_type || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, employment_type: value }))}
                  placeholder="Select Employee Type"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={isEditing ? editData?.email || '' : employeeData.email || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Email Address"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Department
                </label>
                <Dropdown
                  options={departmentOptions}
                  value={isEditing ? editData?.department || '' : employeeData.department || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, department: value }))}
                  placeholder="Select Department"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.designation || '' : employeeData.designation || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Designation"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, designation: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Office Location
                </label>
                <Dropdown
                  options={locationOptions}
                  value={isEditing ? editData?.branch_location || '' : employeeData.branch_location || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, branch_location: value }))}
                  placeholder="Select Office Location"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Date of Joining
                </label>
                <CustomDateInput
                  value={isEditing ? editData?.date_of_joining || '' : employeeData.date_of_joining || ''}
                  onChange={(date) => isEditing && setEditData(prev => ({ ...prev, date_of_joining: date }))}
                  placeholder="Date of Joining"
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  readOnly={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Shift Start Time
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.shift_start_time || '' : employeeData.shift_start_time || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Shift Start Time"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, shift_start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Shift End Time
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.shift_end_time || '' : employeeData.shift_end_time || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Shift End Time"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, shift_end_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Basic Salary
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.basic_salary || '' : employeeData.basic_salary || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Basic Salary"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, basic_salary: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  TDS Percentage
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.tds_percentage || '' : employeeData.tds_percentage || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="TDS (eg: 7%)"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, tds_percentage: e.target.value }))}
                />
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Date</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        Loading attendance records...
                      </td>
                    </tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((record, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-sm">{record.ot_hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm">{record.late_minutes}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            record.status === 'Present' 
                              ? 'bg-teal-100 text-teal-600' 
                              : record.status === 'Half Day'
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-600'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HREmployeeDetails; 