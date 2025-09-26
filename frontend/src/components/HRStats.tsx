import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, TrendingUp, Upload, FileSpreadsheet } from 'lucide-react';
import { fetchSalaryData, SalaryData, TimePeriod } from '../services/salaryService';
import { useNavigate } from 'react-router-dom';

interface HRStatsProps {
  timePeriod: TimePeriod;
  selectedDepartment?: string;
  // Optional: salary data provided by the overview charts so cards can sync to selected month/period
  overviewSalaryData?: SalaryData | null;
}

interface FilterItem {
  department?: string;
}

const HRStats: React.FC<HRStatsProps> = ({ timePeriod, selectedDepartment = 'All', overviewSalaryData = null }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // If parent provides overviewSalaryData, use it as the primary source
  useEffect(() => {
    if (overviewSalaryData) {
      setData(overviewSalaryData);
      const hasActualData = overviewSalaryData.totalEmployees > 0 ||
        (overviewSalaryData.salaryTrends && overviewSalaryData.salaryTrends.length > 0) ||
        (overviewSalaryData.departmentData && overviewSalaryData.departmentData.length > 0);
      setHasData(hasActualData);
      setLoading(false);
    }
  }, [overviewSalaryData]);

  useEffect(() => {
    const loadData = async () => {
      // If overview provided data, don't fetch here - use parent's data as source of truth
      if (overviewSalaryData) return;
      try {
        setLoading(true);
        const salaryData = await fetchSalaryData(timePeriod, selectedDepartment || 'All');
        setData(salaryData);

        // Check if there's actual data (employees, salary records, etc.)
        const hasActualData = salaryData.totalEmployees > 0 ||
          salaryData.salaryTrends.length > 0 ||
          salaryData.departmentData.length > 0;

        setHasData(hasActualData);
      } catch (error) {
        console.error('Error loading salary data:', error);
        setHasData(false);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timePeriod, selectedDepartment]);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg p-6 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded mb-2"></div>
            <div className="w-24 h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // No data state - Show welcome message with upload prompt
  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="max-w-md mx-auto">
          <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to Your HRMS Dashboard!
          </h3>
          <p className="text-gray-600 mb-6">
            Get started by uploading your salary data. Our system will automatically generate
            insights and KPIs from your data.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/hr-management/data-upload')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload Your First Data
            </button>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-3">What you'll get after uploading:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  Employee Analytics
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  Salary Insights
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  Attendance Reports
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertTriangle className="w-4 h-4" />
                  Performance KPIs
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter data by department if needed
  let filteredData = data;
  if (selectedDepartment !== 'All' && data) {
    const departmentFilter = (item: FilterItem) =>
      selectedDepartment === 'N/A' ?
        (!item.department || item.department === 'N/A') :
        item.department === selectedDepartment;

    filteredData = {
      ...data,
      departmentData: data.departmentData.filter(departmentFilter),
      topSalariedEmployees: data.topSalariedEmployees.filter(departmentFilter)
    };
  }

  const stats = [
    {
      title: 'Total Employees',
      value: filteredData?.totalEmployees?.toString() || '0',
      change: filteredData?.employeesChange || 0,
    },
    {
      title: 'Avg Attendance',
      value: `${Math.round(filteredData?.avgAttendancePercentage || 0)}%`,
      change: filteredData?.attendanceChange || 0,
    },
    {
      title: 'Late Minutes',
      value: Math.round(filteredData?.totalLateMinutes || 0).toString(),
      change: filteredData?.lateMinutesChange || 0,
    },
    {
      title: 'OT Hours',
      value: Math.round(filteredData?.totalOTHours || 0).toString(),
      change: filteredData?.otHoursChange || 0,
    }
  ];

  // Render selected payroll period label if provided by backend
  const periodLabel = filteredData?.selectedPeriod?.label;

  return (
    <div className="space-y-4">
      {periodLabel && (
        <div className="text-gray-600 text-sm font-medium">Data for: <span className="font-semibold text-gray-900">{periodLabel}</span></div>
      )}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className={`text-sm font-medium ${
                stat.change > 0 ? 'text-teal-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-gray-600 text-sm">{stat.title}</p>
          </div>
        ))}
      </div> */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm"
          >
            {/* Title */}
            <p className="text-gray-500 text-sm font-medium">{stat.title}</p>

            {/* Value */}
            <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>

            {/* Status */}
            <div className="flex items-center gap-1 mt-2">
              {stat.change > 0 && (
                <img src="/img/trendup.png" alt="" className='w-5 h-5' />
              )}
              {stat.change < 0 && (
                <img src="/img/trenddown.png" alt="" className='w-5 h-5' />
              )}
              {stat.title.includes("Pending") && (
                <img src="/img/caution.png" alt="" className='w-5 h-5' />
              )}

              <span
                className={`text-sm font-medium ${stat.change > 0
                    ? "text-teal-600"
                    : stat.change < 0
                      ? "text-red-600"
                      : stat.title.includes("Pending")
                        ? "text-yellow-600"
                        : "text-gray-500"
                  }`}
              >
                {stat.title.includes("Pending")
                  ? "Action Needed"
                  : `${stat.change > 0 ? "+" : ""}${stat.change.toFixed(
                    2
                  )}% vs Last Month`}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default HRStats;