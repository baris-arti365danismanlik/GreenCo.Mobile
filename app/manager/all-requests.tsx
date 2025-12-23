import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { ArrowLeft, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Request = {
    id: string;
    title: string;
    status: string;
    created_at: string;
    technical_service_types?: {
        name: string;
    } | null;
    projects_greenco?: {
        name: string;
    } | null;
    companies?: {
        name: string;
    } | null;
};

export default function AllRequests() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<Request[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadRequests();
        }, [])
    );

    const loadRequests = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user's managed projects
            const { data: managedProjects } = await supabase
                .from('project_managers')
                .select('project_id')
                .eq('manager_id', user.id);

            if (!managedProjects || managedProjects.length === 0) {
                setRequests([]);
                return;
            }

            const projectIds = managedProjects.map(pm => pm.project_id);

            if (projectIds.length === 0) {
                setRequests([]);
                return;
            }

            const { data, error } = await supabase
                .from('technical_service_requests')
                .select(`
          *,
          technical_service_types(name),
          projects_greenco(name),
          companies(name)
        `)
                .in('project_id', projectIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error loading requests:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            pending_review: 'İnceleme Bekliyor',
            info_needed: 'Bilgi Bekleniyor',
            bidding: 'Teklif Toplanıyor',
            awaiting_customer_decision: 'Karar Bekleniyor',
            awaiting_additional_info: 'Ek Bilgi Bekleniyor',
            diagnostic_in_progress: 'Tanı Yapılıyor',
            approved: 'Onaylandı',
            in_progress: 'Devam Ediyor',
            completed: 'Tamamlandı',
            cancelled: 'İptal Edildi',
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'awaiting_customer_decision':
                return { bg: '#fef3c7', text: '#f59e0b' };
            case 'awaiting_additional_info':
                return { bg: '#fee2e2', text: '#ef4444' };
            case 'diagnostic_in_progress':
                return { bg: '#e0e7ff', text: '#6366f1' };
            case 'bidding':
                return { bg: '#dbeafe', text: '#3b82f6' };
            case 'approved':
            case 'in_progress':
                return { bg: '#d1fae5', text: '#10b981' };
            case 'completed':
                return { bg: '#d1fae5', text: '#059669' };
            default:
                return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    const getStatusIcon = (status: string) => {
        const colors = getStatusColor(status);
        switch (status) {
            case 'awaiting_customer_decision':
                return <AlertCircle size={16} color={colors.text} />;
            case 'completed':
                return <CheckCircle size={16} color={colors.text} />;
            default:
                return <Clock size={16} color={colors.text} />;
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={24} color={COLORS.secondary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Tüm Talepler</Text>
                    <Text style={styles.headerSubtitle}>Tüm teknik servis talepleri</Text>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {requests.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FileText size={48} color={COLORS.textLight} />
                        <Text style={styles.emptyText}>Henüz teknik servis talebi yok</Text>
                    </View>
                ) : (
                    requests.map((request) => (
                        <TouchableOpacity
                            key={request.id}
                            style={styles.requestCard}
                            onPress={() => router.push({ pathname: '/manager/technical-request-detail', params: { id: request.id } })}
                        >
                            <View style={styles.requestHeader}>
                                <Text style={styles.requestTitle}>{request.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status).bg }]}>
                                    {getStatusIcon(request.status)}
                                    <Text style={[styles.statusText, { color: getStatusColor(request.status).text }]}>
                                        {getStatusLabel(request.status)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.requestMeta}>
                                <Text style={styles.metaLabel}>Firma:</Text>
                                <Text style={styles.metaValue}>{request.companies?.name || '-'}</Text>
                            </View>

                            <View style={styles.requestMeta}>
                                <Text style={styles.metaLabel}>Servis Tipi:</Text>
                                <Text style={styles.metaValue}>{request.technical_service_types?.name || '-'}</Text>
                            </View>

                            {request.projects_greenco && (
                                <View style={styles.requestMeta}>
                                    <Text style={styles.metaLabel}>Proje:</Text>
                                    <Text style={styles.metaValue}>{request.projects_greenco.name}</Text>
                                </View>
                            )}

                            <Text style={styles.dateText}>
                                {new Date(request.created_at).toLocaleDateString('tr-TR')}
                            </Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.textLight,
        marginTop: 12,
    },
    requestCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    requestTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    requestMeta: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    metaLabel: {
        fontSize: 14,
        color: COLORS.textLight,
        marginRight: 6,
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    dateText: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 8,
    },
});
