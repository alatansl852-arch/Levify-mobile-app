import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { profileAPI, UserProfile } from '../../services/apiService';

const PRIMARY = '#7C2D3A';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await profileAPI.getProfile();
      setProfile(res?.profile ?? null);
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text>No profile data available</Text>
      </View>
    );
  }

  const getRoleLabel = (role: string) => ({
    hr:       'HR OFFICER',
    ovcaa:    'OVCAA',
    ovcaf:    'OVCAF',
    admin:    'ADMINISTRATOR',
    employee: 'EMPLOYEE',
    faculty:  'FACULTY',
    staff:    'STAFF',
  }[role?.toLowerCase()] || role?.toUpperCase());

  const vl  = profile.leave_balances?.vacation          ?? 0;
  const sl  = profile.leave_balances?.sick              ?? 0;
  const spl = profile.leave_balances?.special_privilege ?? 0;
  const fl  = profile.leave_balances?.forced            ?? 0;

  return (
    <ScrollView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSub}>View and manage your account information</Text>
        <View style={styles.headerLine} />
      </View>

      {/* ── Avatar & basic info ── */}
      <View style={styles.card}>
        <View style={styles.avatarBox}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.name?.charAt(0) ?? 'U'}</Text>
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profilePosition}>{profile.position}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{getRoleLabel(profile.role)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Email:</Text>
          <Text style={styles.contactValue}>{profile.email}</Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Unit:</Text>
          <Text style={styles.contactValue}>{profile.department}</Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Employee ID:</Text>
          <Text style={styles.contactValue}>{profile.employee_id}</Text>
        </View>
      </View>

      {/* ── Personal Information ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        {[
          { label: 'Full Name',        value: profile.name            },
          { label: 'Email Address',    value: profile.email           },
          { label: 'Employee ID',      value: profile.employee_id     },
          { label: 'Unit / Department',value: profile.department      },
          { label: 'Position',         value: profile.position        },
          { label: 'Status',           value: profile.employment_type },
          { label: 'Salary Grade',     value: profile.salary_grade || 'N/A' },
        ].map((item, i) => (
          <View key={i} style={styles.infoItem}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <View style={styles.infoValueBox}>
              <Text style={styles.infoValue}>{item.value ?? '—'}</Text>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Profile information is managed by the Human Resource Management Office.
            To update your details, please contact HR.
          </Text>
        </View>
      </View>

      {/* ── Leave Balance ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Leave Balance</Text>
        <BalanceCard label="Vacation Leave"     value={vl.toFixed(2)}  />
        <BalanceCard label="Sick Leave"         value={sl.toFixed(2)}  />
        <BalanceCard label="Special Privilege"  value={spl.toFixed(2)} />
        <BalanceCard label="Forced Leave"       value={fl.toFixed(2)}  />
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Balance Card: maroon only ─────────────────────────────────────────────────

function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={styles.balanceValue}>{value}</Text>
      <Text style={styles.balanceSub}>days available</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: '#fff', padding: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  headerSub:   { fontSize: 13, color: '#888', marginTop: 2 },
  headerLine:  { height: 3, backgroundColor: PRIMARY, width: 40, marginTop: 10, borderRadius: 2 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    margin: 16, marginBottom: 8, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  avatarBox:       { alignItems: 'center', paddingVertical: 12 },
  avatar:          { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  avatarText:      { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  profileName:     { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginTop: 12 },
  profilePosition: { fontSize: 13, color: '#888', marginTop: 4 },
  roleBadge:       { marginTop: 8, backgroundColor: 'rgba(124,45,58,0.1)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleBadgeText:   { fontSize: 12, fontWeight: '700', color: PRIMARY },

  divider:      { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },
  contactRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  contactLabel: { fontSize: 13, color: '#888', width: 90 },
  contactValue: { fontSize: 13, color: '#1a1a1a', flex: 1 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  infoItem:     { marginBottom: 14 },
  infoLabel:    { fontSize: 12, color: '#888', marginBottom: 4 },
  infoValueBox: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12 },
  infoValue:    { fontSize: 14, color: '#1a1a1a' },
  noteBox:      { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginTop: 8 },
  noteText:     { fontSize: 12, color: '#888', lineHeight: 18 },

  // ── maroon balance cards ──
  balanceCard:  {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(124,45,58,0.07)',
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },
  balanceLabel: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  balanceValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4, color: PRIMARY },
  balanceSub:   { fontSize: 11, color: 'rgba(124,45,58,0.5)', marginTop: 2 },

  logoutBtn:  { backgroundColor: PRIMARY, margin: 16, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});