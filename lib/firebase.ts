// components/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
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

// Inicializa la App global en la nube de Google
const app = initializeApp(firebaseConfig);

// Inicialización inteligente inmune a errores de módulos en TypeScript
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // En entornos móviles nativos, Firebase asimila AsyncStorage automáticamente mediante el puente interno de Expo
  auth = initializeAuth(app);
}

// Inicializa la base de datos NoSQL Cloud Firestore
const db = getFirestore(app);

export { auth, db };

