import { PageHeader } from '../components/ui.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { CheckIcon, MoonIcon, SunIcon } from '../components/Icons.jsx';

const THEME_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surfaces, tuned for daylight',
    Icon: SunIcon,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dimmed surfaces, easier on the eyes at night',
    Icon: MoonIcon,
  },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Manage your workspace preferences." />

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Appearance</h2>
            <p className="card-sub">Choose the theme used across the portal</p>
          </div>
        </div>

        <div className="theme-options">
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value;
            const OptionIcon = option.Icon;
            return (
              <button
                key={option.value}
                type="button"
                className={`theme-option ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => setTheme(option.value)}
              >
                <span className="theme-icon">
                  <OptionIcon size={18} />
                </span>
                <span className="theme-text">
                  <strong>{option.label}</strong>
                  <span className="theme-desc">{option.description}</span>
                </span>
                <span className="theme-check">
                  <CheckIcon size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
