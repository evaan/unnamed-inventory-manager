import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

let initialization: Promise<void> | undefined;

export default function ParticlesBG() {
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    updateMotion();
    preference.addEventListener('change', updateMotion);

    initialization ??= initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    });
    void initialization.then(() => {
      if (active) setReady(true);
    }).catch(() => {
      // A decorative background must never prevent sign-in.
      initialization = undefined;
    });

    return () => {
      active = false;
      preference.removeEventListener('change', updateMotion);
    };
  }, []);

  const options = useMemo<ISourceOptions>(() => ({
    fullScreen: { enable: false },
    fpsLimit: 60,
    detectRetina: true,
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
    particles: {
      color: { value: '#00ADD8' },
      links: {
        color: '#00ADD8',
        distance: 150,
        enable: true,
        opacity: 0.4,
        width: 1,
      },
      move: {
        direction: 'none',
        enable: !reducedMotion,
        outModes: { default: 'bounce' },
        speed: 1.5,
      },
      number: { density: { enable: true }, value: 80 },
      opacity: { value: 0.8 },
      shape: { type: 'circle' },
      size: { value: { min: 1, max: 4 } },
    },
  }), [reducedMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ready && <Particles id="login-particles" className="h-full w-full" options={options} />}
    </div>
  );
}
