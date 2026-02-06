import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 数字滚动动画组件（纯 JS 实现，无第三方依赖）
 * 替代 @react-spring/web，节省 ~60KB
 */
const AnimatedNumber = ({ 
  value = 0, 
  prefix = '', 
  suffix = '', 
  decimals = 0, 
  duration = 800,
  colorByValue = false,
  className = ''
}) => {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const rafRef = useRef(null);

  const formatNumber = useCallback((n) => {
    const formatted = Math.abs(n).toFixed(decimals);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }, [decimals]);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    const diff = to - from;
    if (diff === 0) return;

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + diff * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
        prevValue.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const colorClass = colorByValue
    ? (value >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]')
    : '';

  const sign = colorByValue ? (value >= 0 ? '+' : '-') : prefix;

  return (
    <span className={`${colorClass} ${className}`}>
      {sign}{formatNumber(display)}{suffix}
    </span>
  );
};

export default AnimatedNumber;
