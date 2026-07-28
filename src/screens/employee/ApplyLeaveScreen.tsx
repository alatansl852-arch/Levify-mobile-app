import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, TextInput as RNTextInput, Image,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, DateData } from 'react-native-calendars';
import { useAuth } from '../../contexts/AuthContext';
import { leaveRequestAPI, profileAPI } from '../../services/apiService';
import Toast from 'react-native-toast-message';

const PRIMARY = '#7C2D3A';
const BORDER = '#E5E7EB';

// ⚠️ ASSUMPTION: fixed daily rate shown on the web version (₱500).
// If this should come from the employee's salary grade instead, replace
// this constant with a value pulled from the API.
const DAILY_RATE = 500;

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

// Helper: format a Date object as YYYY-MM-DD (local, not UTC-shifted)
const toDateString = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper: pretty display e.g. "Jul 14, 2026"
const prettyDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ApplyLeaveScreen({ navigation }: any) {
  const { user } = useAuth();

  const [leaveType, setLeaveType] = useState('Vacation Leave');
  const [otherLeaveType, setOtherLeaveType] = useState('');
  const [leaveLocation, setLeaveLocation] = useState<'within_philippines' | 'abroad'>('within_philippines');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [reason, setReason] = useState('');
  const [monetizeCredits, setMonetizeCredits] = useState(false);
  const [monetizeDays, setMonetizeDays] = useState('1');
  const [maxMonetizable, setMaxMonetizable] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // --- Calendar picker state ---
  const [calendarVisible, setCalendarVisible] = useState(false);
  // Draft values so the user can cancel without affecting the saved dates
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');

  useEffect(() => {
    if (startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          setDaysCount(diff.toString());
        }
      } catch {}
    } else {
      setDaysCount('');
    }
  }, [startDate, endDate]);

  // Fetch vacation leave balance to show "Maximum monetizable" when the
  // monetization panel is opened. Uses profileAPI.getProfile() since that's
  // where leave_balances.vacation already lives — no separate balance
  // endpoint exists on leaveRequestAPI.
  useEffect(() => {
    if (!monetizeCredits || maxMonetizable !== null) return;
    (async () => {
      try {
        const res = await profileAPI.getProfile();
        if (res?.success && res.profile?.leave_balances?.vacation != null) {
          setMaxMonetizable(res.profile.leave_balances.vacation);
        }
      } catch (error) {
        // Non-fatal — panel still works without the max-days hint.
        console.log('Could not fetch balance for monetization hint:', error);
      }
    })();
  }, [monetizeCredits]);

  const handleSelectLeaveType = (type: string) => {
    setLeaveType(type);
    setOtherLeaveType('');
    setDropdownVisible(false);
  };

  // --- Calendar picker handlers ---
  const openCalendar = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setCalendarVisible(true);
  };

  const handleDayPress = (day: DateData) => {
    const dateStr = day.dateString;
    // Start a fresh selection if none picked yet, or if a full range is
    // already picked (tapping again starts over).
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd('');
      return;
    }
    // We have a start but no end yet
    if (dateStr < draftStart) {
      // Tapped an earlier date — treat it as the new start
      setDraftStart(dateStr);
      setDraftEnd('');
    } else {
      setDraftEnd(dateStr);
    }
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (draftStart && !draftEnd) {
      marks[draftStart] = {
        startingDay: true,
        endingDay: true,
        color: PRIMARY,
        textColor: '#fff',
      };
    } else if (draftStart && draftEnd) {
      let current = new Date(draftStart + 'T00:00:00');
      const end = new Date(draftEnd + 'T00:00:00');
      while (current <= end) {
        const dateStr = toDateString(current);
        marks[dateStr] = {
          color: PRIMARY,
          textColor: '#fff',
          startingDay: dateStr === draftStart,
          endingDay: dateStr === draftEnd,
        };
        current.setDate(current.getDate() + 1);
      }
    }
    return marks;
  };

  const handleClearCalendar = () => {
    setDraftStart('');
    setDraftEnd('');
  };

  const handleConfirmCalendar = () => {
    if (!draftStart) {
      Toast.show({ type: 'error', text1: 'Missing Date', text2: 'Please select a start date' });
      return;
    }
    setStartDate(draftStart);
    setEndDate(draftEnd || draftStart);
    setCalendarVisible(false);
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
        quality: 0.8,
        selectionLimit: 5 - attachments.length,
      });
      if (!result.canceled && result.assets) {
        if (attachments.length + result.assets.length > 5) {
          Toast.show({ type: 'error', text1: 'Too Many Files', text2: 'Maximum 5 files allowed' });
          return;
        }
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          mimeType: asset.mimeType || 'image/jpeg',
        }));
        setAttachments([...attachments, ...newFiles]);
        Toast.show({ type: 'success', text1: 'Photos Added', text2: `${result.assets.length} photo(s) added` });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open photo library' });
    }
  };

  const validateForm = (): boolean => {
    if (!startDate) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please select a start date' }); return false; }
    if (!endDate) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please select an end date' }); return false; }
    if (!daysCount || parseInt(daysCount) <= 0) { Toast.show({ type: 'error', text1: 'Invalid Days', text2: 'Please select a valid date range' }); return false; }
    if (!reason.trim()) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please enter reason for leave' }); return false; }
    if (leaveType === 'Other' && !otherLeaveType.trim()) { Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please specify the leave type' }); return false; }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) { Toast.show({ type: 'error', text1: 'Invalid Date', text2: 'Please select valid dates' }); return false; }
    if (end < start) { Toast.show({ type: 'error', text1: 'Invalid Date Range', text2: 'End date must be after start date' }); return false; }
    if (monetizeCredits) {
      const days = parseInt(monetizeDays);
      if (!monetizeDays || isNaN(days) || days <= 0) {
        Toast.show({ type: 'error', text1: 'Invalid Days', text2: 'Enter a valid number of days to monetize' });
        return false;
      }
      if (maxMonetizable !== null && days > maxMonetizable) {
        Toast.show({ type: 'error', text1: 'Exceeds Balance', text2: `Maximum monetizable is ${maxMonetizable} day(s)` });
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
        date_from: startDate,
        date_to: endDate,
        days_count: parseInt(daysCount),
        reason: reason.trim(),
        monetize_credits: monetizeCredits,
        monetize_days: monetizeCredits ? parseInt(monetizeDays) : undefined,
        commutation_requested: false,
        attachments: attachments.map(file => ({
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        })),
      });

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success!', text2: 'Leave application submitted' });
        setLeaveType('Vacation Leave');
        setOtherLeaveType('');
        setStartDate('');
        setEndDate('');
        setDaysCount('');
        setReason('');
        setMonetizeCredits(false);
        setMonetizeDays('1');
        setMaxMonetizable(null);
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

  const monetizeDaysNum = parseInt(monetizeDays) || 0;
  const estimatedAmount = monetizeDaysNum * DAILY_RATE;

  return (
    <ScrollView style={styles.container}>

      {/* Leave Type Dropdown Modal */}
      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Leave Type</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
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
                      <Text style={[styles.dropdownItemText, leaveType === type && styles.dropdownItemTextSelected]}>{type}</Text>
                      {leaveType === type && <Text style={{ color: PRIMARY, fontWeight: 'bold' }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Date Range Modal */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCalendarVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calendarModalBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Leave Dates</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarRangeSummary}>
              <View style={styles.calendarRangeItem}>
                <Text style={styles.calendarRangeLabel}>Start</Text>
                <Text style={styles.calendarRangeValue}>{draftStart ? prettyDate(draftStart) : '—'}</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 16 }}>→</Text>
              <View style={styles.calendarRangeItem}>
                <Text style={styles.calendarRangeLabel}>End</Text>
                <Text style={styles.calendarRangeValue}>{draftEnd ? prettyDate(draftEnd) : '—'}</Text>
              </View>
            </View>

            <Calendar
              current={draftStart || undefined}
              minDate={toDateString(new Date())}
              onDayPress={handleDayPress}
              markingType="period"
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

            <View style={styles.calendarActions}>
              <TouchableOpacity style={styles.calendarClearBtn} onPress={handleClearCalendar}>
                <Text style={styles.calendarClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.calendarConfirmBtn} onPress={handleConfirmCalendar}>
                <Text style={styles.calendarConfirmText}>Confirm Dates</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.dropdownTriggerText}>{leaveType}</Text>
            <Text style={{ color: '#666', fontSize: 16 }}>▼</Text>
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

        {/* Leave Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Leave Location *</Text>
          <TouchableOpacity style={styles.radioRow} onPress={() => setLeaveLocation('within_philippines')} disabled={loading}>
            <View style={[styles.radio, leaveLocation === 'within_philippines' && styles.radioSelected]}>
              {leaveLocation === 'within_philippines' && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioLabel}>Within Philippines</Text>
            {leaveLocation === 'within_philippines' && <Text style={{ color: PRIMARY, marginLeft: 'auto', fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioRow} onPress={() => setLeaveLocation('abroad')} disabled={loading}>
            <View style={[styles.radio, leaveLocation === 'abroad' && styles.radioSelected]}>
              {leaveLocation === 'abroad' && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioLabel}>Abroad</Text>
          </TouchableOpacity>
        </View>

        {/* Inclusive Dates — now opens the calendar picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Inclusive Dates *</Text>
          <TouchableOpacity style={styles.dateTrigger} onPress={openCalendar} disabled={loading}>
            <Text style={{ fontSize: 16 }}>📅</Text>
            <Text style={[styles.dateTriggerText, !startDate && { color: '#aaa' }]}>
              {startDate && endDate
                ? `${prettyDate(startDate)}  →  ${prettyDate(endDate)}`
                : 'Select start and end date'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Working Days */}
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
          <TouchableOpacity style={styles.checkRow} onPress={() => setMonetizeCredits(!monetizeCredits)} disabled={loading}>
            <View style={[styles.checkbox, monetizeCredits && styles.checkboxChecked]}>
              {monetizeCredits && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>I want to monetize my leave credits</Text>
          </TouchableOpacity>

          {monetizeCredits && (
            <View style={styles.monetizeBox}>
              <Text style={styles.monetizeNotice}>
                Monetization of leave credits is subject to availability of funds and approval by the agency head.
              </Text>

              <Text style={[styles.label, { marginTop: 12 }]}>Number of Days to Monetize</Text>
              <RNTextInput
                style={styles.input}
                keyboardType="number-pad"
                value={monetizeDays}
                onChangeText={setMonetizeDays}
                editable={!loading}
              />
              {maxMonetizable !== null && (
                <Text style={styles.helperText}>Maximum monetizable: {maxMonetizable} vacation leave days</Text>
              )}

              <View style={styles.monetizeSummary}>
                <View style={styles.monetizeSummaryRow}>
                  <Text style={styles.monetizeSummaryLabel}>Daily Rate:</Text>
                  <Text style={styles.monetizeSummaryValue}>₱{DAILY_RATE.toLocaleString()}</Text>
                </View>
                <View style={styles.monetizeSummaryRow}>
                  <Text style={styles.monetizeSummaryLabel}>Days:</Text>
                  <Text style={styles.monetizeSummaryValue}>{monetizeDaysNum}</Text>
                </View>
                <View style={[styles.monetizeSummaryRow, styles.monetizeSummaryTotalRow]}>
                  <Text style={styles.monetizeSummaryTotalLabel}>Estimated Amount:</Text>
                  <Text style={styles.monetizeSummaryTotalValue}>₱{estimatedAmount.toLocaleString()}</Text>
                </View>
                <Text style={styles.monetizeCalcText}>
                  Calculation: {monetizeDaysNum} days × ₱{DAILY_RATE} = ₱{estimatedAmount.toLocaleString()}
                </Text>
                <Text style={styles.helperText}>*Subject to final computation and fund availability</Text>
              </View>
            </View>
          )}
        </View>

        {/* Attachments */}
        <View style={styles.field}>
          <Text style={styles.label}>Attachment (Optional)</Text>
          <Text style={styles.helperText}>Attach proof documents e.g. medical certificate, clearance · {attachments.length}/5 files</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={handlePickFiles} disabled={loading || attachments.length >= 5}>
            <Text style={{ fontWeight: '600', color: '#444' }}>Click to open File</Text>
            <Text style={styles.helperText}>Select from your album</Text>
          </TouchableOpacity>
          {attachments.length > 0 && (
            <View style={styles.previewGrid}>
              {attachments.map((file, i) => (
                <View key={i} style={styles.previewItem}>
                  <Image source={{ uri: file.uri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setAttachments(attachments.filter((_, idx) => idx !== i))}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.previewName} numberOfLines={1}>{file.name}</Text>
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
  dropdownItemText: { fontSize: 15, color: '#374151' },
  dropdownItemTextSelected: { color: PRIMARY, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, margin: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  helperText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#FEF2F2' },
  dropdownTriggerText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  otherBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#BFDBFE' },
  otherInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', backgroundColor: '#fff' },
  textarea: { height: 100, textAlignVertical: 'top' },
  // Date range trigger (opens calendar modal)
  dateTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fff' },
  dateTriggerText: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  calendar: { borderRadius: 12, marginHorizontal: 12 },
  calendarRangeSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 14, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 12, borderRadius: 10 },
  calendarRangeItem: { alignItems: 'center', minWidth: 90 },
  calendarRangeLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  calendarRangeValue: { fontSize: 14, color: PRIMARY, fontWeight: '700' },
  calendarActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  calendarClearBtn: { flex: 1, borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  calendarClearText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  calendarConfirmBtn: { flex: 2, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  calendarConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  monetizeNotice: { fontSize: 12, color: '#92400E' },
  monetizeSummary: { backgroundColor: '#FDF1E7', borderRadius: 10, padding: 14, marginTop: 14 },
  monetizeSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  monetizeSummaryLabel: { fontSize: 13, color: '#6B7280' },
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
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoCard: { backgroundColor: '#F9FAFB', borderRadius: 14, margin: 16, marginTop: 0, padding: 16, borderWidth: 1, borderColor: BORDER },
  infoText: { fontSize: 12, color: '#6B7280', marginBottom: 5 },
});