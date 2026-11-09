import { Component, inject, OnDestroy, OnInit, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Firestore, collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, where } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { MapaMuscularComponent } from '../../shared/components/mapa-muscular/mapa-muscular.component';

@Component({
  selector: 'app-progreso',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaMuscularComponent],
  templateUrl: './progreso.component.html'
})
export class ProgresoComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private authService: AuthService = inject(AuthService);
  private injector = inject(Injector);

  private historialCol = collection(this.firestore, 'historial');
  private listenerHistorial: any;

  nivelGeneral = 'Novato';
  genero: string = 'Masculino';
  generoVisual: string = 'Masculino'; 
  vistaCuerpo: 'frente' | 'espalda' = 'frente';
  
  niveles = {
    cuello: 'base', pecho: 'base', espalda: 'base', hombros: 'base',
    biceps: 'base', triceps: 'base', antebrazo: 'base', abdomen: 'base',
    cuadricep: 'base', femoral: 'base', gluteo: 'base', pantorrilla: 'base'
  };

  historialReciente: any[] = [];
  mostrarModalDetalle = false;
  sesionSeleccionada: any = null;
  
  periodoActivo: 'semana' | 'mes' = 'semana';
  historialCompletoGlobal: any[] = []; 
  
  slideGrafica: number = 0; 
  datosGraficaVolumen: { diaLetra: string, fechaStr: string, volumenKg: number, porcentaje: number, hoy: boolean }[] = [];
  datosGraficaPeso: any[] = []; 
  medidasVisiblesPeso: any[] = []; 
  puntosSvg = '';
  ultimoPesoRegistrado: number | null = null;

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.cargarDatosUsuario();
      this.iniciarListenerHistorial();
      this.cargarHistorialMedidas();
    });
  }

  async cargarDatosUsuario() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    try {
      const snap = await runInInjectionContext(this.injector, () => {
        return getDoc(doc(this.firestore, `usuarios/${userId}`));
      });
      
      if (snap.exists()) {
        const data = snap.data();
        this.genero = data['genero'] || 'Masculino';
        this.generoVisual = this.genero === 'Neutral' ? 'Masculino' : this.genero;
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  }

  async cargarHistorialMedidas() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    try {
      const snapshot = await runInInjectionContext(this.injector, () => {
        const q = query(collection(this.firestore, `usuarios/${userId}/medidas`), orderBy('fechaIso', 'asc'));
        return getDocs(q);
      });
      
      this.datosGraficaPeso = [];
      snapshot.forEach(d => {
        this.datosGraficaPeso.push({ id: d.id, ...d.data() });
      });

      this.prepararGraficaPuntos();
    } catch (error) {
      console.error('Error cargando medidas:', error);
    }
  }

  iniciarListenerHistorial() {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    runInInjectionContext(this.injector, () => {
      const q = query(this.historialCol, where('userId', '==', userId));
      
      this.listenerHistorial = onSnapshot(q, (snapshot) => {
        let cPecho = 0, cEspalda = 0, cHombro = 0, cBicep = 0, cTricep = 0, cCuello = 0, cAntebrazo = 0;
        let cCuad = 0, cFemoral = 0, cGluteo = 0, cPantorrilla = 0, cAbdomen = 0;
        
        let historialCompleto: any[] = [];

        snapshot.forEach((d) => {
          const sesion: any = { id: d.id, ...d.data() };
          if (sesion['estado'] === 'completado') {
            historialCompleto.push(sesion);
            
            if (sesion.ejercicios) {
            sesion.ejercicios.forEach((ej: any) => {
            const sets = this.contarSetsCompletados(ej);
            const musculo = this.obtenerMusculoEjercicio(ej);

              switch (musculo) {
                case 'cuello': cCuello += sets; break;
                case 'espalda': cEspalda += sets; break;
                case 'hombros': cHombro += sets; break;
                case 'biceps': cBicep += sets; break;
                case 'triceps': cTricep += sets; break;
                case 'antebrazo': cAntebrazo += sets; break;
                case 'pecho': cPecho += sets; break;
                case 'cuadricep': cCuad += sets; break;
                case 'femoral': cFemoral += sets; break;
                case 'pantorrilla': cPantorrilla += sets; break;
                case 'gluteo': cGluteo += sets; break;
                case 'abdomen': cAbdomen += sets; break;
              }
            });
            }
          }
        });

        const totalEntrenamientos = historialCompleto.length;
        if (totalEntrenamientos < 5) this.nivelGeneral = 'Novato';
        else if (totalEntrenamientos < 15) this.nivelGeneral = 'Principiante';
        else if (totalEntrenamientos < 30) this.nivelGeneral = 'Intermedio';
        else if (totalEntrenamientos < 50) this.nivelGeneral = 'Avanzado';
        else this.nivelGeneral = 'Élite';

        this.niveles = {
          cuello: this.calcularNivelMusculo(cCuello), pecho: this.calcularNivelMusculo(cPecho),
          espalda: this.calcularNivelMusculo(cEspalda), hombros: this.calcularNivelMusculo(cHombro),
          biceps: this.calcularNivelMusculo(cBicep), triceps: this.calcularNivelMusculo(cTricep),
          antebrazo: this.calcularNivelMusculo(cAntebrazo), abdomen: this.calcularNivelMusculo(cAbdomen),
          cuadricep: this.calcularNivelMusculo(cCuad), femoral: this.calcularNivelMusculo(cFemoral),
          gluteo: this.calcularNivelMusculo(cGluteo), pantorrilla: this.calcularNivelMusculo(cPantorrilla)
        };

        historialCompleto.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
        
        this.historialCompletoGlobal = historialCompleto; 
        this.historialReciente = historialCompleto.slice(0, 2);
        
        this.actualizarGraficas();
      });
    });
  }

  ngOnDestroy() {
    if (this.listenerHistorial) this.listenerHistorial();
  }

  calcularNivelMusculo(cantidadSets: number): string {
    if (cantidadSets >= 50) return 'diamante';
    if (cantidadSets >= 30) return 'oro';
    if (cantidadSets >= 15) return 'plata';
    if (cantidadSets >= 1) return 'cobre';
    return 'base';
  }

  private contarSetsCompletados(ejercicio: any): number {
    if (!Array.isArray(ejercicio?.setsActivos)) return 0;
    return ejercicio.setsActivos.filter((set: any) =>
      set?.completado === true && Number(set.reps) > 0
    ).length;
  }

  private calcularVolumenSesion(sesion: any): number {
    if (!Array.isArray(sesion?.ejercicios)) return 0;

    return sesion.ejercicios.reduce((total: number, ejercicio: any) => {
      if (!Array.isArray(ejercicio?.setsActivos)) return total;

      return total + ejercicio.setsActivos.reduce((volumen: number, set: any) => {
        const kg = Number(set?.kg);
        const reps = Number(set?.reps);
        if (set?.completado !== true || !Number.isFinite(kg) || !Number.isFinite(reps) || kg < 0 || reps <= 0) {
          return volumen;
        }
        return volumen + (kg * reps);
      }, 0);
    }, 0);
  }

  private obtenerMusculoEjercicio(ejercicio: any): string {
    const musculoAsignado = this.normalizarMusculo(ejercicio?.musculoAsignado);
    if (musculoAsignado) return musculoAsignado;

    return this.normalizarMusculoPorNombre(ejercicio?.nombre);
  }

  private normalizarMusculo(musculo: string): string {
    const valor = (musculo || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (valor === 'cuello' || valor === 'trapecios') return 'cuello';
    if (valor === 'pecho') return 'pecho';
    if (valor === 'dorsales' || valor === 'lumbar') return 'espalda';
    if (valor === 'hombros') return 'hombros';
    if (valor === 'biceps') return 'biceps';
    if (valor === 'triceps') return 'triceps';
    if (valor === 'antebrazos') return 'antebrazo';
    if (valor === 'abdomen' || valor === 'oblicuos') return 'abdomen';
    if (valor === 'cuadriceps' || valor === 'aductores') return 'cuadricep';
    if (valor === 'isquios') return 'femoral';
    if (valor === 'gluteos') return 'gluteo';
    if (valor === 'pantorrillas') return 'pantorrilla';
    return '';
  }

  private normalizarMusculoPorNombre(nombre: string): string {
    const valor = (nombre || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (valor.includes('pecho') || valor.includes('press banca')) return 'pecho';
    if (valor.includes('espalda') || valor.includes('jalon') || valor.includes('remo')) return 'espalda';
    if (valor.includes('hombro') || valor.includes('militar') || valor.includes('lateral')) return 'hombros';
    if (valor.includes('bicep') || valor.includes('curl')) return 'biceps';
    if (valor.includes('tricep') || valor.includes('frances') || valor.includes('extension tricep')) return 'triceps';
    if (valor.includes('antebrazo') || valor.includes('martillo')) return 'antebrazo';
    if (valor.includes('cuello') || valor.includes('encogimiento') || valor.includes('trapecio')) return 'cuello';
    if (valor.includes('cuadricep') || valor.includes('sentadilla') || valor.includes('prensa')) return 'cuadricep';
    if (valor.includes('femoral') || valor.includes('curl pierna') || valor.includes('peso muerto')) return 'femoral';
    if (valor.includes('pantorrilla') || valor.includes('elevacion') || valor.includes('gemelo')) return 'pantorrilla';
    if (valor.includes('gluteo') || valor.includes('hip thrust')) return 'gluteo';
    if (valor.includes('abdomen') || valor.includes('crunch')) return 'abdomen';
    return '';
  }

  actualizarGraficas() {
    this.construirGraficaVolumen();
    this.prepararGraficaPuntos();

    setTimeout(() => {
      const hoyIndex = this.datosGraficaVolumen.findIndex(d => d.hoy);
      if (hoyIndex !== -1) {
        const contenedor = document.querySelector('.grafica-volumen-scroll');
        if (contenedor && contenedor.children[hoyIndex]) {
           contenedor.children[hoyIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 100);
  }

 construirGraficaVolumen() {
    this.datosGraficaVolumen = [];
    const diasSemanaNombres = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    let volumenMaximo = 0;
    
    let fechasAMostrar: Date[] = [];

    if (this.periodoActivo === 'semana') {
      for (let i = 6; i >= 0; i--) {
        const f = new Date();
        f.setDate(f.getDate() - i);
        fechasAMostrar.push(f);
      }
    } else {
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = hoy.getMonth();
      const diasEnMes = new Date(año, mes + 1, 0).getDate(); 
      for (let i = 1; i <= diasEnMes; i++) {
        fechasAMostrar.push(new Date(año, mes, i));
      }
    }

    const hoyStr = new Date().toLocaleDateString('es-MX');

    fechasAMostrar.forEach(fecha => {
      const fechaStr = fecha.toLocaleDateString('es-MX');
      
      const diaLetra = this.periodoActivo === 'semana' 
        ? diasSemanaNombres[fecha.getDay()] 
        : fecha.getDate().toString();
      
      let volumenDia = 0;
      
      if (this.historialCompletoGlobal && this.historialCompletoGlobal.length > 0) {
        const sesionesDelDia = this.historialCompletoGlobal.filter(h =>
          this.obtenerClaveFecha(h.fechaCompleta) === this.obtenerClaveFecha(fecha)
        );
        sesionesDelDia.forEach(sesion => {
          volumenDia += this.calcularVolumenSesion(sesion);
        });
      }

      if (volumenDia > volumenMaximo) volumenMaximo = volumenDia;

      this.datosGraficaVolumen.push({ 
        diaLetra, 
        fechaStr, 
        volumenKg: volumenDia, 
        porcentaje: 0, 
        hoy: fechaStr === hoyStr
      });
    });

    this.datosGraficaVolumen.forEach(dia => {
      if (volumenMaximo > 0 && dia.volumenKg > 0) {
        dia.porcentaje = Math.max((dia.volumenKg / volumenMaximo) * 100, 10);
      } else {
        dia.porcentaje = 0;
      }
    });
  }
  
  prepararGraficaPuntos() {
    this.medidasVisiblesPeso = [];
    this.puntosSvg = '';
    this.ultimoPesoRegistrado = null;

    if (!this.datosGraficaPeso || this.datosGraficaPeso.length === 0) return;
    
    let fechaLimite = new Date();
    if (this.periodoActivo === 'semana') {
      fechaLimite.setDate(fechaLimite.getDate() - 7);
    } else {
      fechaLimite = new Date(new Date().getFullYear(), new Date().getMonth(), 1); 
    }

    const medidasFiltradas = this.datosGraficaPeso.filter(m => {
      const fecha = new Date(m.fechaIso);
      return !Number.isNaN(fecha.getTime()) && fecha >= fechaLimite;
    });
    
    let ultimos = medidasFiltradas.length > 0 ? medidasFiltradas : this.datosGraficaPeso.slice(-2);
    
    if (ultimos.length === 0) return;

    if (ultimos.length > 15) ultimos = ultimos.slice(-15);
    
    this.medidasVisiblesPeso = ultimos;

    const pesos = ultimos.map(m => Number(m.peso)).filter(peso => Number.isFinite(peso));
    if (pesos.length === 0) return;
    this.ultimoPesoRegistrado = pesos[pesos.length - 1];
    const maxPeso = Math.max(...pesos) + 5;
    const minPeso = Math.max(Math.min(...pesos) - 5, 0);
    const rango = maxPeso - minPeso || 1;

    let puntos = '';
    const widthStep = ultimos.length > 1 ? 300 / (ultimos.length - 1) : 0;
    
    ultimos.forEach((medida, index) => {
      const x = ultimos.length > 1 ? index * widthStep : 150;
      const y = 120 - (((Number(medida.peso) - minPeso) / rango) * 100); 
      medida.svgX = x;
      medida.svgY = y;
      puntos += `${x},${y} `;
    });
    this.puntosSvg = puntos.trim();
  }

  private obtenerClaveFecha(fecha: Date | string): string {
    const valor = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '';
    return `${valor.getFullYear()}-${valor.getMonth()}-${valor.getDate()}`;
  }

  siguienteGrafica() { this.slideGrafica = this.slideGrafica === 0 ? 1 : 0; }
  girarCuerpo() { this.vistaCuerpo = this.vistaCuerpo === 'frente' ? 'espalda' : 'frente'; }
  cambiarFormaCuerpo() { this.generoVisual = this.generoVisual === 'Masculino' ? 'Femenino' : 'Masculino'; }
  abrirDetalle(sesion: any) { this.sesionSeleccionada = sesion; this.mostrarModalDetalle = true; }
  cerrarDetalle() { this.mostrarModalDetalle = false; this.sesionSeleccionada = null; }

  obtenerEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pierna') || n.includes('gluteo') || n.includes('cuadricep')) return '🦵';
    if (n.includes('espalda') || n.includes('remo')) return '🦍';
    return '💪';
  }
}