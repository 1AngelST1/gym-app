import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Firestore, collection, onSnapshot, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private firestore: Firestore = inject(Firestore);
  
  // =====================================
  // VARIABLES DE VISTA PRINCIPAL (DÍAS)
  // =====================================
  rutinasHoy: any[] = [];
  rutinasManana: any[] = [];
  rutinasResto: any[] = [];
  
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  diaHoyStr = '';
  diaMananaStr = '';

  // =====================================
  // VARIABLES DE MODAL / EDICIÓN
  // =====================================
  rutinaSeleccionada: any = null;
  modoEdicion = false;
  rutinaEnEdicion: any = null;

  // =====================================
  // VARIABLES DE ENTRENAMIENTO ACTIVO
  // =====================================
  entrenamientoActivo = false;
  rutinaActiva: any = null;
  tiempoSegundos = 0;
  timerInterval: any;
  ejercicioActualIndex = 0;

  constructor() {
    this.calcularDias();

    const rutinasCollection = collection(this.firestore, 'rutinas');
    onSnapshot(rutinasCollection, (snapshot) => {
      this.rutinasHoy = [];
      this.rutinasManana = [];
      this.rutinasResto = [];

      snapshot.forEach((doc) => {
        const rutina: any = { id: doc.id, ...doc.data() };
        
        if (rutina.dia === this.diaHoyStr) {
          this.rutinasHoy.push(rutina);
        } else if (rutina.dia === this.diaMananaStr) {
          this.rutinasManana.push(rutina);
        } else {
          this.rutinasResto.push(rutina);
        }
      });
    });
  }

  calcularDias() {
    const fechaActual = new Date();
    const indexHoy = fechaActual.getDay();
    const indexManana = (indexHoy + 1) % 7; 

    this.diaHoyStr = this.diasSemana[indexHoy];
    this.diaMananaStr = this.diasSemana[indexManana];
  }

  // =====================================
  // LÓGICA DE MODALES Y EDICIÓN
  // =====================================
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
    if (!this.rutinaEnEdicion.ejerciciosLista) {
      this.rutinaEnEdicion.ejerciciosLista = [];
    }
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

  async guardarEdicion() {
    try {
      const rutinaRef = doc(this.firestore, 'rutinas', this.rutinaEnEdicion.id);
      const nombreEstandarizado = this.rutinaEnEdicion.nombre.trim().toUpperCase();
      
      const dataActualizada = {
        ...this.rutinaEnEdicion,
        nombre: nombreEstandarizado,
        ejercicios: this.rutinaEnEdicion.ejerciciosLista.length
      };

      await updateDoc(rutinaRef, dataActualizada);
      this.rutinaSeleccionada = dataActualizada; 
      this.modoEdicion = false; 
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  }

  async eliminarRutinaCompleta() {
    const confirmar = confirm('¿Estás seguro de que quieres eliminar toda esta rutina?');
    if (confirmar) {
      try {
        const rutinaRef = doc(this.firestore, 'rutinas', this.rutinaEnEdicion.id);
        await deleteDoc(rutinaRef);
        console.log("Rutina eliminada");
        this.cerrarDetalle();
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  }

  // =====================================
  // LÓGICA DE ENTRENAMIENTO ACTIVO
  // =====================================
  empezarEntrenamiento() {
    // 1. Copiamos la rutina base
    this.rutinaActiva = JSON.parse(JSON.stringify(this.rutinaSeleccionada)); 
    
    // 2. MAGIA: Transformamos los "sets" (número) en un arreglo real de filas para la UI
    this.rutinaActiva.ejerciciosLista = this.rutinaActiva.ejerciciosLista.map((ej: any) => {
      const filasDeSets = [];
      const totalSets = ej.sets || 1; // Si por error está vacío, pone 1
      
      for(let i = 0; i < totalSets; i++) {
        // Cada fila inicia sin peso, con las reps sugeridas, y sin completar
        filasDeSets.push({ kg: null, reps: ej.reps, completado: false });
      }
      
      return { ...ej, setsActivos: filasDeSets }; 
    });

    this.cerrarDetalle(); // Cerramos el modal pequeño
    this.entrenamientoActivo = true; // Abrimos la pantalla gigante
    this.tiempoSegundos = 0;
    
    // Iniciamos el cronómetro real de JavaScript
    this.timerInterval = setInterval(() => {
      this.tiempoSegundos++;
    }, 1000);
  }

  // Función para el botón "+ Añadir set" en vivo
  agregarSetEnVivo(ejercicioIndex: number) {
    const ejercicio = this.rutinaActiva.ejerciciosLista[ejercicioIndex];
    ejercicio.setsActivos.push({ kg: null, reps: ejercicio.reps, completado: false });
  }

  // Función para alternar la palomita de completado
  marcarSet(set: any) {
    set.completado = !set.completado;
  }

  // Convierte los segundos en formato "00:00"
  get tiempoFormateado() {
    const minutos = Math.floor(this.tiempoSegundos / 60);
    const segundos = this.tiempoSegundos % 60;
    return `${minutos}:${segundos < 10 ? '0' : ''}${segundos}`;
  }

  finalizarEntrenamiento() {
    clearInterval(this.timerInterval); // Detenemos el reloj
    this.entrenamientoActivo = false;
    
    alert(`¡Entrenamiento finalizado! Tiempo total: ${this.tiempoFormateado}`);
    this.rutinaActiva = null;
  }
}