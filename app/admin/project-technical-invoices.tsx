import { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, FileText, Calendar, DollarSign, Plus, Building2, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ProjectTechnicalInvoice = {
    id: string;
    invoice_number: string;
    project_id: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    total_jobs: number;
    status: 'draft' | 'approved' | 'paid' | 'cancelled';
    created_at: string;
    projects_greenco: {
        name: string;
    } | null;
};

const STATUS_CONFIG = {
    draft: { label: 'Taslak', color: COLORS.textSecondary, icon: FileText },
    approved: { label: 'Faturalanmaya Hazır', color: COLORS.success, icon: CheckCircle },
    paid: { label: 'Ödendi', color: COLORS.primary, icon: CheckCircle },
    cancelled: { label: 'İptal', color: COLORS.error, icon: XCircle },
};

export default function AdminProjectTechnicalInvoicesScreen() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<ProjectTechnicalInvoice[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadInvoices();
        }, [])
    );

    const loadInvoices = async () => {
        try {
            if (invoices.length === 0) setLoading(true);

            const { data, error } = await supabase
                .from('project_technical_invoices')
                .select(`
          *,
          projects_greenco(name)
        `)
                .order('created_at', { ascending: false });

            if (data) {
                setInvoices(data);
            }
        } catch (error) {
            console.error('Veri çekme hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={COLORS.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Proje Teknik Hakedişleri</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/admin/create-project-technical-invoice')}
                >
                    <Plus size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={loadInvoices} />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : invoices.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FileText size={48} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>Henüz hakediş oluşturulmamış</Text>
                        <TouchableOpacity
                            style={styles.createFirstButton}
                            onPress={() => router.push('/admin/create-project-technical-invoice')}
                        >
                            <Text style={styles.createFirstButtonText}>İlk Hakedişi Oluştur</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    invoices.map((invoice) => {
                        const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                        const StatusIcon = statusConfig.icon;

                        return (
                            <TouchableOpacity
                                key={invoice.id}
                                style={styles.invoiceCard}
                                activeOpacity={1} // Disable visual feedback
                            // onPress={() => {
                            //     router.push(`/admin/project-technical-invoice-detail?id=${invoice.id}`);
                            // }}
                            >
                                <View style={styles.invoiceHeader}>
                                    <View style={styles.invoiceInfo}>
                                        <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                                        <View style={styles.projectRow}>
                                            <Building2 size={14} color={COLORS.textSecondary} />
                                            <Text style={styles.projectName}>
                                                {invoice.projects_greenco?.name || 'Proje'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                                        <StatusIcon size={14} color={statusConfig.color} />
                                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                            {statusConfig.label}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.invoiceDetails}>
                                    <View style={styles.detailRow}>
                                        <Calendar size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.detailText}>
                                            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                                        </Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <FileText size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.detailText}>{invoice.total_jobs} İş</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <DollarSign size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.amountText}>
                                            {invoice.total_amount?.toLocaleString('tr-TR', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}{' '}
                                            ₺
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
        marginLeft: 16,
    },
    addButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    createFirstButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    createFirstButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    invoiceCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    invoiceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    invoiceInfo: {
        flex: 1,
    },
    invoiceNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    projectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    projectName: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    invoiceDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    amountText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
});
