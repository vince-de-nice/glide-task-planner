import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, Button],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  currentYear = new Date().getFullYear();

  isDeclaration(): boolean {
    const u = this.router.url.split('?')[0];
    return u === '/declaration' || u === '' || u === '/';
  }

  isWaypoints(): boolean {
    return this.router.url.split('?')[0] === '/waypoints';
  }

  goDeclaration(): void {
    void this.router.navigate(['/declaration']);
  }

  goWaypoints(): void {
    void this.router.navigate(['/waypoints']);
  }
}
