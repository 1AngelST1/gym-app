import { Component, inject, Injector, OnDestroy, OnInit, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';

interface UsuarioComunidad {
  id: string;
  nombre: string;
  nivel: string;
  volumen: number;
  volumenTemporada: number;
  entrenamientos: number;
  iniciales: string;
  esUsuario: boolean;
  posicion: number;
  posicionLiga: number;
  liga: string;
}

interface SolicitudAmistad {
  id: string;
  emisorId: string;
  emisorNombre: string;
  estado: string;
}

@Component({
  selector: 'app-comunidad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comunidad.component.html'
})
export class ComunidadComponent implements OnInit, OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  tabActiva: 'global' | 'liga' | 'amigos' = 'global';
  rankingGlobal: UsuarioComunidad[] = [];
  rankingLiga: UsuarioComunidad[] = [];
  private todosLosUsuarios: UsuarioComunidad[] = [];
  usuariosDisponibles: UsuarioComunidad[] = [];
  amigos: UsuarioComunidad[] = [];
  solicitudesPendientes: SolicitudAmistad[] = [];
  busqueda = '';
  cargando = true;
  mensaje = '';
  ligaActual = 'Bronce';
  temporadaId = this.obtenerTemporadaId();
  private listenerUsuarios?: () => void;

  ngOnInit() {
    void this.cargarComunidad();
    this.iniciarListenerUsuarios();
  }

  ngOnDestroy() {
    this.listenerUsuarios?.();
  }

  cambiarTab(tab: 'global' | 'liga' | 'amigos') {
    this.tabActiva = tab;
    this.mensaje = '';
    void this.cargarComunidad();
  }

  get usuariosFiltrados() {
    const termino = this.busqueda.trim().toLowerCase();
    if (!termino) return this.usuariosDisponibles;
    return this.usuariosDisponibles.filter(usuario =>
      usuario.nombre.toLowerCase().includes(termino)
    );
  }

  async cargarComunidad() {
    const userId = this.authService.currentUserUid;
    if (!userId) {
      this.cargando = false;
      this.mensaje = 'Inicia sesión para ver la comunidad.';
      return;
    }

    try {
      const usuariosSnapshot = await this.leerColeccion('usuarios');
      const usuarios = usuariosSnapshot.docs
        .map(documento => this.crearUsuario(documento.id, documento.data()))
        .filter(usuario => usuario.id !== userId);
      this.todosLosUsuarios = usuarios;

      const miDocumento = usuariosSnapshot.docs.find(documento => documento.id === userId);
      const miUsuario = miDocumento
        ? this.crearUsuario(miDocumento.id, miDocumento.data())
        : this.crearUsuario(userId, {});

      this.rankingGlobal = [miUsuario, ...usuarios]
        .sort((a, b) => b.volumen - a.volumen)
        .slice(0, 50)
        .map((usuario, indice) => ({ ...usuario, posicion: indice + 1 }));

      this.ligaActual = miUsuario.liga;
      this.rankingLiga = [miUsuario, ...usuarios]
        .filter(usuario => usuario.liga === this.ligaActual)
        .sort((a, b) => b.volumenTemporada - a.volumenTemporada)
        .slice(0, 50)
        .map((usuario, indice) => ({ ...usuario, posicionLiga: indice + 1 }));

      const amigosSnapshot = await this.leerColeccion(`usuarios/${userId}/amigos`);
      const idsAmigos = new Set(amigosSnapshot.docs.map(documento => documento.id));
      this.amigos = [miUsuario, ...this.todosLosUsuarios.filter(usuario => idsAmigos.has(usuario.id))]
        .sort((a, b) => b.volumen - a.volumen)
        .map((usuario, indice) => ({ ...usuario, posicion: indice + 1 }));
      this.usuariosDisponibles = usuarios.filter(usuario => !idsAmigos.has(usuario.id));

      const solicitudesSnapshot = await this.leerColeccion('solicitudesAmistad');
      this.solicitudesPendientes = solicitudesSnapshot.docs
        .map(documento => ({ id: documento.id, ...documento.data() } as SolicitudAmistad))
        .filter(solicitud => solicitud.estado === 'pendiente' && solicitud.id.endsWith(`_${userId}`));
    } catch (error) {
      console.error('Error cargando comunidad:', error);
      this.mensaje = 'No se pudo cargar la comunidad.';
    } finally {
      this.cargando = false;
    }
  }

  async enviarSolicitud(usuario: UsuarioComunidad) {
    const userId = this.authService.currentUserUid;
    if (!userId || usuario.id === userId) return;

    try {
      await runInInjectionContext(this.injector, () => setDoc(
        doc(this.firestore, 'solicitudesAmistad', `${userId}_${usuario.id}`),
        {
          emisorId: userId,
          receptorId: usuario.id,
          emisorNombre: this.nombreActual(),
          estado: 'pendiente',
          fechaCreacion: new Date().toISOString()
        },
        { merge: true }
      ));
      this.usuariosDisponibles = this.usuariosDisponibles.filter(item => item.id !== usuario.id);
      this.mensaje = `Solicitud enviada a ${usuario.nombre}.`;
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      this.mensaje = 'No se pudo enviar la solicitud.';
    }
  }

  async aceptarSolicitud(solicitud: SolicitudAmistad) {
    const userId = this.authService.currentUserUid;
    if (!userId) return;

    const amigo = this.todosLosUsuarios.find(usuario => usuario.id === solicitud.emisorId)
      ?? this.rankingGlobal.find(usuario => usuario.id === solicitud.emisorId);
    if (!amigo) {
      this.mensaje = 'El usuario ya no está disponible.';
      return;
    }

    try {
      await runInInjectionContext(this.injector, () =>
        updateDoc(doc(this.firestore, 'solicitudesAmistad', solicitud.id), { estado: 'aceptada' })
      );
      await runInInjectionContext(this.injector, () => setDoc(
        doc(this.firestore, `usuarios/${userId}/amigos/${amigo.id}`),
        {
          nombre: amigo.nombre,
          nivel: amigo.nivel,
          fechaAceptada: new Date().toISOString()
        }
      ));
      await runInInjectionContext(this.injector, () => setDoc(
        doc(this.firestore, `usuarios/${amigo.id}/amigos/${userId}`),
        {
          nombre: this.nombreActual(),
          nivel: this.rankingGlobal.find(usuario => usuario.id === userId)?.nivel ?? 'Principiante',
          fechaAceptada: new Date().toISOString()
        }
      ));
      this.solicitudesPendientes = this.solicitudesPendientes.filter(item => item.id !== solicitud.id);
      await this.cargarComunidad();
      this.mensaje = `Ahora tú y ${amigo.nombre} son amigos.`;
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      this.mensaje = 'No se pudo aceptar la solicitud.';
    }
  }

  private crearUsuario(id: string, data: Record<string, any>): UsuarioComunidad {
    const nombre = typeof data['nombre'] === 'string' && data['nombre'].trim()
      ? data['nombre'].trim()
      : 'Usuario';
    const estadisticas = data['estadisticasComunidad'] ?? {};
    return {
      id,
      nombre,
      nivel: data['nivel'] ?? 'Principiante',
      volumen: Number(estadisticas['volumenTotalKg'] ?? 0),
      volumenTemporada: estadisticas['temporadaId'] === this.temporadaId
        ? Number(estadisticas['volumenTemporadaKg'] ?? 0)
        : 0,
      entrenamientos: Number(estadisticas['entrenamientosCompletados'] ?? 0),
      iniciales: this.obtenerIniciales(nombre),
      esUsuario: id === this.authService.currentUserUid,
      posicion: 0,
      posicionLiga: 0,
      liga: this.normalizarLiga(estadisticas['ligaActual'])
    };
  }

  private obtenerIniciales(nombre: string) {
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(parte => parte[0].toUpperCase())
      .join('');
  }

  private nombreActual() {
    return this.rankingGlobal.find(usuario => usuario.esUsuario)?.nombre ?? 'Usuario';
  }

  private normalizarLiga(liga: unknown) {
    return liga === 'Plata' || liga === 'Oro' || liga === 'Diamante' ? liga : 'Bronce';
  }

  private obtenerTemporadaId() {
    const fecha = new Date();
    const dia = fecha.getDay() || 7;
    fecha.setDate(fecha.getDate() - dia + 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  private leerColeccion(ruta: string) {
    return runInInjectionContext(this.injector, () =>
      getDocs(collection(this.firestore, ruta))
    );
  }

  private iniciarListenerUsuarios() {
    runInInjectionContext(this.injector, () => {
      this.listenerUsuarios = onSnapshot(
        collection(this.firestore, 'usuarios'),
        () => void this.cargarComunidad(),
        error => {
          console.error('Error actualizando usuarios de comunidad:', error);
        }
      );
    });
  }
}
