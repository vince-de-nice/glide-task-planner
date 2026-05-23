import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CupDatabaseService } from '../../../services/cup-database.service';
import { WaypointService } from '../../../services/waypoint.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-cup-source-shortcut',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <p class="decl-cup-shortcut" [attr.aria-label]="'cup.shortcutAria' | translate">
      <span class="decl-cup-shortcut__base">
        <i class="pi pi-vav-cup-source decl-cup-shortcut__icon" aria-hidden="true"></i>
        <span class="decl-cup-shortcut__name">{{
          cupMeta().sourceLabel || ('common.noBase' | translate)
        }}</span>
        @if (waypointCount() > 0) {
          <span class="decl-cup-shortcut__count">{{
            'cup.shortcutPoints' | translate: { count: waypointCount() }
          }}</span>
        }
      </span>
      <a routerLink="/data-sources" class="decl-cup-shortcut__link">{{
        'cup.changeSource' | translate
      }}</a>
    </p>
  `,
  styleUrl: './cup-source-shortcut.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CupSourceShortcutComponent {
  private cupDatabase = inject(CupDatabaseService);
  private waypointService = inject(WaypointService);

  cupMeta = this.cupDatabase.meta;
  readonly waypointCount = computed(() => this.waypointService.waypoints().length);
}
