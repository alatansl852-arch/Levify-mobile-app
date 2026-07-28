import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { notificationAPI, Notification } from '../../services/apiService';

const PRIMARY = '#7C2D3A';

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.notifications ?? []);
    } catch (e) {
      console.error('Notifications load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  };

  // ── Navigate based on notification type ──
  const handleNotificationPress = async (notif: Notification) => {
    // Mark as read first
    if (!notif.is_read) await handleMarkRead(notif.id);

    const type = notif.type?.toLowerCase() ?? '';

    // If it's related to a leave application → go to LeaveHistory
    if (
      type.includes('leave') ||
      type.includes('application') ||
      type.includes('approved') ||
      type.includes('rejected') ||
      type.includes('status') ||
      notif.application_number
    ) {
      navigation.navigate('Main', { screen: 'LeaveHistory' });
      return;
    }

    // Fallback: stay on notifications
  };

  const onRefresh = () => { setRefreshing(true); loadNotifications(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading notifications...</Text>
      </View>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
        {unreadCount > 0 && (
          <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
        )}
        <View style={styles.headerLine} />
      </View>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>You'll be notified when your leave status changes</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.item, !notif.is_read && styles.itemUnread]}
              onPress={() => handleNotificationPress(notif)}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.dot, { backgroundColor: notif.is_read ? '#D1D5DB' : PRIMARY }]} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, !notif.is_read && styles.itemTitleUnread]}>
                  {notif.title}
                </Text>
                <Text style={styles.itemMessage}>{notif.message}</Text>
                {notif.application_number && (
                  <Text style={styles.itemRef}>Ref: {notif.application_number}</Text>
                )}
                {notif.leave_status && (
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(notif.leave_status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(notif.leave_status) }]}>
                      {notif.leave_status.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.itemTime}>
                  {new Date(notif.created_at).toLocaleDateString('en-PH', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              {!notif.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Status color helper ──
function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('approved')) return '#10B981';
  if (s.includes('rejected')) return '#EF4444';
  if (s.includes('pending'))  return PRIMARY;
  return '#6B7280';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { backgroundColor: '#fff', padding: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 8 },
  markAllText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  unreadBadge: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginTop: 4 },
  headerLine: { height: 3, backgroundColor: PRIMARY, width: 40, marginTop: 10, borderRadius: 2 },

  emptyBox: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  emptySub: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },

  list: { paddingHorizontal: 16, paddingTop: 12 },
  item: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  itemUnread: { backgroundColor: '#FFF8F8', borderLeftWidth: 3, borderLeftColor: PRIMARY },
  itemLeft: { marginRight: 10, paddingTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  itemTitleUnread: { color: '#1a1a1a', fontWeight: '700' },
  itemMessage: { fontSize: 13, color: '#6B7280', marginTop: 3, lineHeight: 18 },
  itemRef: { fontSize: 11, color: PRIMARY, marginTop: 4, fontWeight: '600' },
  itemTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 4 },

  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
});