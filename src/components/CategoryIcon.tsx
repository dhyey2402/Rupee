import React from 'react';
import {
  Fuel,
  Utensils,
  ShoppingBag,
  Bus,
  GraduationCap,
  Tv,
  Wrench,
  HeartPulse,
  MoreHorizontal,
  Laptop,
  Coins,
  Users,
  PlusCircle,
  Wallet,
  PiggyBank,
  CreditCard,
  Briefcase,
  Coffee,
  Car,
  Plane,
  Home,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5', color }) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    Fuel,
    Utensils,
    ShoppingBag,
    Bus,
    GraduationCap,
    Tv,
    Wrench,
    HeartPulse,
    MoreHorizontal,
    Laptop,
    Coins,
    Users,
    PlusCircle,
    Wallet,
    PiggyBank,
    CreditCard,
    Briefcase,
    Coffee,
    Car,
    Plane,
    Home,
    ShieldCheck,
    Tag,
  };

  const IconComponent = iconMap[name] || Tag;
  return <IconComponent className={className} style={color ? { color } : undefined} />;
};
