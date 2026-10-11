import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export const useApi = () => {
  const { getToken } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchApi = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const token = await getToken();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const config: RequestInit = {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      };

      try {
        const response = await fetch(`${baseUrl}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
          console.error(`API Error [${response.status}] for ${endpoint}:`, data);
          throw new Error(data?.error?.message || data?.error || `Request failed with status ${response.status}`);
        }
        
        return data;
      } catch (error) {
        console.error(`API Fetch Error for ${endpoint}:`, error);
        throw error;
      }
    },
    [getToken, baseUrl]
  );

  return { fetchApi };
};
