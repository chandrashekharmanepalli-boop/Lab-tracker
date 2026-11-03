import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole } from '../types/database';

export interface StudentRegistrationDetails {
  rollNo: string;
  department: string;
  year: number;
  semester: number;
  batch: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  isConfigured: boolean;
  authError: string | null;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (identifier: string, isPhone: boolean, password: string, fullName: string, role: UserRole, phone: string, subject: string, studentDetails?: StudentRegistrationDetails) => Promise<{ error: string | null; requiresPhoneConfirmation?: boolean }>;
  verifyPhoneSignup: (phone: string, token: string) => Promise<{ error: string | null }>;
  resendPhoneSignupCode: (phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  isConfigured: false,
  authError: null,
  signIn: async () => ({ error: 'Supabase is not configured.' }),
  signUp: async () => ({ error: 'Supabase is not configured.' }),
  verifyPhoneSignup: async () => ({ error: 'Supabase is not configured.' }),
  resendPhoneSignupCode: async () => ({ error: 'Supabase is not configured.' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      setAuthError(`Could not load your account profile: ${error.message}`);
      setProfile(null);
      return error.message;
    }

    setAuthError(null);
    setProfile(data);
    return null;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setAuthError(`Could not restore your session: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await fetchProfile(data.session.user.id);
      if (active) setIsLoading(false);
    };
    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setAuthError(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase is not configured. Add your project URL and public anon key to .env, then restart the app.' };
    }

    const credentials = identifier.includes('@')
      ? { email: identifier, password }
      : { phone: identifier, password };
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    return { error: data.user ? await fetchProfile(data.user.id) : null };
  };

  const signUp = async (
    identifier: string,
    isPhone: boolean,
    password: string,
    fullName: string,
    role: UserRole,
    phone: string,
    subject: string,
    studentDetails?: StudentRegistrationDetails,
  ): Promise<{ error: string | null; requiresPhoneConfirmation?: boolean }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase is not configured. Add your project URL and public anon key to .env, then restart the app.' };
    }

    const credentials = isPhone
      ? { phone: identifier, password }
      : { email: identifier, password };
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: {
        data: {
          full_name: fullName,
          role,
          phone: phone || null,
          subject: subject || null,
          ...(role === 'student' && studentDetails ? {
            roll_no: studentDetails.rollNo,
            department: studentDetails.department,
            year: studentDetails.year,
            semester: studentDetails.semester,
            batch: studentDetails.batch,
          } : {}),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    setAuthError(null);
    if (data.session && data.user) await fetchProfile(data.user.id);
    return { error: null, requiresPhoneConfirmation: isPhone && !data.session };
  };

  const verifyPhoneSignup = async (phone: string, token: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    return { error: data.user ? await fetchProfile(data.user.id) : null };
  };

  const resendPhoneSignupCode = async (phone: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resend({ type: 'sms', phone });
    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }

    return { error: null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(`Could not sign out: ${error.message}`);
      throw error;
    }
    setProfile(null);
  };

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isConfigured: isSupabaseConfigured,
        authError,
        signIn,
        signUp,
        verifyPhoneSignup,
        resendPhoneSignupCode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) {
    return (
      <div className="page-wrapper">
        <div className="alert alert-danger">
          <span>You do not have permission to view this page.</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
