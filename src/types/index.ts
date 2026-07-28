export type UserRole = 'staff' | 'faculty' | 'hr' | 'ovcaa' | 'ovcaf';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  position?: string;
  employeeId?: string;
  rank?: string;
  employmentType?: 'permanent' | 'contractual';
}

export interface LeaveRequest {
  id: number;
  reference_no?: string;
  employeeName: string;
  department: string;
  position: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: 'pending' | 'hr_approved' | 'ovcaa_approved' | 'approved' | 'rejected' | 'hr_rejected' | 'ovcaa_rejected';
  createdAt: string;
  updatedAt: string;
  hrRemarks?: string;
  ovcaaRemarks?: string;
  ovcafRemarks?: string;
  rejectionReason?: string;
  attachments?: Array<{
    id: number;
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
}

export interface LeaveBalance {
  id: number;
  user_id: number;
  vacation_leave: string;
  sick_leave: string;
  special_privilege: number;
  forced_leave: number;
  total_earned: string;
  total_used: number;
  year: number;
}

// ============================================
// FILE 4: src/api/leaveService.ts (Simplified mobile API wrapper)
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.100:5000/api'; // Change to your IP

export const getToken = async () => {
  return await AsyncStorage.getItem('levify_token');
};

// Submit leave application (with file upload support)
export const submitLeaveApplication = async (formData: FormData) => {
  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}/leave/apply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData - browser sets it automatically
      },
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Get my applications
export const getMyApplications = async (employeeId: number) => {
  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}/leave/my-applications/${employeeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Get leave balance
export const getLeaveBalance = async (userId: number) => {
  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}/leave-balances/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};