// lib/firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
// getReactNativePersistence solo existe en el bundle "react-native" de firebase/auth;
// los tipos por defecto (web) no lo declaran.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyB6CBtQ-aRsGh5TbDHIeuJ-yOQ3TRBIczM",
  authDomain: "controldehoras-efb3d.firebaseapp.com",
  projectId: "controldehoras-efb3d",
  storageBucket: "controldehoras-efb3d.firebasestorage.app",
  messagingSenderId: "984203415297",
  appId: "1:984203415297:web:b48afcc9280a3045195500"
};

const app = initializeApp(firebaseConfig);

// En web la sesión se guarda en IndexedDB por defecto.
// En nativo hay que indicarle a Firebase que use AsyncStorage; sin esto la sesión se pierde al cerrar la app.
const auth: Auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

const db = getFirestore(app);

export { auth, db };
