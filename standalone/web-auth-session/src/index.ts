import NativeWebAuthSession from './NativeWebAuthSession';

export type AuthSessionResult =
  /** The browser was sent to the callback scheme. url is the full callback URL. */
  | { type: 'success'; url: string }
  /** The browser closed without reaching the callback scheme. */
  | { type: 'cancel' };

export type AuthSessionOptions = {
  /**
   * iOS only. Use a private browser session that shares no cookies with Safari. This also skips
   * the system alert that asks the user to allow the app to sign in. Default false.
   */
  preferEphemeralSession?: boolean;
};

/**
 * The `code` of an error that openAuthSession rejects with.
 * - NO_BROWSER: Android, no browser with Custom Tabs is installed and enabled.
 * - ALREADY_OPEN: another auth session is open.
 * - OPEN_FAILED: the browser could not be opened.
 */
export type AuthSessionErrorCode = 'NO_BROWSER' | 'ALREADY_OPEN' | 'OPEN_FAILED';

let current: {
  url: string;
  callbackScheme: string;
  result: Promise<AuthSessionResult>;
} | null = null;

/**
 * Opens url in the system's auth browser and resolves when the browser is sent to a URL with
 * callbackScheme (for example "myapp" for myapp://callback?code=…) or is closed.
 *
 * iOS uses ASWebAuthenticationSession. Android uses a Custom Tab, in the default browser if it
 * supports Custom Tabs, otherwise in Chrome, otherwise in any browser with Custom Tabs.
 * One session can be open at a time. A call with the same url and
 * callbackScheme while it is open returns the same promise, so a component that mounts twice
 * (React StrictMode) doesn't open a second browser.
 */
export function openAuthSession(
  url: string,
  callbackScheme: string,
  options: AuthSessionOptions = {}
): Promise<AuthSessionResult> {
  if (current) {
    return current.url === url && current.callbackScheme === callbackScheme
      ? current.result
      : Promise.reject(
          Object.assign(new Error('Another auth session is open'), {
            code: 'ALREADY_OPEN',
          })
        );
  }
  const result = NativeWebAuthSession.openAuthSession(
    url,
    callbackScheme,
    options.preferEphemeralSession ?? false
  )
    // iOS resolves a missing URL as undefined, Android as null.
    .then(
      (callbackUrl): AuthSessionResult =>
        callbackUrl ? { type: 'success', url: callbackUrl } : { type: 'cancel' }
    )
    .finally(() => {
      current = null;
    });
  current = { url, callbackScheme, result };
  return result;
}
