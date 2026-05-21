import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import {
  Accordion,
  AccordionPanel,
  AccordionHeader,
  AccordionContent
} from 'primeng/accordion';
import { CupLoaderService } from '../../../services/cup-loader.service';
import { CupDatabaseService } from '../../../services/cup-database.service';
import { CupSourcesConfigService } from '../../../services/cup-sources-config.service';
import { TaskStateService } from '../../../services/task-state.service';
import { WaypointService } from '../../../services/waypoint.service';
import { UiFeedbackService } from '../../../services/ui-feedback.service';
import { TranslateService } from '../../../i18n/translate.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { CupSourceEntry } from '../../../models/cup-sources.model';

const DISCLAIMER_SEEN_KEY = 'gc_disclaimer_seen';
const DISCLAIMER_LEGACY_KEY = 'vav_disclaimer_seen';

@Component({
  selector: 'app-cup-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Select,
    InputText,
    Message,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    TranslatePipe
  ],
  templateUrl: './cup-toolbar.component.html',
  styleUrl: './cup-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CupToolbarComponent implements OnInit {
  private cupLoader = inject(CupLoaderService);
  private cupDatabase = inject(CupDatabaseService);
  private cupSourcesConfig = inject(CupSourcesConfigService);
  private waypointService = inject(WaypointService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);

  /** Page dédiée : masque le doublon d’état et applique la mise en page « standalone ». */
  standalone = input(false, { transform: booleanAttribute });

  /** Base chargée ou rechargée avec succès. */
  databaseLoaded = output<void>();

  waypoints = this.waypointService.waypoints;
  cupMeta = this.cupDatabase.meta;

  cupSources = signal<CupSourceEntry[]>([]);
  cupQuickSourcePick = signal<string | null>(null);
  cupUrlInput = signal('');
  disclaimer = signal('');
  loadError = signal<string | null>(null);
  loading = signal(false);
  disclaimerAccordionIndex = signal<number | number[] | string | string[] | null>(-1);

  @ViewChild('cupFileInput') cupFileInput?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    if (!this.isDisclaimerSeen() && this.disclaimer()) {
      this.disclaimerAccordionIndex.set(0);
    }
    void this.initCupSources();
  }

  onDisclaimerToggle(index: number | number[] | string | string[] | null | undefined): void {
    this.disclaimerAccordionIndex.set(index ?? null);
    const values = Array.isArray(index) ? index : index == null ? [] : [index];
    if (values.some(v => v === 0 || v === '0')) {
      localStorage.setItem(DISCLAIMER_SEEN_KEY, '1');
    }
  }

  async onCupQuickPickChange(url: string | null): Promise<void> {
    this.cupQuickSourcePick.set(url);
    if (!url?.trim()) {
      return;
    }
    const entry = this.cupSources().find(s => s.url === url);
    try {
      await this.loadFromUrl(url, entry?.label);
    } finally {
      this.cupQuickSourcePick.set(null);
    }
  }

  async loadFromUrlInput(): Promise<void> {
    const url = this.cupUrlInput().trim();
    if (!url) return;
    await this.loadFromUrl(url);
  }

  exportCup(): void {
    const content = this.cupDatabase.exportCup();
    const label =
      this.cupDatabase.getSourceLabel().replace(/[^\w.-]+/g, '_') || 'circuit-export';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}.cup`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async onCupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceFileMessage', { name: file.name })
      });
      if (!ok) {
        input.value = '';
        return;
      }
    }

    await this.runLoad(() => this.cupLoader.loadFromFile(file, true));
    input.value = '';
  }

  private async initCupSources(): Promise<void> {
    try {
      const config = await this.cupSourcesConfig.loadConfig();
      this.disclaimer.set(config.disclaimer);
      const merged = this.cupSourcesConfig.mergeWithRecents(
        config,
        this.cupDatabase.getRecentUrls()
      );
      this.cupSources.set(merged);
    } catch {
      this.loadError.set(this.i18n.t('cup.configError'));
    }
  }

  private async loadFromUrl(url: string, label?: string): Promise<void> {
    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceUrlMessage', { count: this.waypoints().length })
      });
      if (!ok) return;
    }
    await this.runLoad(() => this.cupLoader.loadFromUrl(url, label, true));
    this.cupUrlInput.set(url);
    void this.initCupSources();
  }

  private async runLoad(loader: () => Promise<number>): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const count = await loader();
      if (count === 0) {
        this.loadError.set(this.i18n.t('cup.noWaypoints'));
      } else {
        this.uiFeedback.success(
          this.i18n.t('cup.loaded'),
          this.i18n.t('cup.loadedDetail', { count })
        );
        this.databaseLoaded.emit();
      }
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : this.i18n.t('cup.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  private isDisclaimerSeen(): boolean {
    if (localStorage.getItem(DISCLAIMER_SEEN_KEY)) return true;
    if (!localStorage.getItem(DISCLAIMER_LEGACY_KEY)) return false;
    localStorage.setItem(DISCLAIMER_SEEN_KEY, '1');
    localStorage.removeItem(DISCLAIMER_LEGACY_KEY);
    return true;
  }
}
