import { useSpring, animated } from '@react-spring/web';
import { useEffect, useRef } from 'react';

/**
 * 数字滚动动画组件
 * @param {number} value - 目标数值
 * @param {string} prefix - 前缀（如 $ 或 +）
 * @param {string} suffix - 后缀（如 % 或 USD）
 * @param {number} decimals - 小数位数
 * @param {number} duration - 动画时长（毫秒）
 * @param {boolean} colorByValue - 是否根据正负值变色
 * @param {string} className - 额外样式类
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
  const prevValue = useRef(0);
  
  useEffect(() => {
    prevValue.current = value;
  }, [value]);

  const { number } = useSpring({
    from: { number: prevValue.current },
    number: value,
    config: { duration },
  });

  const getColorClass = () => {
    if (!colorByValue) return '';
    return value >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]';
  };

  const formatNumber = (n) => {
    const formatted = Math.abs(n).toFixed(decimals);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  return (
    <animated.span className={`${getColorClass()} ${className}`}>
      {number.to(n => {
        const sign = colorByValue && value >= 0 ? '+' : (value < 0 ? '-' : '');
        const displayPrefix = colorByValue ? sign : prefix;
        return `${displayPrefix}${prefix && !colorByValue ? '' : ''}${formatNumber(n)}${suffix}`;
      })}
    </animated.span>
  );
};

export default AnimatedNumber;
