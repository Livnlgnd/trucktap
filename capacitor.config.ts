import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.trucktap.mobile',
  appName: 'TruckTap',
  webDir: 'dist-mobile',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#fffdf9',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#fffdf9',
  },
}

export default config
