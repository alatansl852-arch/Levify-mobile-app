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
const OVER_CAP = '#F59E0B';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;

export default function LeaveBalanceScreen() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
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
  const total = vl + sl + spl + fl;
  const totalUsed = balance?.total_used  ?? 0;

  const leaveTypes = [
    { name: 'Vacation Leave',          sub: 'Earns 1.25 days/month', value: vl,  max: 60 },
    { name: 'Sick Leave',              sub: 'Earns 1.25 days/month', value: sl,  max: 60 },
    { name: 'Special Privilege Leave', sub: '3 days per year',        value: spl, max: 3  },
    { name: 'Forced Leave',            sub: '5 days per year',        value: fl,  max: 5  },
  ];

  const hasOverCap = leaveTypes.some(l => l.value > l.max);

  // ✅ FIXED: Available days = total - totalUsed
  const summaryCards = [
    { label: 'Total earned days', value: total.toFixed(2)                        },
    { label: 'Total used days',   value: totalUsed.toFixed(2)                   },
    { label: 'Available days',    value: (total - totalUsed).toFixed(2), accent: true },
    { label: 'Monthly accrual',   value: '2.50'                                 },
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

          {/* 4 Summary Cards */}
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

          {/* Over-cap warning */}
          {hasOverCap && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                ⚠️  You have leave days over the 60-day cap. Use them before they go to waste.
              </Text>
            </View>
          )}

          {/* Leave Credits Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leave Credits Details</Text>
            <Text style={styles.cardSub}>
              Breakdown of your leave credits by type (CSC Omnibus Rules on Leave)
            </Text>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { color: PRIMARY,   label: 'Used'      },
                { color: OVER_CAP,  label: 'Over cap'  },
                { color: '#F0F0F0', label: 'Remaining' },
              ].map((item, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {leaveTypes.map((leave, i) => {
              const isOver  = leave.value > leave.max;
              const isFull  = leave.value === leave.max;
              const pct     = Math.min((leave.value / leave.max) * 100, 100);
              const basePct = isOver ? (leave.max / leave.value) * 100 : pct;
              const overAmt = isOver ? (leave.value - leave.max).toFixed(2) : null;

              return (
                <View key={i} style={styles.leaveItem}>
                  <View style={styles.leaveRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.leaveNameRow}>
                        <Text style={styles.leaveName}>{leave.name}</Text>
                        {isOver && (
                          <View style={styles.badgeOver}>
                            <Text style={styles.badgeOverText}>+{overAmt} over cap</Text>
                          </View>
                        )}
                        {isFull && !isOver && (
                          <View style={styles.badgeFull}>
                            <Text style={styles.badgeFullText}>Full</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.leaveSub}>{leave.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.leaveValue}>{leave.value.toFixed(2)}</Text>
                      <Text style={styles.leaveMax}>of {leave.max} max days</Text>
                    </View>
                  </View>

                  <View style={styles.progressBg}>
                    {isOver ? (
                      <View style={{ flexDirection: 'row', height: '100%' }}>
                        <View style={[styles.progressFill, {
                          width: `${basePct}%`,
                          backgroundColor: PRIMARY,
                          borderTopRightRadius: 0,
                          borderBottomRightRadius: 0,
                        }]} />
                        <View style={[styles.progressFill, {
                          flex: 1,
                          backgroundColor: OVER_CAP,
                          borderTopLeftRadius: 0,
                          borderBottomLeftRadius: 0,
                        }]} />
                      </View>
                    ) : (
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: PRIMARY }]} />
                    )}
                  </View>

                  {isOver
                    ? <Text style={styles.overCapText}>+{overAmt} over {leave.max}-day cap</Text>
                    : <Text style={styles.pctText}>{pct.toFixed(0)}% of {leave.max} days</Text>
                  }
                </View>
              );
            })}
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

  /* ── 4 Summary Cards ── */
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

  /* ── Warning ── */
  warnBox: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#FCD34D',
  },
  warnText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

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
  cardSub:   { fontSize: 12, color: '#888', marginBottom: 12 },

  /* ── Legend ── */
  legend:     { flexDirection: 'row', gap: 14, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 2, borderWidth: 1, borderColor: '#ddd' },
  legendLabel:{ fontSize: 11, color: '#888' },

  /* ── Leave Items ── */
  leaveItem:   { marginBottom: 20 },
  leaveRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leaveNameRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  leaveName:   { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  leaveSub:    { fontSize: 12, color: '#888', marginTop: 2 },
  leaveValue:  { fontSize: 20, fontWeight: 'bold', color: PRIMARY },
  leaveMax:    { fontSize: 11, color: '#aaa' },

  badgeOver:     { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  badgeOverText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
  badgeFull:     { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  badgeFullText: { fontSize: 10, color: '#065F46', fontWeight: '600' },

  progressBg:   { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  overCapText:  { fontSize: 10, color: '#92400E', marginTop: 3, textAlign: 'right' },
  pctText:      { fontSize: 10, color: '#aaa',    marginTop: 3, textAlign: 'right' },
});