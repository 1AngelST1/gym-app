import { Component, inject, OnDestroy, OnInit, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Router } from '@angular/router';
import { Firestore, collection, onSnapshot, query, where, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, addDoc, orderBy } from '@angular/fire/firestore';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './perfil.component.html'
})
export class PerfilComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private authService = inject(AuthService); 
  private router = inject(Router);
  private injector = inject(Injector); 
  
  private historialCol = collection(this.firestore, 'historial');
  private rutinasCol = collection(this.firestore, 'rutinas'); 
  
  private listenerHistorial: any;

  // Estadísticas globales
  totalEntrenamientos = 0;
  totalMinutos = 0;
  totalVolumenKG = 0; 

  // Estado del Perfil
  perfilUsuario = {
    nombre: 'Usuario',
    nivel: 'Principiante',
    edad: null as number | null,
    peso: null as number | null,
    pesoMeta: null as number | null,
    genero: 'neutral'
  };
  modoEdicionPerfil = false;

  // Estado del Historial
  mostrarModalHistorial = false;
  filtroActivo: 'semana' | 'mes' | 'ano' | 'todo' = 'mes'; 
  historialCompleto: any[] = [];
  historialVisualizado: any[] = [];
  sesionSeleccionada: any = null; 

  // Estado de Eliminación de Rutina
  mostrarModalConfirmacion = false;
  idSesionABorrar: string | null = null;
  nombreRutinaABorrar: string | null = null;

  // Estado de Metas y Medidas
  mostrarModalMetas = false;
  historialMedidas: any[] = [];
  nuevaMedida = {
    peso: null as number | null,
    pecho: null as number | null,
    brazos: null as number | null,
    cintura: null as number | null,
    piernas: null as number | null
  };

  // Estado de Eliminación de Medidas
  mostrarModalConfirmacionMedida = false;
  idMedidaABorrar: string | null = null;

  // Estado de Notificaciones
  mostrarModalNotificacion = false;
  tituloNotificacion = '';
  tipoNotificacion: 'exito' | 'error' = 'exito';

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.cargarPerfilUsuario();
      this.iniciarListenerHistorial();
    });
  }

  // ==========================================
  // LÓGICA DE PERFIL Y NIVELES
  // ==========================================
  async cargarPerfilUsuario() {
    const userId = this.authService.currentUserUid;
    if (userId) {
      await runInInjectionContext(this.injector, async () => {
        const userRef = doc(this.firestore, `usuarios/${userId}`);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          this.perfilUsuario = { ...this.perfilUsuario, ...docSnap.data() };
        } else {
          // 🔴 Generar nombre por defecto basado en el correo electrónico si es nuevo usuario
          let nombreDefault = 'Usuario';
          const email = (this.authService as any).currentUserEmail || (this.authService as any).user?.email || '';
          if (email) {
            const alias = email.split('@')[0];
            if (alias) {
              // Toma los primeros 3 caracteres (ej. angel -> ang, a1a2 -> a1a, soporta puntos y guiones bajos)
              nombreDefault = alias.substring(0, 3);
            }
          }

          this.perfilUsuario.nombre = nombreDefault;
          await setDoc(userRef, this.perfilUsuario);
        }
      });
    }
  }

  async guardarPerfilUsuario() {
    const userId = this.authService.currentUserUid;
    if (userId) {
      // 🔴 BLOQUEAR NÚMEROS NEGATIVOS
      if (
        (this.perfilUsuario.edad !== null && this.perfilUsuario.edad < 0) ||
        (this.perfilUsuario.peso !== null && this.perfilUsuario.peso < 0) ||
        (this.perfilUsuario.pesoMeta !== null && this.perfilUsuario.pesoMeta < 0)
      ) {
        this.mostrarNotificacion("No se aceptan números negativos", "error");
        return; // Detenemos el guardado
      }

      try {
        if (!this.perfilUsuario.nombre || this.perfilUsuario.nombre.trim() === '') {
          this.perfilUsuario.nombre = 'Usuario';
        }

        await runInInjectionContext(this.injector, () => {
           const userRef = doc(this.firestore, `usuarios/${userId}`);
           return updateDoc(userRef, this.perfilUsuario);
        });
        
        this.modoEdicionPerfil = false;
        this.mostrarNotificacion("¡Perfil Actualizado!", "exito");
      } catch (error) {
        console.error("Error guardando perfil:", error);
        this.mostrarNotificacion("Error al actualizar", "error");
      }
    }
  }

  evaluarNivelAutomatico(volumenTotal: number) {
    let nivelCalculado = 'Principiante';
    if (volumenTotal >= 50000 && volumenTotal < 250000) nivelCalculado = 'Intermedio';
    else if (volumenTotal >= 250000) nivelCalculado = 'Avanzado';

    if (this.perfilUsuario.nivel !== nivelCalculado) {
      this.perfilUsuario.nivel = nivelCalculado;
      this.actualizarNivelSilencioso();
    }
  }

  async actualizarNivelSilencioso() {
    const userId = this.authService.currentUserUid;
    if (userId) {
      const userRef = doc(this.firestore, `usuarios/${userId}`);
      try {
        await runInInjectionContext(this.injector, async () => {
           await updateDoc(userRef, { nivel: this.perfilUsuario.nivel });
        });
      } catch (error) {
        console.error("Error actualizando nivel:", error);
      }
    }
  }

  // ==========================================
  // LÓGICA DE HISTORIAL DE RUTINAS Y RECÁLCULOS
  // ==========================================
  iniciarListenerHistorial() {
    const userId = this.authService.currentUserUid;
    if (userId) {
      runInInjectionContext(this.injector, () => {
        const consultaUsuario = query(this.historialCol, where('userId', '==', userId));

        this.listenerHistorial = onSnapshot(consultaUsuario, (snapshot: any) => {
          let entrenamientosCompletados = 0;
          let segundosTotales = 0;
          let volumenCalculado = 0; 
          
          this.historialCompleto = []; 

          snapshot.forEach((doc: any) => {
            const sesion: any = { id: doc.id, ...doc.data() };
            
            if (sesion['estado'] === 'completado') {
              entrenamientosCompletados++;
              if (sesion['duracionSegundos']) segundosTotales += sesion['duracionSegundos'];

              if (sesion.ejercicios) {
                sesion.ejercicios.forEach((ej: any) => {
                  if (ej.setsActivos) {
                    ej.setsActivos.forEach((set: any) => {
                      if (set.completado && set.kg && set.reps) {
                        volumenCalculado += (set.kg * set.reps);
                      }
                    });
                  }
                });
              }
              this.historialCompleto.push(sesion);
            }
          });
          
          this.totalEntrenamientos = entrenamientosCompletados;
          this.totalMinutos = Math.floor(segundosTotales / 60);
          this.totalVolumenKG = volumenCalculado; 

          this.evaluarNivelAutomatico(this.totalVolumenKG);

          this.historialCompleto.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
          this.aplicarFiltro(this.filtroActivo);
        });
      });
    }
  }

  ngOnDestroy() {
    if (this.listenerHistorial) this.listenerHistorial();
  }

  abrirHistorial() {
    this.mostrarModalHistorial = true;
    this.sesionSeleccionada = null; 
  }

  cerrarHistorial() {
    this.mostrarModalHistorial = false;
    this.sesionSeleccionada = null;
  }

  aplicarFiltro(filtro: 'semana' | 'mes' | 'ano' | 'todo') {
    this.filtroActivo = filtro;
    this.sesionSeleccionada = null; 
    
    if (filtro === 'todo') {
      this.historialVisualizado = [...this.historialCompleto];
      return;
    }

    const fechaLimite = new Date();
    if (filtro === 'semana') fechaLimite.setDate(fechaLimite.getDate() - 7);
    if (filtro === 'mes') fechaLimite.setMonth(fechaLimite.getMonth() - 1);
    if (filtro === 'ano') fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);

    this.historialVisualizado = this.historialCompleto.filter(sesion => {
      const fechaSesion = new Date(sesion.fechaCompleta);
      return fechaSesion >= fechaLimite;
    });
  }

  verDetallesSesion(sesion: any) { this.sesionSeleccionada = sesion; }
  volverAListaHistorial() { this.sesionSeleccionada = null; }

  solicitarEliminacion(idRegistro: string, nombreRutina: string) {
    this.idSesionABorrar = idRegistro;
    this.nombreRutinaABorrar = nombreRutina;
    this.mostrarModalConfirmacion = true;
  }

  cerrarModalConfirmacion() {
    this.mostrarModalConfirmacion = false;
    this.idSesionABorrar = null;
    this.nombreRutinaABorrar = null;
  }

  async confirmarEliminacion() {
    if (!this.idSesionABorrar || !this.nombreRutinaABorrar) return;

    try {
      const userId = this.authService.currentUserUid;
      const idTarget = this.idSesionABorrar;
      const nombreTarget = this.nombreRutinaABorrar;
      
      await runInInjectionContext(this.injector, () => {
        return deleteDoc(doc(this.historialCol, idTarget));
      });

      const { qHistorial, qRutina } = runInInjectionContext(this.injector, () => {
        return {
          qHistorial: query(
            this.historialCol, 
            where('userId', '==', userId), 
            where('rutinaNombre', '==', nombreTarget), 
            where('estado', '==', 'completado')
          ),
          qRutina: query(
            this.rutinasCol, 
            where('userId', '==', userId), 
            where('nombre', '==', nombreTarget)
          )
        };
      });

      const docs = await runInInjectionContext(this.injector, () => {
        return getDocs(qHistorial);
      });

      let historiales: any[] = [];
      docs.forEach(d => {
        const data = d.data() as Record<string, any>;
        historiales.push({ id: d.id, ...data });
      });

      let nuevosMinutos = 0; 
      if (historiales.length > 0) {
        historiales.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
        const ultimoEntrenamientoVivo = historiales[0];
        nuevosMinutos = Math.ceil(ultimoEntrenamientoVivo.duracionSegundos / 60);
      }

      const rutinasSnap = await runInInjectionContext(this.injector, () => {
        return getDocs(qRutina);
      });

      if (!rutinasSnap.empty) {
        const rutinaDoc = rutinasSnap.docs[0];
        if (rutinaDoc) {
          await runInInjectionContext(this.injector, () => {
            return updateDoc(rutinaDoc.ref, { duracion: nuevosMinutos });
          });
        }
      }

      this.cerrarModalConfirmacion();
      this.sesionSeleccionada = null; 
      this.mostrarNotificacion("Sesión Eliminada", "exito");
    } catch (error) {
      console.error("Error al eliminar del historial:", error);
      this.mostrarNotificacion("Error al eliminar", "error");
    }
  }

  // ==========================================
  // LÓGICA DE METAS Y MEDIDAS CORPORALES
  // ==========================================
  async abrirMetas() {
    this.nuevaMedida.peso = this.perfilUsuario.peso; 
    await this.cargarHistorialMedidas();
    this.mostrarModalMetas = true;
  }

  cerrarMetas() {
    this.mostrarModalMetas = false;
  }

  async cargarHistorialMedidas() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    try {
      const querySnapshot = await runInInjectionContext(this.injector, () => {
        const medidasRef = collection(this.firestore, `usuarios/${userId}/medidas`);
        const q = query(medidasRef, orderBy('fechaIso', 'desc'));
        return getDocs(q); 
      });
      
      this.historialMedidas = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Record<string, any>;
        this.historialMedidas.push({ id: doc.id, ...data });
      });
    } catch (error) {
      console.error("Error cargando medidas:", error);
    }
  }

 async guardarMedida() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    // 🔴 VALIDAR PESO PRINCIPAL
    if (!this.nuevaMedida.peso || this.nuevaMedida.peso <= 0) {
      this.mostrarNotificacion("Ingresa un peso actual válido", "error");
      return;
    }

    // 🔴 BLOQUEAR MEDIDAS NEGATIVAS
    if (
      (this.nuevaMedida.pecho !== null && this.nuevaMedida.pecho < 0) ||
      (this.nuevaMedida.brazos !== null && this.nuevaMedida.brazos < 0) ||
      (this.nuevaMedida.cintura !== null && this.nuevaMedida.cintura < 0) ||
      (this.nuevaMedida.piernas !== null && this.nuevaMedida.piernas < 0)
    ) {
      this.mostrarNotificacion("Las medidas no pueden ser negativas", "error");
      return; // Detenemos el guardado
    }

    try {
      const ahora = new Date();
      // Los vacíos (null) se siguen guardando como 0, pero los negativos ya fueron bloqueados arriba
      const registro = {
        peso: this.nuevaMedida.peso,
        pecho: this.nuevaMedida.pecho || 0,
        brazos: this.nuevaMedida.brazos || 0,
        cintura: this.nuevaMedida.cintura || 0,
        piernas: this.nuevaMedida.piernas || 0,
        fechaIso: ahora.toISOString(),
        fechaCorta: ahora.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      };

      await runInInjectionContext(this.injector, () => {
        const medidasRef = collection(this.firestore, `usuarios/${userId}/medidas`);
        return addDoc(medidasRef, registro);
      });

      await runInInjectionContext(this.injector, () => {
        const userRef = doc(this.firestore, `usuarios/${userId}`);
        return updateDoc(userRef, { peso: this.nuevaMedida.peso });
      });

      this.perfilUsuario.peso = this.nuevaMedida.peso;
      this.nuevaMedida = { peso: this.perfilUsuario.peso, pecho: null, brazos: null, cintura: null, piernas: null };
      
      await this.cargarHistorialMedidas();
      this.mostrarNotificacion("¡Progreso Guardado!", "exito");
      
    } catch (error) {
      console.error("Error guardando medida:", error);
      this.mostrarNotificacion("Error al guardar", "error");
    }
  }

  solicitarEliminacionMedida(idMedida: string) {
    this.idMedidaABorrar = idMedida;
    this.mostrarModalConfirmacionMedida = true;
  }

  cerrarModalConfirmacionMedida() {
    this.mostrarModalConfirmacionMedida = false;
    this.idMedidaABorrar = null;
  }

  async confirmarEliminacionMedida() {
    if (!this.idMedidaABorrar) return;
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    try {
      const idTarget = this.idMedidaABorrar; 
      
      await runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `usuarios/${userId}/medidas/${idTarget}`);
        return deleteDoc(docRef);
      });
      
      this.cerrarModalConfirmacionMedida();
      this.mostrarNotificacion("Registro eliminado", "exito");
      await this.cargarHistorialMedidas();
    } catch (error) {
      console.error("Error eliminando medida:", error);
      this.cerrarModalConfirmacionMedida();
      this.mostrarNotificacion("Error al eliminar", "error");
    }
  }

  async guardarPesoMeta() {
    const userId = this.authService.currentUserUid;
    if (userId) {
      // 🔴 BLOQUEAR META NEGATIVA
      if (this.perfilUsuario.pesoMeta !== null && this.perfilUsuario.pesoMeta < 0) {
        this.mostrarNotificacion("La meta no puede ser negativa", "error");
        return; // Detenemos el guardado
      }

      try {
        await runInInjectionContext(this.injector, async () => {
           const userRef = doc(this.firestore, `usuarios/${userId}`);
           await updateDoc(userRef, { pesoMeta: this.perfilUsuario.pesoMeta });
        });
        this.mostrarNotificacion("¡Meta Actualizada!", "exito");
      } catch (error) {
        console.error("Error guardando meta:", error);
        this.mostrarNotificacion("Error al actualizar", "error");
      }
    }
  }

  // ==========================================
  // SISTEMA DE NOTIFICACIONES Y AUTH
  // ==========================================
  mostrarNotificacion(titulo: string, tipo: 'exito' | 'error') {
    this.tituloNotificacion = titulo;
    this.tipoNotificacion = tipo;
    this.mostrarModalNotificacion = true;
  }

  cerrarNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  async cerrarSesion() {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error: any) { 
      console.error('Error al cerrar sesión:', error);
    }
  }
}