import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, Circle, Users, Wrench } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type ServiceModule = 'personnel' | 'technical';

type ServiceModuleSelectorProps = {
  selectedModules: string[];
  onSelectionChange: (modules: string[]) => void;
  disabled?: boolean;
};

const MODULES = [
  {
    id: 'personnel' as ServiceModule,
    name: 'Personel Hizmetleri',
    description: 'Personel talepleri ve yönetimi',
    icon: Users,
    color: '#059669',
    bgColor: '#d1fae5',
  },
  {
    id: 'technical' as ServiceModule,
    name: 'Teknik Hizmetler',
    description: 'Teknik destek ve çözümler',
    icon: Wrench,
    color: '#2563eb',
    bgColor: '#dbeafe',
  },
];

export function ServiceModuleSelector({
  selectedModules,
  onSelectionChange,
  disabled = false,
}: ServiceModuleSelectorProps) {
  const toggleModule = (moduleId: string) => {
    if (disabled) return;

    if (selectedModules.includes(moduleId)) {
      onSelectionChange(selectedModules.filter(id => id !== moduleId));
    } else {
      onSelectionChange([...selectedModules, moduleId]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Hizmet Modülleri</Text>
      <Text style={styles.helperText}>
        Kullanıcının erişebileceği modülleri seçin (birden fazla seçilebilir)
      </Text>

      <View style={styles.modulesGrid}>
        {MODULES.map(module => {
          const Icon = module.icon;
          const isSelected = selectedModules.includes(module.id);

          return (
            <TouchableOpacity
              key={module.id}
              style={[
                styles.moduleCard,
                isSelected && styles.moduleCardSelected,
                { borderColor: isSelected ? module.color : COLORS.border },
                disabled && styles.moduleCardDisabled,
              ]}
              onPress={() => toggleModule(module.id)}
              disabled={disabled}
            >
              <View style={styles.moduleHeader}>
                <View
                  style={[
                    styles.moduleIconContainer,
                    { backgroundColor: isSelected ? module.color : module.bgColor },
                  ]}
                >
                  <Icon size={24} color={isSelected ? 'white' : module.color} />
                </View>
                {isSelected ? (
                  <CheckCircle size={24} color={module.color} />
                ) : (
                  <Circle size={24} color={COLORS.border} />
                )}
              </View>

              <Text
                style={[
                  styles.moduleName,
                  isSelected && { color: module.color },
                ]}
              >
                {module.name}
              </Text>
              <Text style={styles.moduleDescription}>{module.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 12,
  },
  modulesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  moduleCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    minHeight: 140,
  },
  moduleCardSelected: {
    backgroundColor: '#f9fafb',
  },
  moduleCardDisabled: {
    opacity: 0.5,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  moduleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  moduleDescription: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
});
