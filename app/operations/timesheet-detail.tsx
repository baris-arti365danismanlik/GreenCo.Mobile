import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, DollarSign, FileText, Star, Edit2, X } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type TimesheetPeriod = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: number;
  total_personnel: number;
  manager_approval_note?: string;
  project: { name: string };
};

type PersonnelAttendance = {
  worker_id: string;
  full_name: string;
  avatar_url?: string;
  total_hours: number;
  total_days: number;
  hourly_rate: number;
  daily_rate: number;
  overtime_rate: number;
  standard_hours: number;
  overtime_hours: number;
  daily_amount: number;
  overtime_amount: number;
  total_amount: number;
  personnel_type?: string;
  avg_rating?: number;
  rated_days: number;
  total_work_days: number;
  adjustment?: {
    id: string;
    original_amount: number;
    adjusted_amount: number;
    adjustment_reason: string;
  };
};

export default function OperationsTimesheetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const timesheetId = params.id as string;
  const { user } = useAuth();

  const [timesheet, setTimesheet] = useState<TimesheetPeriod | null>(null);
  const [personnelData, setPersonnelData] = useState<PersonnelAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);
  const [hasInvoice, setHasInvoice] = useState(false);

  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelAttendance | null>(null);
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTimesheetDetail = useCallback(async () => {
    try {
      console.log('Loading timesheet detail for ID:', timesheetId);

      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_periods')
        .select(`
          *,
          projects_greenco!inner (
            name
          )
        `)
        .eq('id', timesheetId)
        .single();

      console.log('Timesheet data:', { timesheetData, timesheetError });

      if (timesheetError) throw timesheetError;

      const formattedTimesheet = {
        ...timesheetData,
        project: { name: timesheetData.projects_greenco?.name }
      };
      setTimesheet(formattedTimesheet);

      console.log('Loading project assignments with rates...');

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('project_assignments')
        .select(`
          personnel_id,
          hourly_rate,
          daily_rate,
          overtime_rate,
          position_title,
          standard_hours,
          profiles!project_assignments_personnel_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', timesheetData.project_id);

      console.log('Assignments data:', { count: assignmentsData?.length, assignmentsError });

      if (assignmentsError) throw assignmentsError;

      const ratesMap = new Map();
      assignmentsData?.forEach((assignment: any) => {
        const hourlyRate = Number(assignment.hourly_rate) || 0;
        const dailyRate = Number(assignment.daily_rate) || 0;
        const effectiveDailyRate = dailyRate > 0 ? dailyRate : (hourlyRate * 8);
        const effectiveOvertimeRate = Number(assignment.overtime_rate) || hourlyRate;

        ratesMap.set(assignment.personnel_id, {
          daily_rate: effectiveDailyRate,
          overtime_rate: effectiveOvertimeRate,
          position_title: assignment.position_title || 'Personel',
          standard_hours: Number(assignment.standard_hours) || 8,
          full_name: assignment.profiles?.full_name || 'Bilinmiyor',
          avatar_url: assignment.profiles?.avatar_url,
        });
      });

      console.log('Loading attendance for project:', timesheetData.project_id);
      console.log('Period:', timesheetData.period_start, 'to', timesheetData.period_end);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          worker_id,
          total_hours,
          check_in_time,
          check_out_time,
          performance_rating
        `)
        .eq('project_id', timesheetData.project_id)
        .gte('check_in_time', `${timesheetData.period_start}T00:00:00`)
        .lte('check_in_time', `${timesheetData.period_end}T23:59:59`);

      console.log('Attendance data:', { count: attendanceData?.length, attendanceError });

      if (attendanceError) throw attendanceError;

      const personnelMap = new Map<string, PersonnelAttendance>();

      attendanceData?.forEach((record: any) => {
        const workerId = record.worker_id;
        const hours = Number(record.total_hours) || 0;
        const rateInfo = ratesMap.get(workerId);

        if (!rateInfo) {
          console.warn('No rate info for worker:', workerId);
          return;
        }

        if (!personnelMap.has(workerId)) {
          personnelMap.set(workerId, {
            worker_id: workerId,
            full_name: rateInfo.full_name,
            avatar_url: rateInfo.avatar_url,
            personnel_type: rateInfo.position_title,
            hourly_rate: rateInfo.daily_rate,
            daily_rate: rateInfo.daily_rate,
            overtime_rate: rateInfo.overtime_rate,
            standard_hours: rateInfo.standard_hours,
            total_hours: 0,
            total_days: 0,
            overtime_hours: 0,
            daily_amount: 0,
            overtime_amount: 0,
            total_amount: 0,
            avg_rating: 0,
            rated_days: 0,
            total_work_days: 0,
          });
        }

        const personnel = personnelMap.get(workerId)!;
        personnel.total_hours += hours;
        personnel.total_days += 1;

        const isComplete = record.check_in_time && record.check_out_time;
        if (isComplete) {
          personnel.total_work_days += 1;
          if (record.performance_rating) {
            personnel.avg_rating = (personnel.avg_rating || 0) + record.performance_rating;
            personnel.rated_days += 1;
          }
        }
      });

      const personnelArray = Array.from(personnelMap.values()).map(p => {
        const rateInfo = ratesMap.get(p.worker_id);
        if (!rateInfo) return p;

        const standardHours = p.total_days * rateInfo.standard_hours;
        const overtimeHours = Math.max(0, p.total_hours - standardHours);

        const dailyAmount = p.total_days * rateInfo.daily_rate;
        const overtimeAmount = overtimeHours * rateInfo.overtime_rate;
        const totalAmount = dailyAmount + overtimeAmount;

        console.log(`${p.full_name}: ${p.total_days} gün × ${rateInfo.daily_rate}₺ = ${dailyAmount}₺, ${overtimeHours.toFixed(1)}h FM × ${rateInfo.overtime_rate}₺ = ${overtimeAmount.toFixed(2)}₺, TOPLAM: ${totalAmount}₺`);

        const avgRating = p.rated_days > 0 && p.avg_rating ? p.avg_rating / p.rated_days : 0;

        return {
          ...p,
          overtime_hours: overtimeHours,
          daily_amount: dailyAmount,
          overtime_amount: overtimeAmount,
          total_amount: totalAmount,
          avg_rating: avgRating,
        };
      });

      personnelArray.sort((a, b) => b.total_amount - a.total_amount);

      console.log('Loading adjustments...');

      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from('timesheet_adjustments')
        .select('*')
        .eq('timesheet_period_id', timesheetId);

      if (adjustmentsError) {
        console.warn('Adjustments loading error:', adjustmentsError);
      }

      const adjustmentsMap = new Map();
      adjustmentsData?.forEach((adj: any) => {
        adjustmentsMap.set(adj.worker_id, {
          id: adj.id,
          original_amount: Number(adj.original_amount),
          adjusted_amount: Number(adj.adjusted_amount),
          adjustment_reason: adj.adjustment_reason,
        });
      });

      const personnelWithAdjustments = personnelArray.map(p => {
        const adjustment = adjustmentsMap.get(p.worker_id);
        return {
          ...p,
          adjustment,
        };
      });

      const total = personnelWithAdjustments.reduce((sum, p) =>
        sum + (p.adjustment ? p.adjustment.adjusted_amount : p.total_amount), 0
      );

      console.log('Personnel breakdown:', personnelWithAdjustments);
      console.log('Grand total:', total);

      setGrandTotal(total);
      setPersonnelData(personnelWithAdjustments);

      const { data: existingInvoice, error: invoiceCheckError } = await supabase
        .from('invoices')
        .select('id')
        .eq('timesheet_period_id', timesheetId)
        .maybeSingle();

      if (!invoiceCheckError && existingInvoice) {
        console.log('Bu puantaj için zaten hakediş var:', existingInvoice.id);
        setHasInvoice(true);
      }
    } catch (error: any) {
      console.error('Detay yükleme hatası:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  }, [timesheetId]);

  useFocusEffect(
    useCallback(() => {
      loadTimesheetDetail();
    }, [loadTimesheetDetail])
  );

  const handleConvertToInvoice = async () => {
    if (!timesheet || !user) return;

    if (hasInvoice) {
      Alert.alert('Uyarı', 'Bu puantaj için zaten bir hakediş oluşturulmuş');
      return;
    }

    setConverting(true);
    try {
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('timesheet_period_id', timesheet.id)
        .maybeSingle();

      if (existingInvoice) {
        Alert.alert('Uyarı', 'Bu puantaj için zaten bir hakediş oluşturulmuş');
        setHasInvoice(true);
        setConverting(false);
        return;
      }
      const personnelBreakdown = personnelData.map(p => ({
        personnel_id: p.worker_id,
        full_name: p.full_name,
        personnel_type: p.personnel_type || 'Genel',
        total_hours: p.total_hours,
        total_days: p.total_days,
        daily_rate: p.daily_rate,
        overtime_rate: p.overtime_rate,
        overtime_hours: p.overtime_hours,
        daily_amount: p.daily_amount,
        overtime_amount: p.overtime_amount,
        hourly_rate: p.hourly_rate,
        total_amount: p.adjustment ? p.adjustment.adjusted_amount : p.total_amount,
        original_amount: p.total_amount,
        adjusted_amount: p.adjustment ? p.adjustment.adjusted_amount : null,
        adjustment_reason: p.adjustment ? p.adjustment.adjustment_reason : null,
      }));

      const invoiceNumberResponse = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = invoiceNumberResponse.data;

      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          timesheet_period_id: timesheet.id,
          project_id: timesheet.project_id,
          invoice_number: invoiceNumber,
          period_start: timesheet.period_start,
          period_end: timesheet.period_end,
          total_hours: timesheet.total_hours,
          total_personnel: timesheet.total_personnel,
          total_amount: grandTotal,
          personnel_breakdown: personnelBreakdown,
          status: 'pending',
          created_by: user.id,
        });

      if (invoiceError) throw invoiceError;

      const { error: updateError } = await supabase
        .from('timesheet_periods')
        .update({
          status: 'invoice_pending',
          invoice_created_by: user.id,
          invoice_created_at: new Date().toISOString(),
        })
        .eq('id', timesheet.id);

      if (updateError) throw updateError;

      Alert.alert('Başarılı', 'Hakediş başarıyla oluşturuldu');
      router.back();
    } catch (error: any) {
      console.error('Hakediş oluşturma hatası:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);

      let errorMessage = 'Hakediş oluşturulamadı';
      if (error.code === '23505') {
        errorMessage = 'Bu puantaj için zaten bir hakediş oluşturulmuş';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Hata', errorMessage);
    } finally {
      setConverting(false);
    }
  };

  const openAdjustModal = (person: PersonnelAttendance) => {
    setSelectedPersonnel(person);
    setAdjustedAmount(
      (person.adjustment
        ? person.adjustment.adjusted_amount
        : person.total_amount
      ).toString()
    );
    setAdjustmentReason(person.adjustment?.adjustment_reason || '');
    setAdjustModalVisible(true);
  };

  const closeAdjustModal = () => {
    setAdjustModalVisible(false);
    setSelectedPersonnel(null);
    setAdjustedAmount('');
    setAdjustmentReason('');
  };

  const handleSaveAdjustment = async () => {
    if (!selectedPersonnel || !user || !timesheet) return;

    const newAmount = parseFloat(adjustedAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir tutar girin');
      return;
    }

    if (!adjustmentReason.trim()) {
      Alert.alert('Hata', 'Lütfen düzeltme nedenini belirtin');
      return;
    }

    setSaving(true);
    try {
      const adjustmentData = {
        timesheet_period_id: timesheet.id,
        worker_id: selectedPersonnel.worker_id,
        original_amount: selectedPersonnel.total_amount,
        adjusted_amount: newAmount,
        adjustment_reason: adjustmentReason.trim(),
        adjusted_by: user.id,
      };

      if (selectedPersonnel.adjustment) {
        const { error: updateError } = await supabase
          .from('timesheet_adjustments')
          .update(adjustmentData)
          .eq('id', selectedPersonnel.adjustment.id);

        if (updateError) {
          console.error('Supabase request failed', updateError);
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('timesheet_adjustments')
          .insert(adjustmentData);

        if (insertError) {
          console.error('Supabase request failed', insertError);
          throw insertError;
        }
      }

      // Modal'ı kapat ve verileri yenile
      closeAdjustModal();
      await loadTimesheetDetail();
      Alert.alert('Başarılı', 'Düzeltme kaydedildi');
    } catch (error: any) {
      console.error('Adjustment save error:', error);
      Alert.alert('Hata', 'Düzeltme kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !timesheet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canConvert = timesheet.status === 'final_approved' && !hasInvoice;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Puantaj Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.projectName}>{timesheet.project?.name || 'Proje'}</Text>

          <View style={styles.dateContainer}>
            <Calendar size={16} color={COLORS.textLight} />
            <Text style={styles.dateText}>
              {new Date(timesheet.period_start).toLocaleDateString('tr-TR')} -{' '}
              {new Date(timesheet.period_end).toLocaleDateString('tr-TR')}
            </Text>
          </View>

          {timesheet.manager_approval_note && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Proje Yöneticisi Notu:</Text>
              <Text style={styles.noteText}>{timesheet.manager_approval_note}</Text>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Clock size={20} color={COLORS.primary} />
              <Text style={styles.statValue}>{timesheet.total_hours}h</Text>
              <Text style={styles.statLabel}>Toplam Saat</Text>
            </View>
            <View style={styles.statBox}>
              <User size={20} color={COLORS.blue} />
              <Text style={styles.statValue}>{personnelData.length}</Text>
              <Text style={styles.statLabel}>Çalışan</Text>
            </View>
            <View style={styles.statBox}>
              <DollarSign size={20} color={COLORS.success} />
              <Text style={styles.statValue}>{grandTotal.toLocaleString('tr-TR')} ₺</Text>
              <Text style={styles.statLabel}>Toplam Tutar</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>PERSONEL DETAYLARI ({personnelData.length})</Text>

        {personnelData.map((person, index) => (
          <View key={person.worker_id} style={styles.personnelCard}>
            <View style={styles.personnelHeader}>
              {person.avatar_url ? (
                <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={24} color={COLORS.textLight} />
                </View>
              )}
              <View style={styles.personnelInfo}>
                <Text style={styles.personnelName}>{person.full_name}</Text>
                {person.personnel_type && (
                  <Text style={styles.personnelType}>{person.personnel_type}</Text>
                )}
              </View>
              <Text style={styles.rankBadge}>#{index + 1}</Text>
            </View>

            <View style={styles.personnelStats}>
              <View style={styles.personnelStatItem}>
                <Text style={styles.personnelStatLabel}>Toplam Saat</Text>
                <Text style={styles.personnelStatValue}>{person.total_hours.toFixed(1)}h</Text>
              </View>
              <View style={styles.personnelStatItem}>
                <Text style={styles.personnelStatLabel}>Çalışma Günü</Text>
                <Text style={styles.personnelStatValue}>{person.total_days}</Text>
              </View>
              <View style={styles.personnelStatItem}>
                <Text style={styles.personnelStatLabel}>Fazla Mesai</Text>
                <Text style={styles.personnelStatValue}>{person.overtime_hours.toFixed(1)}h</Text>
              </View>
            </View>

            <View style={styles.calculationBox}>
              <View style={styles.calculationHeader}>
                <Text style={styles.calculationTitle}>Hakediş Hesabı:</Text>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => openAdjustModal(person)}
                >
                  <Edit2 size={16} color={COLORS.primary} />
                  <Text style={styles.adjustButtonText}>Düzelt</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Günlük Ücret: {person.total_days} gün × {person.daily_rate.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.calculationValue}>
                  {person.daily_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </Text>
              </View>

              {person.overtime_hours > 0 && (
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>
                    Fazla Mesai: {person.overtime_hours.toFixed(1)}h × {person.overtime_rate.toLocaleString('tr-TR')} ₺
                  </Text>
                  <Text style={styles.calculationValue}>
                    {person.overtime_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </Text>
                </View>
              )}

              <View style={styles.calculationDivider} />

              {person.adjustment ? (
                <>
                  <View style={styles.calculationRow}>
                    <Text style={[styles.calculationLabel, styles.strikethrough]}>Orijinal Toplam</Text>
                    <Text style={[styles.calculationValue, styles.strikethrough]}>
                      {person.adjustment.original_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </Text>
                  </View>
                  <View style={styles.calculationRow}>
                    <Text style={styles.calculationTotalLabel}>Düzeltilmiş Toplam</Text>
                    <Text style={styles.calculationTotalValue}>
                      {person.adjustment.adjusted_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </Text>
                  </View>
                  <View style={styles.adjustmentReasonBox}>
                    <Text style={styles.adjustmentReasonLabel}>Düzeltme Nedeni:</Text>
                    <Text style={styles.adjustmentReasonText}>{person.adjustment.adjustment_reason}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationTotalLabel}>TOPLAM</Text>
                  <Text style={styles.calculationTotalValue}>
                    {person.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.ratingContainer}>
              <View style={styles.ratingRow}>
                <View style={styles.starsDisplay}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      color={person.avg_rating && person.avg_rating >= star ? '#fbbf24' : '#d1d5db'}
                      fill={person.avg_rating && person.avg_rating >= star ? '#fbbf24' : 'transparent'}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {person.avg_rating ? person.avg_rating?.toFixed(1) : 'Puanlanmamış'}
                </Text>
              </View>
              <Text style={styles.ratingProgressText}>
                {person.rated_days}/{person.total_work_days} gün puanlandı
              </Text>
            </View>
          </View>
        ))}

        {personnelData.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Bu dönemde devamsızlık kaydı bulunmuyor</Text>
          </View>
        )}

        <View style={styles.grandTotalCard}>
          <DollarSign size={24} color={COLORS.success} />
          <View style={styles.grandTotalInfo}>
            <Text style={styles.grandTotalLabel}>GENEL TOPLAM</Text>
            {personnelData.some(p => p.adjustment) ? (
              <>
                <View style={styles.grandTotalRow}>
                  <Text style={[styles.grandTotalSubLabel, styles.strikethrough]}>Orijinal:</Text>
                  <Text style={[styles.grandTotalSubValue, styles.strikethrough]}>
                    {personnelData.reduce((sum, p) => sum + p.total_amount, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalSubLabel}>Düzeltilmiş:</Text>
                  <Text style={styles.grandTotalValue}>
                    {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.grandTotalValue}>
                {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              </Text>
            )}
          </View>
        </View>

        {hasInvoice && (
          <View style={styles.infoCard}>
            <FileText size={20} color={COLORS.blue} />
            <Text style={styles.infoText}>Bu puantaj için hakediş zaten oluşturulmuş</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={adjustModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAdjustModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tutarı Düzelt</Text>
              <TouchableOpacity onPress={closeAdjustModal}>
                <X size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {selectedPersonnel && (
                <>
                  <View style={styles.modalPersonnelInfo}>
                    <Text style={styles.modalPersonnelName}>{selectedPersonnel.full_name}</Text>
                    <Text style={styles.modalOriginalAmount}>
                      Orijinal: {selectedPersonnel.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Düzeltilmiş Tutar (₺) *</Text>
                    <TextInput
                      style={styles.input}
                      value={adjustedAmount}
                      onChangeText={setAdjustedAmount}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Düzeltme Nedeni *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={adjustmentReason}
                      onChangeText={setAdjustmentReason}
                      placeholder="Örn: 1 gün hastalık izni düşüldü"
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={closeAdjustModal}
                    >
                      <Text style={styles.cancelButtonText}>İptal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton, saving && { opacity: 0.5 }]}
                      onPress={handleSaveAdjustment}
                      disabled={saving}
                    >
                      <Text style={styles.saveButtonText}>
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {canConvert && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.convertButton, converting && { opacity: 0.5 }]}
            onPress={handleConvertToInvoice}
            disabled={converting}
          >
            <FileText size={20} color="white" />
            <Text style={styles.convertButtonText}>
              {converting ? 'Oluşturuluyor...' : "Hakediş'e Çevir"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.text,
  },
  noteBox: {
    backgroundColor: COLORS.primary + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteText: {
    fontSize: 14,
    color: COLORS.secondary,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 12,
    letterSpacing: 1,
  },
  personnelCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personnelInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  personnelType: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  rankBadge: {
    backgroundColor: COLORS.primary + '20',
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  personnelStats: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 12,
  },
  personnelStatItem: {
    flex: 1,
  },
  personnelStatLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  personnelStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  calculationBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calculationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calculationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
  },
  adjustButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 8,
  },
  calculationDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  calculationTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  calculationTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.success,
  },
  ratingContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starsDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  ratingProgressText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  grandTotalCard: {
    backgroundColor: COLORS.success,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 80,
  },
  grandTotalInfo: {
    flex: 1,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    opacity: 0.9,
    marginBottom: 4,
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  grandTotalSubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
    opacity: 0.9,
  },
  grandTotalSubValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    opacity: 0.9,
  },
  infoCard: {
    backgroundColor: COLORS.blue + '15',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 80,
    borderWidth: 1,
    borderColor: COLORS.blue + '40',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.blue,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
  },
  convertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  adjustmentReasonBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  adjustmentReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adjustmentReasonText: {
    fontSize: 12,
    color: COLORS.secondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalScroll: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalPersonnelInfo: {
    backgroundColor: COLORS.bg,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalPersonnelName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  modalOriginalAmount: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.secondary,
    backgroundColor: 'white',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingBottom: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
