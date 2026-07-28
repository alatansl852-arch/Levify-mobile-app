import React, { useEffect, useState, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Dimensions, Animated, TouchableWithoutFeedback,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import {
  profileAPI, leaveRequestAPI,
  UserProfile, LeaveBalance, LeaveStatistics, LeaveApplication
} from '../../services/apiService';

const PRIMARY = '#7C2D3A';
const GRAY = '#6B7280';
const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:        { label: 'Pending',        color: PRIMARY   },
  hr_approved:    { label: 'HR Approved',    color: '#3B82F6' },
  ovcaa_approved: { label: 'OVCAA Approved', color: '#3B82F6' },
  approved:       { label: 'Approved',       color: '#10B981' },
  rejected:       { label: 'Rejected',       color: '#EF4444' },
  hr_rejected:    { label: 'HR Rejected',    color: '#EF4444' },
  ovcaa_rejected: { label: 'OVCAA Rejected', color: '#EF4444' },
};

const getStatus = (status: string) => STATUS_MAP[status] || { label: status, color: GRAY };

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [balance,    setBalance]    = useState<LeaveBalance | null>(null);
  const [statistics, setStatistics] = useState<LeaveStatistics | null>(null);
  const [recentApps, setRecentApps] = useState<LeaveApplication[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen,    setFabOpen]    = useState(false);

  const fabAnim     = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, stats, apps] = await Promise.all([
        profileAPI.getProfile().catch(() => null),
        leaveRequestAPI.getStatistics().catch(() => null),
        leaveRequestAPI.getMyApplications().catch(() => []),
      ]);

      // ── DEBUG LOGS (remove after fixing) ──────────────────────────────────
      console.log('📊 RAW stats:', JSON.stringify(stats));
      console.log('👤 RAW profile availed:', profileRes?.profile?.total_leave_availed);
      console.log('✅ Final totalAvailed:', stats?.total_leave_availed ?? profileRes?.profile?.total_leave_availed ?? 0);
      // ──────────────────────────────────────────────────────────────────────

      const profileData = profileRes?.profile ?? null;
      setProfile(profileData);
      if (profileData?.leave_balances) {
        const b = profileData.leave_balances;
        setBalance({
          vacation:          b.vacation,
          sick:              b.sick,
          special_privilege: b.special_privilege,
          forced:            b.forced,
          total:             b.vacation + b.sick + b.special_privilege + b.forced,
          total_used:        b.total_used,
        });
      }
      setStatistics(stats);
      setRecentApps(apps.slice(0, 3));
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const openFab = () => {
    setFabOpen(true);
    Animated.parallel([
      Animated.spring(fabAnim,     { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeFab = () => {
    Animated.parallel([
      Animated.spring(fabAnim,     { toValue: 0, useNativeDriver: true, friction: 6 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setFabOpen(false));
  };

  const toggleFab = () => { if (fabOpen) { closeFab(); } else { openFab(); } };

  const handleFabAction = (screen: string) => {
    closeFab();
    setTimeout(() => navigation.navigate(screen), 250);
  };

  const item1TranslateY = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const fabRotate       = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading dashboard...</Text>
      </View>
    );
  }

  const vl           = balance?.vacation          ?? 0;
  const sl           = balance?.sick              ?? 0;
  const spl          = balance?.special_privilege ?? 0;
  const fl           = balance?.forced            ?? 0;
  const totalUsed    = balance?.total_used        ?? 0;
  const pending      = statistics?.pending        ?? 0;
  const totalCredits = profile?.total_leave_credits ?? 0;
  const totalAvailed = statistics?.total_leave_availed ?? profile?.total_leave_availed ?? 0;
  const salaryGrade  = profile?.salary_grade        ?? 'N/A';
  const CARD_W       = (SCREEN_WIDTH - 32 - 12) / 2;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {/* ── Welcome Banner ── */}
        <View style={styles.banner}>
          <Text style={styles.bannerSub}>Welcome back,</Text>
          <Text style={styles.bannerName}>{profile?.name ?? user?.name ?? 'User'}</Text>
          <Text style={styles.bannerRole}>
            {profile?.position ?? user?.position} · {profile?.department ?? user?.department}
          </Text>
        </View>

        {/* ── Row 1 ── */}
        <View style={styles.row}>
          <StatCard label="VACATION LEAVE" value={vl.toFixed(2)} sub="days available" width={CARD_W} />
          <StatCard label="SICK LEAVE"     value={sl.toFixed(2)} sub="days available" width={CARD_W} />
        </View>

        {/* ── Row 2 ── */}
        <View style={styles.row}>
          <StatCard label="PENDING REQUESTS" value={String(pending)}   sub="awaiting approval" width={CARD_W} accent />
          <StatCard label="TOTAL USED"       value={String(totalUsed)} sub="days this year"    width={CARD_W} />
        </View>

        {/* ── Row 3 ── */}
        <View style={styles.row}>
          <SmallStatCard label="Total Leave Credits" value={totalCredits.toFixed(2)} sub="lifetime credits" />
          <SmallStatCard label="Total Leave Availed" value={totalAvailed.toFixed(2)} sub="used / monetized" accent />
          <SmallStatCard label="Salary Grade"        value={`SG-${salaryGrade}`}     sub="current grade" />
        </View>

        {/* ── Recent Applications ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Recent Applications</Text>
            {recentApps.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('LeaveHistory')}>
                <Text style={{ color: PRIMARY, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentApps.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ color: '#999', marginTop: 8 }}>No applications yet</Text>
            </View>
          ) : recentApps.map((app) => {
            const s = getStatus(app.status);
            return (
              <TouchableOpacity
                key={app.id}
                style={styles.appItem}
                onPress={() => navigation.navigate('LeaveDetails', { id: app.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14 }}>{app.application_number}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>{app.leave_type} · {app.days_count} day(s)</Text>
                  <Text style={{ color: '#999', fontSize: 12 }}>
                    {new Date(app.date_from).toLocaleDateString()} – {new Date(app.date_to).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: s.color + '20' }]}>
                  <Text style={{ color: s.color, fontWeight: '700', fontSize: 11 }}>{s.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Leave Balance Summary ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Leave Balance Summary</Text>
          <View style={styles.row}>
            <MiniCard label="Vacation Leave"    value={vl.toFixed(2)}  />
            <MiniCard label="Sick Leave"        value={sl.toFixed(2)}  />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <MiniCard label="Special Privilege" value={spl.toFixed(2)} />
            <MiniCard label="Forced Leave"      value={fl.toFixed(2)}  />
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Available</Text>
            <Text style={styles.totalValue}>{(vl + sl + spl + fl).toFixed(2)} days</Text>
          </View>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Total Leave Credits (Lifetime)</Text>
            <Text style={styles.subValue}>{totalCredits.toFixed(2)} days</Text>
          </View>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Total Leave Availed / Monetized</Text>
            <Text style={styles.subValue}>{totalAvailed.toFixed(2)} days</Text>
          </View>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Salary Grade</Text>
            <Text style={styles.subValue}>SG - {salaryGrade}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Overlay ── */}
      {fabOpen && (
        <TouchableWithoutFeedback onPress={closeFab}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      {/* ── FAB ── */}
      <View style={styles.fabContainer} pointerEvents="box-none">

        {/* Only item: Apply for Leave */}
        <Animated.View
          style={[styles.fabItem, { opacity: fabAnim, transform: [{ translateY: item1TranslateY }] }]}
          pointerEvents={fabOpen ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.fabItemRow}
            onPress={() => handleFabAction('ApplyLeave')}
            delayLongPress={2000}
            activeOpacity={0.7}
          >
            <View style={styles.fabLabel}>
              <Text style={styles.fabLabelText}>Apply for Leave</Text>
            </View>
            <View style={styles.fabMini}>
              <Text style={styles.fabMiniText}>+</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Main FAB Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={toggleFab}
          activeOpacity={0.85}
          delayLongPress={2000}
        >
          <Animated.Text style={[styles.fabIcon, { transform: [{ rotate: fabRotate }] }]}>+</Animated.Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, width, accent, muted }:
  { label: string; value: string; sub: string; width: number; accent?: boolean; muted?: boolean }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: muted ? '#9CA3AF' : PRIMARY, width }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: muted ? '#6B7280' : PRIMARY }]}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function SmallStatCard({ label, value, sub, accent, muted }:
  { label: string; value: string; sub: string; accent?: boolean; muted?: boolean }) {
  const color = muted ? '#6B7280' : PRIMARY;
  return (
    <View style={[styles.smallStatCard, { borderLeftColor: color }]}>
      <Text style={styles.smallStatLabel}>{label}</Text>
      <Text style={[styles.smallStatValue, { color }]}>{value}</Text>
      <Text style={styles.smallStatSub}>{sub}</Text>
    </View>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniSub}>days</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },

  banner:     { backgroundColor: PRIMARY, margin: 16, borderRadius: 16, padding: 20 },
  bannerSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  bannerName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  bannerRole: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  row: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },

  statCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  statSub:   { fontSize: 11, color: '#999', marginTop: 2 },

  smallStatCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderLeftWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  smallStatLabel: { fontSize: 9,  color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  smallStatValue: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  smallStatSub:   { fontSize: 9,  color: '#999', marginTop: 2 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle:  { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },

  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  appItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  badge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },

  miniCard:  { flex: 1, borderRadius: 12, padding: 14, backgroundColor: 'rgba(124,45,58,0.07)' },
  miniLabel: { fontSize: 11, color: PRIMARY },
  miniValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4, color: PRIMARY },
  miniSub:   { fontSize: 11, color: 'rgba(124,45,58,0.5)', marginTop: 2 },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 14, paddingTop: 14 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: PRIMARY },
  subRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  subLabel:   { fontSize: 12, color: '#888', flex: 1 },
  subValue:   { fontSize: 12, color: '#444', fontWeight: '600' },

  // ── FAB ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  fabContainer: {
    position: 'absolute', bottom: 24, right: 24,
    alignItems: 'flex-end', zIndex: 20,
  },
  fab: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  fabIcon: {
    color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 36, marginTop: -2,
  },
  fabItem: {
    position: 'absolute', bottom: 0, right: 0, alignItems: 'flex-end',
  },
  fabItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4,
  },
  fabLabel: {
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  fabLabelText: {
    fontSize: 15, fontWeight: '600', color: '#1a1a1a',
  },
  fabMini: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5,
  },
  fabMiniText: {
    color: '#fff', fontSize: 20, fontWeight: 'bold',
  },
});