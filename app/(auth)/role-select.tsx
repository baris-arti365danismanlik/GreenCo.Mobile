import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Briefcase, ClipboardList, ShieldCheck, ChevronRight, Wrench, Building2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { GreencoLogo } from '@/components/GreencoLogo';

type RoleOption = {
  key: string;
  icon: any;
  title: string;
  desc: string;
  color: string;
  route: string;
};

const roles: RoleOption[] = [
  {
    key: 'personnel',
    icon: User,
    title: 'Personel',
    desc: 'Giriş/Çıkış',
    color: COLORS.primary,
    route: '/(tabs)',
  },
  {
    key: 'manager',
    icon: Briefcase,
    title: 'Yönetici',
    desc: 'Onay & Puan',
    color: COLORS.blue,
    route: '/manager',
  },
  {
    key: 'operations',
    icon: ClipboardList,
    title: 'Operasyon (Personel)',
    desc: 'Talep & Proje',
    color: COLORS.amber,
    route: '/operations',
  },
  {
    key: 'technical',
    icon: Wrench,
    title: 'Teknik Hizmetler',
    desc: 'Teknik Talepler',
    color: COLORS.blue,
    route: '/technical',
  },
  {
    key: 'technical_company',
    icon: Building2,
    title: 'Teknisyen Firma',
    desc: 'Teklif & İşler',
    color: '#0284c7',
    route: '/technical-company',
  },
  {
    key: 'admin',
    icon: ShieldCheck,
    title: 'Admin',
    desc: 'Sistem Yönetimi',
    color: COLORS.purple,
    route: '/admin',
  },
];

export default function RoleSelect() {
  const router = useRouter();
  const { profile } = useAuth();

  const handleRoleSelect = (role: RoleOption) => {
    router.replace(role.route);
  };

  const serviceModules = (profile as any)?.service_modules || [];

  const availableRoles = roles.filter((role) => {
    if (role.key === 'personnel' && profile?.role === 'personnel') return true;
    if (role.key === 'manager' && profile?.role === 'project_manager' && serviceModules.length > 0) return true;
    if (role.key === 'operations' && profile?.role === 'operations' && serviceModules.includes('personnel')) return true;
    if (role.key === 'technical' && profile?.role === 'operations' && serviceModules.includes('technical')) return true;
    if (role.key === 'technical_company' && profile?.role === 'technical_company' && (profile as any)?.technical_company_id) return true;
    if (role.key === 'admin' && profile?.role === 'admin') return true;
    return false;
  });

  React.useEffect(() => {
    if (availableRoles.length === 1) {
      router.replace(availableRoles[0].route);
    }
  }, [availableRoles]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.centerContent}
      >
        <View style={styles.logoContainer}>
          <GreencoLogo size="medium" variant="light" />
        </View>
        <Text style={styles.title}>Hoş Geldiniz</Text>
        <Text style={styles.subtitle}>{profile?.full_name || 'Kullanıcı'}</Text>

        <View style={styles.rolesContainer}>
          {availableRoles.map((role) => (
            <TouchableOpacity
              key={role.key}
              style={[styles.roleBtn, { borderLeftColor: role.color, borderLeftWidth: 4 }]}
              onPress={() => handleRoleSelect(role)}
            >
              <View style={[styles.iconBox, { backgroundColor: role.color + '10' }]}>
                <role.icon size={24} color={role.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDesc}>{role.desc}</Text>
              </View>
              <ChevronRight size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 30,
  },
  rolesContainer: {
    width: '100%',
    gap: 10,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  roleDesc: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
});
