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

  return (
    <ScrollView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSub}>View and manage your account information</Text>
        <View style={styles.headerLine} />
      </View>

      {/* ── Avatar & role — just identity, no fields (those live in the card below) ── */}
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
      </View>

      {/* ── Profile Information — plain rows, not boxed inputs (nothing here is editable) ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        {[
          { label: 'Email',        value: profile.email           },
          { label: 'Employee ID',  value: profile.employee_id     },
          { label: 'Department',   value: profile.department      },
          { label: 'Position',     value: profile.position        },
          { label: 'Status',       value: profile.employment_type },
          { label: 'Salary Grade', value: profile.salary_grade ? `SG-${profile.salary_grade}` : 'N/A' },
        ].map((item, i) => (
          <View key={i} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{item.value ?? '—'}</Text>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Profile information is managed by the Human Resource Management Office.
            To update your details, please contact HR.
          </Text>
        </View>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
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

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 10 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '600', flexShrink: 1, marginLeft: 12, textAlign: 'right' },

  noteBox:  { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginTop: 12 },
  noteText: { fontSize: 12, color: '#888', lineHeight: 18 },

  logoutBtn:  { backgroundColor: PRIMARY, margin: 16, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});