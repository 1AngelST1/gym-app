import { Component, inject, Injector, runInInjectionContext, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Firestore, collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private injector = inject(Injector);
  
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

  // Control de notificaciones visuales y modales de confirmación
  mensajeAlerta: string | null = null;
  mostrarModalConfirmacion = false;
  tituloConfirmacion = '';
  mensajeConfirmacion = '';
  accionConfirmacion: 'cancelar' | 'pausar' | 'eliminarRutina' | null = null;
  
  // Guardamos temporalmente la sesión incompleta detectada
  sesionIncompletaPendiente: any = null;

  constructor() {
    this.calcularDias();

    const hoyCorta = new Date().toLocaleDateString('es-MX');

    this.listenerRutinas = onSnapshot(this.rutinasCol, (snapshot) => {
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

    this.listenerHistorial = onSnapshot(this.historialCol, (snapshot) => {
      this.historialHoy = [];
      snapshot.forEach((documento) => {
        const datos = documento.data();
        if (datos['fechaCorta'] === hoyCorta) {
          this.historialHoy.push({ id: documento.id, ...datos });
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.listenerRutinas) this.listenerRutinas();
    if (this.listenerHistorial) this.listenerHistorial();
    if (this.timerInterval) clearInterval(this.timerInterval);
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
  }

  cancelarEdicion() {
    this.modoEdicion = false;
  }

  agregarEjercicioEdit() {
    this.rutinaEnEdicion.ejerciciosLista.push({ nombre: '', sets: null, reps: null });
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

  empezarEntrenamiento() {
    const sesionIncompleta = this.historialHoy.find(h => 
      h.rutinaNombre === this.rutinaSeleccionada.nombre && h.estado === 'incompleto'
    );

    if (sesionIncompleta) {
      this.sesionIncompletaPendiente = sesionIncompleta;
      this.tituloConfirmacion = 'Entrenamiento en Pausa';
      this.mensajeConfirmacion = 'Tienes una sesión pausada hoy. ¿Deseas retomarla?';
      this.accionConfirmacion = 'pausar'; // O manejamos flujo de retomar
      this.mostrarModalConfirmacion = true;
      return;
    }
    this.empezarDeCero();
  }

  empezarDeCero() {
    this.historialActivoId = null; 
    this.rutinaActiva = JSON.parse(JSON.stringify(this.rutinaSeleccionada)); 
    
    this.rutinaActiva.ejerciciosLista = this.rutinaActiva.ejerciciosLista.map((ej: any) => {
      const filasDeSets = [];
      const totalSets = ej.sets || 1; 
      for(let i = 0; i < totalSets; i++) filasDeSets.push({ kg: 0, reps: ej.reps, completado: false });
      return { ...ej, setsActivos: filasDeSets }; 
    });

    this.cerrarDetalle(); 
    this.entrenamientoActivo = true; 
    this.tiempoSegundos = 0;
    this.horaInicioEntrenamiento = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    this.timerInterval = setInterval(() => { this.tiempoSegundos++; }, 1000);
  }

  retomarSesion(id: string, datosGuardados: any) {
    this.historialActivoId = id; 
    this.rutinaActiva = { nombre: datosGuardados.rutinaNombre, ejerciciosLista: datosGuardados.ejercicios };
    this.cerrarDetalle(); 
    this.entrenamientoActivo = true; 
    this.tiempoSegundos = datosGuardados.duracionSegundos; 
    this.horaInicioEntrenamiento = datosGuardados.horaInicio;
    
    this.timerInterval = setInterval(() => { this.tiempoSegundos++; }, 1000);
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

  async ejecutarAccionConfirmada() {
    this.mostrarModalConfirmacion = false;

    if (this.accionConfirmacion === 'cancelar') {
      clearInterval(this.timerInterval); 
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
    try {
      const registro = this.generarRegistro('completado');
      
      await runInInjectionContext(this.injector, async () => {
        if (this.historialActivoId) {
          const historialRef = doc(this.historialCol, this.historialActivoId);
          await updateDoc(historialRef, registro);
        } else {
          await addDoc(this.historialCol, registro);
        }
      });
      
      this.resumenDatos = registro;
      this.mostrarResumen = true;
    } catch (error) {
      console.error("Error al finalizar:", error);
      this.mostrarAlerta("Error de conexión al guardar tu progreso."); 
    }
    this.entrenamientoActivo = false;
    this.rutinaActiva = null;
  }

  agregarSetEnVivo(ejercicioIndex: number) {
    this.rutinaActiva.ejerciciosLista[ejercicioIndex].setsActivos.push({ kg: 0, reps: this.rutinaActiva.ejerciciosLista[ejercicioIndex].reps, completado: false });
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