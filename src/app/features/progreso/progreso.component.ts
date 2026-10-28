import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-progreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progreso.component.html'
})
export class ProgresoComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  
  // Todos los músculos empiezan en nivel base
  niveles = {
    pecho: 'base',
    abdomen: 'base',
    brazoIzq: 'base',
    brazoDer: 'base',
    piernas: 'base'
  };

  ngOnInit() {
    const rutinasRef = collection(this.firestore, 'rutinas');
    
    // Escuchamos a Firebase en tiempo real
    onSnapshot(rutinasRef, (snapshot) => {
      let contadorPecho = 0;
      let contadorPierna = 0;
      let contadorBrazo = 0;

      // Recorremos todas tus rutinas de la base de datos
      snapshot.forEach((doc) => {
        const rutina = doc.data();
        const nombre = rutina['nombre']?.toLowerCase() || '';
        const ejercicios = rutina['ejercicios'] || 0;

        // Clasificamos los ejercicios según el nombre de la rutina
        if (nombre.includes('pecho') || nombre.includes('empuje')) contadorPecho += ejercicios;
        if (nombre.includes('pierna')) contadorPierna += ejercicios;
        if (nombre.includes('brazo') || nombre.includes('bicep') || nombre.includes('tricep')) contadorBrazo += ejercicios;
      });

      // Calculamos el nivel de cada músculo
      this.niveles.pecho = this.calcularNivel(contadorPecho);
      this.niveles.piernas = this.calcularNivel(contadorPierna);
      this.niveles.brazoIzq = this.calcularNivel(contadorBrazo);
      this.niveles.brazoDer = this.calcularNivel(contadorBrazo);
    });
  }

  // Lógica del videojuego: Cuántos ejercicios necesitas para subir de rango
  calcularNivel(cantidadEjercicios: number): string {
    if (cantidadEjercicios >= 20) return 'diamante';
    if (cantidadEjercicios >= 15) return 'oro';
    if (cantidadEjercicios >= 10) return 'plata';
    if (cantidadEjercicios >= 5) return 'cobre';
    return 'base';
  }

  // Traductor a colores de Tailwind
  obtenerClasesMusculo(nivel: string): string {
    const clasesBase = 'stroke-[0.5] transition-colors cursor-pointer duration-500 ';
    
    switch (nivel) {
      case 'diamante': return clasesBase + 'fill-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] stroke-cyan-200 hover:fill-cyan-300';
      case 'oro': return clasesBase + 'fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] stroke-yellow-200 hover:fill-yellow-400';
      case 'plata': return clasesBase + 'fill-zinc-300 stroke-white hover:fill-white';
      case 'cobre': return clasesBase + 'fill-orange-700 stroke-orange-400 hover:fill-orange-600';
      default: return 'fill-zinc-800 stroke-zinc-700 stroke-1 hover:fill-zinc-700 transition-colors cursor-pointer';
    }
  }
}