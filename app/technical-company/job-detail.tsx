import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  DollarSign,
  MapPin,
  Calendar,
  CheckCircle,
  FileText,
  Save,
  Camera,
  ImageIcon,
  X,
  Video,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Assignment = {
  id: string;
  final_price: number;
  completion_date: string | null;
  problem_description: string | null;
  solution_description: string | null;
  parts_used: string | null;
  labor_cost: number | null;
  parts_cost: number | null;
  warranty_months: number | null;
  pm_approved: boolean;
  operations_approved: boolean;
  created_at: string;
  technical_service_requests: {
    id: string;
    title: string;
    description: string;
    location_city: string;
    location_district: string;
    location_address: string;
    technical_service_types: {
      name: string;
    };
  };
};

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'image' | 'video';
  file_size: number;
  caption: string | null;
  created_at: string;
};

export default function JobDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [problemDesc, setProblemDesc] = useState('');
  const [solutionDesc, setSolutionDesc] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    loadAssignment();
    loadAttachments();
  }, [id]);

  const loadAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          problem_description,
          solution_description,
          parts_used,
          labor_cost,
          parts_cost,
          warranty_months,
          pm_approved,
          operations_approved,
          created_at,
          technical_service_requests(
            id,
            title,
            description,
            location_city,
            location_district,
            location_address,
            technical_service_types(name)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      setAssignment(data);
      setProblemDesc(data.problem_description || '');
      setSolutionDesc(data.solution_description || '');
      setPartsUsed(data.parts_used || '');
      setLaborCost(data.labor_cost?.toString() || '');
      setPartsCost(data.parts_cost?.toString() || '');
      setWarrantyMonths(data.warranty_months?.toString() || '');
    } catch (error) {
      console.error('Error loading assignment:', error);
      if (Platform.OS === 'web') {
        window.alert('İş detayı yüklenirken bir hata oluştu');
      } else {
        Alert.alert('Hata', 'İş detayı yüklenirken bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_assignment_attachments')
        .select('*')
        .eq('assignment_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  const saveJobReport = async () => {
    if (!problemDesc || !solutionDesc) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen problem ve çözüm açıklamasını girin');
      } else {
        Alert.alert('Uyarı', 'Lütfen problem ve çözüm açıklamasını girin');
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('technical_service_assignments')
        .update({
          problem_description: problemDesc,
          solution_description: solutionDesc,
          parts_used: partsUsed || null,
          labor_cost: laborCost ? parseFloat(laborCost) : null,
          parts_cost: partsCost ? parseFloat(partsCost) : null,
          warranty_months: warrantyMonths ? parseInt(warrantyMonths) : null,
        })
        .eq('id', id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('İş raporu kaydedildi');
      } else {
        Alert.alert('Başarılı', 'İş raporu kaydedildi');
      }
      loadAssignment();
    } catch (error) {
      console.error('Error saving report:', error);
      if (Platform.OS === 'web') {
        window.alert('Rapor kaydedilirken bir hata oluştu: ' + (error as any).message);
      } else {
        Alert.alert('Hata', 'Rapor kaydedilirken bir hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      if (Platform.OS === 'web') {
        window.alert('Fotoğraf seçilirken bir hata oluştu');
      } else {
        Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu');
      }
    }
  };

  const takePicture = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        if (Platform.OS === 'web') {
          window.alert('Kamera kullanmak için izin vermeniz gerekiyor');
        } else {
          Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin vermeniz gerekiyor');
        }
        return;
      }
    }
    setShowCamera(true);
  };

  const uploadFile = async (file: any) => {
    try {
      setUploading(true);

      const fileType = file.type?.startsWith('video') ? 'video' : 'image';
      const fileExt = file.uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `assignments/${id}/${fileName}`;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('technical-attachments')
          .upload(filePath, blob, {
            contentType: file.type || 'image/jpeg',
          });

        if (uploadError) throw uploadError;
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.type || 'image/jpeg',
          name: fileName,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('technical-attachments')
          .upload(filePath, formData);

        if (uploadError) throw uploadError;
      }

      const { error: dbError } = await supabase
        .from('technical_service_assignment_attachments')
        .insert({
          assignment_id: id,
          file_name: fileName,
          file_path: filePath,
          file_type: fileType,
          file_size: file.fileSize || 0,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (dbError) throw dbError;

      if (Platform.OS === 'web') {
        window.alert('Dosya yüklendi');
      } else {
        Alert.alert('Başarılı', 'Dosya yüklendi');
      }
      loadAttachments();
    } catch (error) {
      console.error('Error uploading file:', error);
      if (Platform.OS === 'web') {
        window.alert('Dosya yüklenirken bir hata oluştu: ' + (error as any).message);
      } else {
        Alert.alert('Hata', 'Dosya yüklenirken bir hata oluştu');
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string, filePath: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Bu dosyayı silmek istediğinize emin misiniz?')
      : await new Promise((resolve) => {
          Alert.alert('Sil', 'Bu dosyayı silmek istediğinize emin misiniz?', [
            { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    try {
      await supabase.storage.from('technical-attachments').remove([filePath]);

      const { error } = await supabase
        .from('technical_service_assignment_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      loadAttachments();
      if (Platform.OS === 'web') {
        window.alert('Dosya silindi');
      } else {
        Alert.alert('Başarılı', 'Dosya silindi');
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      if (Platform.OS === 'web') {
        window.alert('Dosya silinirken bir hata oluştu: ' + (error as any).message);
      } else {
        Alert.alert('Hata', 'Dosya silinirken bir hata oluştu');
      }
    }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('technical-attachments')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const completeJob = async () => {
    if (!problemDesc || !solutionDesc) {
      if (Platform.OS === 'web') {
        window.alert('İşi tamamlamak için rapor bilgilerini doldurun');
      } else {
        Alert.alert('Uyarı', 'İşi tamamlamak için rapor bilgilerini doldurun');
      }
      return;
    }

    const confirmed = Platform.OS === 'web'
      ? window.confirm('İşi tamamlandı olarak işaretlemek istediğinize emin misiniz?')
      : await new Promise((resolve) => {
          Alert.alert(
            'İşi Tamamla',
            'İşi tamamlandı olarak işaretlemek istediğinize emin misiniz?',
            [
              { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Tamamla', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    setSaving(true);
    try {
      const { error: assignmentError } = await supabase
        .from('technical_service_assignments')
        .update({
          completion_date: new Date().toISOString(),
          problem_description: problemDesc,
          solution_description: solutionDesc,
          parts_used: partsUsed || null,
          labor_cost: laborCost ? parseFloat(laborCost) : null,
          parts_cost: partsCost ? parseFloat(partsCost) : null,
          warranty_months: warrantyMonths ? parseInt(warrantyMonths) : null,
        })
        .eq('id', id);

      if (assignmentError) throw assignmentError;

      if (assignment?.technical_service_requests?.id) {
        const { error: requestError } = await supabase
          .from('technical_service_requests')
          .update({ status: 'completed' })
          .eq('id', assignment.technical_service_requests.id);

        if (requestError) throw requestError;
      }

      if (Platform.OS === 'web') {
        window.alert('İş tamamlandı olarak işaretlendi');
        router.back();
      } else {
        Alert.alert('Başarılı', 'İş tamamlandı olarak işaretlendi', [
          {
            text: 'Tamam',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error completing job:', error);
      if (Platform.OS === 'web') {
        window.alert('İş tamamlanırken bir hata oluştu: ' + (error as any).message);
      } else {
        Alert.alert('Hata', 'İş tamamlanırken bir hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <FileText size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>İş Bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = !!assignment.completion_date;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>İş Detayı</Text>
          <Text style={styles.headerSub}>
            {assignment.technical_service_requests.technical_service_types.name}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.serviceTypeBadge}>
              <Text style={styles.serviceTypeText}>
                {assignment.technical_service_requests.technical_service_types.name}
              </Text>
            </View>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <CheckCircle size={14} color="#10b981" />
                <Text style={styles.completedText}>Tamamlandı</Text>
              </View>
            )}
          </View>

          <Text style={styles.jobTitle}>
            {assignment.technical_service_requests.title}
          </Text>
          <Text style={styles.jobDesc}>
            {assignment.technical_service_requests.description}
          </Text>

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Konum</Text>
            <View style={styles.infoRow}>
              <MapPin size={16} color={COLORS.textLight} />
              <Text style={styles.infoValue}>
                {assignment.technical_service_requests.location_address},{' '}
                {assignment.technical_service_requests.location_district},{' '}
                {assignment.technical_service_requests.location_city}
              </Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Sözleşme Bedeli</Text>
            <View style={styles.infoRow}>
              <DollarSign size={16} color={COLORS.textLight} />
              <Text style={styles.infoValue}>
                {formatCurrency(assignment.final_price)}
              </Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Tarihler</Text>
            <View style={styles.infoRow}>
              <Calendar size={16} color={COLORS.textLight} />
              <Text style={styles.infoValue}>
                Başlangıç: {formatDate(assignment.created_at)}
              </Text>
            </View>
            {isCompleted && (
              <View style={styles.infoRow}>
                <Calendar size={16} color={COLORS.textLight} />
                <Text style={styles.infoValue}>
                  Tamamlanma: {formatDate(assignment.completion_date!)}
                </Text>
              </View>
            )}
          </View>

          {(assignment.pm_approved || assignment.operations_approved) && (
            <View style={styles.approvalSection}>
              {assignment.pm_approved && (
                <View style={styles.approvalBadge}>
                  <CheckCircle size={14} color="#10b981" />
                  <Text style={styles.approvalText}>PM Onayı</Text>
                </View>
              )}
              {assignment.operations_approved && (
                <View style={styles.approvalBadge}>
                  <CheckCircle size={14} color="#10b981" />
                  <Text style={styles.approvalText}>Operasyon Onayı</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {!isCompleted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>İş Raporu</Text>

            <View style={styles.mediaSection}>
              <Text style={styles.label}>Fotoğraf/Video Ekle</Text>
              <View style={styles.mediaButtonsRow}>
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={takePicture}
                  disabled={uploading}
                >
                  <Camera size={20} color={COLORS.primary} />
                  <Text style={styles.mediaBtnText}>Fotoğraf Çek</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={pickImageFromGallery}
                  disabled={uploading}
                >
                  <ImageIcon size={20} color={COLORS.primary} />
                  <Text style={styles.mediaBtnText}>Galeriden Seç</Text>
                </TouchableOpacity>
              </View>

              {attachments.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsScroll}>
                  {attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      {attachment.file_type === 'image' ? (
                        <Image
                          source={{ uri: getFileUrl(attachment.file_path) }}
                          style={styles.attachmentImage}
                        />
                      ) : (
                        <View style={styles.videoPlaceholder}>
                          <Video size={32} color={COLORS.textLight} />
                          <Text style={styles.videoText}>Video</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.deleteAttachmentBtn}
                        onPress={() => deleteAttachment(attachment.id, attachment.file_path)}
                      >
                        <X size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {uploading && (
                <View style={styles.uploadingIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.uploadingText}>Yükleniyor...</Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Problem Tanımı *</Text>
              <TextInput
                style={styles.textArea}
                value={problemDesc}
                onChangeText={setProblemDesc}
                placeholder="Tespit edilen problemi detaylı açıklayın"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yapılan İşlem/Çözüm *</Text>
              <TextInput
                style={styles.textArea}
                value={solutionDesc}
                onChangeText={setSolutionDesc}
                placeholder="Yapılan işlemi detaylı açıklayın"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kullanılan Malzemeler</Text>
              <TextInput
                style={styles.textArea}
                value={partsUsed}
                onChangeText={setPartsUsed}
                placeholder="Kullanılan malzemeleri listeleyin"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>İşçilik (TL)</Text>
                <TextInput
                  style={styles.input}
                  value={laborCost}
                  onChangeText={setLaborCost}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Malzeme (TL)</Text>
                <TextInput
                  style={styles.input}
                  value={partsCost}
                  onChangeText={setPartsCost}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Garanti Süresi (Ay)</Text>
              <TextInput
                style={styles.input}
                value={warrantyMonths}
                onChangeText={setWarrantyMonths}
                placeholder="Örn: 12"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={saveJobReport}
                disabled={saving}
              >
                <Save size={18} color={COLORS.primary} />
                <Text style={styles.saveBtnText}>Taslak Kaydet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.completeBtn, saving && styles.btnDisabled]}
                onPress={completeJob}
                disabled={saving}
              >
                <CheckCircle size={18} color="white" />
                <Text style={styles.completeBtnText}>İşi Tamamla</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showCamera && Platform.OS === 'web' && (
          <View style={styles.cameraModal}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Fotoğraf Çek</Text>
              <TouchableOpacity onPress={() => setShowCamera(false)}>
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cameraNote}>
              Web üzerinde kamera kullanımı sınırlıdır. Galeriden fotoğraf seçmeyi deneyin.
            </Text>
            <TouchableOpacity
              style={styles.cameraCloseBtn}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.cameraCloseBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>İş Raporu</Text>

            {attachments.length > 0 && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Fotoğraf/Video</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsScroll}>
                  {attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      {attachment.file_type === 'image' ? (
                        <Image
                          source={{ uri: getFileUrl(attachment.file_path) }}
                          style={styles.attachmentImage}
                        />
                      ) : (
                        <View style={styles.videoPlaceholder}>
                          <Video size={32} color={COLORS.textLight} />
                          <Text style={styles.videoText}>Video</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.reportSection}>
              <Text style={styles.reportLabel}>Problem Tanımı</Text>
              <Text style={styles.reportValue}>
                {assignment.problem_description || '-'}
              </Text>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.reportLabel}>Yapılan İşlem/Çözüm</Text>
              <Text style={styles.reportValue}>
                {assignment.solution_description || '-'}
              </Text>
            </View>

            {assignment.parts_used && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Kullanılan Malzemeler</Text>
                <Text style={styles.reportValue}>{assignment.parts_used}</Text>
              </View>
            )}

            <View style={styles.costRow}>
              {assignment.labor_cost && (
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>İşçilik</Text>
                  <Text style={styles.costValue}>
                    {formatCurrency(assignment.labor_cost)}
                  </Text>
                </View>
              )}
              {assignment.parts_cost && (
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Malzeme</Text>
                  <Text style={styles.costValue}>
                    {formatCurrency(assignment.parts_cost)}
                  </Text>
                </View>
              )}
            </View>

            {assignment.warranty_months && (
              <View style={styles.warrantyBox}>
                <Text style={styles.warrantyText}>
                  {assignment.warranty_months} Ay Garanti
                </Text>
              </View>
            )}
          </View>
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 16,
  },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTypeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  serviceTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  jobDesc: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  approvalSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  approvalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 15,
    color: COLORS.secondary,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 15,
    color: COLORS.secondary,
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  reportSection: {
    marginBottom: 16,
  },
  reportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  reportValue: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 22,
  },
  costRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  costItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
  },
  costLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  warrantyBox: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  warrantyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  mediaSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  mediaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  attachmentsScroll: {
    marginTop: 12,
  },
  attachmentItem: {
    position: 'relative',
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  videoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  deleteAttachmentBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  uploadingText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  cameraModal: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  cameraNote: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 16,
  },
  cameraCloseBtn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cameraCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});
