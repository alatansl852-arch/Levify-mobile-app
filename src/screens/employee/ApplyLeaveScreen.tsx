import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, TextInput as RNTextInput, Image,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Calendar, DateData } from 'react-native-calendars';
import { useAuth } from '../../contexts/AuthContext';
import { leaveRequestAPI, profileAPI } from '../../services/apiService';
import { computeMonetizationValue, MONETIZATION_CF } from '../../services/salary-utils';
import Toast from 'react-native-toast-message';

const PRIMARY = '#7C2D3A';
const BORDER = '#E5E7EB';

// ---------------------------------------------------------------------------
// Client-side image compression before upload. iPhone photos (HEIC, high-res)
// can easily be 8-15MB — this resizes + re-encodes them as JPEG under
// MAX_FILE_SIZE_BYTES so they never hit the backend's 5MB upload limit.
// Mirrors the limit enforced on the web ApplyLeavePage.tsx file input.
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — keep in sync with backend multer limit
const MAX_DIMENSION = 1600; // long-edge resize target; big win for iPhone photos

async function compressImageForUpload(uri: string): Promise<{ uri: string; size: number }> {
  let quality = 0.8;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  let fileInfo = await FileSystem.getInfoAsync(result.uri);

  // If still too big after resize, keep lowering JPEG quality.
  while (
    fileInfo.exists &&
    fileInfo.size &&
    fileInfo.size > MAX_FILE_SIZE_BYTES &&
    quality > 0.3
  ) {
    quality -= 0.15;
    result = await ImageManipulator.manipulateAsync(
      result.uri,
      [],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    fileInfo = await FileSystem.getInfoAsync(result.uri);
  }

  return {
    uri: result.uri,
    size: fileInfo.exists && fileInfo.size ? fileInfo.size : 0,
  };
}

const LEAVE_GROUPS = [
  {
    label: 'Regular Leave',
    items: ['Vacation Leave', 'Mandatory/Forced Leave', 'Sick Leave', 'Special Privilege Leave'],
  },
  {
    label: 'Special Leave',
    items: ['Maternity Leave', 'Paternity Leave', 'Solo Parent Leave', 'Study Leave', 'VAWC Leave', 'Rehabilitation Leave', 'Special Emergency Leave', 'Adoption Leave', 'Calamity Leave'],
  },
  {
    label: 'Other',
    items: ['Terminal Leave', 'Other'],
  },
];

// ---------------------------------------------------------------------------
// Short "at a glance" duration/notice label shown beside each leave type in
// the dropdown, so users don't have to open a type first to learn its limit.
// ---------------------------------------------------------------------------
const LEAVE_TYPE_DURATION_LABELS: Record<string, string> = {
  'Vacation Leave': '5 days notice',
  'Sick Leave': 'upon return',
  'Special Privilege Leave': '3 days',
  'Mandatory/Forced Leave': '5 days',
  'Maternity Leave': '105 days',
  'Paternity Leave': '7 days',
  'Solo Parent Leave': '7 days',
  'Study Leave': '6 months',
  'VAWC Leave': '10 days',
  'Rehabilitation Leave': '6 months',
  'Special Emergency Leave': '5 days',
  'Calamity Leave': '5 days',
  'Adoption Leave': '—',
  'Terminal Leave': '—',
  'Other': '—',
};

// ---------------------------------------------------------------------------
// CSC Omnibus Rules on Leave — per-leave-type date constraints.
// Same rules as the web ApplyLeavePage.tsx. Keyed by the display strings used
// in LEAVE_GROUPS above (mobile doesn't use the web's LeaveType enum).
// Each rule drives the Calendar's min/max date and the submit-time
// validation below. Types not listed fall back to `defaultRule`.
// ---------------------------------------------------------------------------
interface LeaveDateRule {
  /** Must be filed at least this many days before the start date. */
  minAdvanceDays?: number;
  /** Max days allowed. Counted in calendar days (end - start + 1) unless maxInWorkingDays is true. */
  maxDurationDays?: number;
  /** If true, maxDurationDays counts working days only (Sundays, and Saturdays for staff, are not counted). */
  maxInWorkingDays?: boolean;
  /** If true, start/end dates may fall in the past (filed upon/after return). */
  allowRetroactive?: boolean;
  /** Short helper text shown under the date picker for this leave type. */
  note: string;
}

const defaultRule: LeaveDateRule = {
  allowRetroactive: false,
  note: '',
};

const leaveDateRules: Record<string, LeaveDateRule> = {
  'Vacation Leave': {
    minAdvanceDays: 5,
    allowRetroactive: false,
    note: 'File at least 5 days before your start date, whenever possible.',
  },
  'Sick Leave': {
    allowRetroactive: true,
    note: 'File immediately upon your return, or in advance. A medical certificate is required if filed 5+ days in advance, or if the leave exceeds 5 days.',
  },
  'Special Privilege Leave': {
    minAdvanceDays: 7,
    maxDurationDays: 3,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'File at least 1 week before availment. Maximum of 3 working days.',
  },
  'Mandatory/Forced Leave': {
    maxDurationDays: 5,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'Mandatory 5-day annual vacation leave, scheduled within the year.',
  },
  'Maternity Leave': {
    maxDurationDays: 105,
    allowRetroactive: false,
    note: 'Up to 105 days. File in advance with proof of pregnancy (ultrasound/doctor\u2019s certificate).',
  },
  'Paternity Leave': {
    maxDurationDays: 7,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'Up to 7 working days. Requires proof of child\u2019s delivery (birth certificate, medical certificate, marriage contract).',
  },
  'Solo Parent Leave': {
    minAdvanceDays: 5,
    maxDurationDays: 7,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'File at least 5 days in advance, with updated Solo Parent ID. Up to 7 working days.',
  },
  'Study Leave': {
    maxDurationDays: 180,
    allowRetroactive: false,
    note: 'Up to 6 months, subject to agency requirements and an agency-employee contract.',
  },
  'VAWC Leave': {
    maxDurationDays: 10,
    maxInWorkingDays: true,
    allowRetroactive: true,
    note: 'Up to 10 working days. May be filed in advance or immediately upon your return.',
  },
  'Rehabilitation Leave': {
    maxDurationDays: 180,
    allowRetroactive: false,
    note: 'Up to 6 months. File within 1 week of the accident, unless a longer period is warranted.',
  },
  'Special Emergency Leave': {
    maxDurationDays: 5,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'Up to 5 working days (straight or staggered) within 30 days of the calamity.',
  },
  'Calamity Leave': {
    maxDurationDays: 5,
    maxInWorkingDays: true,
    allowRetroactive: false,
    note: 'Up to 5 working days (straight or staggered) within 30 days of the calamity.',
  },
  'Adoption Leave': {
    allowRetroactive: false,
    note: 'Requires an authenticated Pre-Adoptive Placement Authority (DSWD).',
  },
  'Terminal Leave': {
    allowRetroactive: false,
    note: 'Requires proof of resignation, retirement, or separation from service.',
  },
  'Other': {
    allowRetroactive: true,
    note: '',
  },
};

// Helper: format a Date object as YYYY-MM-DD (local, not UTC-shifted)
const toDateString = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Parses a yyyy-mm-dd string as a local-time Date (no UTC shift). */
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper: pretty display e.g. "Jul 14, 2026"
const prettyDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Adds `days` to a yyyy-mm-dd string and returns a yyyy-mm-dd string, entirely in local time. */
const addDaysToDateString = (dateStr: string, days: number) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

/**
 * Sundays are never working days. Saturdays are non-working for staff, but
 * count as working days for faculty (they have Friday/Saturday classes).
 */
const isWorkingDay = (date: Date, isFaculty: boolean): boolean => {
  const day = date.getDay();
  if (day === 0) return false;
  if (day === 6) return isFaculty;
  return true;
};

/** Counts working days between two yyyy-mm-dd strings, inclusive. */
const calculateWorkingDays = (startDateStr: string, endDateStr: string, isFaculty: boolean): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isWorkingDay(current, isFaculty)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

/** Returns the date (yyyy-mm-dd) of the Nth working day, counting `startStr` as day 1 if it is a working day. */
const nthWorkingDayFrom = (startStr: string, n: number, isFaculty: boolean): string => {
  const d = parseLocalDate(startStr);
  let count = isWorkingDay(d, isFaculty) ? 1 : 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d, isFaculty)) count++;
  }
  return toDateString(d);
};

/** Formats a number as pesos with two decimals, e.g. 719.23 -> "₱719.23". */
const formatPeso = (amount: number): string => {
  const fixed = (Number(amount) || 0).toFixed(2);
  const [whole, decimals] = fixed.split('.');
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`;
};

export default function ApplyLeaveScreen({ navigation }: any) {
  const { user } = useAuth();

  // Leave type starts unselected so Inclusive Dates only appear once the user
  // has actually made a choice (the date rules depend on the type).
  const [leaveType, setLeaveType] = useState('');
  const [otherLeaveType, setOtherLeaveType] = useState('');
  // Same values the web app sends ('within_ph' | 'abroad'). Only used for Vacation Leave.
  const [leaveLocation, setLeaveLocation] = useState<'within_ph' | 'abroad'>('within_ph');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [monetizeCredits, setMonetizeCredits] = useState(false);
  const [monetizationVlDays, setMonetizationVlDays] = useState('');
  const [monetizationSlDays, setMonetizationSlDays] = useState('');
  // Loaded from the profile on mount.
  const [balanceVl, setBalanceVl] = useState<number | null>(null);
  const [balanceSl, setBalanceSl] = useState<number | null>(null);
  const [monthlySalary, setMonthlySalary] = useState<number | null>(null);
  const [profileEmployeeType, setProfileEmployeeType] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  // True while picked photos are being resized/compressed, before they
  // land in `attachments`. Disables the upload box + shows a status line
  // so the user doesn't tap again mid-compress.
  const [compressing, setCompressing] = useState(false);

  // --- Calendar picker state ---
  // Which date field the calendar modal is picking for (null = closed).
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  // Faculty have Friday/Saturday classes, so Saturday counts as a working day for them.
  // The backend may label them 'faculty' or 'teaching'.
  const employeeTypeValue = (profileEmployeeType || (user as any)?.employeeType || '').toLowerCase();
  const isFaculty = employeeTypeValue === 'faculty' || employeeTypeValue === 'teaching';

  // CSC date rule for the currently selected leave type.
  const dateRule = leaveType ? (leaveDateRules[leaveType] ?? defaultRule) : defaultRule;

  // Built from local calendar fields (no UTC round-trip), so it can't
  // drift a day depending on timezone/time-of-day.
  const todayStr = toDateString(new Date());

  // Earliest selectable start date for this leave type.
  // Today is allowed; yesterday and earlier are blocked (unless the leave type
  // is filed upon/after return, e.g. Sick Leave).
  const minStartDate = dateRule.allowRetroactive
    ? undefined
    : dateRule.minAdvanceDays
      ? addDaysToDateString(todayStr, dateRule.minAdvanceDays)
      : todayStr;

  // Working days in the picked range (used for balance deduction).
  const numberOfDays = startDate && endDate ? calculateWorkingDays(startDate, endDate, isFaculty) : 0;
  const daysCount = numberOfDays > 0 ? String(numberOfDays) : '';

  // Inclusive calendar-day span (end - start + 1).
  const calendarDays = startDate && endDate
    ? Math.round((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / 86400000) + 1
    : 0;

  const isWeekendOnlyRange = !!startDate && !!endDate && numberOfDays === 0;

  // Days counted against this leave type's max duration (working days or calendar days).
  const countedDays = dateRule.maxInWorkingDays ? numberOfDays : calendarDays;
  const durationUnit = dateRule.maxInWorkingDays ? 'working' : 'calendar';

  // Last selectable end date for a given start date, if the leave type has a max duration.
  const getMaxEndDate = (start: string): string | undefined => {
    if (!dateRule.maxDurationDays || !start) return undefined;
    return dateRule.maxInWorkingDays
      ? nthWorkingDayFrom(start, dateRule.maxDurationDays, isFaculty)
      : addDaysToDateString(start, dateRule.maxDurationDays - 1);
  };

  // Clear the picked dates whenever the leave type changes so a stale
  // selection from a previous type (e.g. a 90-day range picked under
  // "Study Leave") can't linger as invalid under the newly selected type.
  useEffect(() => {
    setStartDate('');
    setEndDate('');
  }, [leaveType]);

  // Load the leave balances (for the VL/SL monetization limits), the employee
  // type (Saturday rule) and the monthly salary (monetization estimate).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.getProfile();
        if (cancelled || !res?.success || !res.profile) return;
        const p = res.profile;
        setBalanceVl(p.leave_balances?.vacation ?? null);
        setBalanceSl(p.leave_balances?.sick ?? null);
        setProfileEmployeeType(p.employee_type ?? '');

        let salary = Number(p.monthly_salary) || 0;
        if (!salary) {
          salary = (await profileAPI.getMonthlySalary(p.employee_id)) ?? 0;
        }
        if (!cancelled) setMonthlySalary(salary > 0 ? salary : null);
      } catch (error) {
        // Non-fatal — the form still works without the hints/estimate.
        console.log('Could not load profile for Apply Leave:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------------------------------------------------------------------------
  // Monetization estimate — MSU HRDO / CSC-DBM formula:
  //   Salary x No. of days to be monetized x 0.0481927
  // Same helper as the web app (salary-utils), so both match.
  // ---------------------------------------------------------------------------
  const hasSalaryData = !!monthlySalary && monthlySalary > 0;
  const vlDays = parseFloat(monetizationVlDays) || 0;
  const slDays = parseFloat(monetizationSlDays) || 0;
  const totalMonetizationDays = monetizeCredits ? vlDays + slDays : 0;
  const estimatedAmount = totalMonetizationDays > 0
    ? computeMonetizationValue(monthlySalary, totalMonetizationDays)
    : 0;

  const handleSelectLeaveType = (type: string) => {
    setLeaveType(type);
    setOtherLeaveType('');
    setDropdownVisible(false);
  };

  // --- Calendar picker handlers (one date at a time, same as the web app) ---
  const openStartPicker = () => setPickerTarget('start');
  const openEndPicker = () => setPickerTarget('end');
  const closePicker = () => setPickerTarget(null);

  // When the start date changes, drop the end date if it no longer fits
  // (before the new start, or beyond the max duration for this leave type).
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate) {
      const newMaxEnd = getMaxEndDate(value);
      if (endDate < value || (newMaxEnd && endDate > newMaxEnd)) {
        setEndDate('');
      }
    }
  };

  const handleDayPress = (day: DateData) => {
    if (pickerTarget === 'start') {
      handleStartDateChange(day.dateString);
    } else if (pickerTarget === 'end') {
      setEndDate(day.dateString);
    }
    closePicker();
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    const selected = pickerTarget === 'start' ? startDate : pickerTarget === 'end' ? endDate : '';
    if (selected) {
      marks[selected] = { selected: true, selectedColor: PRIMARY, selectedTextColor: '#fff' };
    }
    return marks;
  };

  const handlePickFiles = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Please allow access to your photos in Settings' });
        return;
      }
      if (attachments.length >= 5) {
        Toast.show({ type: 'error', text1: 'Too Many Files', text2: 'Maximum 5 files allowed' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1, // grab full quality here — we compress ourselves right after
        selectionLimit: 5 - attachments.length,
      });
      if (result.canceled || !result.assets) return;

      if (attachments.length + result.assets.length > 5) {
        Toast.show({ type: 'error', text1: 'Too Many Files', text2: 'Maximum 5 files allowed' });
        return;
      }

      // Compress each picked photo (resize + re-encode) so none exceed the
      // backend's 5MB limit — iPhone photos especially can start well above that.
      setCompressing(true);
      try {
        const compressedFiles = await Promise.all(
          result.assets.map(async (asset) => {
            const { uri, size } = await compressImageForUpload(asset.uri);
            return {
              uri,
              name: asset.fileName || `photo_${Date.now()}.jpg`,
              size,
              mimeType: 'image/jpeg', // compression always re-encodes to JPEG
            };
          })
        );
        setAttachments(prev => [...prev, ...compressedFiles]);
        Toast.show({ type: 'success', text1: 'Photos Added', text2: `${compressedFiles.length} photo(s) added` });
      } catch (compressError) {
        console.log('Compression error:', compressError);
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to process photo(s). Please try again.' });
      } finally {
        setCompressing(false);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open photo library' });
      setCompressing(false);
    }
  };

  const validateForm = (): boolean => {
    if (!leaveType) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please select a leave type' }); return false; }
    if (!startDate) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please select a start date' }); return false; }
    if (!endDate) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please select an end date' }); return false; }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) { Toast.show({ type: 'error', text1: 'Invalid Date', text2: 'Please select valid dates' }); return false; }
    if (end < start) { Toast.show({ type: 'error', text1: 'Invalid Date Range', text2: 'End date must be after start date' }); return false; }

    // Start and end dates must fall on a working day
    if (!isWorkingDay(start, isFaculty) || !isWorkingDay(end, isFaculty)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Date Selected',
        text2: isFaculty
          ? 'Sundays are non-working days. Please choose a different date.'
          : 'Saturdays and Sundays are non-working days. Please choose a different date.',
      });
      return false;
    }

    if (numberOfDays <= 0) {
      Toast.show({
        type: 'error',
        text1: 'No Working Days',
        text2: 'Selected dates contain no working days. Please choose a different range.',
      });
      return false;
    }

    if (!reason.trim()) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please enter reason for leave' }); return false; }
    if (leaveType === 'Other' && !otherLeaveType.trim()) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please specify the leave type' }); return false; }

    // CSC advance-notice check (skip for leave types filed upon/after return)
    if (!dateRule.allowRetroactive && minStartDate && startDate < minStartDate) {
      Toast.show({
        type: 'error',
        text1: 'Advance Notice Required',
        text2: dateRule.minAdvanceDays
          ? `${leaveType} must be filed at least ${dateRule.minAdvanceDays} day(s) before the start date.`
          : `${leaveType} cannot be backdated.`,
      });
      return false;
    }

    // CSC max-duration check
    if (dateRule.maxDurationDays && countedDays > dateRule.maxDurationDays) {
      Toast.show({
        type: 'error',
        text1: 'Duration Exceeds Limit',
        text2: `${leaveType} is limited to ${dateRule.maxDurationDays} ${dateRule.maxInWorkingDays ? 'working ' : ''}day(s). You selected ${countedDays}.`,
      });
      return false;
    }

    // Validate the VL / SL days to monetize (both may be monetized)
    if (monetizeCredits) {
      if (vlDays < 0 || slDays < 0 || vlDays + slDays <= 0) {
        Toast.show({ type: 'error', text1: 'Invalid Days', text2: 'Enter the number of VL or SL days to monetize' });
        return false;
      }
      if (balanceVl !== null && vlDays > balanceVl) {
        Toast.show({ type: 'error', text1: 'Not Enough Vacation Leave Credits', text2: `You can monetize at most ${balanceVl.toFixed(2)} VL day(s).` });
        return false;
      }
      if (balanceSl !== null && slDays > balanceSl) {
        Toast.show({ type: 'error', text1: 'Not Enough Sick Leave Credits', text2: `You can monetize at most ${balanceSl.toFixed(2)} SL day(s).` });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const finalLeaveType = leaveType === 'Other' ? otherLeaveType : leaveType;

      const response = await leaveRequestAPI.applyLeave({
        leave_type: finalLeaveType,
        leave_location: leaveLocation,
        date_from: startDate,
        date_to: endDate,
        days_count: numberOfDays,
        reason: reason.trim(),
        monetize_credits: monetizeCredits,
        monetize_days: monetizeCredits ? totalMonetizationDays : undefined,
        monetization_vl_days: monetizeCredits ? vlDays : 0,
        monetization_sl_days: monetizeCredits ? slDays : 0,
        commutation_requested: false,
        attachments: attachments.map(file => ({
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        })),
      });

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success!', text2: 'Leave application submitted' });
        setLeaveType('');
        setLeaveLocation('within_ph');
        setOtherLeaveType('');
        setStartDate('');
        setEndDate('');
        setReason('');
        setMonetizeCredits(false);
        setMonetizationVlDays('');
        setMonetizationSlDays('');
        setAttachments([]);
        setTimeout(() => navigation.navigate('Main'), 1500);
      } else {
        Toast.show({ type: 'error', text1: 'Submission Failed', text2: response.message || 'Please try again' });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to submit application' });
    } finally {
      setLoading(false);
    }
  };

  // Calendar bounds for whichever field is open. Sundays (and Saturdays for staff) can't be tapped.
  // The End Date can't be before the Start Date, and is capped by the leave type's max duration.
  const minEndDate = startDate || minStartDate;
  const maxEndDate = getMaxEndDate(startDate);
  const calendarMinDate = pickerTarget === 'end' ? minEndDate : minStartDate;
  const calendarMaxDate = pickerTarget === 'end' ? maxEndDate : undefined;
  const calendarCurrent = pickerTarget === 'end'
    ? (endDate || startDate || minStartDate)
    : (startDate || minStartDate);
  const disabledDaysIndexes = isFaculty ? [0] : [0, 6];

  return (
    <ScrollView style={styles.container}>

      {/* Leave Type Dropdown Modal */}
      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Leave Type</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LEAVE_GROUPS}
              keyExtractor={(item) => item.label}
              renderItem={({ item: group }) => (
                <View>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupLabel}>{group.label}</Text>
                  </View>
                  {group.items.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.dropdownItem, leaveType === type && styles.dropdownItemSelected]}
                      onPress={() => handleSelectLeaveType(type)}
                    >
                      <View style={styles.dropdownItemTextRow}>
                        <Text style={[styles.dropdownItemText, leaveType === type && styles.dropdownItemTextSelected]}>{type}</Text>
                        <Text style={styles.dropdownItemDuration}>{LEAVE_TYPE_DURATION_LABELS[type]}</Text>
                      </View>
                      {leaveType === type && <Feather name="check" size={16} color={PRIMARY} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modal — picks one date at a time (Start Date or End Date), same as the web app */}
      <Modal visible={pickerTarget !== null} transparent animationType="fade" onRequestClose={closePicker}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closePicker}>
          <TouchableOpacity activeOpacity={1} style={styles.calendarModalBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTarget === 'end' ? 'Select End Date' : 'Select Start Date'}</Text>
              <TouchableOpacity onPress={closePicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {dateRule.note ? (
              <Text style={styles.calendarRuleNote}>{dateRule.note}</Text>
            ) : null}
            <Text style={styles.calendarRuleNote}>
              {isFaculty
                ? 'Sundays are non-working days and cannot be selected.'
                : 'Saturdays and Sundays are non-working days and cannot be selected.'}
            </Text>

            <Calendar
              current={calendarCurrent || undefined}
              minDate={calendarMinDate}
              maxDate={calendarMaxDate}
              disabledDaysIndexes={disabledDaysIndexes}
              disableAllTouchEventsForDisabledDays
              onDayPress={handleDayPress}
              markedDates={getMarkedDates()}
              theme={{
                todayTextColor: PRIMARY,
                arrowColor: PRIMARY,
                selectedDayBackgroundColor: PRIMARY,
                dotColor: PRIMARY,
                textDayFontWeight: '500',
                textMonthFontWeight: '700',
              }}
              style={styles.calendar}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Main Form Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Leave Information</Text>

        {/* Leave Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Leave Type *</Text>
          <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setDropdownVisible(true)} disabled={loading}>
            <Text style={[styles.dropdownTriggerText, !leaveType && { color: '#aaa' }]}>
              {leaveType || 'Select a leave type'}
            </Text>
            <Feather name="chevron-down" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Other Leave Type */}
        {leaveType === 'Other' && (
          <View style={styles.otherBox}>
            <Text style={styles.label}>Please Specify Leave Type *</Text>
            <RNTextInput
              style={styles.otherInput}
              placeholder="Enter the specific type of leave"
              placeholderTextColor="#aaa"
              value={otherLeaveType}
              onChangeText={setOtherLeaveType}
            />
            <Text style={styles.helperText}>Please provide details about the type of leave you are applying for.</Text>
          </View>
        )}

        {/* Leave Location — Vacation Leave only (same as the web app) */}
        {leaveType === 'Vacation Leave' && (
          <View style={styles.field}>
            <Text style={styles.label}>Leave Location *</Text>
            <TouchableOpacity style={styles.radioRow} onPress={() => setLeaveLocation('within_ph')} disabled={loading}>
              <View style={[styles.radio, leaveLocation === 'within_ph' && styles.radioSelected]}>
                {leaveLocation === 'within_ph' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioLabel}>Within Philippines</Text>
              {leaveLocation === 'within_ph' && (
                <View style={{ marginLeft: 'auto' }}>
                  <Feather name="check" size={16} color={PRIMARY} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.radioRow} onPress={() => setLeaveLocation('abroad')} disabled={loading}>
              <View style={[styles.radio, leaveLocation === 'abroad' && styles.radioSelected]}>
                {leaveLocation === 'abroad' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioLabel}>Abroad</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Inclusive Dates — Start Date and End Date as two separate fields (same as the web app).
            Only shown once a leave type has been picked, since the rules depend on it. */}
        {leaveType ? (
          <View style={styles.field}>
            <Text style={styles.label}>Inclusive Dates *</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <Text style={styles.dateSubLabel}>Start Date</Text>
                <TouchableOpacity style={styles.dateTrigger} onPress={openStartPicker} disabled={loading}>
                  <Feather name="calendar" size={16} color={PRIMARY} />
                  <Text
                    style={[styles.dateTriggerText, !startDate && { color: '#aaa' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {startDate ? prettyDate(startDate) : 'Pick a date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateCol}>
                <Text style={styles.dateSubLabel}>End Date</Text>
                <TouchableOpacity style={styles.dateTrigger} onPress={openEndPicker} disabled={loading}>
                  <Feather name="calendar" size={16} color={PRIMARY} />
                  <Text
                    style={[styles.dateTriggerText, !endDate && { color: '#aaa' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {endDate ? prettyDate(endDate) : 'Pick a date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {dateRule.note ? (
              <Text style={styles.helperText}>{dateRule.note}</Text>
            ) : null}
            <Text style={styles.helperText}>
              {isFaculty
                ? 'Sundays are non-working days and cannot be selected.'
                : 'Saturdays and Sundays are non-working days and cannot be selected.'}
            </Text>
            {startDate && endDate && dateRule.maxDurationDays ? (
              <Text style={styles.helperText}>
                {countedDays}/{dateRule.maxDurationDays} {durationUnit} days used
              </Text>
            ) : null}
            {isWeekendOnlyRange ? (
              <Text style={styles.warningText}>Selected dates fall on non-working days — no working days in this range</Text>
            ) : null}
          </View>
        ) : null}

        {/* Working Days */}
        {leaveType ? (
          <View style={styles.field}>
            <Text style={styles.label}>Number of Working Days *</Text>
            <RNTextInput
              style={[styles.input, { color: daysCount ? PRIMARY : '#aaa' }]}
              placeholder="Auto-calculated from dates"
              placeholderTextColor="#aaa"
              value={daysCount ? `${daysCount} day(s)` : ''}
              editable={false}
            />
          </View>
        ) : null}

        {/* Reason */}
        <View style={styles.field}>
          <Text style={styles.label}>Reason for Leave *</Text>
          <RNTextInput
            style={[styles.input, styles.textarea]}
            placeholder="Enter reason for leave"
            placeholderTextColor="#aaa"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        {/* Monetization */}
        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => {
              const next = !monetizeCredits;
              setMonetizeCredits(next);
              if (!next) {
                setMonetizationVlDays('');
                setMonetizationSlDays('');
              }
            }}
            disabled={loading}
          >
            <View style={[styles.checkbox, monetizeCredits && styles.checkboxChecked]}>
              {monetizeCredits && <Feather name="check" size={12} color="#fff" />}
            </View>
            <Text style={styles.checkLabel}>I want to monetize my leave credits</Text>
          </TouchableOpacity>

          {monetizeCredits && (
            <View style={styles.monetizeBox}>
              <Text style={styles.monetizeNotice}>
                Monetization of leave credits is subject to availability of funds and approval by the agency head.
              </Text>

              <View style={styles.monetizeRow}>
                <View style={styles.monetizeCol}>
                  <Text style={styles.label} numberOfLines={2}>{'Vacation Leave\n(VL) days'}</Text>
                  <RNTextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#aaa"
                    value={monetizationVlDays}
                    onChangeText={setMonetizationVlDays}
                    editable={!loading}
                  />
                  <Text style={styles.helperText}>
                    Maximum: {balanceVl !== null ? balanceVl.toFixed(2) : '0.00'} VL days
                  </Text>
                </View>
                <View style={styles.monetizeCol}>
                  <Text style={styles.label} numberOfLines={2}>{'Sick Leave\n(SL) days'}</Text>
                  <RNTextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#aaa"
                    value={monetizationSlDays}
                    onChangeText={setMonetizationSlDays}
                    editable={!loading}
                  />
                  <Text style={styles.helperText}>
                    Maximum: {balanceSl !== null ? balanceSl.toFixed(2) : '0.00'} SL days
                  </Text>
                </View>
              </View>

              {totalMonetizationDays > 0 && (
                <View style={styles.monetizeSummary}>
                  <View style={styles.monetizeSummaryRow}>
                    <Text style={styles.monetizeSummaryLabel}>Salary / Month:</Text>
                    <Text style={styles.monetizeSummaryValue}>
                      {hasSalaryData ? formatPeso(monthlySalary as number) : '—'}
                    </Text>
                  </View>
                  <View style={styles.monetizeSummaryRow}>
                    <Text style={styles.monetizeSummaryLabel}>Days (VL {vlDays} + SL {slDays}):</Text>
                    <Text style={styles.monetizeSummaryValue}>{totalMonetizationDays}</Text>
                  </View>
                  <View style={styles.monetizeSummaryRow}>
                    <Text style={styles.monetizeSummaryLabel}>Constant Factor (CF):</Text>
                    <Text style={styles.monetizeSummaryValue}>{MONETIZATION_CF}</Text>
                  </View>
                  <View style={[styles.monetizeSummaryRow, styles.monetizeSummaryTotalRow]}>
                    <Text style={styles.monetizeSummaryTotalLabel}>Estimated Amount:</Text>
                    <Text style={styles.monetizeSummaryTotalValue}>{formatPeso(estimatedAmount)}</Text>
                  </View>
                  <Text style={styles.monetizeCalcText}>
                    Formula: Salary × No. of days × CF = {hasSalaryData ? formatPeso(monthlySalary as number) : '—'} × {totalMonetizationDays} × {MONETIZATION_CF}
                  </Text>
                  <Text style={styles.helperText}>*Subject to final computation and fund availability</Text>
                  {!hasSalaryData && (
                    <Text style={styles.warningText}>
                      Your monthly salary is not on file yet, so no estimate can be shown. HR will compute the final amount.
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Attachments */}
        <View style={styles.field}>
          <Text style={styles.label}>Attachment (Optional)</Text>
          <Text style={styles.helperText}>Attach proof documents e.g. medical certificate, clearance · {attachments.length}/5 files</Text>
          <TouchableOpacity
            style={[styles.uploadBox, compressing && { opacity: 0.6 }]}
            onPress={handlePickFiles}
            disabled={loading || compressing || attachments.length >= 5}
          >
            {compressing ? (
              <>
                <ActivityIndicator color={PRIMARY} size="small" />
                <Text style={[styles.helperText, { marginTop: 6 }]}>Compressing photo(s)…</Text>
              </>
            ) : (
              <>
                <Text style={{ fontWeight: '600', color: '#444' }}>Click to open File</Text>
                <Text style={styles.helperText}>Select from your album</Text>
              </>
            )}
          </TouchableOpacity>
          {attachments.length > 0 && (
            <View style={styles.previewGrid}>
              {attachments.map((file, i) => (
                <View key={i} style={styles.previewItem}>
                  <Image source={{ uri: file.uri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setAttachments(attachments.filter((_, idx) => idx !== i))}>
                    <Feather name="x" size={10} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.previewName} numberOfLines={1}>{file.name}</Text>
                  {file.size > 0 && (
                    <Text style={styles.previewSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Application</Text>}
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>• Leave applications are subject to approval</Text>
        <Text style={styles.infoText}>• Check your leave balance before applying</Text>
        <Text style={styles.infoText}>• Days are automatically calculated from date range</Text>
        <Text style={styles.infoText}>• You will receive notifications on approval status</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 16 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '80%', overflow: 'hidden' },
  calendarModalBox: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', paddingBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  groupHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: BORDER },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownItemSelected: { backgroundColor: `${PRIMARY}08` },
  dropdownItemTextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 8 },
  dropdownItemText: { fontSize: 15, color: '#374151' },
  dropdownItemTextSelected: { color: PRIMARY, fontWeight: '600' },
  dropdownItemDuration: { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  card: { backgroundColor: '#fff', borderRadius: 14, margin: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  helperText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  warningText: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '600' },
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#FEF2F2' },
  dropdownTriggerText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  otherBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#BFDBFE' },
  otherInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', backgroundColor: '#fff' },
  textarea: { height: 100, textAlignVertical: 'top' },
  // Date fields (each opens a single-date calendar modal) — Start Date / End Date side by side, like the web app
  dateRow: { flexDirection: 'row', gap: 12 },
  dateCol: { flex: 1 },
  dateSubLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  dateTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#fff' },
  dateTriggerText: { flex: 1, fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  calendar: { borderRadius: 12, marginHorizontal: 12 },
  calendarRuleNote: { fontSize: 11, color: '#9CA3AF', marginTop: 10, marginHorizontal: 16, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  radioLabel: { fontSize: 15, color: '#374151' },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkLabel: { fontSize: 14, color: '#374151', flex: 1 },
  monetizeBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginTop: 12 },
  monetizeNotice: { fontSize: 12, color: '#92400E', marginBottom: 12 },
  monetizeRow: { flexDirection: 'row', gap: 12 },
  monetizeCol: { flex: 1 },
  monetizeSummary: { backgroundColor: '#FDF1E7', borderRadius: 10, padding: 14, marginTop: 14 },
  monetizeSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  monetizeSummaryLabel: { fontSize: 13, color: '#6B7280', flexShrink: 1, paddingRight: 8 },
  monetizeSummaryValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  monetizeSummaryTotalRow: { borderTopWidth: 1, borderTopColor: '#E5D5C5', paddingTop: 8, marginTop: 4, marginBottom: 4 },
  monetizeSummaryTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  monetizeSummaryTotalValue: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  monetizeCalcText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  uploadBox: { borderWidth: 2, borderColor: BORDER, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 24, alignItems: 'center', marginTop: 8, backgroundColor: '#FAFAFA' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  previewItem: { width: '30%', position: 'relative' },
  previewImage: { width: '100%', height: 90, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  previewName: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' },
  previewSize: { fontSize: 9, color: '#9CA3AF', textAlign: 'center' },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoCard: { backgroundColor: '#F9FAFB', borderRadius: 14, margin: 16, marginTop: 0, padding: 16, borderWidth: 1, borderColor: BORDER },
  infoText: { fontSize: 12, color: '#6B7280', marginBottom: 5 },
});