import { Component, inject } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private firestore: Firestore = inject(Firestore);
  
  rutinas: any[] = [];
  
  // Variable para guardar la rutina que el usuario quiere ver en el modal
  rutinaSeleccionada: any = null;

  constructor() {
    const rutinasCollection = collection(this.firestore, 'rutinas');
    
    onSnapshot(rutinasCollection, (snapshot) => {
      const dataTemporal: any[] = [];
      snapshot.forEach((doc) => {
        dataTemporal.push({ id: doc.id, ...doc.data() });
      });
      this.rutinas = dataTemporal;
    });
  }

  // Funciones mágicas para el modal
  abrirDetalle(rutina: any) {
    this.rutinaSeleccionada = rutina;
  }

  cerrarDetalle() {
    this.rutinaSeleccionada = null;
  }
}