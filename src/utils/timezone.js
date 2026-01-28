/**
 * 时区转换和市场时段判断工具
 */

/**
 * 将 UTC+0 时间转换为 UTC+8（中国时间）
 * @param {Date} utcDate - UTC+0 时间
 * @returns {Date} - UTC+8 时间
 */
export const convertUTCToCST = (utcDate) => {
  if (!utcDate) return null;
  
  // 如果已经是 Date 对象，直接使用
  if (utcDate instanceof Date) {
    // 创建一个新日期对象，加上8小时
    const cstDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    return cstDate;
  }
  
  // 如果是字符串或其他格式，先转换为 Date
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) return null;
  
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
};

/**
 * 判断指定日期是否在美国夏令时期间
 * 美国夏令时：3月第二个周日 02:00 - 11月第一个周日 02:00
 * @param {Date} date - 日期（UTC+8 中国时间）
 * @returns {boolean}
 */
export const isUSDaylightSavingTime = (date) => {
  if (!date) return false;
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() 返回 0-11
  
  // 3月之前或11月之后，肯定是冬令时
  if (month < 3 || month > 11) return false;
  
  // 4月到10月，肯定是夏令时
  if (month > 3 && month < 11) return true;
  
  // 3月：从第二个周日开始是夏令时
  if (month === 3) {
    const secondSunday = getNthSundayOfMonth(year, 3, 2);
    return date >= secondSunday;
  }
  
  // 11月：到第一个周日之前是夏令时
  if (month === 11) {
    const firstSunday = getNthSundayOfMonth(year, 11, 1);
    return date < firstSunday;
  }
  
  return false;
};

/**
 * 判断指定日期是否在欧洲夏令时期间
 * 欧洲夏令时：3月最后一个周日 02:00 - 10月最后一个周日 02:00
 * @param {Date} date - 日期（UTC+8 中国时间）
 * @returns {boolean}
 */
export const isEUDaylightSavingTime = (date) => {
  if (!date) return false;
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // 4月到9月，肯定是夏令时
  if (month >= 4 && month <= 9) return true;
  
  // 3月：从最后一个周日开始是夏令时
  if (month === 3) {
    const lastSunday = getLastSundayOfMonth(year, 3);
    return date >= lastSunday;
  }
  
  // 10月：到最后一个周日之前是夏令时
  if (month === 10) {
    const lastSunday = getLastSundayOfMonth(year, 10);
    return date < lastSunday;
  }
  
  return false;
};

/**
 * 获取指定月份的第N个周日
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @param {number} n - 第几个周日 (1-5)
 * @returns {Date} - 日期对象（UTC+8 中国时间，设置为 02:00）
 */
const getNthSundayOfMonth = (year, month, n) => {
  // 创建该月第一天的日期
  const firstDay = new Date(year, month - 1, 1);
  
  // 找到第一个周日
  const firstDayOfWeek = firstDay.getDay(); // 0 = 周日
  const daysToFirstSunday = firstDayOfWeek === 0 ? 0 : 7 - firstDayOfWeek;
  const firstSunday = new Date(year, month - 1, 1 + daysToFirstSunday);
  
  // 计算第N个周日
  const nthSunday = new Date(firstSunday);
  nthSunday.setDate(firstSunday.getDate() + (n - 1) * 7);
  nthSunday.setHours(2, 0, 0, 0); // 设置为 02:00
  
  return nthSunday;
};

/**
 * 获取指定月份的最后一个周日
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @returns {Date} - 日期对象（UTC+8 中国时间，设置为 02:00）
 */
const getLastSundayOfMonth = (year, month) => {
  // 创建下个月第一天的日期
  const nextMonth = new Date(year, month, 1);
  
  // 往前推一天，找到本月最后一天
  const lastDay = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
  
  // 找到最后一个周日
  const lastDayOfWeek = lastDay.getDay();
  const daysToLastSunday = lastDayOfWeek === 0 ? 0 : lastDayOfWeek;
  const lastSunday = new Date(lastDay);
  lastSunday.setDate(lastDay.getDate() - daysToLastSunday);
  lastSunday.setHours(2, 0, 0, 0); // 设置为 02:00
  
  return lastSunday;
};

/**
 * 根据中国时间（UTC+8）判断市场时段（细分版本）
 * 自动适应夏令时/冬令时
 * 
 * ============ 冬令时时段（北京时间，11月-3月）============
 * 
 * 【亚盘】08:00-16:00（东京、香港、新加坡、澳洲）
 * - 亚盘早盘：08:00-10:30（东京/港股开盘）
 * - 亚盘午盘：10:30-14:00（午间交易）
 * - 亚盘尾盘：14:00-16:00（收盘整理，等待欧盘）
 * 
 * 【欧盘】16:00-22:30（伦敦、法兰克福）
 * - 欧盘早盘：16:00-18:30（伦敦开盘，欧洲数据）
 * - 欧盘午盘：18:30-21:00（欧洲午间交易）
 * - 欧盘尾盘：21:00-22:30（等待美股开盘）
 * 
 * 【美盘开盘】22:30-23:30 ★★★ 极高波动 ★★★
 * - 美股开盘首小时，最重要的交易时段之一
 * 
 * 【欧美重叠】23:30-01:00（伦敦尾盘+纽约早盘）★★ 高流动性 ★★
 * - 两大市场重叠，流动性最高
 * 
 * 【美盘】01:00-05:00（纽约）
 * - 美盘早盘：01:00-02:30（纽约上午活跃）
 * - 美盘午盘：02:30-04:00（纽约午间）
 * - 美盘尾盘：04:00-05:00（纽约收盘整理）
 * 
 * 【场外】05:00-08:00（休市，流动性极低）
 * 
 * ============ 夏令时时段（北京时间，3月-11月）============
 * 时间整体提前1小时
 * 
 * @param {Date} cstDate - 中国时间（UTC+8）
 * @returns {string} - 市场时段名称
 */
export const getMarketSession = (cstDate) => {
  if (!cstDate) return '未知';
  
  // 确保是 Date 对象
  const date = cstDate instanceof Date ? cstDate : new Date(cstDate);
  if (isNaN(date.getTime())) return '未知';
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeValue = hour * 60 + minute; // 转换为分钟
  
  // 检测是否夏令时
  const isUSDST = isUSDaylightSavingTime(date);
  
  // 夏令时偏移：夏令时时所有美国相关时段提前60分钟
  const dstOffset = isUSDST ? 60 : 0;
  
  // ========== 亚盘：08:00-16:00（不受美国夏令时影响）==========
  if (timeValue >= 480 && timeValue < 960) { // 08:00-16:00
    if (timeValue < 630) { // 08:00-10:30
      return '亚盘早盘';
    } else if (timeValue < 840) { // 10:30-14:00
      return '亚盘午盘';
    } else { // 14:00-16:00
      return '亚盘尾盘';
    }
  }
  
  // ========== 欧盘：16:00 到 美股开盘前 ==========
  // 冬令时：16:00-22:30，夏令时：15:00-21:30
  const euroStart = isUSDST ? 900 : 960; // 夏令时15:00，冬令时16:00
  const usOpen = isUSDST ? 1290 : 1350; // 美股开盘：夏令时21:30，冬令时22:30
  
  if (timeValue >= euroStart && timeValue < usOpen) {
    const euroMid1 = euroStart + 150; // 开盘后2.5小时
    const euroMid2 = usOpen - 90; // 美股开盘前1.5小时
    
    if (timeValue < euroMid1) {
      return '欧盘早盘';
    } else if (timeValue < euroMid2) {
      return '欧盘午盘';
    } else {
      return '欧盘尾盘';
    }
  }
  
  // ========== 美盘开盘（极高波动！）==========
  // 冬令时：22:30-23:30，夏令时：21:30-22:30
  const usOpenEnd = usOpen + 60;
  if (timeValue >= usOpen && timeValue < usOpenEnd) {
    return '美盘开盘';
  }
  
  // ========== 欧美重叠（高流动性）==========
  // 伦敦收盘时间：冬令时北京时间00:30，夏令时北京时间23:30
  // 冬令时：23:30-00:30，夏令时：22:30-23:30
  if (timeValue >= usOpenEnd && timeValue < 1440) {
    return '欧美重叠';
  }
  if (!isUSDST && timeValue >= 0 && timeValue < 30) { // 冬令时00:00-00:30是欧美重叠
    return '欧美重叠';
  }
  
  // ========== 美盘 ==========
  // 冬令时：00:30-05:00，夏令时：23:30-04:00
  // 冬令时美盘：00:30-05:00
  if (!isUSDST && timeValue >= 30 && timeValue < 300) {
    if (timeValue < 120) { // 00:30-02:00
      return '美盘早盘';
    } else if (timeValue < 240) { // 02:00-04:00
      return '美盘午盘';
    } else { // 04:00-05:00
      return '美盘尾盘';
    }
  }
  
  // 夏令时美盘：23:30-04:00（跨越午夜）
  if (isUSDST) {
    if (timeValue >= 1410) { // 23:30-24:00
      return '美盘早盘';
    }
    if (timeValue < 240) { // 00:00-04:00
      if (timeValue < 90) { // 00:00-01:30
        return '美盘早盘';
      } else if (timeValue < 180) { // 01:30-03:00
        return '美盘午盘';
      } else { // 03:00-04:00
        return '美盘尾盘';
      }
    }
  }
  
  // ========== 场外时间 ==========
  // 冬令时：05:00-08:00，夏令时：04:00-08:00
  const offMarketStart = isUSDST ? 240 : 300;
  if (timeValue >= offMarketStart && timeValue < 480) {
    return '场外';
  }
  
  // 兜底
  return '场外';
};

/**
 * 获取简化的市场时段（不含早盘/午盘/尾盘细分）
 * @param {Date} cstDate - 中国时间（UTC+8）
 * @returns {string} - 简化的市场时段名称
 */
export const getMarketSessionSimple = (cstDate) => {
  const session = getMarketSession(cstDate);
  if (session.startsWith('亚盘')) return '亚盘';
  if (session.startsWith('欧盘')) return '欧盘';
  if (session === '美盘开盘') return '美盘开盘';
  if (session === '欧美重叠') return '欧美重叠';
  if (session.startsWith('美盘')) return '美盘';
  return session;
};

/**
 * 获取时段的主分类
 * @param {string} session - 详细时段名称
 * @returns {string} - 主分类（亚盘/欧盘/美盘开盘/欧美重叠/美盘/场外）
 */
export const getSessionMainCategory = (session) => {
  if (!session) return '未知';
  if (session.startsWith('亚盘')) return '亚盘';
  if (session.startsWith('欧盘')) return '欧盘';
  if (session === '美盘开盘') return '美盘开盘';
  if (session === '欧美重叠') return '欧美重叠';
  if (session.startsWith('美盘')) return '美盘';
  if (session === '场外') return '场外';
  return session;
};

/**
 * 获取市场时段的详细描述
 * @param {Date} cstDate - 中国时间（UTC+8）
 * @returns {object} - { session: 时段名称, mainSession: 主时段, description: 描述, isUSDST, isEUDST }
 */
export const getMarketSessionDetail = (cstDate) => {
  if (!cstDate) return { session: '未知', mainSession: '未知', description: '', isUSDST: false, isEUDST: false };
  
  const date = cstDate instanceof Date ? cstDate : new Date(cstDate);
  if (isNaN(date.getTime())) {
    return { session: '未知', mainSession: '未知', description: '', isUSDST: false, isEUDST: false };
  }
  
  const session = getMarketSession(date);
  const mainSession = getSessionMainCategory(session);
  const isUSDST = isUSDaylightSavingTime(date);
  const isEUDST = isEUDaylightSavingTime(date);
  
  const dstLabel = isUSDST ? '夏令时' : '冬令时';
  
  const descriptions = {
    '亚盘早盘': '东京/香港/新加坡开盘，亚洲经济数据发布，流动性逐渐增加',
    '亚盘午盘': '亚洲市场午间交易，波动相对平缓',
    '亚盘尾盘': '亚洲市场收盘前整理，等待欧盘开盘',
    '欧盘早盘': `伦敦开盘（${dstLabel}），欧洲经济数据发布，流动性高`,
    '欧盘午盘': '伦敦市场午间交易，波动相对稳定',
    '欧盘尾盘': '等待美股开盘，关注美国盘前数据和期货走势',
    '美盘开盘': `★ 美股开盘首小时（${dstLabel}），极高波动，重要数据发布时段 ★`,
    '欧美重叠': `★ 伦敦尾盘+纽约早盘重叠（${dstLabel}），流动性最高 ★`,
    '美盘早盘': `纽约上午活跃交易（${dstLabel}），美股联动期`,
    '美盘午盘': '纽约午间交易，波动相对平缓',
    '美盘尾盘': `纽约收盘前整理（${dstLabel}），尾盘波动`,
    '场外': '市场休市，流动性极低，不建议交易',
  };
  
  return {
    session,
    mainSession,
    description: descriptions[session] || '',
    isUSDST,
    isEUDST,
  };
};

/**
 * 格式化时间显示（显示中国时间）
 * @param {Date} date - 日期对象
 * @param {boolean} includeSeconds - 是否包含秒
 * @returns {string} - 格式化后的时间字符串
 */
export const formatCSTTime = (date, includeSeconds = false) => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  if (includeSeconds) {
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export default {
  convertUTCToCST,
  getMarketSession,
  getMarketSessionSimple,
  getSessionMainCategory,
  getMarketSessionDetail,
  isUSDaylightSavingTime,
  isEUDaylightSavingTime,
  formatCSTTime,
};

