import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'personnel' | 'project_manager' | 'operations' | 'admin' | 'technical_company';
  company_id: string | null;
  technical_company_id?: string | null;
  avatar_url: string | null;
  is_active: boolean;
  service_modules?: string[];
  city?: string | null;
  district?: string | null;
  tc_identity_no?: string | null;
  birth_date?: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPhone: (phone: string, password: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phone: string, otp: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: 'personnel' | 'project_manager' | 'operations' | 'admin',
    companyId?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedProfile = React.useRef(false);

  const loadProfile = async (userId: string) => {
    try {
      console.log('Loading profile for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile query error:', error);
        throw error;
      }

      if (!data) {
        console.error('No profile found for user:', userId);
        setProfile(null);
      } else {
        console.log('Profile loaded successfully:', data.role, data.full_name);
        setProfile(data);
      }

      hasLoadedProfile.current = true;
    } catch (error: any) {
      console.error('Error loading profile:', error.message || error);
      setProfile(null);
    } finally {
      console.log('Profile loading complete, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          console.log('Auth state changed:', event, 'User ID:', session?.user?.id);

          if (event === 'SIGNED_OUT') {
            console.log('Signing out, clearing all state');
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            hasLoadedProfile.current = false;
            return;
          }

          if (event === 'SIGNED_IN' && session?.user) {
            console.log('User signed in, loading profile. hasLoadedProfile:', hasLoadedProfile.current);
            setSession(session);
            setUser(session.user);
            console.log('User signed in, reloading profile...');
            setSession(session);
            setUser(session.user);
            await loadProfile(session.user.id);
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed, reloading profile');
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
              await loadProfile(session.user.id);
            }
          }
        })();
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPhone = async (phone: string, password: string) => {
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+90${phone}`;
      const email = `${formattedPhone.replace('+', '')}@greenco.app`;

      console.log('Giriş bilgileri:', { phone, formattedPhone, email });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase auth hatası:', error);
      } else {
        console.log('Auth başarılı, kullanıcı:', data.user?.id);
      }

      return { error };
    } catch (error) {
      console.error('SignInWithPhone exception:', error);
      return { error: error as Error };
    }
  };

  const verifyOTP = async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: '',
          phone,
          role: 'personnel',
          is_active: true,
        });
        if (insertError) throw insertError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithPassword = signInWithPhone;

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: 'personnel' | 'project_manager' | 'operations' | 'admin',
    companyId?: string
  ) => {
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+90${phone}`;
      const generatedEmail = `${formattedPhone.replace('+', '')}@greenco.app`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: generatedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        phone: formattedPhone,
        role,
        company_id: companyId || null,
        is_active: true,
      });

      if (profileError) throw profileError;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting sign out...');
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);

      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        console.error('AuthContext: Sign out error:', error);
      }
      console.log('AuthContext: Sign out successful');
    } catch (error: any) {
      if (error?.message !== 'Auth session missing!') {
        console.error('AuthContext: Error signing out:', error);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const forceRefreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      setSession(data.session);
      setUser(data.session.user);
      if (data.session.user) {
        await loadProfile(data.session.user.id);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signInWithPhone,
        verifyOTP,
        signIn,
        signInWithPassword,
        signUp,
        signOut,
        refreshProfile,
        forceRefreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
