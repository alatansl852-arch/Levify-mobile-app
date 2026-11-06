// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/apiService';

export type UserRole = 'employee' | 'faculty' | 'staff' | 'hr' | 'ovcaa' | 'ovcaf';

// Only these roles can use the mobile app. Everyone else (HR, OVCAA, OVCAF, admins) → web only.
const MOBILE_ALLOWED_ROLES: string[] = ['employee', 'faculty', 'staff'];
const ADMIN_BLOCK_MESSAGE =
  'Admin accounts cannot log in on the mobile app. Please use the web portal.';

const isMobileAllowed = (role: string | undefined) =>
  !!role && MOBILE_ALLOWED_ROLES.includes(role.toLowerCase());

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  position?: string;
  employeeId?: string;
  employmentType?: 'permanent' | 'contractual';
  employeeType?: 'faculty' | 'staff';
  salaryGrade?: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  adminBlocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const clearStorage = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('levify_user');
  };

  const loadUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('levify_user');
      // read token from 'userToken' (same key apiService uses)
      const savedToken = await AsyncStorage.getItem('userToken');

      if (savedUser && savedToken) {
        const parsedUser = JSON.parse(savedUser);

        // Block any saved admin session
        if (!isMobileAllowed(parsedUser.role)) {
          console.log('⛔ Saved session is not allowed on mobile:', parsedUser.role);
          await clearStorage();
          return;
        }

        const userData: User = {
          id: parsedUser.id,
          email: parsedUser.email,
          name: parsedUser.name,
          role: parsedUser.role as UserRole,
          department: parsedUser.department,
          position: parsedUser.position,
          employeeId: parsedUser.employeeId,
          employmentType: parsedUser.employmentType as 'permanent' | 'contractual',
          employeeType: parsedUser.employee_type as 'faculty' | 'staff',
          salaryGrade: parsedUser.salary_grade,
        };
        setUser(userData);
        console.log('✅ User loaded from storage:', userData.email, userData.role);
      }
    } catch (error) {
      console.error('❌ Error loading saved user:', error);
      await clearStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      console.log('🔵 Attempting login for:', email);
      const response = await authAPI.login(email, password);

      if (response.success && response.user && response.token) {
        // ⛔ Block admins from the mobile app (web only)
        if (!isMobileAllowed(response.user.role)) {
          console.log('⛔ Blocked non-employee login on mobile. Role:', response.user.role);
          // apiService may have already saved the token, so clear everything
          await clearStorage();
          setUser(null);
          setIsLoading(false);
          return { success: false, adminBlocked: true, message: ADMIN_BLOCK_MESSAGE };
        }

        const userData: User = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role as UserRole,
          department: response.user.department,
          position: response.user.position,
          employeeId: response.user.employeeId,
          employmentType: response.user.employmentType as 'permanent' | 'contractual',
          employeeType: response.user.employee_type as 'faculty' | 'staff',
          salaryGrade: response.user.salary_grade,
        };

        console.log('✅ Login successful! User:', userData.name, 'Role:', userData.role);

        setUser(userData);

        // save token as 'userToken' AND save user data
        await AsyncStorage.setItem('userToken', response.token);
        await AsyncStorage.setItem('levify_user', JSON.stringify(response.user));

        setIsLoading(false);
        return { success: true };
      } else {
        console.log('❌ Login failed:', response.message);
        setIsLoading(false);
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      setIsLoading(false);
      return { success: false };
    }
  };

  const logout = async () => {
    console.log('👋 Logging out...');
    setUser(null);
    await clearStorage();
    await authAPI.logout();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}