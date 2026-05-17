/**
 * Design System — public API
 * هەموو reusable UI primitives لێرە export دەکرێن.
 */
export { default as PageHeader, type PageHeaderProps } from './PageHeader';
export { default as KpiCard, type KpiCardProps } from './KpiCard';
export { default as StatusTag, type StatusTagProps, type StatusKind } from './StatusTag';
export { default as EmptyState, type EmptyStateProps } from './EmptyState';
export { default as MoneyInput, type MoneyInputProps } from './MoneyInput';
export { default as FilterBar, type FilterBarProps, type FilterDef } from './FilterBar';
export { default as DataTable, type DataTableProps } from './DataTable';
export { default as ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { default as SectionCard, type SectionCardProps } from './SectionCard';
export { default as KeyValueGrid, type KeyValueGridProps, type KeyValueItem } from './KeyValueGrid';
export { default as KbdHint, type KbdHintProps, cmdKey } from './KbdHint';
export { default as LoadingSkeleton, type LoadingSkeletonProps, type SkeletonVariant } from './LoadingSkeleton';

// Sprint 5–6 additions (UI Redesign Master Plan)
export { default as BulkActionBar, type BulkActionBarProps, type BulkAction } from './BulkActionBar';
export { default as ColumnVisibility, type ColumnVisibilityProps, type ColumnVisibilityItem } from './ColumnVisibility';
export { default as ExportMenu, type ExportMenuProps, type ExportFormat } from './ExportMenu';
export { default as FilterChipTray, type FilterChipTrayProps, type FilterChip } from './FilterChipTray';
export { default as DetailLayout, type DetailLayoutProps, type DetailLayoutTab } from './DetailLayout';
export { default as FormLayout, type FormLayoutProps, type FormSection, useUnsavedChangesGuard } from './FormLayout';
export { default as toast, useToastBridge, type ToastOptions } from './Toast';
export { default as ContextMenu, type ContextMenuProps, type ContextMenuItem } from './ContextMenu';

// Sprint 10 — Micro-components
export { default as CopyButton, type CopyButtonProps } from './CopyButton';
export { default as InlineEdit, type InlineEditProps } from './InlineEdit';
export { default as ShortcutCheatsheet, type ShortcutCheatsheetProps, type Shortcut } from './ShortcutCheatsheet';
export { default as EnvironmentBadge, type EnvironmentBadgeProps } from './EnvironmentBadge';
export { default as ConnectionStatus, type ConnectionStatusProps, type ConnectionStatusVariant } from './ConnectionStatus';
export { default as Stepper, type StepperProps } from './Stepper';
export { default as Timeline, type TimelineProps } from './Timeline';
export { default as AvatarGroup, type AvatarGroupProps, type AvatarItem } from './AvatarGroup';
export { default as PhoneInput, type PhoneInputProps } from './PhoneInput';
export { default as AddressInput, type AddressInputProps, type AddressValue, IRAQ_GOVERNORATES } from './AddressInput';
export { default as FileUploader, type FileUploaderProps } from './FileUploader';
export { default as MiniSparkline, type MiniSparklineProps } from './MiniSparkline';
export { default as TrendChart, type TrendChartProps } from './TrendChart';
export { default as DateRangePickerRTL, type DateRangePickerRTLProps } from './DateRangePickerRTL';
export { default as UserSelect, type UserSelectProps, type UserOption } from './UserSelect';
export { default as SavedViewsPicker, type SavedViewsPickerProps, type SavedView } from './SavedViewsPicker';
export { default as AdvancedFilterDrawer, type AdvancedFilterDrawerProps } from './AdvancedFilterDrawer';

// Wave 8.C: Premium UX Features
export { default as PrintView, usePrint, type PrintViewProps } from './PrintView';
export { default as QuickSearch, type QuickSearchProps } from './QuickSearch';

// Task 5.1: Framer Motion Animation Components (Requirements 4.1–4.5)
export { default as PageTransition } from '../components/PageTransition';
export { default as MotionModal, MotionModalContent } from '../components/MotionModal';
export { default as AnimatedList, AnimatedListItem } from '../components/AnimatedList';
export { default as MotionButton, type MotionButtonProps } from '../components/MotionButton';
export {
  pageVariants,
  modalVariants,
  listVariants,
  itemVariants,
  pressAnimation,
  hoverLift,
  reducedPageVariants,
  reducedModalVariants,
} from '../utils/animations';

// Performance: Image optimization (داواکاری ٥.٧) — WebP، lazy loading، responsive sizes
export { default as OptimizedImage, type OptimizedImageProps } from './OptimizedImage';
