// API Configuration for different environments
export const API_CONFIG = {
  // Get base URL from environment variable or fallback to auto-detection
  getBaseUrl: () => {
    // First, try to get from environment variable
    const envApiUrl = import.meta.env.VITE_API_BASE_URL;
    if (envApiUrl) {
      return envApiUrl;
    }

    // Fallback to auto-detection for development
    // If we're on localhost/development
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return import.meta.env.VITE_DEV_API_URL || "http://127.0.0.1:8000";
    }

    // For production, use environment variable or current domain
    return import.meta.env.VITE_PROD_API_URL || `${window.location.protocol}//${window.location.hostname}`;
  },

  // Get the full API URL
  getApiUrl: (endpoint: string = "") => {
    const baseUrl = API_CONFIG.getBaseUrl();
    return `${baseUrl}/api${endpoint}`;
  },

  // Get environment info for debugging
  getEnvironmentInfo: () => {
    return {
      NODE_ENV: import.meta.env.MODE,
      API_BASE_URL: API_CONFIG.getBaseUrl(),
      HOSTNAME: window.location.hostname,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_DEV_API_URL: import.meta.env.VITE_DEV_API_URL,
      VITE_PROD_API_URL: import.meta.env.VITE_PROD_API_URL,
    };
  },
};

// Export the base URL for backward compatibility
export const API_BASE_URL = API_CONFIG.getBaseUrl();
export const API_BASE = API_CONFIG.getApiUrl();

// Log environment info in development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', API_CONFIG.getEnvironmentInfo());
}
