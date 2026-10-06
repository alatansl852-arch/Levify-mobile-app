import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert, Image, Modal, Linking, SafeAreaView,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import {
  leaveRequestAPI, LeaveApplication, AttachmentFile, getFileUrl,
} from '../../services/apiService';

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

const isImageFile = (file: AttachmentFile): boolean => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || file.path || '').toLowerCase();
  return type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/.test(name);
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function LeaveDetailsScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [application, setApplication] = useState<LeaveApplication | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  // In-app full-screen image viewer (no leaving the app / opening a browser).
  const [viewer, setViewer] = useState<{ uri: string; name: string } | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [cancelling, setCancelling]   = useState(false);

  useEffect(() => { loadDetails(); }, []);

  const loadDetails = async () => {
    try {
      const res = await leaveRequestAPI.getLeaveById(id);
      const app = res.leave ?? res;
      setApplication(app);
      loadAttachments(app);
    } catch (e) {
      console.error('Leave details error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAttachments = async (app: any) => {
    try {
      setLoadingFiles(true);
      const files = await leaveRequestAPI.getAttachments(id, app?.attachments);
      setAttachments(files);
    } finally {
      setLoadingFiles(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadDetails(); };

  const handleOpenFile = (file: AttachmentFile) => {
    const url = getFileUrl(file.path);
    if (isImageFile(file)) {
      setViewer({ uri: url, name: file.name });
    } else {
      // PDF / Word etc. can't be shown as a picture — hand them to the phone.
      Linking.openURL(url).catch(() =>
        Alert.alert('Error', 'Unable to open this file.')
      );
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Application',
      'Are you sure you want to cancel this leave application?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await leaveRequestAPI.cancelLeave(id);
              Alert.alert('Success', 'Leave application cancelled.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert('Error', 'Failed to cancel. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading details...</Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#666' }}>Application not found.</Text>
      </View>
    );
  }

  const s           = getStatus(application.status);
  const currentIdx  = STEP_STATUSES.indexOf(application.status);
  const isRejected  = application.status.includes('rejected');
  const isPending   = application.status === 'pending';
  const isCancelled = application.status === 'cancelled';

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {/* ── Status Header ── */}
        <View style={[styles.statusHeader, { backgroundColor: s.color + '15' }]}>
          <Text style={styles.appNumber}>{application.application_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: s.color + '25' }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
          <Text style={styles.submittedDate}>
            Submitted: {new Date(application.created_at).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </Text>
        </View>

        {/* ── Approval Chain ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Approval Progress</Text>
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
        </View>

        {/* ── Leave Details ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Leave Details</Text>

          <InfoRow label="Leave Type"  value={application.leave_type} />
          <InfoRow label="Date From"   value={new Date(application.date_from).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} />
          <InfoRow label="Date To"     value={new Date(application.date_to).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} />
          <InfoRow label="Days Count"  value={`${application.days_count} day(s)`} highlight />
          {application.reason ? (
            <InfoRow label="Reason" value={application.reason} />
          ) : null}
        </View>

        {/* ── Attachments ── */}
        {(loadingFiles || attachments.length > 0) && (
          <View style={styles.card}>
            <View style={styles.attachHeader}>
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Supporting Documents</Text>
              {attachments.length > 0 && (
                <Text style={styles.attachCount}>{attachments.length} file(s)</Text>
              )}
            </View>

            {loadingFiles ? (
              <View style={styles.attachLoading}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.attachLoadingText}>Loading attachments...</Text>
              </View>
            ) : (
              <View style={styles.attachGrid}>
                {attachments.map((file) => (
                  <AttachmentThumb
                    key={String(file.id)}
                    file={file}
                    onPress={() => handleOpenFile(file)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Approvals Remarks ── */}
        {application.approvals && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Approval Remarks</Text>

            {(['hr', 'ovcaa', 'ovcaf'] as const).map((level) => {
              const remarks = application.approvals?.[level]?.remarks;
              return (
                <View key={level} style={styles.remarkRow}>
                  <Text style={styles.remarkLevel}>{level.toUpperCase()}</Text>
                  <Text style={styles.remarkText}>
                    {remarks || <Text style={{ color: '#bbb' }}>No remarks yet</Text>}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Cancel Button ── */}
        {isPending && !isCancelled && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.cancelBtnText}>Cancel Application</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Full-screen image viewer ── */}
      <Modal
        visible={!!viewer}
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <SafeAreaView style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewer?.name}</Text>
            <TouchableOpacity
              style={styles.viewerClose}
              onPress={() => setViewer(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {viewer && (
            // Pinch-to-zoom works on iOS; on Android the image is shown fit-to-screen.
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.viewerScroll}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: viewer.uri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

function AttachmentThumb({ file, onPress }: { file: AttachmentFile; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  const showImage = isImageFile(file) && !failed;

  return (
    <TouchableOpacity style={styles.thumbWrap} activeOpacity={0.8} onPress={onPress}>
      {showImage ? (
        <Image
          source={{ uri: getFileUrl(file.path) }}
          style={styles.thumbImage}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.thumbFile}>
          <Feather name="file-text" size={32} color="#9CA3AF" />
          <Text style={styles.thumbFileHint}>Tap to open</Text>
        </View>
      )}
      <View style={styles.thumbInfo}>
        <Text style={styles.thumbName} numberOfLines={1}>{file.name}</Text>
        {file.size > 0 && <Text style={styles.thumbSize}>{formatFileSize(file.size)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: PRIMARY, fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statusHeader: {
    margin: 16, borderRadius: 14, padding: 16, alignItems: 'center',
  },
  appNumber:    { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  statusBadge:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 8 },
  statusText:   { fontSize: 13, fontWeight: '700' },
  submittedDate:{ fontSize: 12, color: '#888' },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: PRIMARY, marginBottom: 14 },

  chainRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  stepWrap:  { alignItems: 'center', width: 44 },
  stepDot:   { width: 22, height: 22, borderRadius: 11, marginBottom: 4, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  stepLine:  { flex: 1, height: 2, marginBottom: 14 },

  infoRow:   { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel: { fontSize: 13, color: '#888', width: 90 },
  infoValue: { fontSize: 13, color: '#333', flex: 1 },

  // Attachments
  attachHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  attachCount:       { fontSize: 12, color: '#9CA3AF' },
  attachLoading:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  attachLoadingText: { fontSize: 13, color: '#888' },
  attachGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap:         { width: '48%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  thumbImage:        { width: '100%', height: 120, backgroundColor: '#F3F4F6' },
  thumbFile:         { width: '100%', height: 120, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  thumbFileHint:     { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  thumbInfo:         { padding: 8 },
  thumbName:         { fontSize: 11, fontWeight: '600', color: '#374151' },
  thumbSize:         { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  // Full-screen viewer
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  viewerTitle:     { flex: 1, color: '#fff', fontSize: 14, marginRight: 12 },
  viewerClose:     { backgroundColor: PRIMARY, borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  viewerScroll:    { flexGrow: 1, justifyContent: 'center' },
  viewerImage:     { width: '100%', height: '100%', minHeight: 400 },

  remarkRow:    { marginBottom: 12 },
  remarkLevel:  { fontSize: 11, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  remarkText:   { fontSize: 13, color: '#444', lineHeight: 18 },

  cancelBtn:     { marginHorizontal: 16, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});