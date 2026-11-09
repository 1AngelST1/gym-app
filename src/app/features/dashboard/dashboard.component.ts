import { Component, inject, Injector, runInInjectionContext, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Firestore, collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, where, getDocs, getDoc, setDoc } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private injector = inject(Injector); 
  private authService = inject(AuthService);
  private zone = inject(NgZone); 
  private auth: Auth = inject(Auth); 
  
  private rutinasCol = collection(this.firestore, 'rutinas');
  private historialCol = collection(this.firestore, 'historial');
  
  private listenerRutinas: any;
  private listenerHistorial: any;

  rutinasHoy: any[] = [];
  rutinasManana: any[] = [];
  rutinasResto: any[] = [];
  historialHoy: any[] = []; 
  
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  diaHoyStr = '';
  diaMananaStr = '';

  opcionesMusculos = [
    'Cuello', 'Trapecios', 'Hombros', 'Pecho', 'Dorsales', 
    'Lumbar', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen', 
    'Oblicuos', 'Glúteos', 'Cuádriceps', 'Isquios', 'Aductores', 'Pantorrillas'
  ];

  rutinaSeleccionada: any = null;
  modoEdicion = false;
  rutinaEnEdicion: any = null;

  entrenamientoActivo = false;
  rutinaActiva: any = null;
  tiempoSegundos = 0;
  timerInterval: any;
  ejercicioActualIndex = 0;
  horaInicioEntrenamiento: string = ''; 
  historialActivoId: string | null = null; 

  mostrarResumen = false;
  resumenDatos: any = null;

  mensajeAlerta: string | null = null;
  mostrarModalConfirmacion = false;
  tituloConfirmacion = '';
  mensajeConfirmacion = '';
  accionConfirmacion: 'cancelar' | 'pausar' | 'eliminarRutina' | null = null;
  
  sesionIncompletaPendiente: any = null;

  constructor() {
    this.calcularDias();
    const hoyCorta = new Date().toLocaleDateString('es-MX');
    
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const userId = user.uid;

        const consultaRutinas = query(this.rutinasCol, where('userId', '==', userId));
        this.listenerRutinas = onSnapshot(consultaRutinas, 
          (snapshot) => {
            this.zone.run(() => {
              this.rutinasHoy = [];
              this.rutinasManana = [];
              this.rutinasResto = [];

              snapshot.forEach((documento) => {
                const rutina: any = { id: documento.id, ...documento.data() };
                if (rutina.dia === this.diaHoyStr) this.rutinasHoy.push(rutina);
                else if (rutina.dia === this.diaMananaStr) this.rutinasManana.push(rutina);
                else this.rutinasResto.push(rutina);
              });
            });
          },
          (error) => { console.log('Sincronización pausada.'); }
        );

        const consultaHistorial = query(this.historialCol, where('userId', '==', userId));
        this.listenerHistorial = onSnapshot(consultaHistorial, 
          (snapshot) => {
            this.zone.run(() => {
              this.historialHoy = [];
              snapshot.forEach((documento) => {
                const datos = documento.data();
                if (datos['fechaCorta'] === hoyCorta) {
                  this.historialHoy.push({ id: documento.id, ...datos });
                }
              });
            });
          },
          (error) => { console.log('Historial pausado.'); }
        );
      } else {
        this.zone.run(() => {
          this.rutinasHoy = [];
          this.rutinasManana = [];
          this.rutinasResto = [];
          this.historialHoy = [];
        });
        if (this.listenerRutinas) this.listenerRutinas();
        if (this.listenerHistorial) this.listenerHistorial();
      }
    });
  }

  ngOnDestroy() {
    if (this.listenerRutinas) this.listenerRutinas();
    if (this.listenerHistorial) this.listenerHistorial();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  generarId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  calcularDias() {
    const fechaActual = new Date();
    const indexHoy = fechaActual.getDay();
    const indexManana = (indexHoy + 1) % 7; 
    this.diaHoyStr = this.diasSemana[indexHoy];
    this.diaMananaStr = this.diasSemana[indexManana];
  }

  abrirDetalle(rutina: any) {
    this.rutinaSeleccionada = rutina;
    this.modoEdicion = false;
  }

  cerrarDetalle() {
    this.rutinaSeleccionada = null;
    this.modoEdicion = false;
  }

  activarEdicion() {
    this.modoEdicion = true;
    this.rutinaEnEdicion = JSON.parse(JSON.stringify(this.rutinaSeleccionada));
    if (!this.rutinaEnEdicion.ejerciciosLista) this.rutinaEnEdicion.ejerciciosLista = [];
    
    this.rutinaEnEdicion.ejerciciosLista.forEach((ej: any) => {
      if (!ej.id) ej.id = this.generarId();
    });
  }

  cancelarEdicion() {
    this.modoEdicion = false;
  }

  agregarEjercicioEdit() {
    this.rutinaEnEdicion.ejerciciosLista.push({ 
      id: this.generarId(), 
      nombre: '', 
      musculoAsignado: '', 
      sets: null, 
      reps: null 
    });
  }

  eliminarEjercicioEdit(index: number) {
    this.rutinaEnEdicion.ejerciciosLista.splice(index, 1);
  }

  mostrarAlerta(mensaje: string) {
    this.mensajeAlerta = mensaje;
    setTimeout(() => {
      this.mensajeAlerta = null;
    }, 3500);
  }

  async guardarEdicion() {
    this.rutinaEnEdicion.ejerciciosLista = this.rutinaEnEdicion.ejerciciosLista.filter((ej: any) => {
      return ej.nombre.trim() !== '' || ej.musculoAsignado !== '' || ej.sets > 0 || ej.reps > 0;
    });

    if (!this.rutinaEnEdicion.nombre || this.rutinaEnEdicion.nombre.trim() === '') {
      this.mostrarAlerta('Ponle un nombre a tu rutina antes de guardar.');
      return;
    }
    if (!this.rutinaEnEdicion.ejerciciosLista || this.rutinaEnEdicion.ejerciciosLista.length === 0) {
      this.mostrarAlerta('La rutina debe tener al menos un ejercicio.');
      return;
    }
    
    for (let ej of this.rutinaEnEdicion.ejerciciosLista) {
      if (!ej.nombre || ej.nombre.trim() === '') {
        this.mostrarAlerta('Hay un ejercicio sin nombre.');
        return;
      }
      if (!ej.musculoAsignado) {
        this.mostrarAlerta(`Falta asignar músculo a: ${ej.nombre}`);
        return;
      }
      if (!ej.sets || ej.sets <= 0 || !ej.reps || ej.reps <= 0) {
        this.mostrarAlerta(`Revisa los sets y reps de: ${ej.nombre}`);
        return;
      }
    }

    try {
      const nombreEstandarizado = this.rutinaEnEdicion.nombre.trim().toUpperCase();
      const dataActualizada = { ...this.rutinaEnEdicion, nombre: nombreEstandarizado, ejercicios: this.rutinaEnEdicion.ejerciciosLista.length };
      
      await runInInjectionContext(this.injector, async () => {
        const rutinaRef = doc(this.rutinasCol, this.rutinaEnEdicion.id);
        await updateDoc(rutinaRef, dataActualizada);
      });
      
      this.rutinaSeleccionada = dataActualizada; 
      this.modoEdicion = false; 
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  }

  eliminarRutinaCompleta() {
    this.tituloConfirmacion = '¿Eliminar Rutina?';
    this.mensajeConfirmacion = 'Esta acción borrará toda la rutina permanentemente.';
    this.accionConfirmacion = 'eliminarRutina';
    this.mostrarModalConfirmacion = true;
  }

  async empezarEntrenamiento() {
    const sesionIncompleta = this.historialHoy.find(h => 
      h.rutinaNombre === this.rutinaSeleccionada.nombre && h.estado === 'incompleto'
    );

    if (sesionIncompleta) {
      this.sesionIncompletaPendiente = sesionIncompleta;
      this.tituloConfirmacion = 'Entrenamiento en Pausa';
      this.mensajeConfirmacion = 'Tienes una sesión pausada hoy. ¿Deseas retomarla?';
      this.accionConfirmacion = 'pausar'; 
      this.mostrarModalConfirmacion = true;
      return;
    }
    await this.empezarDeCero();
  }

  async empezarDeCero() {
    this.historialActivoId = null; 
    this.rutinaActiva = JSON.parse(JSON.stringify(this.rutinaSeleccionada)); 
    // Aseguramos que el ID global de la rutina viaje al entorno activo
    this.rutinaActiva.id = this.rutinaSeleccionada.id; 
    
    this.rutinaActiva.ejerciciosLista = this.rutinaActiva.ejerciciosLista.map((ej: any) => {
      if (!ej.id) ej.id = this.generarId(); 
      const filasDeSets = [];
      const totalSets = ej.sets || 1; 
      for(let i = 0; i < totalSets; i++) filasDeSets.push({ kg: 0, reps: ej.reps, completado: false, previoString: '-' });
      return { ...ej, setsActivos: filasDeSets }; 
    });

    this.cerrarDetalle(); 
    this.entrenamientoActivo = true; 
    this.tiempoSegundos = 0;
    this.horaInicioEntrenamiento = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    this.timerInterval = setInterval(() => { this.tiempoSegundos++; }, 1000);

    await this.cargarPrevios();
  }

  async retomarSesion(id: string, datosGuardados: any) {
    this.historialActivoId = id; 

    let ejerciciosSincronizados = datosGuardados.ejercicios.map((ejGuardado: any, index: number) => {
      const ejPlantilla = this.rutinaSeleccionada.ejerciciosLista[index];
      if (ejPlantilla) {
        return {
          ...ejGuardado,
          id: ejPlantilla.id || ejGuardado.id, 
          nombre: ejPlantilla.nombre,
          musculoAsignado: ejPlantilla.musculoAsignado
        };
      }
      return ejGuardado; 
    });

    this.rutinaActiva = { 
      id: this.rutinaSeleccionada.id, 
      nombre: this.rutinaSeleccionada.nombre, 
      ejerciciosLista: ejerciciosSincronizados 
    };
    
    this.cerrarDetalle(); 
    this.entrenamientoActivo = true; 
    this.tiempoSegundos = datosGuardados.duracionSegundos; 
    this.horaInicioEntrenamiento = datosGuardados.horaInicio;
    
    this.timerInterval = setInterval(() => { this.tiempoSegundos++; }, 1000);

    await this.cargarPrevios();
  }

  async cargarPrevios() {
    try {
      // 🔴 BLINDAJE APLICADO: Envolvemos getDocs en el contexto seguro
      await runInInjectionContext(this.injector, async () => {
        const q = query(
          this.historialCol, 
          where('userId', '==', this.authService.currentUserUid), 
          where('rutinaNombre', '==', this.rutinaActiva.nombre), 
          where('estado', '==', 'completado')
        );
        
        const docs = await getDocs(q);
        let historiales: any[] = [];
        docs.forEach(d => historiales.push(d.data()));
        
        if (historiales.length > 0) {
          historiales.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
          const ultimoEntrenamiento = historiales[0];
          
          this.rutinaActiva.ejerciciosLista.forEach((ejActivo: any) => {
            const ejPrevio = ultimoEntrenamiento.ejercicios.find((e: any) => e.id === ejActivo.id || e.nombre === ejActivo.nombre);
            
            if (ejPrevio && ejPrevio.setsActivos) {
              ejActivo.setsActivos.forEach((set: any, i: number) => {
                if (ejPrevio.setsActivos[i]) {
                  set.previoString = `${ejPrevio.setsActivos[i].kg}kg x ${ejPrevio.setsActivos[i].reps}`;
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error("Error al cargar previos:", error);
    }
  }

  solicitarCancelar() {
    this.tituloConfirmacion = '¿Cancelar Entrenamiento?';
    this.mensajeConfirmacion = 'Se perderá el progreso actual de esta sesión.';
    this.accionConfirmacion = 'cancelar';
    this.mostrarModalConfirmacion = true;
  }

  solicitarPausar() {
    this.tituloConfirmacion = '¿Pausar Sesión?';
    this.mensajeConfirmacion = 'Podrás retomarla más tarde el día de hoy desde tu plan.';
    this.accionConfirmacion = 'pausar';
    this.mostrarModalConfirmacion = true;
  }

  limpiarEntrenamientoActivo() {
    this.rutinaActiva.ejerciciosLista = this.rutinaActiva.ejerciciosLista.filter((ej: any) => {
      return ej.nombre && ej.nombre.trim() !== '' && ej.musculoAsignado && ej.musculoAsignado !== '';
    });

    this.rutinaActiva.ejerciciosLista.forEach((ej: any) => {
      ej.setsActivos.forEach((set: any) => {
        if (set.kg === null || set.kg === undefined || set.kg === '') set.kg = 0;
        if (set.reps === null || set.reps === undefined || set.reps === '') set.reps = 0;
      });
    });
  }

 async ejecutarAccionConfirmada() {
    this.mostrarModalConfirmacion = false;

    if (this.accionConfirmacion === 'cancelar') {
      clearInterval(this.timerInterval); 
      
      if (this.historialActivoId) {
        try {
          const idParaBorrar = this.historialActivoId; // Guardamos el ID antes de limpiar
          const nombreRutinaCancelada = this.rutinaActiva.nombre;
          const idRutinaPlantilla = this.rutinaActiva.id; // Necesitamos saber a qué tarjeta actualizarle el tiempo

          await runInInjectionContext(this.injector, async () => {
            // 1. Borramos la sesión cancelada
            await deleteDoc(doc(this.historialCol, idParaBorrar as string)); 
            console.log("🗑️ Sesión borrada exitosamente");

            // 2. RECÁLCULO DINÁMICO: Buscamos el último entrenamiento completado de esta rutina
            const q = query(
              this.historialCol, 
              where('userId', '==', this.authService.currentUserUid), 
              where('rutinaNombre', '==', nombreRutinaCancelada), 
              where('estado', '==', 'completado')
            );
            
            const docs = await getDocs(q);
            let historiales: any[] = [];
            docs.forEach(d => historiales.push(d.data()));

            let nuevosMinutos = 0; // Por defecto a 0 si no hay historial previo

            if (historiales.length > 0) {
              // Ordenamos para encontrar el más reciente de los que quedaron vivos
              historiales.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
              const ultimoEntrenamientoVivo = historiales[0];
              nuevosMinutos = Math.ceil(ultimoEntrenamientoVivo.duracionSegundos / 60);
              console.log(`⏱️ Recálculo: El entrenamiento anterior duró ${nuevosMinutos} min`);
            } else {
              console.log(`⏱️ Recálculo: No hay historial previo, se regresa a 0 min`);
            }

            // 3. Actualizamos la tarjeta de la plantilla con el tiempo correcto
            if (idRutinaPlantilla) {
              const rutinaRef = doc(this.rutinasCol, idRutinaPlantilla);
              await updateDoc(rutinaRef, { duracion: nuevosMinutos });
              
              // Actualización visual si la rutina sigue seleccionada
              if (this.rutinaSeleccionada && this.rutinaSeleccionada.id === idRutinaPlantilla) {
                this.rutinaSeleccionada.duracion = nuevosMinutos;
              }
            }
          });
        } catch (error) {
          console.error("Error al borrar la sesión cancelada:", error);
        }
      }

      this.entrenamientoActivo = false;  
      this.rutinaActiva = null; 
      this.historialActivoId = null;
    } else if (this.accionConfirmacion === 'pausar') {
      if (this.sesionIncompletaPendiente) {
        this.retomarSesion(this.sesionIncompletaPendiente.id, this.sesionIncompletaPendiente);
        this.sesionIncompletaPendiente = null;
        this.accionConfirmacion = null;
        return;
      }

      clearInterval(this.timerInterval); 
      this.limpiarEntrenamientoActivo(); 

      if (this.rutinaActiva.ejerciciosLista.length === 0) {
        this.entrenamientoActivo = false;
        this.rutinaActiva = null;
        return; 
      }

      try {
        const registro = this.generarRegistro('incompleto');
        
        await runInInjectionContext(this.injector, async () => {
          if (this.historialActivoId) {
            await updateDoc(doc(this.historialCol, this.historialActivoId), registro);
          } else {
            await addDoc(this.historialCol, registro);
          }
        });
        
        this.mostrarAlerta('Entrenamiento pausado correctamente.');
      } catch (error) {
        console.error("Error al pausar:", error);
      }
      this.entrenamientoActivo = false;
      this.rutinaActiva = null;

    } else if (this.accionConfirmacion === 'eliminarRutina') {
      try {
        await runInInjectionContext(this.injector, async () => {
          const rutinaRef = doc(this.rutinasCol, this.rutinaEnEdicion.id);
          await deleteDoc(rutinaRef);
        });
        this.cerrarDetalle();
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
    
    this.accionConfirmacion = null;
  }

  cerrarModalConfirmacion() {
    this.mostrarModalConfirmacion = false;
    this.accionConfirmacion = null;
    this.sesionIncompletaPendiente = null;
  }

  generarRegistro(estado: string) {
    let setsCompletados = 0;
    this.rutinaActiva.ejerciciosLista.forEach((ej: any) => {
      ej.setsActivos.forEach((set: any) => { if (set.completado) setsCompletados++; });
    });
    
    const fechaActual = new Date();
    
    return {
      userId: this.authService.currentUserUid,
      fechaCompleta: fechaActual.toISOString(),
      fechaCorta: fechaActual.toLocaleDateString('es-MX'), 
      horaInicio: this.horaInicioEntrenamiento,     
      horaFin: fechaActual.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rutinaNombre: this.rutinaActiva.nombre,
      duracionSegundos: this.tiempoSegundos,
      duracionFormateada: this.tiempoFormateado,
      ejercicios: this.rutinaActiva.ejerciciosLista,
      totalSets: setsCompletados,
      estado: estado
    };
  }

  async finalizarEntrenamiento() {
    clearInterval(this.timerInterval); 
    this.limpiarEntrenamientoActivo(); 

    if (this.rutinaActiva.ejerciciosLista.length === 0) {
      this.mostrarAlerta('Entrenamiento vacío descartado.');
      this.entrenamientoActivo = false;
      this.rutinaActiva = null;
      return;
    }

    try {
      const registro = this.generarRegistro('completado');
      const minutosReales = Math.ceil(this.tiempoSegundos / 60);
      
      // 🔴 REESTRUCTURACIÓN: Extraemos los IDs y datos necesarios ANTES de abrir el contexto de inyección
      const historialIdTarget = this.historialActivoId;
      const rutinaIdTarget = this.rutinaActiva && this.rutinaActiva.id ? this.rutinaActiva.id : null;

      // Actualizamos visualmente al instante
      if (this.rutinaSeleccionada) {
        this.rutinaSeleccionada.duracion = minutosReales;
      }
      this.resumenDatos = registro;

      // 🔴 BLINDAJE TOTAL: El contexto de inyección solo debe ejecutar funciones puras de Firestore
      if (historialIdTarget) {
        await runInInjectionContext(this.injector, () =>
          updateDoc(doc(this.historialCol, historialIdTarget), registro)
        );
      } else {
        await runInInjectionContext(this.injector, () => addDoc(this.historialCol, registro));
      }

      if (rutinaIdTarget) {
        await runInInjectionContext(this.injector, () =>
          updateDoc(doc(this.rutinasCol, rutinaIdTarget), { duracion: minutosReales })
        );
      }

      await this.sincronizarEstadisticasComunidad();
      
      this.mostrarResumen = true;
    } catch (error) {
      console.error("Error al finalizar:", error);
      this.mostrarAlerta("Error de conexión al guardar tu progreso."); 
    }
    
    this.entrenamientoActivo = false;
    this.rutinaActiva = null;
  }

  private async sincronizarEstadisticasComunidad() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    const consulta = runInInjectionContext(this.injector, () =>
      query(this.historialCol, where('userId', '==', userId))
    );
    const snapshot = await runInInjectionContext(this.injector, () => getDocs(consulta));
    const perfilSnapshot = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, `usuarios/${userId}`))
    );
    const perfilData = perfilSnapshot.exists() ? perfilSnapshot.data() : {};
    const estadisticasActuales = perfilData['estadisticasComunidad'] ?? {};
    const temporadaId = this.obtenerTemporadaId();
    const inicioTemporada = this.obtenerInicioTemporada();
    let volumenTotalKg = 0;
    let volumenTemporadaKg = 0;
    let entrenamientosCompletados = 0;

    snapshot.forEach(documento => {
      const sesion = documento.data();
      if (sesion['estado'] !== 'completado') return;

      entrenamientosCompletados++;
      const fechaSesion = new Date(String(sesion['fechaCompleta'] ?? ''));
      const esDeEstaTemporada = !Number.isNaN(fechaSesion.getTime()) && fechaSesion >= inicioTemporada;
      const ejercicios = Array.isArray(sesion['ejercicios']) ? sesion['ejercicios'] : [];
      let volumenSesionKg = 0;
      ejercicios.forEach((ejercicio: any) => {
        const sets = Array.isArray(ejercicio.setsActivos) ? ejercicio.setsActivos : [];
        sets.forEach((set: any) => {
          if (set.completado === true && Number(set.kg) >= 0 && Number(set.reps) > 0) {
            volumenSesionKg += Number(set.kg) * Number(set.reps);
          }
        });
      });
      volumenTotalKg += volumenSesionKg;
      if (esDeEstaTemporada) volumenTemporadaKg += volumenSesionKg;
    });

    await runInInjectionContext(this.injector, () => setDoc(
      doc(this.firestore, `usuarios/${userId}`),
      {
        estadisticasComunidad: {
          volumenTotalKg,
          entrenamientosCompletados,
          volumenTemporadaKg,
          temporadaId,
          ligaActual: estadisticasActuales['ligaActual'] ?? 'Bronce',
          actualizadoEn: new Date().toISOString()
        }
      },
      { merge: true }
    ));
  }

  private obtenerInicioTemporada() {
    const fecha = new Date();
    const dia = fecha.getDay() || 7;
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() - dia + 1);
    return fecha;
  }

  private obtenerTemporadaId() {
    const inicio = this.obtenerInicioTemporada();
    return `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
  }

  agregarEjercicioEnVivo() {
    this.rutinaActiva.ejerciciosLista.push({ 
      id: this.generarId(), 
      nombre: '', 
      musculoAsignado: '',
      setsActivos: [{ kg: 0, reps: null, completado: false, previoString: '-' }] 
    });
  }

  eliminarEjercicioEnVivo(ejercicioIndex: number) {
    this.rutinaActiva.ejerciciosLista.splice(ejercicioIndex, 1);
  }

  agregarSetEnVivo(ejercicioIndex: number) {
    this.rutinaActiva.ejerciciosLista[ejercicioIndex].setsActivos.push({ kg: 0, reps: this.rutinaActiva.ejerciciosLista[ejercicioIndex].reps, completado: false, previoString: '-' });
  }

  quitarSetEnVivo(ejercicioIndex: number) {
    const sets = this.rutinaActiva.ejerciciosLista[ejercicioIndex].setsActivos;
    if (sets.length > 1) {
      sets.pop();
    }
  }

  marcarSet(set: any) { set.completado = !set.completado; }
  
  get tiempoFormateado() {
    const min = Math.floor(this.tiempoSegundos / 60);
    const sec = this.tiempoSegundos % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  cerrarResumen() {
    this.mostrarResumen = false;
    this.resumenDatos = null;
  }
}