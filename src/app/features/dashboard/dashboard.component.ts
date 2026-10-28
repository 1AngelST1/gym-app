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

  constructor() {
    const rutinasCollection = collection(this.firestore, 'rutinas');
    
    // Escuchamos a Firebase directamente desde el constructor para que Angular no se queje
    onSnapshot(rutinasCollection, (snapshot) => {
      const dataTemporal: any[] = [];
      
      snapshot.forEach((doc) => {
        dataTemporal.push({ id: doc.id, ...doc.data() });
      });
      
      this.rutinas = dataTemporal;
      console.log("✅ Datos limpios y directos sin warnings:", this.rutinas);
    });
  }
}