import React, { createContext, useContext, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ACCESS_TOKEN_EXPIRES,
  setAuthTokenStorageMethods,
} from '@_linked/auth/utils/token';
import { Preferences } from '@capacitor/preferences';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';

interface CapacitorContext {
  Capacitor: typeof Capacitor;
}
export const CapacitorContext = createContext<CapacitorContext | null>(null);

function useCapacitorProvider(): CapacitorContext {
  return {
    Capacitor,
  };
}

interface CapacitorProviderProps {
  children: React.ReactNode;
}
export function CapacitorProvider({ children }: CapacitorProviderProps) {
  const capacitor = useCapacitorProvider();

  const navigate = useNavigate();
  /**
   * AppUrlListener, used to handle deep links
   */
  useEffect(() => {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      // use URL constructor to parse the URL
      // example:
      // https://beerswift.com/tabs/tab2 --> /tabs/tab2
      // https://www.peacegame.earth/tabs --> /tabs
      const url = new URL(event.url);

      // extract the path from the URL
      const slug = url.pathname;

      // log the deeplink URL
      if (process.env.NODE_ENV === 'staging') {
        console.log('deeplink: ', slug);
      }

      if (slug) {
        navigate(slug);
      }
    });
  }, []);

  /**
   * set the storage token methods for Capacitor
   */
  useEffect(() => {
    const getTokenFn = async (key: string) => {
      const token = await Preferences.get({ key });
      return token?.value;
    };

    const setTokenFn = async (key: string, value: string) => {
      await Preferences.set({
        key: key,
        value: value,
      });
    };

    const removeTokenFn = async (key: string) => {
      await Preferences.remove({ key: key });
    };

    // set the preferences storage methods only for native platforms
    // and run this effect only once during component mount
    if (Capacitor.isNativePlatform()) {
      setAuthTokenStorageMethods(getTokenFn, setTokenFn, removeTokenFn);
    }
  }, []);

  return (
    <CapacitorContext.Provider value={capacitor}>
      {children}
    </CapacitorContext.Provider>
  );
}

export const useCapacitor = (): CapacitorContext => {
  const capacitor = useContext(CapacitorContext);

  if (!capacitor) {
    throw new Error('useCapacitor must be used within a <CapacitorProvider>');
  }

  return capacitor;
};
