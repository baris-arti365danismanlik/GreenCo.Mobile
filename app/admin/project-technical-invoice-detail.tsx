import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    Calendar,
    Building2,
    DollarSign,
    FileText,
    CheckCircle,
    Clock,
    XCircle,
    MapPin,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Invoice = {
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
        city: string;
        district: string;
    } | null;
    created_by_profile?: {
        full_name: string;
    } | null;
};

type JobDetail = {
    id: string;
    title: string;
    final_price: number;
    completion_date: string;
    location: string; // Will use 'location' field or construct from district/city
    request_number: string;
};

const STATUS_CONFIG = {
    draft: { label: 'Taslak', color: COLORS.textSecondary, icon: FileText },
    approved: { label: 'Faturalanmaya Hazır', color: COLORS.success, icon: CheckCircle },
    paid: { label: 'Ödendi', color: COLORS.primary, icon: CheckCircle },
    cancelled: { label: 'İptal', color: COLORS.error, icon: XCircle },
};

export default function ProjectTechnicalInvoiceDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [jobs, setJobs] = useState<JobDetail[]>([]);

    useEffect(() => {
        loadInvoice();
    }, [id]);

    const loadInvoice = async () => {
        try {
            // 1. Fetch Invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('project_technical_invoices')
                .select(`
                  *,
                  projects_greenco(name, city, district)
                `)
                .eq('id', id)
                .maybeSingle();

            if (invoiceError) throw invoiceError;
            if (!invoiceData) {
                Alert.alert('Hata', 'Hakediş bulunamadı');
                router.back();
                return;
            }

            setInvoice(invoiceData);

            // 2. Fetch Linked Jobs
            // We linked them via customer_invoice_id in technical_service_requests
            // Note: 'final_price' column does not exist on requests table. We must calculate/fetch it.
            const { data: jobsData, error: jobsError } = await supabase
                .select('id, title, completion_date:updated_at, location_city, location_district')
                .eq('customer_invoice_id', id);

            if (jobsError) throw jobsError;

            // Fetch prices from accepted bids
            const jobIds = jobsData?.map(j => j.id) || [];
            let pricesMap: Record<string, number> = {};

            if (jobIds.length > 0) {
                const { data: bids, error: bidsError } = await supabase
                    .from('technical_service_bids')
                    .select('request_id, bid_amount')
                    .in('request_id', jobIds)
                    .eq('status', 'accepted');

                if (!bidsError && bids) {
                    // Fetch commission rates if needed (assuming 10% or similar logic used in creation)
                    // For accuracy, we should really start storing the calculated 'invoiced_price' on the request or invoice_items table.
                    // For now, let's use the bid_amount as base. 
                    // If we need commission, we'd need to fetch company commission again.
                    // Let's assume bid_amount is what we show or apply a standard calculation?
                    // "create" screen applies commission. Let's try to fetch company commission too.

                    const { data: reqComms } = await supabase
                        .from('technical_service_requests')
                        .select('id, companies(commission_rate)')
                        .in('id', jobIds);

                    const commMap: Record<string, number> = {};
                    reqComms?.forEach((r: any) => {
                        commMap[r.id] = r.companies?.commission_rate || 0;
                    });

                    bids.forEach(bid => {
                        const comm = commMap[bid.request_id] || 0;
                        pricesMap[bid.request_id] = bid.bid_amount * (1 + comm);
                    });
                }
            }

            const formattedJobs = (jobsData || []).map(job => ({
                id: job.id,
                title: job.title,
                final_price: pricesMap[job.id] || 0,
                completion_date: job.completion_date,
                location: `${job.location_district || ''}, ${job.location_city || ''}`,
                request_number: job.request_number
            }));

            setJobs(formattedJobs);

        } catch (error) {
            console.error('Hakediş detay yükleme hatası:', error);
            Alert.alert('Hata', 'Hakediş yüklenirken hata oluştu');
            // router.back(); // Don't auto-back on error to let user see empty state if needed
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Yükleniyor...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!invoice) {
        return null;
    }

    const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
    const StatusIcon = statusConfig.icon;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* ... Header ... */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={COLORS.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hakediş Detayı</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* ... Card 1 ... */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                            <StatusIcon size={16} color={statusConfig.color} />
                            <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <Building2 size={16} color={COLORS.textSecondary} />
                        <Text style={styles.infoText}>
                            {invoice.projects_greenco?.name || 'Bilinmeyen Proje'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Calendar size={16} color={COLORS.textSecondary} />
                        <Text style={styles.infoText}>
                            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </Text>
                    </View>
                </View>

                {/* ... Summary Card ... */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Özet</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Toplam İş Sayısı:</Text>
                        <Text style={styles.summaryValue}>{invoice.total_jobs}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Toplam Tutar (Müşteri):</Text>
                        <Text style={styles.summaryAmount}>
                            {invoice.total_amount?.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                            })}{' '}
                            ₺
                        </Text>
                    </View>
                </View>

                {/* ... Jobs List ... */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>İşler ({jobs.length})</Text>
                    {jobs.map((job, index) => (
                        <View key={job.id} style={styles.jobItem}>
                            <View style={styles.jobHeader}>
                                <Text style={styles.jobNumber}>#{index + 1}</Text>
                                <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                            </View>
                            <View style={styles.jobDetails}>
                                <View style={styles.jobDetailRow}>
                                    <FileText size={12} color={COLORS.textSecondary} />
                                    <Text style={styles.jobDetailText}>No: {job.request_number || '-'}</Text>
                                </View>
                                <View style={styles.jobDetailRow}>
                                    <MapPin size={12} color={COLORS.textSecondary} />
                                    <Text style={styles.jobDetailText}>{job.location}</Text>
                                </View>
                                <View style={styles.jobDetailRow}>
                                    <Calendar size={12} color={COLORS.textSecondary} />
                                    <Text style={styles.jobDetailText}>
                                        {formatDate(job.completion_date)}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.jobAmount}>
                                {job.final_price?.toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                })}{' '}
                                ₺
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Project Info Section - Similar to Company Info but for Project */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Proje Bilgileri</Text>
                    <View style={styles.companyInfoRow}>
                        {/* Replace Building2 with MapPin or relevant icon if desired, keeping structure consistent */}
                        <Text style={styles.companyInfoLabel}>Proje:</Text>
                        <Text style={styles.companyInfoValue}>
                            {invoice.projects_greenco?.name}
                        </Text>
                    </View>
                    <View style={styles.companyInfoRow}>
                        <Text style={styles.companyInfoLabel}>Konum:</Text>
                        <Text style={styles.companyInfoValue}>
                            {invoice.projects_greenco?.district ? `${invoice.projects_greenco.district}, ` : ''}
                            {invoice.projects_greenco?.city || '-'}
                        </Text>
                    </View>
                </View>

                {invoice.status === 'draft' && (
                    <View style={styles.footerNote}>
                        <Text style={styles.footerNoteText}>Bu hakediş taslak aşamasındadır.</Text>
                    </View>
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
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    invoiceNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: COLORS.text,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
    },
    jobItem: {
        padding: 12,
        backgroundColor: COLORS.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    jobHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    jobNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    jobTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    jobDetails: {
        gap: 4,
        marginBottom: 8,
    },
    jobDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    jobDetailText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    jobAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'right',
    },
    footerNote: {
        padding: 16,
        alignItems: 'center'
    },
    footerNoteText: {
        color: COLORS.textSecondary,
        fontSize: 12
    },
    companyInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 8,
    },
    companyInfoLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    companyInfoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text,
    },
});
