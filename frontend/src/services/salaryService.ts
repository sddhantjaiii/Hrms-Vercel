// Define the new TimePeriod type
import { API_CONFIG } from "../config/apiConfig";
export type TimePeriod =
  | "this_month"
  | "last_6_months"
  | "last_12_months"
  | "last_5_years";

// Interface representing the raw API response format - UPDATED to match backend model
export interface SalaryRawData {
  id: number;
  year: number;
  month: string;
  date: string;
  name: string;
  employee_id: string;
  department: string;
  // Backend field names (not the expected frontend names)
  salery: string; // was basic_salary
  absent: string; // was days_absent
  days: string; // was days_present
  sl_wo_ot: string; // was sl_wo_ot_wo_late
  ot: string; // was ot_hours
  hour_rs: string; // was basic_salary_per_hour
  charges: string; // was ot_charges
  late: string; // was late_minutes
  charge: string; // was basic_salary_per_minute
  incentive: string;
  amt: string; // was late_charges
  sal_ot: string; // was salary_wo_advance_deduction
  adv_25th: string; // was adv_paid_on_25th
  old_adv: string; // was repayment_of_old_adv
  nett_payable: string; // was net_payable
  total_old_adv: string; // was total_old_advance
  balnce_adv: string; // was final_balance_advance
  tds: string;
  sal_tds: string; // was sal_before_tds
  advance: string;
}

// Interface for processed salary data to be used by the frontend
export interface SalaryData {
  // Stats data
  totalEmployees: number;
  avgAttendancePercentage: number;
  totalWorkingDays: number;
  totalOTHours: number;
  totalLateMinutes: number;

  // Comparison data (trends/changes)
  employeesChange: number;
  attendanceChange: number;
  lateMinutesChange: number;
  otHoursChange: number;

  // Department data
  departmentData: {
    department: string;
    averageSalary: number;
    headcount: number;
    totalSalary: number;
    attendancePercentage: number;
    totalOTHours: number;
    totalLateMinutes: number;
  }[];

  // Distribution data
  salaryDistribution: {
    range: string;
    count: number;
  }[];

  // Attendance data
  todayAttendance: {
    status: string;
    count: number;
  }[];

  // Trends data
  salaryTrends: {
    month: string;
    averageSalary: number;
  }[];

  // OT trends
  otTrends: {
    month: string;
    averageOTHours: number;
  }[];

  // Top salaried employees
  topSalariedEmployees: {
    name: string;
    salary: number;
    department: string;
  }[];

  // Department distribution
  departmentDistribution: {
    department: string;
    count: number;
  }[];

  // Available departments for dropdown
  availableDepartments?: string[];

  // Selected payroll period used for the current KPI calculations
  selectedPeriod?: {
    month: string;
    year: number;
    label: string;
  };
}

// Constants removed - were not being used

// Helper functions removed - were not being used

// Function removed - was not being used

// Function removed - was not being used

// Function removed - was not being used

// Function removed - was not being used

// Caching for repeated salaryData calls within the same session
const salaryDataCache: {
  [key: string]: { data: SalaryData; timestamp: number };
} = {};
const SALARY_DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear in-memory cache – call after payroll is (re)calculated so UI refreshes
export const clearSalaryDataCache = () => {
  Object.keys(salaryDataCache).forEach((key) => delete salaryDataCache[key]);
};

export const fetchSalaryData = async (
  timePeriod: TimePeriod = "this_month",
  department: string = "All"
): Promise<SalaryData> => {
  const cacheKey = `${timePeriod}_${department}`;
  const cached = salaryDataCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < SALARY_DATA_CACHE_TTL) {
    return cached.data;
  }
  try {
    // Use the enhanced frontend charts endpoint with time_period and department parameters
    const url = API_CONFIG.getApiUrl(
      `/salary-data/frontend_charts/?time_period=${timePeriod}&department=${encodeURIComponent(
        department
      )}`
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access")}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "API Error Response:",
        response.status,
        "Error details:",
        errorText
      );
      throw new Error(`Failed to fetch salary data: ${response.status}`);
    }

    const responseData: SalaryData = await response.json();

    // Cache the response
    salaryDataCache[cacheKey] = { data: responseData, timestamp: Date.now() };

    return responseData;
  } catch (error) {
    console.error("Error fetching salary data:", error);
    throw error; // Rethrow to allow proper error handling by caller
  }
};

// Helper function to format salary numbers
export const formatSalary = (salary: number): string => {
  const roundedSalary = Math.round(salary);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundedSalary);
};

// Payment API integration
export const fetchPayments = async () => {
  const response = await fetch(API_CONFIG.getApiUrl("/payments/"), {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access")}`,
    },
  });
  if (!response.ok) throw new Error("Failed to fetch payments");
  return response.json();
};

export const createPayment = async (payload: Record<string, unknown>) => {
  const response = await fetch(API_CONFIG.getApiUrl("/payments/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access")}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create payment");
  return response.json();
};

export const updatePayment = async (
  id: string,
  payload: Record<string, unknown>
) => {
  const response = await fetch(API_CONFIG.getApiUrl(`/payments/${id}/`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access")}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update payment");
  return response.json();
};

// Fetch salary data for a specific employee and month/year
export const fetchSalaryDataForEmployeeMonth = async (
  employee_id: string,
  year: number,
  month: string
): Promise<SalaryRawData | null> => {
  const url = API_CONFIG.getApiUrl(
    `/salary-data/?employee_id=${employee_id}&year=${year}&month=${month}`
  );
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access")}`,
      },
    });
    if (!response.ok) return null;

    const responseData = await response.json();

    // Handle both paginated and non-paginated responses
    let data: SalaryRawData[] = [];
    if (Array.isArray(responseData)) {
      data = responseData;
    } else if (responseData.results && Array.isArray(responseData.results)) {
      data = responseData.results;
    } else {
      data = [];
    }

    // Return the first matching record (should be only one per employee/month)
    return data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error("Error fetching salary data for employee/month:", e);
    return null;
  }
};
