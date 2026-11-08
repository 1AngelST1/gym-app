import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, authState } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  // 🔴 NUEVO: Inyectamos el Injector global de Angular
  private injector: Injector = inject(Injector); 

  // Observable para escuchar si hay un usuario logueado o no en tiempo real
  public user$: Observable<any> = authState(this.auth);

  constructor() {}

  // Función para Registrarse
  registro(email: string, pass: string) {
    // 🔴 Envolvemos la llamada en el contexto seguro
    return runInInjectionContext(this.injector, () => {
      return createUserWithEmailAndPassword(this.auth, email, pass);
    });
  }

  // Función para Iniciar Sesión
  login(email: string, pass: string) {
    // 🔴 Envolvemos la llamada en el contexto seguro
    return runInInjectionContext(this.injector, () => {
      return signInWithEmailAndPassword(this.auth, email, pass);
    });
  }

  // Función para Cerrar Sesión
  logout() {
      return runInInjectionContext(this.injector, () => {
      return signOut(this.auth);
    });
  }

  // Obtener el ID del usuario actual de forma síncrona
  get currentUserUid(): string | null {
    return this.auth.currentUser ? this.auth.currentUser.uid : null;
  }
}