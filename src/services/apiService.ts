import AsyncStorage from '@react-native-async-storage/async-storage';

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://levify.onrender.com';

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
  // Raw attachment rows, if the backend includes them in the leave details response.
  attachments?: any[];
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
  total_used?: number;       // ✅ added — regular (non-monetized) leave days used
  total_monetized?: number;  // ✅ added — leave days cashed out via monetization
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
  // Highest salary received (the 'S' in the monetization formula).
  // Optional — only present if the backend profile endpoint returns it.
  monthly_salary?: number | string | null;
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

// ── ATTACHMENTS ────────────────────────────────────────────────────────────────
export interface AttachmentFile {
  id: number | string;
  name: string;
  path: string;
  size: number;
  type: string;
}

/** Full URL of an uploaded file (the backend serves /uploads/... as static files). */
export const getFileUrl = (filePath: string): string => {
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const normalized = (filePath || '').replace(/\\/g, '/');
  return `${BASE_URL}/${normalized.replace(/^\//, '')}`;
};

// The web and mobile endpoints don't name attachment fields the same way, so
// accept both (file_name / name, file_path / path / url, ...).
const normalizeAttachment = (raw: any): AttachmentFile | null => {
  if (!raw) return null;
  const path = raw.file_path ?? raw.path ?? raw.url ?? '';
  if (!path) return null;
  return {
    id: raw.id ?? path,
    name: raw.file_name ?? raw.name ?? 'Attachment',
    path,
    size: Number(raw.file_size ?? raw.size) || 0,
    type: raw.file_type ?? raw.type ?? raw.mimeType ?? '',
  };
};

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

  // Highest salary received, used for the monetization estimate. Same endpoint
  // the web Apply Leave page uses. Returns null (never throws) if it can't be
  // loaded, so the form still works and just shows "no estimate".
  getMonthlySalary: async (employeeId?: string): Promise<number | null> => {
    if (!employeeId) return null;
    try {
      const res = await fetch(`${BASE_URL}/api/leave/salary/${employeeId}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success && data.monthly_salary) {
        const n = Number(data.monthly_salary);
        return n > 0 ? n : null;
      }
    } catch (error) {
      console.log('Could not load monthly salary:', error);
    }
    return null;
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

  // Attachments of one application. Uses the rows already included in the
  // leave details response when there are any; otherwise falls back to the
  // same endpoint the web HR page uses. Never throws — returns [] on failure.
  getAttachments: async (id: number, inline?: any[]): Promise<AttachmentFile[]> => {
    if (Array.isArray(inline) && inline.length > 0) {
      return inline.map(normalizeAttachment).filter(Boolean) as AttachmentFile[];
    }
    try {
      const res = await fetch(`${BASE_URL}/api/leave/details/${id}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.attachments)) {
        return data.attachments.map(normalizeAttachment).filter(Boolean) as AttachmentFile[];
      }
    } catch (error) {
      console.log('Could not load attachments:', error);
    }
    return [];
  },

  applyLeave: async (payload: {
    leave_type: string;
    // 'within_ph' | 'abroad' — sent for every leave type (same as the web app).
    leave_location?: string;
    date_from: string;
    date_to: string;
    days_count: number;
    reason?: string;
    monetize_credits?: boolean;
    // Total days to monetize (VL + SL). Kept for backward compatibility.
    monetize_days?: number;
    // VL and SL days to monetize are sent separately (MSU splits them).
    monetization_vl_days?: number;
    monetization_sl_days?: number;
    commutation_requested?: boolean;
    attachments?: { uri: string; name: string; type: string }[];
  }) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('leave_type',  payload.leave_type);
    if (payload.leave_location) {
      formData.append('leave_location', payload.leave_location);
    }
    formData.append('date_from',   payload.date_from);
    formData.append('date_to',     payload.date_to);
    formData.append('days_count',  String(payload.days_count));
    formData.append('reason',      payload.reason || '');
    formData.append('monetize_credits', String(payload.monetize_credits ?? false));
    formData.append('monetize_days', String(payload.monetize_days ?? 0));
    formData.append('monetization_vl_days', String(payload.monetization_vl_days ?? 0));
    formData.append('monetization_sl_days', String(payload.monetization_sl_days ?? 0));
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

    // NOTE: On newer Expo SDKs (53+) the global fetch() rejects React Native's
    // { uri, name, type } FormData file parts ("Unsupported FormDataPart
    // implementation"). XMLHttpRequest still supports them, so the multipart
    // upload goes through XHR. It resolves/rejects exactly like handleResponse().
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/mobile/apply`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      // Do NOT set 'Content-Type' manually — XHR sets the multipart boundary itself.
      xhr.timeout = 90000; // generous: Render's free tier can take a while to wake up
      xhr.onload = () => {
        let data: any = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.message || `HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network request failed. Please check your connection.'));
      xhr.ontimeout = () => reject(new Error('The request timed out. Please try again.'));
      xhr.send(formData as any);
    });
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