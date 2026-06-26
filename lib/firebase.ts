// components/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Importación estándar oficial para Web y Web Apps
import { getFirestore } from 'firebase/firestore';

// REEMPLAZA ESTOS VALORES CON TUS LLAVES REALES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB6CBtQ-aRsGh5TbDHIeuJ-yOQ3TRBIczM",
  authDomain: "controldehoras-efb3d.firebaseapp.com",
  projectId: "controldehoras-efb3d",
  storageBucket: "controldehoras-efb3d.firebasestorage.app",
  messagingSenderId: "984203415297",
  appId: "1:984203415297:web:b48afcc9280a3045195500"
};

// Inicializa Firebase de forma global en la nube
const app = initializeApp(firebaseConfig);

// Inicializa el sistema de usuarios estándar (Firebase maneja la memoria web automáticamente)
const auth = getAuth(app);

// Inicializa la base de datos NoSQL Cloud Firestore
const db = getFirestore(app);

export { auth, db };

