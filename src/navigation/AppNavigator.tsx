import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { notificationAPI } from '../services/apiService';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/employee/DashboardScreen';
import ApplyLeaveScreen from '../screens/employee/ApplyLeaveScreen';
import LeaveHistoryScreen from '../screens/employee/LeaveHistoryScreen';
import LeaveBalanceScreen from '../screens/employee/LeaveBalanceScreen';
import ProfileScreen from '../screens/employee/ProfileScreen';
import NotificationsScreen from '../screens/employee/NotificationsScreen';
import LeaveDetailsScreen from '../screens/employee/LeaveDetailsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MAROON_HEADER = {
  headerShown: true,
  headerStyle: { backgroundColor: '#7C2D3A' },
  headerShadowVisible: false,
  headerTintColor: 'white',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

function NotificationBell({ navigation }: { navigation: any }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnread = async () => {
    try {
      const res = await notificationAPI.getAll();
      setUnread(res.unread_count ?? 0);
    } catch {
      // silently fail
    }
  };

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={{ marginRight: 16, position: 'relative' }}
    >
      <Icon name="bell" size={24} color="white" />
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4,
          backgroundColor: '#EF4444', borderRadius: 10,
          minWidth: 18, height: 18,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmployeeTabs({ navigation }: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#7C2D3A',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: '#7C2D3A' },
        headerShadowVisible: false,
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => <NotificationBell navigation={navigation} />,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard" size={size} color={color} />,
          headerTitle: 'LEVIFY - MSU Marawi',
        }}
      />
      <Tab.Screen
        name="LeaveHistory"
        component={LeaveHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Icon name="history" size={size} color={color} />,
          headerTitle: 'Leave History',
        }}
      />
      <Tab.Screen
        name="LeaveBalance"
        component={LeaveBalanceScreen}
        options={{
          tabBarLabel: 'Balance',
          tabBarIcon: ({ color, size }) => <Icon name="wallet" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="account" size={size} color={color} />,
          headerTitle: 'My Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={EmployeeTabs} />
            <Stack.Screen
              name="ApplyLeave"
              component={ApplyLeaveScreen}
              options={{ ...MAROON_HEADER, title: 'Apply for Leave' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ ...MAROON_HEADER, title: 'Notifications' }}
            />
            <Stack.Screen
              name="LeaveDetails"
              component={LeaveDetailsScreen}
              options={{ ...MAROON_HEADER, title: 'Leave Details' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}