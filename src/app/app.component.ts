import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
// Agregamos query, where y getDocs para poder hacerle preguntas a la base de datos
import { Firestore, collection, addDoc, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private firestore: Firestore = inject(Firestore);

  modalAbierto = false;
  mensajeError = ''; // <--- Variable para controlar si mostramos la alerta roja

  nuevaRutina = { 
    nombre: '', 
    dia: 'Lunes', 
    duracion: null as number | null, 
    ejerciciosLista: [] as any[] 
  };

  abrirModal() {
    this.modalAbierto = true;
    this.mensajeError = ''; // Limpiamos errores al abrir
    if (this.nuevaRutina.ejerciciosLista.length === 0) {
      this.agregarEjercicio();
    }
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.mensajeError = '';
    this.nuevaRutina = { nombre: '', dia: 'Lunes', duracion: null, ejerciciosLista: [] };
  }

  agregarEjercicio() {
    this.nuevaRutina.ejerciciosLista.push({ nombre: '', sets: null, reps: null });
  }

  eliminarEjercicio(index: number) {
    this.nuevaRutina.ejerciciosLista.splice(index, 1);
  }

  async guardarRutina() {
    this.mensajeError = ''; // Reseteamos el error

    // Validación 1: Que no esté vacío el nombre
    if (!this.nuevaRutina.nombre.trim()) {
      this.mensajeError = 'Debes ponerle un nombre a tu rutina.';
      return;
    }

    try {
      const rutinasRef = collection(this.firestore, 'rutinas');
      const nombreEstandarizado = this.nuevaRutina.nombre.trim().toUpperCase();

      // En lugar de pedirle a Firebase que compare exactamente, traemos las de ese día
      const consultaDia = query(rutinasRef, where('dia', '==', this.nuevaRutina.dia));
      const resultados = await getDocs(consultaDia);

      let existeDuplicado = false;

      // Las revisamos una por una, convirtiendo la vieja información a mayúsculas para comparar
      resultados.forEach((documento) => {
        const rutinaDB = documento.data();
        const nombreDB = rutinaDB['nombre'] ? rutinaDB['nombre'].trim().toUpperCase() : '';

        if (nombreDB === nombreEstandarizado) {
          existeDuplicado = true;
        }
      });

      // Si existe, bloqueamos
      if (existeDuplicado) {
        this.mensajeError = `Ya tienes una rutina llamada "${nombreEstandarizado}" para el día ${this.nuevaRutina.dia}. Usa otro nombre o edita la existente.`;
        return; 
      }

      // Si pasamos las validaciones, guardamos
      const rutinaParaGuardar = {
        ...this.nuevaRutina,
        nombre: nombreEstandarizado,
        ejercicios: this.nuevaRutina.ejerciciosLista.length
      };

      await addDoc(rutinasRef, rutinaParaGuardar);
      console.log("✅ Rutina guardada sin duplicados");
      this.cerrarModal();

    } catch (error) {
      console.error("❌ Error al guardar:", error);
      this.mensajeError = 'Hubo un error de conexión con la base de datos.';
    }
  }
}