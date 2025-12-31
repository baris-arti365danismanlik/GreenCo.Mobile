import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabledRanges?: { start: string; end: string }[];
};

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabledRanges = [],
}: DateRangePickerProps) {
  const [startError, setStartError] = useState('');
  const [endError, setEndError] = useState('');

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const isDateInRange = (dateStr: string, ranges: { start: string; end: string }[]): boolean => {
    const date = new Date(dateStr);
    return ranges.some(range => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      return date >= start && date <= end;
    });
  };

  const handleStartDateChange = (text: string) => {
    onStartDateChange(text);
    setStartError('');

    if (text.length === 10) {
      if (!validateDate(text)) {
        setStartError('Geçersiz tarih formatı (YYYY-MM-DD)');
      } else if (isDateInRange(text, disabledRanges)) {
        setStartError('Bu tarih zaten onaylanmış bir dönemde');
      }
    }
  };

  const handleEndDateChange = (text: string) => {
    onEndDateChange(text);
    setEndError('');

    if (text.length === 10) {
      if (!validateDate(text)) {
        setEndError('Geçersiz tarih formatı (YYYY-MM-DD)');
      } else if (isDateInRange(text, disabledRanges)) {
        setEndError('Bu tarih zaten onaylanmış bir dönemde');
      } else if (startDate && new Date(text) < new Date(startDate)) {
        setEndError('Bitiş tarihi başlangıçtan önce olamaz');
      }
    }
  };

  const setCurrentMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    onStartDateChange(startStr);
    onEndDateChange(endStr);

    if (isDateInRange(startStr, disabledRanges)) {
      setStartError('Bu tarih zaten onaylanmış bir dönemde');
    } else {
      setStartError('');
    }

    if (isDateInRange(endStr, disabledRanges)) {
      setEndError('Bu tarih zaten onaylanmış bir dönemde');
    } else {
      setEndError('');
    }
  };

  const setPreviousMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    onStartDateChange(startStr);
    onEndDateChange(endStr);

    if (isDateInRange(startStr, disabledRanges)) {
      setStartError('Bu tarih zaten onaylanmış bir dönemde');
    } else {
      setStartError('');
    }

    if (isDateInRange(endStr, disabledRanges)) {
      setEndError('Bu tarih zaten onaylanmış bir dönemde');
    } else {
      setEndError('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.quickButtons}>
        <TouchableOpacity style={styles.quickButton} onPress={setPreviousMonth}>
          <Text style={styles.quickButtonText}>Geçen Ay</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickButton} onPress={setCurrentMonth}>
          <Text style={styles.quickButtonText}>Bu Ay</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Calendar size={20} color={COLORS.textLight} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.inputLabel}>Başlangıç Tarihi</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={handleStartDateChange}
            maxLength={10}
          />
          {startError ? <Text style={styles.errorText}>{startError}</Text> : null}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Calendar size={20} color={COLORS.textLight} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.inputLabel}>Bitiş Tarihi</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            value={endDate}
            onChangeText={handleEndDateChange}
            maxLength={10}
          />
          {endError ? <Text style={styles.errorText}>{endError}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 15,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bg,
    padding: 15,
    borderRadius: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 5,
    fontWeight: '600',
  },
  dateInput: {
    fontSize: 16,
    color: COLORS.secondary,
    padding: 0,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
  },
});
