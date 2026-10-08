import React, { ReactNode, useEffect } from 'react';
import style from './SafeAreaContainer.module.css';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { useLocation } from 'react-router-dom';
import { cl } from '@_linked/react/utils/ClassNames';

interface SafeAreaContainerProps {
  children: ReactNode;
  color?: string;
  resetTop?: boolean;
  resetBottom?: boolean;
  fullScreenRoutes?: string[];
}

export const SafeAreaContainer = ({
  children,
  color,
  resetTop = false,
  resetBottom = false,
  fullScreenRoutes,
}: SafeAreaContainerProps) => {
  /**
   * apply safearea for ios and android
   */
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SafeArea.getSafeAreaInsets().then(({ insets }) => {
        for (const [key, value] of Object.entries(insets)) {
          document.documentElement.style.setProperty(
            `--safe-area-${key}`,
            `${value}px`
          );
        }
      });
    }
  }, []);

  let location = useLocation();

  let backgroundColor = color;
  if (fullScreenRoutes) {
    const isFullScreen = fullScreenRoutes.some((route) =>
      location.pathname.startsWith(route)
    );
    backgroundColor = isFullScreen ? 'transparent' : color;
  }
  // check has color
  const styles = {};
  if (backgroundColor) {
    styles['backgroundColor'] = backgroundColor;
  }

  return (
    <div
      className={cl(
        style.root,
        resetTop && style.resetTop,
        resetBottom && style.resetBottom
      )}
    >
      {/* remove background safearea if resetTop is true */}
      {!resetTop && (
        <div className={cl(style.safearea, style['top'])} style={styles} />
      )}
      <div>{children}</div>
      {/* remove background safearea if resetBottom is true */}
      {!resetBottom && (
        <div className={cl(style.safearea, style['bottom'])} style={styles} />
      )}
    </div>
  );
};
