import AsyncStorage from '@react-native-async-storage/async-storage';

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://levify-production.up.railway.app';

// ── HELPERS ────────────────────────────────────────────────────────────────────
const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userToken');
  } catch {
    return null;
  }
};

const authHeaders = async () => {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

// ── TYPES ──────────────────────────────────────────────────────────────────────
export interface LeaveApplication {
  id: number;
  application_number: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  days_count: number;
  reason?: string;
  status: string;
  approvals?: {
    hr:    { remarks?: string };
    ovcaa: { remarks?: string };
    ovcaf: { remarks?: string };
  };
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  application_number?: string;
  leave_status?: string;
  leave_type?: string;
}

export interface LeaveBalance {
  vacation: number;
  sick: number;
  special_privilege: number;
  forced: number;
  total: number;
  total_used: number;
}

export interface LeaveStatistics {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  total_days_used: number;
  total_leave_availed: number;
}

export interface UserProfile {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  employee_type: string;
  employment_type: string;
  role: string;
  salary_grade: string;
  total_leave_credits: number;
  total_leave_availed: number;
  leave_balances: {
    vacation: number;
    sick: number;
    special_privilege: number;
    forced: number;
    total_used: number;
  };
}

// ── AUTH API ───────────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/mobile/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res);

    if (data.token) {
      await AsyncStorage.setItem('userToken', data.token);
    }

    return data;
  },

  logout: async () => {
    const res = await fetch(`${BASE_URL}/api/mobile/logout`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    await AsyncStorage.removeItem('userToken');
    return handleResponse(res);
  },

  verify: async () => {
    const res = await fetch(`${BASE_URL}/api/mobile/verify`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },
};

// ── PROFILE API ────────────────────────────────────────────────────────────────
export const profileAPI = {
  getProfile: async (): Promise<{ success: boolean; profile: UserProfile }> => {
    const res = await fetch(`${BASE_URL}/api/mobile/profile`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },
};

// ── LEAVE REQUEST API ──────────────────────────────────────────────────────────
export const leaveRequestAPI = {
  getMyApplications: async (): Promise<LeaveApplication[]> => {
    const res = await fetch(`${BASE_URL}/api/mobile/my-leaves`, {
      headers: await authHeaders(),
    });
    const data = await handleResponse(res);
    return data.leaves || [];
  },

  getLeaveById: async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/mobile/leave/${id}`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  applyLeave: async (payload: {
    leave_type: string;
    date_from: string;
    date_to: string;
    days_count: number;
    reason?: string;
    monetize_credits?: boolean;
    monetize_days?: number;
    commutation_requested?: boolean;
    attachments?: { uri: string; name: string; type: string }[];
  }) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('leave_type',  payload.leave_type);
    formData.append('date_from',   payload.date_from);
    formData.append('date_to',     payload.date_to);
    formData.append('days_count',  String(payload.days_count));
    formData.append('reason',      payload.reason || '');
    formData.append('monetize_credits', String(payload.monetize_credits ?? false));
    formData.append('monetize_days', String(payload.monetize_days ?? 0));
    formData.append('commutation_requested', String(payload.commutation_requested ?? false));

    if (payload.attachments) {
      payload.attachments.forEach(file => {
        // RN FormData file objects need { uri, name, type } shape
        formData.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });
    }

    const res = await fetch(`${BASE_URL}/api/mobile/apply`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Note: do NOT set 'Content-Type' manually for multipart FormData —
        // fetch/RN sets the correct boundary automatically.
      },
      body: formData,
    });
    return handleResponse(res);
  },

  cancelLeave: async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/mobile/cancel/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  getStatistics: async (): Promise<LeaveStatistics> => {
    const res = await fetch(`${BASE_URL}/api/mobile/statistics`, {
      headers: await authHeaders(),
    });
    const data = await handleResponse(res);
    return data.statistics;
  },
};

// ── NOTIFICATION API ───────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll: async (): Promise<{
    success: boolean;
    notifications: Notification[];
    unread_count: number;
  }> => {
    const res = await fetch(`${BASE_URL}/api/mobile/notifications`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  markRead: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${BASE_URL}/api/mobile/notifications/${id}/read`, {
      method: 'PUT',
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  markAllRead: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${BASE_URL}/api/mobile/notifications/read-all`, {
      method: 'PUT',
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },
};