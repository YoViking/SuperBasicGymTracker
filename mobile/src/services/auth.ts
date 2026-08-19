import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../lib/supabase';

// Complete any pending auth sessions on web or Android
WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface HandleUrlResult {
  success: boolean;
  isRecovery?: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Extracts auth tokens or code from a callback URL and sets the Supabase session.
 */
export async function handleAuthUrl(url: string): Promise<HandleUrlResult> {
  if (!url) return { success: false };
  console.log('[Auth] Handling Auth URL:', url);

  try {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let code: string | null = null;
    let authType: string | null = null;
    let error: string | null = null;
    let errorCode: string | null = null;

    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    if (hashIndex !== -1) {
      const hashString = url.substring(hashIndex + 1);
      const hashParams = new URLSearchParams(hashString);
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      code = hashParams.get('code');
      authType = hashParams.get('type');
      error = hashParams.get('error') || hashParams.get('error_description');
      errorCode = hashParams.get('error_code');
    }

    if (!accessToken && !error && queryIndex !== -1) {
      const queryString = hashIndex !== -1 ? url.substring(queryIndex + 1, hashIndex) : url.substring(queryIndex + 1);
      const queryParams = new URLSearchParams(queryString);
      accessToken = queryParams.get('access_token');
      refreshToken = queryParams.get('refresh_token');
      if (!code) code = queryParams.get('code');
      if (!authType) authType = queryParams.get('type');
      if (!error) error = queryParams.get('error') || queryParams.get('error_description');
      if (!errorCode) errorCode = queryParams.get('error_code');
    }

    if (error || errorCode) {
      console.warn('[Auth] Auth URL contained error:', errorCode, error);
      return {
        success: false,
        isRecovery: authType === 'recovery' || url.includes('recovery'),
        error: error || 'Länken är ogiltig eller har gått ut',
        errorCode: errorCode || undefined,
      };
    }

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('[Auth] Error setting session from tokens:', sessionError);
        return { success: false, error: sessionError.message };
      }
      console.log('[Auth] Session successfully established from tokens!');
      return {
        success: true,
        isRecovery: authType === 'recovery' || url.includes('recovery'),
      };
    }

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[Auth] Error exchanging code for session:', exchangeError);
        return { success: false, error: exchangeError.message };
      }
      console.log('[Auth] Session successfully established from code!');
      return {
        success: true,
        isRecovery: authType === 'recovery' || url.includes('recovery'),
      };
    }

    // Check if session already exists
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      return { success: true };
    }
  } catch (err: any) {
    console.error('[Auth] Error processing auth URL:', err);
    return { success: false, error: err?.message };
  }

  return { success: false };
}

/**
 * Verifies 6-digit OTP code for password recovery.
 */
export async function verifyRecoveryOtp(email: string, token: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'recovery',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Kunde inte verifiera koden' };
  }
}

/**
 * Initiates Google OAuth login via Supabase and Expo WebBrowser.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    // In Expo Go, use exp:// url so Expo Go handles the return link
    // In standalone build, use superbasicgymtracker://auth
    const redirectUrl = isExpoGo
      ? AuthSession.makeRedirectUri({ path: 'auth' })
      : 'superbasicgymtracker://auth';

    console.log('[Auth] isExpoGo:', isExpoGo);
    console.log('[Auth] Using Redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.error('[Auth] Supabase OAuth URL error:', error);
      return {
        success: false,
        error: error?.message || 'Kunde inte starta Google-inloggning',
      };
    }

    console.log('[Auth] Opening WebBrowser with URL:', data.url);
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    console.log('[Auth] WebBrowser Result:', result);

    if (result.type === 'success' && result.url) {
      const handled = await handleAuthUrl(result.url);
      if (handled) {
        return { success: true };
      }
      return { success: false, error: 'Kunde inte läsa inloggningsuppgifter' };
    }

    // If dismissed or cancelled, check if session was set anyway
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      console.log('[Auth] Session detected after browser close!');
      return { success: true };
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Inloggningen avbröts' };
    }

    return { success: false, error: 'Inloggningen kunde inte slutföras' };
  } catch (err: any) {
    console.error('[Auth] Error during Google sign-in:', err);
    return {
      success: false,
      error: err?.message || 'Ett oväntat fel inträffade vid inloggning',
    };
  }
}

/**
 * Checks if an auth URL is a password recovery link.
 */
export function isRecoveryUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('type=recovery');
}

/**
 * Sends a password reset email via Supabase.
 */
export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  try {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const redirectUrl = isExpoGo
      ? AuthSession.makeRedirectUri({ path: 'auth' })
      : 'superbasicgymtracker://auth';

    console.log('[Auth] Sending password reset for:', email, 'redirectUrl:', redirectUrl);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('[Auth] Password reset error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Auth] Unexpected password reset error:', err);
    return {
      success: false,
      error: err?.message || 'Ett fel uppstod vid skickande av återställningslänk',
    };
  }
}

/**
 * Updates password for current authenticated session.
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Kunde inte uppdatera lösenordet',
    };
  }
}

