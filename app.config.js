import 'dotenv/config';

export default {
  expo: {
    name: "MeuTreinoEleitos",
    slug: "meutreino-eleitos",
    version: "1.0.0",
    sdkVersion: "48.0.0",
    web: {
      name: "MeuTreino Eleitos",
      shortName: "MeuTreino",
      favicon: "./assets/brand/favicon.png",
      backgroundColor: "#f7f8fb",
      themeColor: "#1e90ff"
    },
    extra: {
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'meu-treino-eleitos',
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'meu-treino-eleitos'}.firebaseapp.com`,
      DEFAULT_STUDENT_PASSWORD: process.env.DEFAULT_STUDENT_PASSWORD || 'Mudar@123',
      DEFAULT_TEACHER_PASSWORD: process.env.DEFAULT_TEACHER_PASSWORD || process.env.DEFAULT_STUDENT_PASSWORD || 'Mudar@123'
    }
  }
};
