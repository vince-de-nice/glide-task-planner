import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { filter } from 'rxjs';
import { TranslatePipe } from './i18n/translate.pipe';
import { TranslateService } from './i18n/translate.service';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher.component';
import { BackgroundActivityService } from './services/background-activity.service';

export interface AppNavItem {
  route: string;
  label: string;
  icon: string;
  badge?: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule,
    Button,
    Drawer,
    Toast,
    ConfirmDialog,
    TranslatePipe,
    LanguageSwitcherComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  private i18n = inject(TranslateService);
  readonly bgActivity = inject(BackgroundActivityService);
  currentYear = new Date().getFullYear();
  navDrawerVisible = signal(false);
  private currentPath = signal(this.pathFromUrl(this.router.url));

  hideFooter = computed(() => this.isWorkspaceRoute(this.currentPath()));

  readonly navItems = computed<AppNavItem[]>(() => {
    this.i18n.locale();
    return [
      {
        route: '/declaration',
        label: this.i18n.t('app.nav.circuit'),
        icon: 'pi pi-map'
      },
      {
        route: '/waypoints',
        label: this.i18n.t('app.nav.waypoints'),
        icon: 'pi pi-list'
      },
      {
        route: '/data-sources',
        label: this.i18n.t('app.nav.dataSources'),
        icon: 'pi pi-database'
      },
      {
        route: '/library',
        label: this.i18n.t('app.nav.library'),
        icon: 'pi pi-bookmark'
      },
      {
        route: '/safety-profile',
        label: this.i18n.t('app.nav.safetyProfile'),
        icon: 'pi pi-chart-line'
      },
      {
        route: '/airspace-debug',
        label: this.i18n.t('app.nav.airspaceDebug'),
        icon: 'pi pi-wrench'
      }
    ];
  });

  readonly currentPageTitle = computed(() => {
    this.i18n.locale();
    const path = this.currentPath();
    if (path === '/waypoints') return this.i18n.t('app.nav.waypoints');
    if (path === '/data-sources') return this.i18n.t('app.nav.dataSources');
    if (path === '/library') return this.i18n.t('app.nav.library');
    if (path === '/safety-profile') return this.i18n.t('app.nav.safetyProfile');
    if (path === '/airspace-debug') return this.i18n.t('app.nav.airspaceDebug');
    return this.i18n.t('app.nav.circuit');
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.currentPath.set(this.pathFromUrl(e.urlAfterRedirects));
        this.navDrawerVisible.set(false);
      });
  }

  openNav(): void {
    this.navDrawerVisible.set(true);
  }

  isActiveRoute(route: string): boolean {
    const path = this.currentPath();
    if (route === '/declaration') {
      return path === '/declaration' || path === '/' || path === '';
    }
    return path === route;
  }

  navigate(route: string): void {
    void this.router.navigate([route]);
    this.navDrawerVisible.set(false);
  }

  private pathFromUrl(url: string): string {
    return url.split('?')[0];
  }

  private isWorkspaceRoute(path: string): boolean {
    return (
      path === '/declaration' ||
      path === '' ||
      path === '/' ||
      path === '/data-sources' ||
      path === '/library' ||
      path === '/safety-profile' ||
      path === '/airspace-debug'
    );
  }
}
