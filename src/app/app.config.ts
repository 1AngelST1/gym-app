import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// 1. Importamos las herramientas de Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

// 2. Tus llaves de conexión (Las de tu captura)
const firebaseConfig = {
  apiKey: "AIzaSyAwxMEjPhW5JA16ccOb3BTGJI221idRk_U",
  authDomain: "gymapp-12f16.firebaseapp.com",
  projectId: "gymapp-12f16",
  storageBucket: "gymapp-12f16.firebasestorage.app",
  messagingSenderId: "1080684019602",
  appId: "1:1080684019602:web:a1fc1afd30a1d26a140b4b"
};

// 3. Le pasamos Firebase al cerebro de Angular
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    
    // Encendemos la app de Firebase
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    
    // Encendemos la base de datos
    provideFirestore(() => getFirestore())
  ]
};