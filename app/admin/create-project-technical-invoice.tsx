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
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Calendar,
    Building2,
    CheckCircle,
    Square,
    Save,
    Send,
    DollarSign,
    FileText,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Project = {
    id: string;
    name: string;
};

type CompletedJob = {
    id: string;
    title: string;
    final_price: number; // Müşteriye sunulan (komisyonlu) fiyat
    completed_at: string;
    location_city: string;
    location_district: string;
    technical_service_types?: {
        name: string; // Hizmet Tipi
    } | null;
};

export default function CreateProjectTechnicalInvoiceScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Default dates: Start of this month, Today
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState<string>(firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);

    const [jobs, setJobs] = useState<CompletedJob[]>([]);
    const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects_greenco')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setProjects(data || []);

            // If only one project, select it automatically (common for PMs)
            if (data && data.length === 1) {
                setSelectedProjectId(data[0].id);
            }
        } catch (error) {
            console.error('Proje yükleme hatası:', error);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadJobs = async () => {
        if (!selectedProjectId || !startDate || !endDate) {
            if (Platform.OS === 'web') {
                window.alert('Lütfen proje ve tarih aralığı seçin');
            } else {
                Alert.alert('Uyarı', 'Lütfen proje ve tarih aralığı seçin');
            }
            return;
        }

        setLoading(true);
        setJobs([]);
        setSelectedJobIds(new Set());

        try {
            const { data, error } = await supabase
                .from('technical_service_requests')
                .select(`
                  id,
                  title,
                  status,
                  updated_at,
                  created_at,
                  location_city,
                  location_district,
                  technical_service_types(name)
                `)
                .eq('project_id', selectedProjectId)
                .in('status', ['completed', 'approved'])
                .gte('updated_at', startDate)
                .lte('updated_at', endDate + 'T23:59:59')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const requestIds = data?.map(r => r.id) || [];

            if (requestIds.length > 0) {
                const { data: bids, error: bidsError } = await supabase
                    .from('technical_service_bids')
                    .select('request_id, bid_amount, status')
                    .in('request_id', requestIds)
                    .eq('status', 'accepted');

                if (bidsError) throw bidsError;

                const { data: reqCommissions, error: commError } = await supabase
                    .from('technical_service_requests')
                    .select('id, companies(commission_rate)')
                    .in('id', requestIds);

                if (commError) throw commError;

                const commMap = new Map();
                reqCommissions?.forEach(rc => {
                    commMap.set(rc.id, rc.companies?.commission_rate || 0);
                });

                const jobList: CompletedJob[] = [];

                data?.forEach(req => {
                    const winningBid = bids?.find(b => b.request_id === req.id);
                    if (winningBid && winningBid.bid_amount) {
                        const commission = commMap.get(req.id) || 0;
                        const finalPrice = winningBid.bid_amount * (1 + commission);

                        jobList.push({
                            id: req.id,
                            title: req.title,
                            final_price: finalPrice,
                            completed_at: req.updated_at,
                            location_city: req.location_city,
                            location_district: req.location_district,
                            technical_service_types: req.technical_service_types
                        });
                    }
                });

                setJobs(jobList);
            } else {
                setJobs([]);
            }

        } catch (error) {
            console.error('İş yükleme hatası:', error);
            if (Platform.OS === 'web') {
                window.alert('İşler yüklenirken hata oluştu');
            } else {
                Alert.alert('Hata', 'İşler yüklenirken hata oluştu');
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleJobSelection = (jobId: string) => {
        setSelectedJobIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(jobId)) {
                newSet.delete(jobId);
            } else {
                newSet.add(jobId);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedJobIds(new Set(jobs.map((j) => j.id)));
    };

    const deselectAll = () => {
        setSelectedJobIds(new Set());
    };

    const calculateTotals = () => {
        const selectedJobs = jobs.filter((j) => selectedJobIds.has(j.id));
        const totalAmount = selectedJobs.reduce((sum, j) => sum + j.final_price, 0);
        const totalJobs = selectedJobs.length;
        return { totalAmount, totalJobs };
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const { totalAmount, totalJobs } = calculateTotals();

    const createInvoice = async (status: 'draft' | 'approved') => {
        if (saving) return; // Prevent double submission
        if (selectedJobIds.size === 0) {
            // ...
        }

        setSaving(true);
        try {
            // ... (rest of logic)
        } catch (error: any) {
            // ...
        } finally {
            setSaving(false);
        }
    };

    // ...

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={COLORS.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Proje Teknik Hakedişi Oluştur</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Proje Seçimi</Text>

                    {/* Project Search Input */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchWrapper}>
                            {/* Use a generic search icon here if available, or just omit if clean design preferred. 
                                 But user asked for input. Let's use a nice input style. 
                             */}
                            <Text style={{ marginRight: 8 }}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Proje Ara..."
                                placeholderTextColor={COLORS.textLight}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.companyList}>
                        {filteredProjects.map((project) => (
                            <TouchableOpacity
                                key={project.id}
                                style={[
                                    styles.companyCard,
                                    selectedProjectId === project.id && styles.companyCardSelected,
                                ]}
                                onPress={() => {
                                    setSelectedProjectId(project.id);
                                    setJobs([]);
                                    setSelectedJobIds(new Set());
                                }}
                            >
                                <Building2
                                    size={20}
                                    color={selectedProjectId === project.id ? COLORS.primary : COLORS.textLight}
                                />
                                <Text
                                    style={[
                                        styles.companyCardText,
                                        selectedProjectId === project.id && styles.companyCardTextSelected,
                                    ]}
                                >
                                    {project.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tarih Aralığı</Text>
                    <View style={styles.dateInputsRow}>
                        <View style={styles.dateInputContainer}>
                            <Text style={styles.dateInputLabel}>Başlangıç</Text>
                            <View style={styles.dateInputWrapper}>
                                <Calendar size={16} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={COLORS.textLight}
                                    value={startDate}
                                    onChangeText={setStartDate}
                                    maxLength={10}
                                />
                            </View>
                        </View>
                        <View style={styles.dateInputContainer}>
                            <Text style={styles.dateInputLabel}>Bitiş</Text>
                            <View style={styles.dateInputWrapper}>
                                <Calendar size={16} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={COLORS.textLight}
                                    value={endDate}
                                    onChangeText={setEndDate}
                                    maxLength={10}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.loadButton, (!selectedProjectId || !startDate || !endDate) && styles.loadButtonDisabled]}
                    onPress={loadJobs}
                    disabled={!selectedProjectId || !startDate || !endDate || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <FileText size={20} color="#FFF" />
                            <Text style={styles.loadButtonText}>İşleri Getir</Text>
                        </>
                    )}
                </TouchableOpacity>

                {jobs.length > 0 && (
                    <>
                        <View style={styles.section}>
                            <View style={styles.jobsHeader}>
                                <Text style={styles.sectionTitle}>
                                    Tamamlanmış İşler ({jobs.length})
                                </Text>
                                <View style={styles.selectionButtons}>
                                    <TouchableOpacity style={styles.selectionButton} onPress={selectAll}>
                                        <Text style={styles.selectionButtonText}>Tümünü Seç</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.selectionButton} onPress={deselectAll}>
                                        <Text style={styles.selectionButtonText}>Temizle</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {jobs.map((job) => {
                                const isSelected = selectedJobIds.has(job.id);
                                return (
                                    <TouchableOpacity
                                        key={job.id}
                                        style={[styles.jobCard, isSelected && styles.jobCardSelected]}
                                        onPress={() => toggleJobSelection(job.id)}
                                    >
                                        <View style={styles.jobCardContent}>
                                            {isSelected ? (
                                                <CheckCircle size={20} color={COLORS.primary} />
                                            ) : (
                                                <Square size={20} color={COLORS.textLight} />
                                            )}
                                            <View style={styles.jobInfo}>
                                                <Text style={styles.jobTitle}>
                                                    {job.title}
                                                </Text>
                                                <Text style={styles.jobLocation}>
                                                    {job.technical_service_types?.name} • {job.location_district}, {job.location_city}
                                                </Text>
                                                <Text style={styles.jobDate}>
                                                    {formatDate(job.completed_at)}
                                                </Text>
                                            </View>
                                            <Text style={styles.jobAmount}>
                                                {Number(job.final_price).toLocaleString('tr-TR', {
                                                    minimumFractionDigits: 2,
                                                })}{' '}
                                                ₺
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Özet</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Seçilen İş Sayısı:</Text>
                                <Text style={styles.summaryValue}>{totalJobs}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Toplam Tutar:</Text>
                                <Text style={styles.summaryAmount}>
                                    {totalAmount.toLocaleString('tr-TR', {
                                        minimumFractionDigits: 2,
                                    })}{' '}
                                    ₺
                                </Text>
                            </View>
                        </View>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.draftButton]}
                                onPress={() => createInvoice('draft')}
                                disabled={saving || selectedJobIds.size === 0}
                            >
                                {saving ? (
                                    <ActivityIndicator color={COLORS.primary} />
                                ) : (
                                    <>
                                        <Save size={20} color={COLORS.primary} />
                                        <Text style={styles.draftButtonText}>Taslak Kaydet</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.submitButton]}
                                onPress={() => createInvoice('approved')}
                                disabled={saving || selectedJobIds.size === 0}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <CheckCircle size={20} color="#FFF" />
                                        <Text style={styles.submitButtonText}>Hakediş Oluştur</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {jobs.length === 0 && selectedProjectId && startDate && endDate && !loading && (
                    <View style={styles.emptyState}>
                        <FileText size={48} color={COLORS.textLight} />
                        <Text style={styles.emptyText}>
                            Seçilen kriterlere uygun faturalanmamış iş bulunamadı
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
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
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    companyList: {
        flexDirection: 'row',
    },
    companyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    companyCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary + '10',
    },
    companyCardText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text,
    },
    companyCardTextSelected: {
        color: COLORS.primary,
    },
    dateInputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateInputContainer: {
        flex: 1,
    },
    dateInputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textLight,
        marginBottom: 8,
    },
    dateInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dateInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
        padding: 0,
    },
    loadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        marginBottom: 20,
    },
    loadButtonDisabled: {
        opacity: 0.5,
    },
    loadButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    jobsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    selectionButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: COLORS.primary + '20',
        borderRadius: 8,
    },
    selectionButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.primary,
    },
    jobCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    jobCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary + '05',
    },
    jobCardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    jobInfo: {
        flex: 1,
    },
    jobTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    jobLocation: {
        fontSize: 12,
        color: COLORS.textLight,
        marginBottom: 2,
    },
    jobDate: {
        fontSize: 11,
        color: COLORS.textLight,
    },
    jobAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    summaryCard: {
        backgroundColor: COLORS.primary + '10',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        marginTop: 12,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '700',
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
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
    },
    draftButton: {
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    draftButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    submitButton: {
        backgroundColor: COLORS.primary,
    },
    submitButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    searchContainer: {
        marginBottom: 12,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
        padding: 0,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textLight,
        textAlign: 'center',
    },
});
