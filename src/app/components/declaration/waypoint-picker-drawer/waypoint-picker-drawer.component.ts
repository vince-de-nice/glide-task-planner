import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Drawer } from 'primeng/drawer';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { WaypointService } from '../../../services/waypoint.service';
import { TaskStateService } from '../../../services/task-state.service';
import { WaypointType, WaypointTypeFilter } from '../../../models/waypoint.model';
import {
  WAYPOINT_TYPE_DISPLAY,
  WAYPOINT_TYPE_ORDER
} from '../../../utils/waypoint-type-display.util';
import { TranslateService } from '../../../i18n/translate.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { waypointTypeDisplayI18n } from '../../../i18n/display-i18n.util';

@Component({
  selector: 'app-waypoint-picker-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, Drawer, Button, InputText, Select, TranslatePipe],
  templateUrl: './waypoint-picker-drawer.component.html',
  styleUrl: './waypoint-picker-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WaypointPickerDrawerComponent {
  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private i18n = inject(TranslateService);

  visible = input(false);
  visibleChange = output<boolean>();
  waypointAdded = output<string>();

  waypoints = this.waypointService.waypoints;

  searchQuery = signal('');
  typeFilter = signal<WaypointTypeFilter>('all');
  currentPage = signal(1);
  pageSize = signal(40);

  readonly pageSizeOptions = [25, 40, 50, 100];

  readonly typeFilters = computed(() => {
    this.i18n.locale();
    return [
      { id: 'all' as WaypointTypeFilter, label: this.i18n.t('common.all'), icon: 'pi pi-list' },
      ...WAYPOINT_TYPE_ORDER.map(t => ({
        id: t as WaypointTypeFilter,
        label: this.i18n.t(`wpType.${t}.label`),
        icon: WAYPOINT_TYPE_DISPLAY[t].icon
      }))
    ];
  });

  filteredWaypoints = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.typeFilter();
    return this.waypoints().filter(wp => {
      if (filter !== 'all' && wp.type !== filter) return false;
      if (!q) return true;
      const haystack = [wp.name, wp.code, wp.description, wp.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  filteredCount = computed(() => this.filteredWaypoints().length);

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCount() / this.pageSize()))
  );

  paginatedWaypoints = computed(() => {
    const all = this.filteredWaypoints();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  pageRangeStart = computed(() => {
    if (this.filteredCount() === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  pageRangeEnd = computed(() => {
    const end = Math.min(this.currentPage(), this.totalPages()) * this.pageSize();
    return Math.min(end, this.filteredCount());
  });

  constructor() {
    effect(() => {
      this.filteredWaypoints();
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });
  }

  waypointTypeDisplay(type: WaypointType) {
    return waypointTypeDisplayI18n(type, this.i18n);
  }

  onVisibleChange(v: boolean): void {
    this.visibleChange.emit(v);
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  setTypeFilter(filter: WaypointTypeFilter): void {
    this.typeFilter.set(filter);
    this.currentPage.set(1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const p = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(p);
    document.querySelector('.decl-wp-list')?.scrollTo({ top: 0 });
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  onWaypointRowClick(id: string, name: string): void {
    this.taskState.addTurnpoint(id);
    this.waypointAdded.emit(name);
  }

  getOccurrenceCount(id: string): number {
    return this.taskState.getOccurrenceCount(id);
  }
}
