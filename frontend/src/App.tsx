import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import HRSidebar from './components/HRSidebar';
import HRHeader from './components/HRHeader';
import HRStats from './components/HRStats';
import HROverviewCharts from './components/HROverviewCharts';
import HRDirectory from './components/HRDirectory';
import HRAddEmployee from './components/HRAddEmployee';
import HRPayrollNew from './components/HRPayrollNew';
import PayrollOverview from './components/payroll/PayrollOverview';

import HRAttendanceTracker from './components/HRAttendanceTracker';
import HRAttendanceLog from './components/HRAttendanceLog';
import HRLeaveManagement from './components/HRLeaveManagement';
import HRSettings from './components/HRSettings';
import HREmployeeDetails from './components/HREmployeeDetails';
import HRDataUpload from './components/HRDataUpload';
import HRUserInvitation from './components/HRUserInvitation';
import Dropdown, { DropdownOption } from './components/Dropdown';
import { TimePeriod } from './services/salaryService';
import { getDropdownOptions } from './services/dropdownService';
import Login from './components/Login';
import Signup from './components/Signup';
import AcceptInvitation from './components/AcceptInvitation';
import ForgotPassword from './components/ForgotPassword';
import ChangePassword from './components/ChangePassword';
import InactivityWarningModal from './components/InactivityWarningModal';
import { useInactivityManager } from './hooks/useInactivityManager';

// Time period options for HR dashboard
const timePeriodOptions: { label: string; value: TimePeriod }[] = [
  { label: 'Latest Month', value: 'this_month' },
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'Last 12 Months', value: 'last_12_months' },
  { label: 'Last 5 Years', value: 'last_5_years' },
];

function PrivateRoute({ children }: { children: JSX.Element }) {
  const access = localStorage.getItem('access');
  const { showWarning, extendSession, logout } = useInactivityManager();

  if (!access) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {children}
      <InactivityWarningModal
        isOpen={showWarning}
        onStayLoggedIn={extendSession}
        onLogout={logout}
      />
    </>
  );
}

function AppContent({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_month');
  const [activePage, setActivePage] = useState('overview'); // Track active HR page
  const location = useLocation();
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [overviewSalaryData, setOverviewSalaryData] = useState<any>(null);

  // Convert time period options to dropdown format
  const timePeriodDropdownOptions: DropdownOption[] = timePeriodOptions.map(opt => ({
    value: opt.value,
    label: opt.label
  }));

  // Convert departments to dropdown format
  const departmentDropdownOptions: DropdownOption[] = [
    { value: 'All', label: 'All Departments' },
    ...availableDepartments.map(dept => ({ value: dept, label: dept }))
  ];

  // Fetch available departments from API
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const dropdownOptions = await getDropdownOptions();
        // Use departments from the dropdown options API (sourced from database)
        setAvailableDepartments(dropdownOptions.departments);
      } catch (error) {
        console.error('Failed to load departments:', error);
        // Fallback to default departments if API fails
        setAvailableDepartments(['Engineering', 'Sales', 'HR', 'Finance', 'Design', 'Marketing']);
      }
    };

    loadDepartments();
  }, []);

  // Update activePage based on current route
  useEffect(() => {
    if (location.pathname === '/hr-management') {
      setActivePage('overview');
    } else if (location.pathname === '/hr-management/directory') {
      setActivePage('directory');
    } else if (location.pathname === '/hr-management/directory/add') {
      setActivePage('add-employee');
    } else if (location.pathname === '/hr-management/payroll') {
      setActivePage('payroll');

    } else if (location.pathname === '/hr-management/attendance-tracker') {
      setActivePage('attendance-tracker');
    } else if (location.pathname === '/hr-management/attendance-log') {
      setActivePage('attendance-log');
    } else if (location.pathname === '/hr-management/leave-management') {
      setActivePage('leave-management');
    } else if (location.pathname === '/hr-management/settings') {
      setActivePage('settings');
    } else if (location.pathname === '/hr-management/data-upload') {
      setActivePage('data-upload');
    } else if (location.pathname === '/hr-management/team') {
      setActivePage('team');
    }
  }, [location.pathname]);

  // Handle time period selection
  const handleTimePeriodSelect = (value: string) => {
    setTimePeriod(value as TimePeriod);
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (dark) {
      document.documentElement.classList.add('dark');
    }
  }, [dark]);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />
      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
              {/* Left Sidebar */}
              <Routes>
                <Route path="/hr-management/*" element={<HRSidebar activePage={activePage} onPageChange={setActivePage} />} />
                <Route path="*" element={<HRSidebar activePage={activePage} onPageChange={setActivePage} />} />
              </Routes>
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <Routes>
                  <Route path="/hr-management/*" element={<HRHeader dark={dark} setDark={setDark} />} />
                  <Route path="*" element={<HRHeader dark={dark} setDark={setDark} />} />
                </Routes>
                {/* Main Content with Right Sidebar */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Main Content */}
                  <main className="flex-1 overflow-auto p-6 hide-scrollbar">
                    <div className="max-w-full mx-auto">
                      <Routes>
                        {/* HR Management Routes */}
                        <Route path="/hr-management" element={
                          <>
                            <div className="flex justify-end items-center mb-6">
                              <div className="flex items-center gap-4">
                                <Dropdown
                                  options={timePeriodDropdownOptions}
                                  value={timePeriod}
                                  onChange={handleTimePeriodSelect}
                                  className="w-48"
                                />
                                <Dropdown
                                  options={departmentDropdownOptions}
                                  value={selectedDepartment}
                                  onChange={setSelectedDepartment}
                                  className="w-48"
                                />
                              </div>
                            </div>
                            <div className="space-y-6">
                              <HRStats timePeriod={timePeriod} selectedDepartment={selectedDepartment === "N/A" ? "N/A" : selectedDepartment} overviewSalaryData={overviewSalaryData} />
                                <HROverviewCharts timePeriod={timePeriod} selectedDepartment={selectedDepartment === "N/A" ? "N/A" : selectedDepartment} onSalaryData={(d) => setOverviewSalaryData(d)} />
                            </div>
                          </>
                        } />
                        {/* Directory/Employees Route */}
                        <Route path="/hr-management/directory" element={<HRDirectory />} />
                        {/* Add Employee Route */}
                        <Route path="/hr-management/directory/add" element={<HRAddEmployee />} />
                        {/* Employee Details Route */}
                        <Route path="/hr-management/directory/:id" element={<HREmployeeDetails />} />
                        {/* Employee Edit Route */}
                        <Route path="/hr-management/employees/edit/:id" element={<HREmployeeDetails />} />
                        {/* Payroll Route */}
                        <Route path="/hr-management/payroll" element={<HRPayrollNew />} />
                        {/* Payroll Overview Route */}
                        <Route path="/hr-management/payroll-overview" element={<PayrollOverview />} />

                        {/* Attendance Tracker Route */}
                        <Route path="/hr-management/attendance-tracker" element={<HRAttendanceTracker />} />
                <Route path="/hr-management/attendance-log" element={<HRAttendanceLog />} />
                        {/* Leave Management Route */}
                        <Route path="/hr-management/leave-management" element={<HRLeaveManagement />} />
                        {/* Data Upload Route */}
                        <Route path="/hr-management/data-upload" element={<HRDataUpload />} />
                        {/* Team Management Route */}
                        <Route path="/hr-management/team" element={<HRUserInvitation />} />
                        {/* Settings Route */}
                        <Route path="/hr-management/settings" element={<HRSettings />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              </div>
            </div>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  const [dark, setDark] = useState(false); // Always start with light theme

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (dark) {
      document.documentElement.classList.add('dark');
    }
  }, [dark]);

  return (
    <Router>
      <AppContent dark={dark} setDark={setDark} />
    </Router>
  );
}

export default App;