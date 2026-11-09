import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  esRegistro = false; 
  email = '';
  password = '';
  confirmPassword = ''; // Nuevo campo para confirmar contraseña
  mensajeError = '';
  cargando = false;
  
  mostrarPassword = false; // Controla el ojito de la contraseña principal
  mostrarConfirmPassword = false; // Controla el ojito de la confirmación

  alternarModo() {
    this.esRegistro = !this.esRegistro;
    this.mensajeError = '';
    this.password = '';
    this.confirmPassword = '';
  }

  alternarVisibilidadPassword() {
    this.mostrarPassword = !this.mostrarPassword;
  }
  
  alternarVisibilidadConfirmPassword() {
    this.mostrarConfirmPassword = !this.mostrarConfirmPassword;
  }

  async enviarFormulario() {
    // Validaciones básicas
    if (!this.email || !this.password) {
      this.mensajeError = 'Por favor, llena los campos requeridos.';
      return;
    }

    // Validación extra si es registro
    if (this.esRegistro) {
      if (!this.confirmPassword) {
         this.mensajeError = 'Por favor, confirma tu contraseña.';
         return;
      }
      if (this.password !== this.confirmPassword) {
        this.mensajeError = 'Las contraseñas no coinciden.';
        return;
      }
    }

    this.cargando = true;
    this.mensajeError = '';

    try {
      if (this.esRegistro) {
        await this.authService.registro(this.email, this.password);
      } else {
        await this.authService.login(this.email, this.password);
      }
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') this.mensajeError = 'Este correo ya está registrado.';
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') this.mensajeError = 'Correo o contraseña incorrectos.';
      else if (error.code === 'auth/weak-password') this.mensajeError = 'La contraseña debe tener al menos 6 caracteres.';
      else this.mensajeError = 'Ocurrió un error. Intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }
}