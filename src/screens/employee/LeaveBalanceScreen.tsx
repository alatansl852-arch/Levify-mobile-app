import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { profileAPI, LeaveBalance } from '../../services/apiService';

const PRIMARY = '#7C2D3A';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;

// Whole numbers show without decimals (5), real fractions keep 2 decimals (5.50).
const formatWholeOrDecimal = (n: number): string => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

interface LeaveRow {
  name: string;
  sub: string;
  value: number;
  // accumulates = VL/SL: credits carry over with no maximum, so no bar is drawn.
  // Otherwise `max` is the annual limit (Special Privilege 3, Forced 5).
  accumulates: boolean;
  max: number;
}

export default function LeaveBalanceScreen() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [totalLeaveCredits, setTotalLeaveCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadBalance(); }, []);

  const loadBalance = async () => {
    try {
      const res = await profileAPI.getProfile();
      if (res?.profile?.leave_balances) {
        const b = res.profile.leave_balances;
        setBalance({
          vacation: b.vacation,
          sick: b.sick,
          special_privilege: b.special_privilege,
          forced: b.forced,
          total: b.vacation + b.sick + b.special_privilege + b.forced,
          total_used: b.total_used,
        });
      }
      // Lifetime credits are no longer shown as their own card,
      // but Available is still computed from them.
      setTotalLeaveCredits(res?.profile?.total_leave_credits ?? 0);
    } catch (e) {
      console.error('Balance load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadBalance(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: PRIMARY }}>Loading balance...</Text>
      </View>
    );
  }

  const vl  = balance?.vacation          ?? 0;
  const sl  = balance?.sick              ?? 0;
  const spl = balance?.special_privilege ?? 0;
  const fl  = balance?.forced            ?? 0;
  const totalAvailed = balance?.total_used ?? 0;
  const credits      = totalLeaveCredits   ?? 0;

  const leaveTypes: LeaveRow[] = [
    { name: 'Vacation Leave',          sub: 'Earns 1.25 days/month', value: vl,  accumulates: true,  max: 0 },
    { name: 'Sick Leave',              sub: 'Earns 1.25 days/month', value: sl,  accumulates: true,  max: 0 },
    { name: 'Special Privilege Leave', sub: '3 days per year',        value: spl, accumulates: false, max: 3 },
    { name: 'Forced Leave',            sub: '5 days per year',        value: fl,  accumulates: false, max: 5 },
  ];

  // 2 cards: Total availed + Available (Available = credits − availed)
  const summaryCards = [
    { label: 'Total availed',  value: formatWholeOrDecimal(totalAvailed)         },
    { label: 'Available days', value: (credits - totalAvailed).toFixed(2), accent: true },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* ── Maroon Header ── */}
        <View style={styles.maroonHeader}>
          <Text style={styles.headerTitle}>Leave Balance</Text>

          {/* 2 Summary Cards */}
          <View style={styles.summaryGrid}>
            {summaryCards.map((card, i) => (
              <View
                key={i}
                style={[
                  styles.summaryCard,
                  card.accent && styles.summaryCardAccent,
                  { width: CARD_WIDTH },
                ]}
              >
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Accrual Breakdown */}
          <Text style={styles.accrualHeading}>ACCRUAL BREAKDOWN</Text>
          <View style={styles.accrualRow}>
            <View style={styles.accrualPill}>
              <Text style={styles.accrualPillText}>+ VL 1.25/mo</Text>
            </View>
            <View style={styles.accrualPill}>
              <Text style={styles.accrualPillText}>+ SL 1.25/mo</Text>
            </View>
          </View>
        </View>

        {/* ── White Content Section ── */}
        <View style={styles.contentWrap}>

          {/* Leave Credits Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leave Credits Details</Text>
            <Text style={styles.cardSub}>
              Breakdown of your leave credits by type (CSC Omnibus Rules on Leave)
            </Text>

            {leaveTypes.map((leave, i) => {
              const isFull = !leave.accumulates && leave.value >= leave.max;
              const pct    = leave.accumulates ? 0 : Math.min((leave.value / leave.max) * 100, 100);

              return (
                <View key={i} style={styles.leaveItem}>
                  <View style={styles.leaveRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.leaveNameRow}>
                        <Text style={styles.leaveName}>{leave.name}</Text>
                        {isFull && (
                          <View style={styles.badgeFull}>
                            <Text style={styles.badgeFullText}>Full</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.leaveSub}>{leave.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.leaveValue}>{leave.value.toFixed(2)}</Text>
                      <Text style={styles.leaveMax}>
                        {leave.accumulates ? 'days accumulated' : `of ${leave.max} max days`}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar — only for leave types with an annual limit */}
                  {!leave.accumulates && (
                    <>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: PRIMARY }]} />
                      </View>
                      <Text style={styles.pctText}>{pct.toFixed(0)}% of {leave.max} days</Text>
                    </>
                  )}
                </View>
              );
            })}

            <Text style={styles.noteText}>
              Vacation and sick leave credits are cumulative and carry over each year.
              Monetization is subject to CSC rules and agency approval.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: PRIMARY },
  container: { flex: 1, backgroundColor: PRIMARY },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* ── Header ── */
  maroonHeader: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 18,
  },

  /* ── Summary Cards ── */
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    padding: 16,
  },
  summaryCardAccent: {
    backgroundColor: 'rgba(255,255,255,0.23)',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },

  /* ── Accrual ── */
  accrualHeading: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  accrualRow: { flexDirection: 'row', gap: 8 },
  accrualPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  accrualPillText: { color: '#fff', fontSize: 11 },

  /* ── White Section ── */
  contentWrap: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    marginTop: -2,
    flex: 1,
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: PRIMARY, marginBottom: 4 },
  cardSub:   { fontSize: 12, color: '#888', marginBottom: 16 },

  /* ── Leave Items ── */
  leaveItem:   { marginBottom: 20 },
  leaveRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leaveNameRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  leaveName:   { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  leaveSub:    { fontSize: 12, color: '#888', marginTop: 2 },
  leaveValue:  { fontSize: 20, fontWeight: 'bold', color: PRIMARY },
  leaveMax:    { fontSize: 11, color: '#aaa' },

  badgeFull:     { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  badgeFullText: { fontSize: 10, color: '#065F46', fontWeight: '600' },

  progressBg:   { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  pctText:      { fontSize: 10, color: '#aaa', marginTop: 3, textAlign: 'right' },

  noteText: { fontSize: 11, color: '#888', marginTop: 4, lineHeight: 16 },
});