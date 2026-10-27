import {
  BellIcon,
  BookIcon,
  CalendarIcon,
  CapIcon,
  InfoIcon,
  WalletIcon,
} from './Icons.jsx';

export default function NotificationIcon({ type, size = 18 }) {
  const icons = {
    announcement: BellIcon,
    grade: BookIcon,
    payment: WalletIcon,
    attendance: CalendarIcon,
    enrollment: CapIcon,
    library: BookIcon,
    system: InfoIcon,
  };
  const Icon = icons[type] || InfoIcon;
  return (
    <span className={`type-icon type-${type || 'system'}`}>
      <Icon size={size} />
    </span>
  );
}
