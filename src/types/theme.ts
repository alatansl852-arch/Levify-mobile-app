// ============================================
// FILE 1: src/theme.ts
// Create this new file in: src/theme.ts
// ============================================
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const customColors = {
  primary: '#7C2D3A',
  primaryLight: '#9B4050',
  primaryDark: '#5A1F2A',
  primaryContainer: '#FFD8E4',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#3E0012',
  
  secondary: '#F4B942',
  secondaryLight: '#F7CB6E',
  secondaryDark: '#D89F2A',
  secondaryContainer: '#FFEFD5',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#261900',
  
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  successContainer: '#D1FAE5',
  onSuccess: '#FFFFFF',
  
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  warningContainer: '#FEF3C7',
  onWarning: '#FFFFFF',
  
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  errorContainer: '#FEE2E2',
  onError: '#FFFFFF',
  onErrorContainer: '#410002',
  
  background: '#FAFAFA',
  backgroundSecondary: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#F4F4F5',
  surfaceDisabled: '#E0E0E0',
  
  onBackground: '#1A1A1A',
  onSurface: '#1A1A1A',
  onSurfaceVariant: '#6B7280',
  
  outline: '#E5E7EB',
  outlineVariant: '#D1D5DB',
  
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#FFB1C8',
  
  institutional: '#7C2D3A',
  institutionalLight: '#9B4050',
  gold: '#F4B942',
  muted: '#9CA3AF',
  mutedForeground: '#6B7280',
  card: '#FFFFFF',
  cardBorder: '#E5E7EB',
  
  pendingBg: '#FEF3C7',
  pendingText: '#F59E0B',
  approvedBg: '#D1FAE5',
  approvedText: '#10B981',
  rejectedBg: '#FEE2E2',
  rejectedText: '#EF4444',
  hrApprovedBg: '#DBEAFE',
  hrApprovedText: '#3B82F6',
  ovcaaApprovedBg: '#E0E7FF',
  ovcaaApprovedText: '#6366F1',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: customColors.primary,
    primaryContainer: customColors.primaryContainer,
    secondary: customColors.secondary,
    secondaryContainer: customColors.secondaryContainer,
    tertiary: customColors.gold,
    tertiaryContainer: customColors.secondaryContainer,
    surface: customColors.surface,
    surfaceVariant: customColors.surfaceVariant,
    surfaceDisabled: customColors.surfaceDisabled,
    background: customColors.background,
    error: customColors.error,
    errorContainer: customColors.errorContainer,
    onPrimary: customColors.onPrimary,
    onPrimaryContainer: customColors.onPrimaryContainer,
    onSecondary: customColors.onSecondary,
    onSecondaryContainer: customColors.onSecondaryContainer,
    onTertiary: customColors.onSecondary,
    onTertiaryContainer: customColors.onSecondaryContainer,
    onSurface: customColors.onSurface,
    onSurfaceVariant: customColors.onSurfaceVariant,
    onError: customColors.onError,
    onErrorContainer: customColors.onErrorContainer,
    onBackground: customColors.onBackground,
    outline: customColors.outline,
    outlineVariant: customColors.outlineVariant,
    inverseSurface: customColors.inverseSurface,
    inverseOnSurface: customColors.inverseOnSurface,
    inversePrimary: customColors.inversePrimary,
    shadow: customColors.shadow,
    scrim: customColors.scrim,
    backdrop: 'rgba(0, 0, 0, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: customColors.surface,
      level2: customColors.surface,
      level3: customColors.surface,
      level4: customColors.surface,
      level5: customColors.surface,
    },
  },
  custom: customColors,
};

export const getStatusColors = (status: string) => {
  switch (status) {
    case 'pending':
      return { bg: customColors.pendingBg, text: customColors.pendingText };
    case 'approved':
      return { bg: customColors.approvedBg, text: customColors.approvedText };
    case 'rejected':
    case 'hr_rejected':
    case 'ovcaa_rejected':
    case 'ovcaf_rejected':
      return { bg: customColors.rejectedBg, text: customColors.rejectedText };
    case 'hr_approved':
      return { bg: customColors.hrApprovedBg, text: customColors.hrApprovedText };
    case 'ovcaa_approved':
    case 'ovcaf_approved':
      return { bg: customColors.ovcaaApprovedBg, text: customColors.ovcaaApprovedText };
    default:
      return { bg: customColors.surfaceVariant, text: customColors.onSurfaceVariant };
  }
};

export default lightTheme;