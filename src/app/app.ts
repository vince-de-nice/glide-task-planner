import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, Button, Toast, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  currentYear = new Date().getFullYear();
  hideFooter = signal(this.isDeclarationRoute(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.hideFooter.set(this.isDeclarationRoute(e.urlAfterRedirects)));
  }

  private isDeclarationRoute(url: string): boolean {
    const path = url.split('?')[0];
    return path === '/declaration' || path === '' || path === '/';
  }

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
