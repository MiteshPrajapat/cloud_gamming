import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  orientationAngle: number;
}

export function useDeviceDetect(): DeviceInfo {
  const checkDevice = (): DeviceInfo => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isLandscape: true,
        isPortrait: false,
        orientationAngle: 0,
      };
    }

    const ua = navigator.userAgent.toLowerCase();
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    const isMobileUA = /android|iphone|ipod|windows phone/i.test(ua);
    const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(ua);

    // Screen dimension checks
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;

    const isMobile = isMobileUA || (isTouchDevice && Math.min(width, height) < 768);
    const isTablet = isTabletUA || (isTouchDevice && Math.min(width, height) >= 768 && Math.max(width, height) <= 1366);

    return {
      isMobile,
      isTablet,
      isTouchDevice,
      isLandscape,
      isPortrait: !isLandscape,
      orientationAngle: window.screen?.orientation?.angle || 0,
    };
  };

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(checkDevice);

  useEffect(() => {
    const handleResize = () => setDeviceInfo(checkDevice());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}
