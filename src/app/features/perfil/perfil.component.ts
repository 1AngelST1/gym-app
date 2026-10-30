import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil',
  standalone: true,
  templateUrl: './perfil.component.html'
})
export class PerfilComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);

  // Variables que se mostrarán en tu HTML
  totalEntrenamientos = 0;
  totalMinutos = 0;

  ngOnInit() {
    const rutinasRef = collection(this.firestore, 'rutinas');
    
    // onSnapshot escucha en tiempo real: si agregas una rutina nueva, esto se recalcula solo
    onSnapshot(rutinasRef, (snapshot) => {
      // 1. Contamos cuántas rutinas existen en total
      this.totalEntrenamientos = snapshot.size;

      // 2. Sumamos los minutos de todas las rutinas
      let sumaMinutos = 0;
      snapshot.forEach((doc) => {
        const rutina = doc.data();
        // Verificamos que la rutina tenga duración antes de sumarla
        if (rutina['duracion']) {
          sumaMinutos += rutina['duracion'];
        }
      });
      
      this.totalMinutos = sumaMinutos;
    });
  }
}