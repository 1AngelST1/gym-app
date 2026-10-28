import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms'; // <-- Para leer los inputs del modal
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private firestore: Firestore = inject(Firestore);

  // Controla la animación del modal
  modalAbierto = false;

  // Molde vacío para tu nueva rutina
  nuevaRutina = { nombre: '', dia: 'Lunes', duracion: null, ejercicios: null };

  abrirModal() {
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
    // Limpiamos los campos cuando se cierra
    this.nuevaRutina = { nombre: '', dia: 'Lunes', duracion: null, ejercicios: null };
  }

  // Función estrella: Envía los datos directo a tu base de datos en Google
  async guardarRutina() {
    try {
      const rutinasRef = collection(this.firestore, 'rutinas');
      await addDoc(rutinasRef, this.nuevaRutina);
      console.log("✅ Rutina guardada exitosamente en Firebase");
      this.cerrarModal();
    } catch (error) {
      console.error("❌ Error al guardar:", error);
    }
  }
}