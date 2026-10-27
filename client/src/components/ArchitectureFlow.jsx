import { DatabaseIcon, LayersIcon, MonitorIcon, ServerIcon } from './Icons.jsx';

const LAYERS = [
  {
    title: 'Presentation',
    subtitle: 'Student and staff web portal',
    icon: MonitorIcon,
    tone: 'indigo',
  },
  {
    title: 'API Gateway',
    subtitle: 'Authentication, RBAC, validation',
    icon: ServerIcon,
    tone: 'sky',
  },
  {
    title: 'Services',
    subtitle: 'Student · Academic · Library · Billing',
    icon: LayersIcon,
    tone: 'emerald',
  },
  {
    title: 'Database',
    subtitle: 'Relational storage with constraints',
    icon: DatabaseIcon,
    tone: 'amber',
  },
];

export default function ArchitectureFlow() {
  return (
    <div className="arch-flow">
      {LAYERS.map((layer, index) => {
        const Icon = layer.icon;
        return (
          <div className="arch-step" key={layer.title}>
            <div className="arch-node">
              <span className={`arch-node-icon tone-${layer.tone}`}>
                <Icon size={20} />
              </span>
              <div>
                <h3>{layer.title}</h3>
                <p>{layer.subtitle}</p>
              </div>
            </div>
            {index < LAYERS.length - 1 && <span className="arch-arrow" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
