import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, TextInput, Modal, ScrollView
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { leaveRequestAPI, notificationAPI, LeaveApplication } from '../../services/apiService';
import { useFocusEffect } from '@react-navigation/native';

const PRIMARY = '#7C2D3A';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:        { label: 'Pending',        color: '#F59E0B' },
  hr_approved:    { label: 'HR Approved',    color: '#3B82F6' },
  ovcaa_approved: { label: 'OVCAA Approved', color: '#8B5CF6' },
  approved:       { label: 'Final Approved', color: '#10B981' },
  rejected:       { label: 'Rejected',       color: '#EF4444' },
  hr_rejected:    { label: 'HR Rejected',    color: '#EF4444' },
  ovcaa_rejected: { label: 'OVCAA Rejected', color: '#EF4444' },
  ovcaf_rejected: { label: 'OVCAF Rejected', color: '#EF4444' },
  cancelled:      { label: 'Cancelled',      color: '#9CA3AF' },
};

const getStatus = (status: string) =>
  STATUS_MAP[status] || { label: status, color: '#6B7280' };

const APPROVAL_STEPS = [
  { key: 'pending',        label: 'Submit' },
  { key: 'hr_approved',    label: 'HR'     },
  { key: 'ovcaa_approved', label: 'OVCAA'  },
  { key: 'approved',       label: 'OVCAF'  },
];
const STEP_STATUSES = ['pending', 'hr_approved', 'ovcaa_approved', 'approved'];

export default function LeaveHistoryScreen({ navigation }: any) {
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [filtered, setFiltered]         = useState<LeaveApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useFocusEffect(
    useCallback(() => { loadApplications(); }, [])
  );

  useEffect(() => { applyFilter(); }, [applications, activeFilter, search]);

  const loadApplications = async () => {
    try {
      const data = await leaveRequestAPI.getMyApplications();
      setApplications(data);
    } catch (e) {
      console.error('History load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadApplications(); };

  const applyFilter = () => {
    let result = applications;
    if (activeFilter === 'pending') {
      result = result.filter(a => a.status === 'pending');
    } else if (activeFilter === 'approved') {
      result = result.filter(a =>
        a.status === 'approved' || a.status === 'hr_approved' || a.status === 'ovcaa_approved'
      );
    } else if (activeFilter === 'rejected') {
      result = result.filter(a => a.status.includes('rejected'));
    }
    if (search) {
      result = result.filter(a =>
        a.application_number.toLowerCase().includes(search.toLowerCase()) ||
        a.leave_type.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFiltered(result);
  };

  const approvedCount = applications.filter(a =>
    a.status === 'approved' || a.status === 'hr_approved' || a.status === 'ovcaa_approved'
  ).length;

  const filters = [
    { key: 'all',      label: `All (${applications.length})` },
    { key: 'pending',  label: `Pending (${applications.filter(a => a.status === 'pending').length})` },
    { key: 'approved', label: `Approved (${approvedCount})` },
    { key: 'rejected', label: `Rejected (${applications.filter(a => a.status.includes('rejected')).length})` },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search applications..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No Applications Found</Text>
          <Text style={styles.emptySub}>
            {search || activeFilter !== 'all'
              ? 'Try adjusting your filters or search'
              : "You haven't submitted any leave applications yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
          }
          renderItem={({ item }) => {
            const s = getStatus(item.status);
            const currentIdx = STEP_STATUSES.indexOf(item.status);
            const isRejected = item.status.includes('rejected');
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('LeaveDetails', { id: item.id })}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <Text style={styles.appNumber} numberOfLines={1}>{item.application_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: s.color + '22' }]}>
                    <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>

                {/* Approval chain */}
                <View style={styles.chainRow}>
                  {APPROVAL_STEPS.map((step, idx) => {
                    const isDone    = !isRejected && currentIdx >= idx;
                    const isCurrent = currentIdx === idx;
                    const dotColor  = isRejected && isCurrent ? '#EF4444'
                      : isDone ? '#10B981'
                      : isCurrent ? '#3B82F6'
                      : '#D1D5DB';
                    const lineColor = (!isRejected && currentIdx > idx) ? '#10B981' : '#E5E7EB';
                    return (
                      <React.Fragment key={step.key}>
                        <View style={styles.stepWrap}>
                          <View style={[styles.stepDot, { backgroundColor: dotColor }]}>
                            {isDone && !isCurrent && (
                              <Text style={styles.checkMark}>✓</Text>
                            )}
                          </View>
                          <Text style={[styles.stepLabel, isDone && { color: '#10B981' }]}>
                            {step.label}
                          </Text>
                        </View>
                        {idx < 3 && (
                          <View style={[styles.stepLine, { backgroundColor: lineColor }]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* Info rows */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type:</Text>
                  <Text style={styles.infoValue}>{item.leave_type}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(item.date_from).toLocaleDateString()} – {new Date(item.date_to).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Days:</Text>
                  <Text style={[styles.infoValue, { fontWeight: '700', color: '#1a1a1a' }]}>
                    {item.days_count} day(s)
                  </Text>
                </View>
                {item.reason ? (
                  <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F5F5' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a' },
  filterRow:   { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive:  { backgroundColor: PRIMARY + '15', borderColor: PRIMARY },
  filterLabel:       { fontSize: 12, color: '#666', fontWeight: '500' },
  filterLabelActive: { color: PRIMARY, fontWeight: '700' },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  appNumber:   { fontSize: 13, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  chainRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 12 },
  stepWrap:    { alignItems: 'center', width: 44 },
  stepDot:     { width: 22, height: 22, borderRadius: 11, marginBottom: 4, alignItems: 'center', justifyContent: 'center' },
  checkMark:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLabel:   { fontSize: 9, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  stepLine:    { flex: 1, height: 2, marginBottom: 14 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  infoLabel:   { fontSize: 13, color: '#888', width: 48 },
  infoValue:   { fontSize: 13, color: '#444', flex: 1 },
  reason:      { fontSize: 12, color: '#999', marginTop: 6 },
  emptyTitle:  { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});