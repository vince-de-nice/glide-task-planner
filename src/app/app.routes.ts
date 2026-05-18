import { Routes } from '@angular/router';
import { DeclarationComponent } from './components/declaration/declaration.component';
import { WaypointManagerComponent } from './components/waypoint-manager/waypoint-manager.component';

export const routes: Routes = [
  { path: '', redirectTo: 'declaration', pathMatch: 'full' },
  { path: 'declaration', component: DeclarationComponent },
  { path: 'waypoints', component: WaypointManagerComponent },
  { path: 'planner', redirectTo: 'declaration', pathMatch: 'full' },
  { path: 'map', redirectTo: 'declaration', pathMatch: 'full' },
  { path: '**', redirectTo: 'declaration' }
];
