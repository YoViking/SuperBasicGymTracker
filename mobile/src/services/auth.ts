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

/**
 * Extracts auth tokens or code from a callback URL and sets the Supabase session.
 */
export async function handleAuthUrl(url: string): Promise<boolean> {
  if (!url) return false;
  console.log('[Auth] Handling Auth URL:', url);

  try {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let code: string | null = null;

    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    if (hashIndex !== -1) {
      const hashString = url.substring(hashIndex + 1);
      const hashParams = new URLSearchParams(hashString);
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      code = hashParams.get('code');
    }

    if (!accessToken && queryIndex !== -1) {
      const queryString = hashIndex !== -1 ? url.substring(queryIndex + 1, hashIndex) : url.substring(queryIndex + 1);
      const queryParams = new URLSearchParams(queryString);
      accessToken = queryParams.get('access_token');
      refreshToken = queryParams.get('refresh_token');
      if (!code) code = queryParams.get('code');
    }

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('[Auth] Error setting session from tokens:', sessionError);
        return false;
      }
      console.log('[Auth] Session successfully established from tokens!');
      return true;
    }

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[Auth] Error exchanging code for session:', exchangeError);
        return false;
      }
      console.log('[Auth] Session successfully established from code!');
      return true;
    }

    // Check if session already exists
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      return true;
    }
  } catch (err) {
    console.error('[Auth] Error processing auth URL:', err);
  }

  return false;
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
