// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/apiService';

export type UserRole = 'employee' | 'hr' | 'ovcaa' | 'ovcaf';

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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
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

  const loadUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('levify_user');
      // ✅ FIXED: read token from 'userToken' (same key apiService uses)
      const savedToken = await AsyncStorage.getItem('userToken');

      if (savedUser && savedToken) {
        const parsedUser = JSON.parse(savedUser);
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
      await AsyncStorage.removeItem('levify_user');
      await AsyncStorage.removeItem('userToken');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('🔵 Attempting login for:', email);
      const response = await authAPI.login(email, password);

      if (response.success && response.user && response.token) {
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

        // ✅ FIXED: save token as 'userToken' AND save user data
        await AsyncStorage.setItem('userToken', response.token);
        await AsyncStorage.setItem('levify_user', JSON.stringify(response.user));

        setIsLoading(false);
        return true;
      } else {
        console.log('❌ Login failed:', response.message);
        setIsLoading(false);
        return false;
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    console.log('👋 Logging out...');
    setUser(null);
    // ✅ FIXED: remove correct token key
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('levify_user');
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