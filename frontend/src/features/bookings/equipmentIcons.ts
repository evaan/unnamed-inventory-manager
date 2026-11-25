import { Wrench, Printer, Scissors, Hammer, Zap, Cpu, type LucideIcon } from 'lucide-react';

export const EQUIPMENT_ICONS = { wrench: Wrench, printer: Printer, scissors: Scissors, hammer: Hammer, zap: Zap, cpu: Cpu } satisfies Record<string, LucideIcon>;
export type EquipmentIconName = keyof typeof EQUIPMENT_ICONS;
export const iconFor = (name?: string): LucideIcon => EQUIPMENT_ICONS[name as EquipmentIconName] ?? Wrench;