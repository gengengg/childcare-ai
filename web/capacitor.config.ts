import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gengg.childcareai',
  appName: '알림장 AI',
  webDir: 'dist',
  backgroundColor: '#FDFAF4',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#FDFAF4',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FDFAF4',
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
