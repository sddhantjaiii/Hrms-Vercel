import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, DollarSign, Search, Filter, Trash2, AlertTriangle, Edit, Save, X, Users, Plus, Download } from 'lucide-react';
import { apiRequest } from '../../services/api';
import AdvanceManager from './AdvanceManager';
import Dropdown, { DropdownOption } from '../Dropdown';
import { exportPayrollToExcel, PayrollData } from '../../utils/excelExport';

interface PayrollOverviewPeriod {
  id: number;
  year: number;
  month: string;
  month_display: string;
  data_source: string;
  status: string;
  status_color: string;
  is_locked: boolean;
  calculation_date: string | null;
  working_days: number;
  tds_rate: number;
  total_employees: number;
  paid_employees: number;
  pending_employees: number;
  total_gross_salary: number;
  total_net_salary: number;
  total_advance_deductions: number;
  total_tds: number;
  can_modify: boolean;
}

interface PayrollDetailEntry {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  basic_salary: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  ot_hours: number;
  late_minutes: number;
  gross_salary: number;
  ot_charges: number;
  late_deduction: number;
  tds_percentage: number;
  tds_amount: number;
  salary_after_tds: number;
  total_advance_balance: number;
  advance_deduction_amount: number;
  advance_deduction_editable: boolean;
  remaining_advance_balance: number;
  net_payable: number;
  is_paid: boolean;
  payment_date?: string;
}

interface PayrollDetailResponse {
  success: boolean;
  employees: PayrollDetailEntry[];
}

interface AdvanceUpdateResponse {
  success: boolean;
  message?: string;
}

interface BulkUpdateResponse {
  success: boolean;
  message?: string;
}

interface DeleteResponse {
  ok: boolean;
  status: number;
}

interface PayrollOverviewData {
  success: boolean;
  current_month: string;
  current_year: number;
  current_period_exists: boolean;
  periods: PayrollOverviewPeriod[];
  total_periods: number;
}

const PayrollOverview: React.FC = () => {
  const [overviewData, setOverviewData] = useState<PayrollOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filterStatusOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Status' },
    { value: 'LOCKED', label: 'Locked' },
    { value: 'UNLOCKED', label: 'Unlocked' },
    { value: 'PAID', label: 'Has Paid' },
    { value: 'PENDING', label: 'Has Pending' }
  ];
  const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // New states for detailed view
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollOverviewPeriod | null>(null);
  const [detailData, setDetailData] = useState<PayrollDetailEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{[key: string]: number}>({});
  
  // States for temporary status changes
  const [tempStatusChanges, setTempStatusChanges] = useState<{[key: string]: boolean}>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  useEffect(() => {
    loadPayrollOverview();
  }, []);

  const loadPayrollOverview = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/payroll-overview/');
      
      // Ensure the response has the expected structure
      if (data && typeof data === 'object') {
        const payrollData = data as PayrollOverviewData;
        // Ensure periods is always an array
        if (!Array.isArray(payrollData.periods)) {
          payrollData.periods = [];
        }
        setOverviewData(payrollData);
      } else {
        console.error('Invalid response structure:', data);
        setOverviewData({
          success: false,
          current_month: '',
          current_year: new Date().getFullYear(),
          current_period_exists: false,
          periods: [],
          total_periods: 0
        });
      }
    } catch (error) {
      console.error('Error loading payroll overview:', error);
      // Set a default structure on error
      setOverviewData({
        success: false,
        current_month: '',
        current_year: new Date().getFullYear(),
        current_period_exists: false,
        periods: [],
        total_periods: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodDetail = async (period: PayrollOverviewPeriod) => {
    try {
      setLoadingDetail(true);
      setSelectedPeriod(period);
      
      const data = await apiRequest(`/api/payroll-period-detail/${period.id}/`) as PayrollDetailResponse;
      
      if (data && data.success) {
        setDetailData(data.employees || []);
      } else {
        console.error('Failed to load period detail:', data);
        setDetailData([]);
      }
    } catch (error) {
      console.error('Error loading period detail:', error);
      setDetailData([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    try {
      setDeleting(true);
      const response = await apiRequest(`/api/payroll-periods/${periodId}/`, {
        method: 'DELETE'
      }) as DeleteResponse;
      
      // Check if response is ok
      if (response.ok) {
        // Reload the overview data
        await loadPayrollOverview();
        setShowDeleteModal(null);
      } else {
        console.error('Failed to delete period:', response.status);
      }
    } catch (error) {
      console.error('Error deleting period:', error);
    } finally {
      setDeleting(false);
    }
  };

  const startEditAdvance = (employeeId: string, currentAmount: number) => {
    setEditingEntry(employeeId);
    setEditValues({ [employeeId]: currentAmount });
  };

  const saveAdvanceEdit = async (employeeId: string) => {
    try {
      const newAmount = editValues[employeeId];
      
      const data = await apiRequest('/api/update-advance-deduction/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculated_salary_id: detailData.find(entry => entry.employee_id === employeeId)?.id,
          new_amount: newAmount
        })
      }) as AdvanceUpdateResponse;

      if (data.success) {
        // Update local data
        setDetailData(prev => prev.map(entry => 
          entry.employee_id === employeeId 
            ? { ...entry, advance_deduction_amount: newAmount, net_payable: entry.salary_after_tds - newAmount }
            : entry
        ));
        setEditingEntry(null);
        setEditValues({});
      } else {
        alert('Failed to update advance deduction');
      }
    } catch (error) {
      console.error('Error updating advance:', error);
      alert('Error updating advance deduction');
    }
  };

  const toggleTempStatus = (employeeId: string) => {
    const currentEntry = detailData.find(e => e.employee_id === employeeId);
    if (!currentEntry) return;

    const currentStatus = tempStatusChanges[employeeId] !== undefined 
      ? tempStatusChanges[employeeId] 
      : currentEntry.is_paid;
    
    const newStatus = !currentStatus;
    
    setTempStatusChanges(prev => ({
      ...prev,
      [employeeId]: newStatus
    }));
    
    setHasUnsavedChanges(true);
  };

  const markAllAsPaid = () => {
    const newChanges: {[key: string]: boolean} = {};
    detailData.forEach(entry => {
      const currentStatus = tempStatusChanges[entry.employee_id] !== undefined 
        ? tempStatusChanges[entry.employee_id] 
        : entry.is_paid;
      
      if (!currentStatus) {
        newChanges[entry.employee_id] = true;
      }
    });
    
    setTempStatusChanges(prev => ({
      ...prev,
      ...newChanges
    }));
    
    if (Object.keys(newChanges).length > 0) {
      setHasUnsavedChanges(true);
    }
  };

  const saveChanges = async () => {
    try {
      setSavingChanges(true);
      
      // Prepare the data for bulk update
      const updatedEntries = detailData.map(entry => ({
        employee_id: entry.employee_id,
        is_paid: tempStatusChanges[entry.employee_id] !== undefined 
          ? tempStatusChanges[entry.employee_id] 
          : entry.is_paid,
        advance_deduction_amount: editValues[`advance_${entry.employee_id}`] !== undefined
          ? editValues[`advance_${entry.employee_id}`]
          : entry.advance_deduction_amount,
        net_payable: editValues[`net_${entry.employee_id}`] !== undefined
          ? editValues[`net_${entry.employee_id}`]
          : entry.net_payable
      }));

      const data = await apiRequest(`/api/payroll-periods/${selectedPeriod?.id}/bulk-update/`, {
        method: 'POST',
        body: JSON.stringify({
          entries: updatedEntries
        })
      }) as BulkUpdateResponse;
      
      if (data && data.success) {
        // Reload the detail data
        if (selectedPeriod) {
          await loadPeriodDetail(selectedPeriod);
        }
        // Clear temporary changes
        setTempStatusChanges({});
        setEditValues({});
        setHasUnsavedChanges(false);
      } else {
        console.error('Failed to save changes:', data);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setSavingChanges(false);
    }
  };

  const discardChanges = () => {
    setTempStatusChanges({});
    setEditValues({});
    setHasUnsavedChanges(false);
    setEditingEntry(null);
  };

  const getEffectiveStatus = (employeeId: string, originalStatus: boolean) => {
    return tempStatusChanges[employeeId] !== undefined 
      ? tempStatusChanges[employeeId] 
      : originalStatus;
  };

  const filteredPeriods = overviewData?.periods?.filter(period => {
    const matchesSearch = period.month_display.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         period.year.toString().includes(searchQuery);
    const matchesStatus = filterStatus === 'ALL' || 
                         (filterStatus === 'LOCKED' && period.is_locked) ||
                         (filterStatus === 'UNLOCKED' && !period.is_locked) ||
                         (filterStatus === 'PAID' && period.paid_employees > 0) ||
                         (filterStatus === 'PENDING' && period.pending_employees > 0);
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // Show detailed period view
  if (selectedPeriod) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedPeriod(null)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900"
            >
              <X size={16} />
              Back to Overview
            </button>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Payroll Detail - {selectedPeriod.month_display} {selectedPeriod.year}
              </h3>
              <p className="text-sm text-gray-600">Manage individual salaries and payment status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <>
                <button
                  onClick={saveChanges}
                  disabled={savingChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingChanges ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={discardChanges}
                  disabled={savingChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  <X size={16} />
                  Discard
                </button>
              </>
            )}
            <button
              onClick={markAllAsPaid}
              disabled={savingChanges}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              Mark All Paid
            </button>
          </div>
        </div>

        {/* Period Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Users className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-xl font-semibold text-gray-900">{selectedPeriod.total_employees}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-xl font-semibold text-gray-900">{selectedPeriod.paid_employees}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Clock className="text-orange-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-semibold text-gray-900">{selectedPeriod.pending_employees}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <DollarSign className="text-purple-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Net</p>
                <p className="text-xl font-semibold text-gray-900">₹{selectedPeriod.total_net_salary.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        {loadingDetail ? (
          <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h4 className="font-medium text-gray-900">Employee Salary Details</h4>
                <p className="text-sm text-gray-600">Edit advance deductions and manage payment status</p>
              </div>
              <button
                onClick={() => {
                  if (detailData.length > 0) {
                    const fileName = selectedPeriod 
                      ? `payroll_${selectedPeriod.month_display}_${selectedPeriod.year}` 
                      : 'payroll_details';
                    exportPayrollToExcel(detailData as PayrollData[], fileName);
                  }
                }}
                disabled={detailData.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Salary</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Days</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Hours</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Charges</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late (Min)</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Deduction</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Salary</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS %</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS Amount</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Balance</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Deduction</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Salary</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {detailData.map((entry) => {
                    const hasUnsavedChange = tempStatusChanges[entry.employee_id] !== undefined;
                    const effectiveStatus = getEffectiveStatus(entry.employee_id, entry.is_paid);
                    
                    return (
                    <tr key={entry.employee_id} className={`hover:bg-gray-50 ${hasUnsavedChange ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{entry.employee_name}</div>
                            <div className="text-sm text-gray-500">{entry.employee_id}</div>
                          </div>
                          {hasUnsavedChange && (
                            <div className="w-2 h-2 bg-yellow-400 rounded-full" title="Unsaved changes"></div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.department}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">₹{entry.basic_salary.toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.working_days || 0}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.present_days}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.absent_days}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.ot_hours || 0}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">₹{(entry.ot_charges || 0).toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.late_minutes || 0}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">₹{(entry.late_deduction || 0).toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">₹{entry.gross_salary.toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.tds_percentage || 0}%</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">₹{entry.tds_amount.toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">₹{entry.total_advance_balance.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Remaining: ₹{entry.remaining_advance_balance.toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {editingEntry === entry.employee_id ? (
                          <input
                            type="number"
                            value={editValues[`advance_${entry.employee_id}`] || 0}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              [`advance_${entry.employee_id}`]: parseFloat(e.target.value) || 0
                            }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            max={entry.total_advance_balance}
                          />
                        ) : (
                          <span className="text-sm text-gray-900">₹{entry.advance_deduction_amount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-teal-600">₹{entry.net_payable.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          effectiveStatus 
                            ? 'bg-teal-100 text-teal-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {effectiveStatus ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {editingEntry === entry.employee_id ? (
                            <>
                              <button
                                onClick={() => saveAdvanceEdit(entry.employee_id)}
                                className="text-teal-600 hover:text-teal-900"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={() => setEditingEntry(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditAdvance(entry.employee_id, entry.advance_deduction_amount)}
                                className="text-teal-600 hover:text-teal-900"
                                title="Edit Advance"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => toggleTempStatus(entry.employee_id)}
                                className={`${
                                  effectiveStatus 
                                    ? 'text-yellow-600 hover:text-yellow-900' 
                                    : 'text-teal-600 hover:text-teal-900'
                                }`}
                                title={effectiveStatus ? 'Mark Unpaid' : 'Mark Paid'}
                              >
                                <CheckCircle size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show overview list
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payroll Overview</h3>
          <p className="text-sm text-gray-600">Manage all payroll periods and track payment status</p>
        </div>
          <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Add Advance
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Calendar className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Periods</p>
                <p className="text-xl font-semibold text-gray-900">{overviewData.total_periods}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="text-orange-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Current Month</p>
                <p className="text-xl font-semibold text-gray-900">{overviewData.current_month} {overviewData.current_year}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Active Periods</p>
                <p className="text-xl font-semibold text-gray-900">{overviewData.periods?.filter(p => !p.is_locked).length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <DollarSign className="text-purple-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Current Period Exists</p>
                <p className="text-xl font-semibold text-gray-900">{overviewData.current_period_exists ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by month or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <Dropdown
          options={filterStatusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="All Status"
          className="w-40"
        />
        </div>
      </div>

      {/* Periods Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Payroll Periods</h4>
          <p className="text-sm text-gray-600">Click on a period to view detailed salary breakdown</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Gross</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Net</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPeriods.map((period) => (
                <tr 
                  key={period.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadPeriodDetail(period)}
                >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                      <div className="text-sm font-medium text-gray-900">{period.month_display} {period.year}</div>
                      <div className="text-sm text-gray-500">{period.data_source}</div>
                      </div>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {period.total_employees} total
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{period.total_gross_salary.toLocaleString()}
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₹{period.total_net_salary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">{period.paid_employees} paid</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-orange-600">{period.pending_employees} pending</span>
                    </div>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      period.is_locked 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {period.is_locked ? 'Locked' : 'Active'}
                    </span>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setShowDeleteModal(period.id)}
                      className="text-red-600 hover:text-red-900"
                            title="Delete Period"
                          >
                            <Trash2 size={16} />
                          </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPeriods.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No payroll periods found</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">Delete Payroll Period</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this payroll period? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePeriod(showDeleteModal)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AdvanceManager 
        showModal={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
      />
    </div>
  );
};

export default PayrollOverview; 