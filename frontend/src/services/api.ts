import { API_CONFIG } from "../config/apiConfig";

// const API_BASE_URL = API_CONFIG.getBaseUrl();
const API_BASE_URL = API_CONFIG.getBaseUrl();

// Type definitions
interface APIError {
  error: string;
}

// Get authentication token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem("access");
};

// Helper function to refresh token
const refreshAuthToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem("refresh");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      return true;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }

  return false;
};

// Helper function to make authenticated API calls
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getAuthToken();
  const tenant = JSON.parse(localStorage.getItem("tenant") || "{}");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add tenant subdomain header for tenant resolution
  if (tenant.subdomain) {
    headers["X-Tenant-Subdomain"] = tenant.subdomain;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If token expired (401), try to refresh and retry once
  if (response.status === 401 && token) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      // Retry the request with new token
      const newToken = getAuthToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    } else {
      // Refresh failed, redirect to login
      localStorage.clear();
      window.location.href = "/login";
    }
  }

  return response;
};

// Generic API request function with automatic JSON parsing
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> => {
  const response = await apiCall(endpoint, options);

  if (!response.ok) {
    const error = await response
      .json()
      .catch((): APIError => ({ error: "Network error" }));
    throw new Error((error as APIError).error || `HTTPS ${response.status}`);
  }

  return await response.json();
};

// File upload function for handling FormData
export const apiUpload = async (
  endpoint: string,
  formData: FormData
): Promise<Response> => {
  const token = getAuthToken();
  const tenant = JSON.parse(localStorage.getItem("tenant") || "{}");

  const headers: Record<string, string> = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add tenant subdomain header for tenant resolution
  if (tenant.subdomain) {
    headers["X-Tenant-Subdomain"] = tenant.subdomain;
  }

  // Note: Don't set Content-Type for FormData, let the browser set it with boundary
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  return response;
};

// Convenience methods for different HTTP methods
export const apiGet = (endpoint: string) =>
  apiCall(endpoint, { method: "GET" });
export const apiPost = (endpoint: string, data?: unknown) =>
  apiCall(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
export const apiPut = (endpoint: string, data?: unknown) =>
  apiCall(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
export const apiPatch = (endpoint: string, data?: unknown) =>
  apiCall(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
export const apiDelete = (endpoint: string) =>
  apiCall(endpoint, { method: "DELETE" });

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  login: "/api/public/login/",
  signup: "/api/public/signup/",
  register: "/api/auth/register/",
  refreshToken: "/api/auth/refresh/",

  // Dashboard
  dashboard: "/api/dashboard/stats/",

  // File operations
  downloadTemplate: "/api/download-template/",
  uploadSalary: "/api/upload-salary/",

  // User Management - Updated to use correct endpoints
  users: "/api/user-invitations/",
  userById: (id: string) => `/api/user-invitations/${id}/`,
  userPermissions: (id: string) => `/api/user-invitations/${id}/permissions/`,
  inviteUser: "/api/user-invitations/",

  // Employee Management
  employees: "/api/employees/",
  employeeById: (id: string) => `/api/employees/${id}/`,
  employeeStats: "/api/employees/stats/",

  // Salary and Payroll
  salaryData: "/api/salary-data/",
  salaryStats: "/api/salary-data/stats/",
  monthlyPayroll: "/api/payroll/monthly/",

  // Attendance
  attendance: "/api/attendance/",
  attendanceStats: "/api/attendance/stats/",

  // Leave Management
  leaves: "/api/leaves/",
  leaveStats: "/api/leaves/stats/",

  // Department Management
  departments: "/api/departments/",
  departmentStats: "/api/departments/stats/",

  // Reports
  reports: "/api/reports/",
  exportData: "/api/reports/export/",

  // Tenant/Company Settings
  tenantSettings: "/api/tenant/settings/",
  tenantUsers: "/api/tenant/users/",

  // Legacy endpoints for backward compatibility
  get_directory_data: "/api/employees/get_directory_data/",
  get_employee_details: (id: string) =>
    `/api/employees/${id}/get_employee_details/`,
  get_attendance_data: "/api/attendance/get_attendance_data/",
  get_leave_data: "/api/leaves/get_leave_data/",
  get_payroll_data: "/api/salary-data/get_payroll_data/",
  update_employee_details: (id: string) =>
    `/api/employees/${id}/update_employee_details/`,
};

export default {
  apiCall,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  apiUpload,
  API_ENDPOINTS,
};
