import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { CupToolbarComponent } from '../declaration/cup-toolbar/cup-toolbar.component';
import { CupDatabaseService } from '../../services/cup-database.service';
import { CupSourcesConfigService } from '../../services/cup-sources-config.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CupSourceEntry } from '../../models/cup-sources.model';

@Component({
  selector: 'app-data-sources',
  standalone: true,
  imports: [CommonModule, Button, CupToolbarComponent, TranslatePipe],
  templateUrl: './data-sources.component.html',
  styleUrl: './data-sources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataSourcesComponent implements OnInit {
  private cupDatabase = inject(CupDatabaseService);
  private cupSourcesConfig = inject(CupSourcesConfigService);
  private cupLoader = inject(CupLoaderService);
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);

  cupMeta = this.cupDatabase.meta;
  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;

  configSources = signal<CupSourceEntry[]>([]);
  recentUrls = signal<string[]>([]);
  configError = signal<string | null>(null);
  loadingSource = signal(false);

  readonly loadedAtLabel = computed(() => {
    const at = this.cupMeta().loadedAt;
    if (!at) return null;
    try {
      return new Date(at).toLocaleString(this.i18n.locale() === 'fr' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return at;
    }
  });

  ngOnInit(): void {
    void this.refreshLists();
  }

  onDatabaseLoaded(): void {
    this.refreshLists();
  }

  refreshLists(): void {
    this.recentUrls.set(this.cupDatabase.getRecentUrls());
    void this.cupSourcesConfig.loadConfig().then(
      config => {
        this.configSources.set(config.sources);
        this.configError.set(null);
      },
      () => this.configError.set(this.i18n.t('cup.configError'))
    );
  }

  isActiveSource(url: string): boolean {
    return this.cupDatabase.isFromUrl(url);
  }

  async loadSource(entry: CupSourceEntry): Promise<void> {
    await this.loadUrl(entry.url, entry.label);
  }

  async loadRecent(url: string): Promise<void> {
    await this.loadUrl(url);
  }

  private async loadUrl(url: string, label?: string): Promise<void> {
    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceUrlMessage', { count: this.waypoints().length })
      });
      if (!ok) return;
    }
    this.loadingSource.set(true);
    try {
      const count = await this.cupLoader.loadFromUrl(url, label, true);
      if (count === 0) {
        this.uiFeedback.warn(this.i18n.t('cup.noWaypoints'));
      } else {
        this.uiFeedback.success(
          this.i18n.t('cup.loaded'),
          this.i18n.t('cup.loadedDetail', { count })
        );
      }
      this.refreshLists();
    } catch (e) {
      this.uiFeedback.error(
        e instanceof Error ? e.message : this.i18n.t('cup.loadFailed')
      );
    } finally {
      this.loadingSource.set(false);
    }
  }

  removeRecent(url: string): void {
    this.cupDatabase.removeRecentUrl(url);
    this.refreshLists();
  }

  async clearRecents(): Promise<void> {
    if (this.recentUrls().length === 0) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('dataSources.clearRecentsHeader'),
      message: this.i18n.t('dataSources.clearRecentsMessage')
    });
    if (!ok) return;
    this.cupDatabase.clearRecentUrls();
    this.refreshLists();
  }

  async clearDatabase(): Promise<void> {
    if (this.waypoints().length === 0) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('dataSources.clearDbHeader'),
      message: this.i18n.t('dataSources.clearDbMessage'),
      acceptLabel: this.i18n.t('dataSources.clearDbAccept'),
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    this.waypointService.clearWaypoints();
    this.taskState.clearSelection();
    this.refreshLists();
    this.uiFeedback.success(this.i18n.t('dataSources.cleared'));
  }
}
