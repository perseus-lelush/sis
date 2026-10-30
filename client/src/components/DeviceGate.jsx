/**
 * Desktop-only access gate.
 *
 * Wraps the whole application. Unsupported devices (mobile/tablet user
 * agents, touch-only hardware, or viewports narrower than the desktop
 * minimum) see a "desktop required" notice instead of the app, and the
 * check re-runs on resize/orientation change so a desktop window that is
 * temporarily made narrow opens again once it is widened.
 *
 * index.html marks unsupported devices with html[data-device-blocked]
 * BEFORE first paint; the styles.rule in styles.css uses that attribute
 * to hide every #root child until React swaps the app for this gate, so
 * the application markup never flashes on a phone.
 */
import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { MIN_DESKTOP_WIDTH, inspectDevice } from '../lib/device.js';

function readDevice() {
  let touchOnly = false;
  try {
    touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    touchOnly = false;
  }
  return {
    ...inspectDevice({
      width: window.innerWidth,
      userAgent: navigator.userAgent,
      touchOnly,
    }),
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

const REASON_LABELS = {
  device: 'Mobile or tablet browser detected',
  touch: 'Touch-only device detected',
  viewport: `Screen width below ${MIN_DESKTOP_WIDTH}px`,
  unknown: 'Device profile could not be verified',
};

function BlockedNotice({ reason, size }) {
  const labels = reason.reasons.map((value) => REASON_LABELS[value]);
  return (
    <div className="device-gate">
      <div className="device-gate__card">
        <div className="device-gate__logo">
          <Logo size={38} />
        </div>
        <h1>Desktop only</h1>
        <p>
          The Student Information System runs on laptop and desktop browsers.
          Android phones, tablets and other small devices cannot open it.
        </p>
        <div className="device-gate__chips">
          {labels.map((label) => (
            <span className="device-gate__chip" key={label}>
              {label}
            </span>
          ))}
        </div>
        <p className="device-gate__hint">
          Your window is {size.width} × {size.height}. If you are on a desktop
          browser, maximize the window to continue.
        </p>
      </div>
    </div>
  );
}

export default function DeviceGate({ children }) {
  const [state, setState] = useState(() => readDevice());

  useEffect(() => {
    const update = () => {
      const next = readDevice();
      setState(next);
      if (next.blocked) {
        document.documentElement.setAttribute('data-device-blocked', 'true');
      } else {
        document.documentElement.removeAttribute('data-device-blocked');
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (state.blocked) {
    return <BlockedNotice reason={state} size={state} />;
  }
  return children;
}
