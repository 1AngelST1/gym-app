import { Component, inject, Injector, runInInjectionContext } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router'; 
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router); 
  private authService: AuthService = inject(AuthService); 
  private injector = inject(Injector); 

  modalAbierto = false;
  mensajeError = '';
  isOffline = false; 

  opcionesMusculos = [
    'Cuello', 'Trapecios', 'Hombros', 'Pecho', 'Dorsales', 
    'Lumbar', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen', 
    'Oblicuos', 'Glúteos', 'Cuádriceps', 'Isquios', 'Aductores', 'Pantorrillas'
  ];

  nuevaRutina = { 
    nombre: '', 
    dia: 'Lunes', 
    ejerciciosLista: [] as any[] 
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOffline = !navigator.onLine;
      window.addEventListener('offline', () => this.isOffline = true);
      window.addEventListener('online', () => this.isOffline = false);
    }
  }

  get esRutaLogin(): boolean {
    return this.router.url === '/login' || this.router.url === '/';
  }

  // 🔴 NUEVA FUNCIÓN: Generador de ID único alfanumérico
  generarId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  abrirModal() {
    this.modalAbierto = true;
    this.mensajeError = '';
    if (this.nuevaRutina.ejerciciosLista.length === 0) {
      this.agregarEjercicio();
    }
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.mensajeError = '';
    this.nuevaRutina = { nombre: '', dia: 'Lunes', ejerciciosLista: [] };
  }

  agregarEjercicio() {
    this.nuevaRutina.ejerciciosLista.push({ 
      id: this.generarId(), // 🔴 Inyectamos el ID invisible
      nombre: '', 
      musculoAsignado: '', 
      sets: null, 
      reps: null 
    });
  }

  eliminarEjercicio(index: number) {
    this.nuevaRutina.ejerciciosLista.splice(index, 1);
  }

  async guardarRutina() {
    this.mensajeError = '';
    
    const userId = this.authService.currentUserUid;

    if (!userId) {
      this.mensajeError = 'Sesión inválida. Vuelve a iniciar sesión.';
      return;
    }

    if (!this.nuevaRutina.nombre.trim()) {
      this.mensajeError = 'Debes ponerle un nombre a tu rutina.';
      return;
    }

    if (this.nuevaRutina.ejerciciosLista.length === 0) {
      this.mensajeError = 'Agrega al menos un ejercicio.';
      return;
    }

    const ejerciciosSinNombre = this.nuevaRutina.ejerciciosLista.some(ej => !ej.nombre.trim());
    if (ejerciciosSinNombre) {
      this.mensajeError = 'Por favor, ponle nombre a todos tus ejercicios.';
      return;
    }

    const ejerciciosSinMusculo = this.nuevaRutina.ejerciciosLista.some(ej => !ej.musculoAsignado);
    if (ejerciciosSinMusculo) {
      this.mensajeError = 'Por favor, selecciona qué músculo trabaja cada ejercicio.';
      return;
    }

    const ejerciciosConNumerosMalos = this.nuevaRutina.ejerciciosLista.some(
      ej => ej.sets === null || ej.sets <= 0 || ej.reps === null || ej.reps <= 0
    );
    if (ejerciciosConNumerosMalos) {
      this.mensajeError = 'Los sets y repeticiones deben ser números válidos mayores a 0.';
      return;
    }

    try {
      const nombreEstandarizado = this.nuevaRutina.nombre.trim().toUpperCase();
      const rutinasRef = collection(this.firestore, 'rutinas');
      
      // 1. Fase de LECTURA: Buscamos duplicados SIN el contexto de inyección forzado
      const consultaDia = query(
        rutinasRef, 
        where('dia', '==', this.nuevaRutina.dia),
        where('userId', '==', userId)
      );
      
      const resultados = await getDocs(consultaDia);
      let existeDuplicado = false;

      resultados.forEach((documento) => {
        const rutinaDB = documento.data();
        const nombreDB = rutinaDB['nombre'] ? rutinaDB['nombre'].trim().toUpperCase() : '';
        if (nombreDB === nombreEstandarizado) {
          existeDuplicado = true;
        }
      });

      if (existeDuplicado) {
        this.mensajeError = `Ya tienes una rutina llamada "${nombreEstandarizado}" para el día ${this.nuevaRutina.dia}.`;
        return; 
      }

      const rutinaParaGuardar = {
        ...this.nuevaRutina,
        nombre: nombreEstandarizado,
        ejercicios: this.nuevaRutina.ejerciciosLista.length,
        userId: userId,
        duracion: 0
      };

      // 2. Fase de ESCRITURA: Envolvemos estrictamente el guardado (addDoc) en el contexto seguro
      runInInjectionContext(this.injector, () => {
        addDoc(rutinasRef, rutinaParaGuardar).then(() => {
          console.log("✅ Rutina guardada perfectamente estructurada");
        });
      });
      
      this.cerrarModal();

    } catch (error) {
      console.error("❌ Error al guardar:", error);
      this.mensajeError = 'Hubo un error de conexión con la base de datos.';
    }
  }
}