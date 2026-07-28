import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { lightTheme } from './src/types/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {

  useEffect(() => {
    const clearStorage = async () => {
      await AsyncStorage.clear();
      console.log('🧹 Storage cleared');
    };
    clearStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={lightTheme}>
        <AuthProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor="#7C2D3A"
          />
          <AppNavigator />
          <Toast />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}