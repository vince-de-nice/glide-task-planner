import { Routes } from '@angular/router';
import { DeclarationComponent } from './components/declaration/declaration.component';

export const routes: Routes = [
  { path: '', redirectTo: 'declaration', pathMatch: 'full' },
  { path: 'declaration', component: DeclarationComponent },
  {
    path: 'waypoints',
    loadComponent: () =>
      import('./components/waypoint-manager/waypoint-manager.component').then(
        m => m.WaypointManagerComponent
      )
  },
  {
    path: 'data-sources',
    loadComponent: () =>
      import('./components/data-sources/data-sources.component').then(
        m => m.DataSourcesComponent
      )
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./components/library-page/library-page.component').then(
        m => m.LibraryPageComponent
      )
  },
  {
    path: 'safety-profile',
    loadComponent: () =>
      import('./components/safety-profile/safety-profile.component').then(
        m => m.SafetyProfileComponent
      )
  },
  {
    path: 'airspace-debug',
    loadComponent: () =>
      import('./components/airspace-debug-lab/airspace-debug-lab.component').then(
        m => m.AirspaceDebugLabComponent
      )
  },
  { path: 'planner', redirectTo: 'declaration', pathMatch: 'full' },
  { path: 'map', redirectTo: 'declaration', pathMatch: 'full' },
  { path: '**', redirectTo: 'declaration' }
];
