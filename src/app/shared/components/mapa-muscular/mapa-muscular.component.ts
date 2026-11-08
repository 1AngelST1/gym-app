import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mapa-muscular',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-muscular.component.html'
})
export class MapaMuscularComponent {
  @Input() niveles: any;
  @Input() genero: string = 'masculino';

  obtenerClasesMusculo(nivel: string): string {
    const clasesBase = 'cursor-pointer transition-all duration-300 stroke-[2px] ';
    switch (nivel) {
      case 'diamante': return clasesBase + 'fill-cyan-500/80 stroke-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)] hover:fill-cyan-400';
      case 'oro': return clasesBase + 'fill-yellow-500/80 stroke-yellow-300 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] hover:fill-yellow-400';
      case 'plata': return clasesBase + 'fill-zinc-300/80 stroke-white hover:fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]';
      case 'cobre': return clasesBase + 'fill-orange-600/80 stroke-orange-400 drop-shadow-[0_0_8px_rgba(234,88,12,0.5)] hover:fill-orange-500';
      
      // Estado base transparente (plano arquitectónico)
      default: return clasesBase + 'fill-transparent stroke-transparent hover:fill-zinc-700/30';
    }
  }
}