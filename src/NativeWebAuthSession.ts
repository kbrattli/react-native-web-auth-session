import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Resolves with the callback URL, or null if the browser closed without one. Use
   * openAuthSession from the package root instead.
   */
  openAuthSession(
    url: string,
    callbackScheme: string,
    preferEphemeralSession: boolean,
    browserPackages: ReadonlyArray<string> | null
  ): Promise<string | null>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WebAuthSession');
