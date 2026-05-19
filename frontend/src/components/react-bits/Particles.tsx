/**
 * Particles — React Bits particle background component
 *
 * Configurable particle system for login page and dashboard hero section.
 *
 * Validates: Requirements 2.3, 7.5
 */
import React, { useEffect, useRef } from 'react';

export interface ParticleConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

export interface ParticlesProps {
  /** Number of particles (default: 60) */
  count?: number;
  /** Particle color (default: rgba(255,255,255,0.6)) */
  color?: string;
  /** Minimum particle radius (default: 1) */
  minRadius?: number;
  /** Maximum particle radius (default: 3) */
  maxRadius?: number;
  /** Particle speed multiplier (default: 0.5) */
  speed?: number;
  /** Whether to draw connecting lines between nearby particles */
  connectParticles?: boolean;
  /** Connection distance threshold in px (default: 120) */
  connectionDistance?: number;
  /** CSS class for the canvas wrapper */
  className?: string;
  /** Inline style for the canvas wrapper */
  style?: React.CSSProperties;
}

const Particles: React.FC<ParticlesProps> = ({
  count = 60,
  color = 'rgba(255,255,255,0.6)',
  minRadius = 1,
  maxRadius = 3,
  speed = 0.5,
  connectParticles = true,
  connectionDistance = 120,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<ParticleConfig[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      radius: minRadius + Math.random() * (maxRadius - minRadius),
      opacity: 0.3 + Math.random() * 0.7,
      color,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;

      // Update and draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw connections
      if (connectParticles) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectionDistance) {
              const alpha = (1 - dist / connectionDistance) * 0.3;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = color;
              ctx.globalAlpha = alpha;
              ctx.lineWidth = 0.5;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [count, color, minRadius, maxRadius, speed, connectParticles, connectionDistance]);

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        ...style,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default Particles;
