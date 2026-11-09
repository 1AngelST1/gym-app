import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Importamos Firebase Auth
import { provideAuth, getAuth } from '@angular/fire/auth';
// Importamos Firebase App
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
// NUEVO: Importamos Firestore con persistencia local
import { provideFirestore, initializeFirestore, persistentLocalCache } from '@angular/fire/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAwxMEjPhW5JA16ccOb3BTGJI221idRk_U",
  authDomain: "gymapp-12f16.firebaseapp.com",
  projectId: "gymapp-12f16",
  storageBucket: "gymapp-12f16.firebasestorage.app",
  messagingSenderId: "1080684019602",
  appId: "1:1080684019602:web:a1fc1afd30a1d26a140b4b"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    
    // NUEVO: Encendemos Firestore en modo Offline-First
    provideFirestore(() => initializeFirestore(getApp(), {
      localCache: persistentLocalCache()
    })),

    provideAuth(() => getAuth())
  ]
};