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
  
  // En lugar de un solo arreglo, ahora tenemos 3 para separar la vista
  rutinasHoy: any[] = [];
  rutinasManana: any[] = [];
  rutinasResto: any[] = [];
  
  // Variables para saber qué día es hoy y mañana en español
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  diaHoyStr = '';
  diaMananaStr = '';

  rutinaSeleccionada: any = null;
  modoEdicion = false;
  rutinaEnEdicion: any = null;

  constructor() {
    this.calcularDias();

    const rutinasCollection = collection(this.firestore, 'rutinas');
    onSnapshot(rutinasCollection, (snapshot) => {
      // Limpiamos los arreglos cada vez que hay un cambio en Firebase
      this.rutinasHoy = [];
      this.rutinasManana = [];
      this.rutinasResto = [];

      snapshot.forEach((doc) => {

        const rutina: any = { id: doc.id, ...doc.data() };
        
        // Magia de filtrado: Acomodamos cada rutina en su lugar
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
    const indexHoy = fechaActual.getDay(); // 0 es Domingo, 1 es Lunes...
    const indexManana = (indexHoy + 1) % 7; // El % 7 es para que si hoy es Sábado (6), mañana sea Domingo (0)

    this.diaHoyStr = this.diasSemana[indexHoy];
    this.diaMananaStr = this.diasSemana[indexManana];
  }

  // =====================================
  // LÓGICA DE MODALES (Idéntica a la que ya tenías)
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
}