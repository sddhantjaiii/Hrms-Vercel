import React, { useState, useRef, useEffect } from 'react';
import { User, Briefcase, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall, apiUpload } from '../services/api';
import { getDropdownOptions } from '../services/dropdownService';
import CustomDateInputWithOverlay from './CustomDateInputWithOverlay';
import Dropdown, { DropdownOption } from './Dropdown';
import './HRAddEmployee.css';
import './TimeInput.css';

// Define interface for form state
interface EmployeeFormState {
  // Personal Information
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

  // Professional Information
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  location_branch: string;
  shift_start_time: string;
  shift_end_time: string;
  basic_salary: string;
  tds_percentage: string;
  ot_charge: string;

  // Off Days
  off_monday: boolean;
  off_tuesday: boolean;
  off_wednesday: boolean;
  off_thursday: boolean;
  off_friday: boolean;
  off_saturday: boolean;
  off_sunday: boolean;

  // Employee Status
  is_active: boolean;
}


const HRAddEmployee: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'professional'>('personal');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown options state
  const [dropdownOptions, setDropdownOptions] = useState({
    departments: [] as string[],
    locations: [] as string[],
    designations: [] as string[],
    cities: [] as string[],
    states: [] as string[]
  });

  // Convert to dropdown format
  const departmentOptions: DropdownOption[] = dropdownOptions.departments.map(dept => ({
    value: dept,
    label: dept
  }));

  const locationOptions: DropdownOption[] = dropdownOptions.locations.map(loc => ({
    value: loc,
    label: loc
  }));

  const designationOptions: DropdownOption[] = dropdownOptions.designations.map(desig => ({
    value: desig,
    label: desig
  }));

  const cityOptions: DropdownOption[] = dropdownOptions.cities.map(city => ({
    value: city,
    label: city
  }));

  const stateOptions: DropdownOption[] = dropdownOptions.states.map(state => ({
    value: state,
    label: state
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
    { value: '', label: 'Country' },
    { value: 'Afghanistan', label: 'Afghanistan' },
    { value: 'Albania', label: 'Albania' },
    { value: 'Algeria', label: 'Algeria' },
    { value: 'Argentina', label: 'Argentina' },
    { value: 'Australia', label: 'Australia' },
    { value: 'Austria', label: 'Austria' },
    { value: 'Bangladesh', label: 'Bangladesh' },
    { value: 'Belgium', label: 'Belgium' },
    { value: 'Brazil', label: 'Brazil' },
    { value: 'Bulgaria', label: 'Bulgaria' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Chile', label: 'Chile' },
    { value: 'China', label: 'China' },
    { value: 'Colombia', label: 'Colombia' },
    { value: 'Croatia', label: 'Croatia' },
    { value: 'Czech Republic', label: 'Czech Republic' },
    { value: 'Denmark', label: 'Denmark' },
    { value: 'Egypt', label: 'Egypt' },
    { value: 'Estonia', label: 'Estonia' },
    { value: 'Finland', label: 'Finland' },
    { value: 'France', label: 'France' },
    { value: 'Germany', label: 'Germany' },
    { value: 'Ghana', label: 'Ghana' },
    { value: 'Greece', label: 'Greece' },
    { value: 'Hungary', label: 'Hungary' },
    { value: 'Iceland', label: 'Iceland' },
    { value: 'India', label: 'India' },
    { value: 'Indonesia', label: 'Indonesia' },
    { value: 'Ireland', label: 'Ireland' },
    { value: 'Israel', label: 'Israel' },
    { value: 'Italy', label: 'Italy' },
    { value: 'Japan', label: 'Japan' },
    { value: 'Kenya', label: 'Kenya' },
    { value: 'Latvia', label: 'Latvia' },
    { value: 'Lithuania', label: 'Lithuania' },
    { value: 'Luxembourg', label: 'Luxembourg' },
    { value: 'Malaysia', label: 'Malaysia' },
    { value: 'Mexico', label: 'Mexico' },
    { value: 'Netherlands', label: 'Netherlands' },
    { value: 'New Zealand', label: 'New Zealand' },
    { value: 'Nigeria', label: 'Nigeria' },
    { value: 'Norway', label: 'Norway' },
    { value: 'Pakistan', label: 'Pakistan' },
    { value: 'Philippines', label: 'Philippines' },
    { value: 'Poland', label: 'Poland' },
    { value: 'Portugal', label: 'Portugal' },
    { value: 'Romania', label: 'Romania' },
    { value: 'Russia', label: 'Russia' },
    { value: 'Saudi Arabia', label: 'Saudi Arabia' },
    { value: 'Singapore', label: 'Singapore' },
    { value: 'Slovakia', label: 'Slovakia' },
    { value: 'Slovenia', label: 'Slovenia' },
    { value: 'South Africa', label: 'South Africa' },
    { value: 'South Korea', label: 'South Korea' },
    { value: 'Spain', label: 'Spain' },
    { value: 'Sri Lanka', label: 'Sri Lanka' },
    { value: 'Sweden', label: 'Sweden' },
    { value: 'Switzerland', label: 'Switzerland' },
    { value: 'Thailand', label: 'Thailand' },
    { value: 'Turkey', label: 'Turkey' },
    { value: 'UAE', label: 'UAE' },
    { value: 'UK', label: 'UK' },
    { value: 'Ukraine', label: 'Ukraine' },
    { value: 'USA', label: 'USA' },
    { value: 'Vietnam', label: 'Vietnam' }
  ];

  const employmentTypeOptions: DropdownOption[] = [
    { value: '', label: 'Employment Type' },
    { value: 'FULL_TIME', label: 'Full-time' },
    { value: 'PART_TIME', label: 'Part-time' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'INTERN', label: 'Intern' }
  ];

  const salaryOptions: DropdownOption[] = [
    { value: '', label: 'Select Basic Salary' },
    { value: '0', label: '₹0' },
    { value: '15000', label: '₹15,000' },
    { value: '30000', label: '₹30,000' },
    { value: '45000', label: '₹45,000' },
    { value: '60000', label: '₹60,000' }
  ];


  // Initialize form state with default values
  const [formData, setFormData] = useState<EmployeeFormState>({
    // Personal Information
    first_name: '',
    last_name: '',
    mobile_number: '',
    email: '',
    date_of_birth: '',
    marital_status: '',
    gender: '',
    nationality: '',
    address: '',
    city: '',
    state: '',

    // Professional Information
    department: '',
    designation: '',
    employment_type: '',
    date_of_joining: '',
    location_branch: '',
    shift_start_time: '',
    shift_end_time: '',
    basic_salary: '',
    tds_percentage: '',
    ot_charge: '',

    // Off Days
    off_monday: false,
    off_tuesday: false,
    off_wednesday: false,
    off_thursday: false,
    off_friday: false,
    off_saturday: false,
    off_sunday: true,

    // Employee Status
    is_active: true,
  });


  // Fetch dropdown options on component mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const options = await getDropdownOptions();
        setDropdownOptions(options);
      } catch (error) {
        console.error('Failed to load dropdown options:', error);
        // Set empty arrays as fallback
        setDropdownOptions({
          departments: [],
          locations: [],
          designations: [],
          cities: [],
          states: []
        });
      }
    };

    loadDropdownOptions();
  }, []);



  // Custom add handlers for new dropdown component
  const handleCustomDepartmentAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.includes(value) ? prev.departments : [...prev.departments, value]
    }));
  };

  const handleCustomLocationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      locations: prev.locations.includes(value) ? prev.locations : [...prev.locations, value]
    }));
  };

  const handleCustomDesignationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.includes(value) ? prev.designations : [...prev.designations, value]
    }));
  };

  const handleCustomCityAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      cities: prev.cities.includes(value) ? prev.cities : [...prev.cities, value]
    }));
  };

  const handleCustomStateAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      states: prev.states.includes(value) ? prev.states : [...prev.states, value]
    }));
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    // Handle checkboxes separately
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => {
        const updated = { ...prev, [name]: value };
        if (name === 'basic_salary') {
          const salaryNum = parseFloat(value.replace(/,/g, ''));
          if (!isNaN(salaryNum) && salaryNum > 0) {
            updated.ot_charge = (salaryNum / 240).toFixed(2);
          } else {
            updated.ot_charge = '';
          }
        }
        return updated;
      });
    }
  };

  // Handle salary dropdown changes with OT calculation
  const handleSalaryChange = (value: string) => {
    setFormData(prev => {
      const updated = { ...prev, basic_salary: value };
      const salaryNum = parseFloat(value);
      if (!isNaN(salaryNum) && salaryNum > 0) {
        updated.ot_charge = (salaryNum / 240).toFixed(2);
      } else {
        updated.ot_charge = '';
      }
      return updated;
    });
  };

  // Handle checkbox changes for off days
  const handleCheckboxChange = (day: string) => {
    const fieldName = `off_${day.toLowerCase()}` as keyof EmployeeFormState;
    setFormData(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  // Function to validate the form based on active tab
  const validateForm = (): boolean => {
    if (activeTab === 'personal') {
      if (!formData.first_name || !formData.last_name) {
        setError('Please fill in all required fields: First Name and Last Name');
        return false;
      }
    } else if (activeTab === 'professional') {
      if (!formData.shift_start_time || !formData.shift_end_time || !formData.basic_salary) {
        setError('Please fill in all required fields: Shift Start Time, Shift End Time, and Basic Salary');
        return false;
      }
    }

    setError(null);
    return true;
  };

  // Handle file upload events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await apiCall('/api/employees/download_template/', { method: 'GET' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_upload_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download template');
      }
    } catch (error) {
      console.error('Template download error:', error);
      alert('Failed to download template');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiUpload('/api/employees/bulk_upload/', formData);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error details:', errorData);

        let errorMessage = 'Upload failed: ';
        if (errorData.error) {
          errorMessage += errorData.error;
        }
        if (errorData.expected_columns) {
          errorMessage += '\n\nExpected columns:\n' + errorData.expected_columns.join(', ');
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      let message = `Upload completed!\n`;
      message += `✅ ${result.employees_created} employees created successfully\n`;
      if (result.employees_failed > 0) {
        message += `❌ ${result.employees_failed} employees failed\n`;
        if (result.error_details && result.error_details.length > 0) {
          message += `\nError details:\n${result.error_details.join('\n')}`;
        }
      }

      alert(message);

      if (result.employees_created > 0) {
        setSelectedFile(null);
        navigate('/hr-management/directory');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (activeTab === 'personal') {
      // Move to professional tab if on personal tab
      setActiveTab('professional');
      return;
    }

    // If on professional tab, submit the form
    setIsSubmitting(true);
    setError(null);

    try {
      // Structure data according to the backend expectation
      // Separate personal and professional information
      const personalInfo = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        mobile_number: formData.mobile_number,
        email: formData.email,
        date_of_birth: formData.date_of_birth,
        marital_status: formData.marital_status,
        gender: formData.gender,
        nationality: formData.nationality,
        address: formData.address,
        city: formData.city,
        state: formData.state
      };

      const professionalInfo = {
        department: formData.department,
        designation: formData.designation,
        employment_type: formData.employment_type,
        date_of_joining: formData.date_of_joining,
        location_branch: formData.location_branch,
        shift_start_time: formData.shift_start_time,
        shift_end_time: formData.shift_end_time,
        basic_salary: formData.basic_salary.replace(/,/g, ''), // Remove commas from salary
        tds_percentage: formData.tds_percentage.replace('%', ''), // Remove % sign from TDS
        ot_charge: formData.ot_charge,
        // Send individual off day boolean fields as expected by backend
        off_monday: formData.off_monday,
        off_tuesday: formData.off_tuesday,
        off_wednesday: formData.off_wednesday,
        off_thursday: formData.off_thursday,
        off_friday: formData.off_friday,
        off_saturday: formData.off_saturday,
        off_sunday: formData.off_sunday,
        is_active: formData.is_active
      };

      // Make the API call to your backend endpoint using apiCall for authentication
      const response = await apiCall('/api/employees/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...personalInfo,
          ...professionalInfo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      await response.json();

      // If successful, show a success message and navigate to the directory page
      alert('Employee added successfully!');
      navigate('/hr-management/directory');
    } catch (err) {
      console.error('Error creating employee:', err);
      let errorMessage = 'An error occurred while saving the employee data';

      // Try to parse error message if it's JSON
      if (err instanceof Error) {
        try {
          const parsedError = JSON.parse(err.message);
          errorMessage = '';

          // Format error messages for each field
          for (const [field, messages] of Object.entries(parsedError)) {
            errorMessage += `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}\n`;
          }
        } catch {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* File Upload Area */}
      <div className="m-6">
        {/* <h3 className="text-lg font-medium mb-4">Add New Employee</h3> */}

        <div
          className={`border-2 border-dashed rounded-lg p-8 ${dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center mb-4">
              {/* Custom folder upload icon */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <rect x="8" y="16" width="40" height="28" rx="4" fill="#176B6B" />
                  <rect x="8" y="16" width="40" height="28" rx="4" stroke="#176B6B" strokeWidth="2" />
                  <rect x="16" y="8" width="24" height="12" rx="2" fill="#B2F4F4" />
                  <rect x="16" y="8" width="24" height="12" rx="2" stroke="#B2F4F4" strokeWidth="2" />
                  <circle cx="28" cy="30" r="8" fill="#EAF6F6" />
                  <path d="M28 26v6" stroke="#176B6B" strokeWidth="2" strokeLinecap="round" />
                  <path d="M25 29l3 3 3-3" stroke="#176B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </svg>
            </div>

            <h4 className="text-lg font-medium mb-2">Drag your file(s) to start uploading</h4>
            <p className="text-gray-500 mb-4">OR</p>

            <button
              onClick={handleBrowseClick}
              className="px-5 py-2 border-2 border-[#176B6B] text-[#176B6B] rounded-lg bg-white hover:bg-[#EAF6F6] font-medium text-base transition"
            >
              Browse files
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Bulk Upload Instructions */}
      <div className="mx-8 mb-6">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-teal-800 mb-3 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Bulk Upload Instructions
          </h3>
          <div className="space-y-2 text-sm text-teal-700">
            <p className="font-medium">Please follow these guidelines when preparing your employee data:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Fill in employee data starting from row 4</li>
              <li><strong>Employment Type:</strong> Full Time, Part Time, Contract, Intern (leave empty if not available)</li>
              <li><strong>Marital Status:</strong> Single, Married, Divorced, Widowed</li>
              <li><strong>Gender:</strong> Male, Female, Other</li>
              <li><strong>Shift Times:</strong> Use HH:MM:SS format (e.g., 09:00:00)</li>
              <li><strong>Basic Salary:</strong> Enter as number only (e.g., 50000)</li>
              <li><strong>OT Rate (per hour):</strong> Overtime hourly rate (e.g., 208.33). If not provided, auto-calculated as Basic Salary ÷ 240</li>
              <li><strong>Dates:</strong> Use YYYY-MM-DD format (e.g., 2024-01-01)</li>
              <li><strong>TDS:</strong> Enter as percentage number (e.g., 10 for 10%)</li>
              <li><strong>OFF DAY:</strong> Monday, Tuesday, etc. (comma-separated for multiple days)</li>
              <li>If TDS not provided, defaults to 0</li>
              <li>If OFF DAY not provided, defaults to no off days</li>
              <li>If Date of joining not provided, defaults to upload date</li>
            </ol>
            <div className="mt-3 p-2 bg-teal-100 rounded border-l-4 border-teal-400">
              <p className="text-xs font-medium">💡 <strong>Pro Tip:</strong> Download the template first to see the exact column structure and format requirements.</p>
            </div>
          </div>
        </div>
      </div>

      {/* File upload note and controls */}
      <div className="flex justify-between items-center mt-2 ml-8 mr-8 mb-6">
        <div className="flex items-center">
          <span className="text-gray-500 text-sm">Supports Excel (.xlsx, .xls) and CSV files. </span>
          <button
            onClick={handleTemplateDownload}
            className="ml-1 text-[#176B6B] underline text-sm font-medium hover:text-[#0B5E59]"
            type="button"
            disabled={isSubmitting}
          >
            Download Template
          </button>
        </div>

        {/* Selected file and upload button */}
        {selectedFile && (
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mx-8 mb-6">
            <span className="text-sm text-gray-700">
              Selected: {selectedFile.name}
            </span>
            <button
              onClick={handleFileUpload}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#176B6B] text-white rounded-lg hover:bg-[#0B5E59] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Employees'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mx-6">
        <div className="flex border-b">
          <div className="relative px-6">
            <button
              className={`flex items-center gap-2 pb-4 ${activeTab === 'personal' ? 'text-teal-600 font-medium' : 'text-gray-600'
                }`}
              onClick={() => setActiveTab('personal')}
            >
              <User size={18} />
              <span>Personal Information</span>
            </button>
            {activeTab === 'personal' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-600"></div>
            )}
          </div>
          <div className="relative px-6">
            <button
              className={`flex items-center gap-2 pb-4 ${activeTab === 'professional' ? 'text-teal-600 font-medium' : 'text-gray-600'
                }`}
              onClick={() => setActiveTab('professional')}
            >
              <Briefcase size={18} />
              <span>Professional Information</span>
            </button>
            {activeTab === 'professional' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-600"></div>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 pt-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
            <AlertCircle size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Personal Information Form */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="First Name"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
                required
              />
            </div>
            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
            <div>
              <input
                type="text"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleInputChange}
                placeholder="Mobile Number"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
      ${!/^\d{10}$/.test(formData.mobile_number) && formData.mobile_number
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 focus:ring-teal-500"} 
      text-gray-500 placeholder-gray-500`}
              />
              {!/^\d{10}$/.test(formData.mobile_number) && formData.mobile_number && (
                <p className="text-red-500 text-sm mt-1">Enter a valid 10-digit mobile number</p>
              )}
            </div>

            <div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email Address"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
                              ${!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.email
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 focus:ring-teal-500"} 
                                text-gray-500 placeholder-gray-500`}
              />
              {!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.email && (
                <p className="text-red-500 text-sm mt-1">Enter a valid email address</p>
              )}
            </div>

            <div>
              <label htmlFor="date_of_birth" className="block mb-1 text-sm font-medium px-1 text-gray-700">
                Date of Birth
              </label>
              <CustomDateInputWithOverlay
                value={formData.date_of_birth}
                onChange={(date) => setFormData(prev => ({ ...prev, date_of_birth: date }))}
                placeholder="Date of Birth"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pointer-events-auto bg-transparent"
                name="date_of_birth"
              />
            </div>
            <Dropdown
              options={maritalStatusOptions}
              value={formData.marital_status}
              onChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
              placeholder="Marital Status"
              label="Marital Status"
              required
            />
            <Dropdown
              options={genderOptions}
              value={formData.gender}
              onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              placeholder="Gender"
              label="Gender"
              required
            />
            <Dropdown
              options={nationalityOptions}
              value={formData.nationality}
              onChange={(value) => setFormData(prev => ({ ...prev, nationality: value }))}
              placeholder="Country"
              label="Country"
              required
            />
            <Dropdown
              options={cityOptions}
              value={formData.city}
              onChange={(value) => setFormData(prev => ({ ...prev, city: value }))}
              placeholder="Select City"
              allowCustom
              onCustomAdd={handleCustomCityAdd}
              customPlaceholder="Enter new city"
              label="City"
              required
            />
            <Dropdown
              options={stateOptions}
              value={formData.state}
              onChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
              placeholder="Select State"
              allowCustom
              onCustomAdd={handleCustomStateAdd}
              customPlaceholder="Enter new state"
              label="State"
              required
            />
            <div className="col-span-2">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Address"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
          </div>
        )}

        {/* Professional Information Form */}
        {activeTab === 'professional' && (
          <div className="grid grid-cols-2 gap-6">
            <Dropdown
              options={departmentOptions}
              value={formData.department}
              onChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              placeholder="Select Department"
              allowCustom
              onCustomAdd={handleCustomDepartmentAdd}
              customPlaceholder="Enter new department"
              label="Department"
              required
            />
            <Dropdown
              options={designationOptions}
              value={formData.designation}
              onChange={(value) => setFormData(prev => ({ ...prev, designation: value }))}
              placeholder="Select Designation"
              allowCustom
              onCustomAdd={handleCustomDesignationAdd}
              customPlaceholder="Enter new designation"
              label="Designation"
              required
            />
            <Dropdown
              options={employmentTypeOptions}
              value={formData.employment_type}
              onChange={(value) => setFormData(prev => ({ ...prev, employment_type: value }))}
              placeholder="Employment Type"
              label="Employment Type"
              required
            />
            <div>
              <label
                htmlFor="date_of_joining"
                className="block mt-1 text-sm font-medium text-gray-700"
              >
                Date of Joining <span className="text-red-500">*</span>
              </label>
              <CustomDateInputWithOverlay
                value={formData.date_of_joining}
                onChange={(date) =>
                  setFormData((prev) => ({ ...prev, date_of_joining: date }))
                }
                placeholder="Date of Joining"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pointer-events-auto bg-transparent"
                name="date_of_joining"
                required={true}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={formData.shift_start_time}
                onFocus={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={e => setFormData(prev => ({ ...prev, shift_start_time: e.target.value }))}
                className="time-input-styled w-28 px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300 transition-colors duration-200"
              />
              <span className="text-sm text-gray-500">Shift Start Time</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={formData.shift_end_time}
                onFocus={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={e => setFormData(prev => ({ ...prev, shift_end_time: e.target.value }))}
                className="time-input-styled w-28 px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300 transition-colors duration-200"
              />
              <span className="text-sm text-gray-500">Shift End Time</span>
            </div>
            <Dropdown
              options={locationOptions}
              value={formData.location_branch}
              onChange={(value) => setFormData(prev => ({ ...prev, location_branch: value }))}
              placeholder="Select Location/Branch"
              allowCustom
              onCustomAdd={handleCustomLocationAdd}
              customPlaceholder="Enter new location"
              label="Location/Branch"
              required
            />

            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                Basic Salary <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="basic_salary"
                value={formData.basic_salary}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="Enter Basic Salary"
                className="w-full h-[45px] border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>


            <div className="relative">
              <input
                type="text"
                name="tds_percentage"
                value={formData.tds_percentage}
                onChange={handleInputChange}
                placeholder="TDS (e.g., 7%)"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
            <div className="relative">
              <input
                type="text"
                name="ot_charge"
                value={formData.ot_charge}
                onChange={handleInputChange}
                placeholder="OT Charge per Hour (calculated automatically)"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
                readOnly
              />
              {formData.basic_salary && formData.ot_charge && (
                <div className="absolute top-full left-0 right-0 text-xs text-gray-500 mt-1">
                  Calculation: {formData.basic_salary} ÷ 240 = {formData.ot_charge}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Off Days</label>
              <div className="grid grid-cols-7 gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="flex items-center">
                    <input
                      type="checkbox"
                      id={day}
                      name={`off_${day.toLowerCase()}`}
                      checked={formData[`off_${day.toLowerCase()}` as keyof EmployeeFormState] as boolean}
                      onChange={() => handleCheckboxChange(day)}
                      className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor={day} className="ml-2 text-sm text-gray-600">
                      {day}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Employee Status</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active !== undefined ? formData.is_active : true}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-600">
                  Active Employee (checked = active, unchecked = inactive)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer with Action Buttons */}
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={() => navigate('/hr-management/directory')}
            className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg"
            disabled={isSubmitting}
          >
            Cancel
          </button>

          {activeTab === 'personal' ? (
            <button
              onClick={handleSubmit}
              className="px-5 py-2 bg-teal-600 text-white rounded-lg"
              disabled={isSubmitting}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-5 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HRAddEmployee; 