import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Text, TextInput, Button, Card, useTheme } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const theme = useTheme();

  const handleSubmit = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please enter your email and password'
      });
      return;
    }

    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Login Successful!',
          text2: 'Welcome to LEVIFY Leave Management System'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Invalid credentials. Please try again.'
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'An error occurred',
        text2: 'Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Branding Section ─────────────────────────────────────────── */}
        <View style={styles.brandingSection}>
          <View style={styles.brandingContent}>

            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/levify-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text variant="titleMedium" style={styles.appSubtitle}>
              Leave Management System
            </Text>

            <Text variant="bodyLarge" style={styles.institutionName}>
              Mindanao State University
            </Text>
            <Text variant="bodyMedium" style={styles.institutionLocation}>
              Main Campus, Marawi City
            </Text>
          </View>

          {/* Decorative Wave */}
          <View style={styles.wave} />
        </View>

        {/* ── Login Form Section ───────────────────────────────────────── */}
        <View style={styles.formSection}>
          <Card style={styles.loginCard} elevation={4}>
            <Card.Content style={styles.cardContent}>
              <Text variant="headlineMedium" style={styles.welcomeText}>
                Welcome Back
              </Text>
              <Text variant="bodyMedium" style={[styles.welcomeSubtext, { color: theme.colors.onSurfaceVariant }]}>
                Sign in to access your leave management portal
              </Text>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  placeholder="your.email@msumain.edu.ph"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  left={<TextInput.Icon icon="account" />}
                  style={styles.input}
                  outlineColor="#E5E7EB"
                  activeOutlineColor="#7C2D3A"
                  disabled={loading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  style={styles.input}
                  outlineColor="#E5E7EB"
                  activeOutlineColor="#7C2D3A"
                  disabled={loading}
                />
              </View>

              {/* Login Button */}
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.loginButtonContent}
                buttonColor="#7C2D3A"
                labelStyle={styles.loginButtonLabel}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              {/* Info Box */}
              <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  ℹ️ Enter your institutional email to login.
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Footer */}
          <Text variant="bodySmall" style={styles.footer}>
            © 2026 MSU Marawi - College of Information and Computing Sciences
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  brandingSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: '#7C2D3A',
    position: 'relative',
  },
  brandingContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: 180,
    height: 180,
  },
  appSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  institutionName: {
    color: 'white',
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  institutionLocation: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  loginCard: {
    borderRadius: 16,
    backgroundColor: 'white',
  },
  cardContent: {
    paddingVertical: 24,
  },
  welcomeText: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtext: {
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 24,
    marginBottom: 16,
  },
});