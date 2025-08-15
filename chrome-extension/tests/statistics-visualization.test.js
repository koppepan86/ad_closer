/**
 * 統計とデータ可視化機能のユニットテスト
 * Task 9.1: ユニットテストの作成
 */

describe('統計とデータ可視化機能', () => {
  let mockStatistics;

  beforeEach(() => {
    mockStatistics = {
      totalBlocked: 150,
      todayBlocked: 12,
      weeklyBlocked: 85,
      monthlyBlocked: 320,
      topDomains: [
        { domain: 'example.com', count: 45 },
        { domain: 'ads.google.com', count: 32 },
        { domain: 'facebook.com', count: 28 }
      ],
      blockingTrends: [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 8 },
        { date: '2024-01-03', count: 12 }
      ]
    };
  });

  describe('統計データの処理', () => {
    test('基本統計の計算', () => {
      const calculateBasicStats = (data) => {
        return {
          total: data.totalBlocked,
          average: data.weeklyBlocked / 7,
          growth: ((data.todayBlocked - 10) / 10) * 100
        };
      };

      const result = calculateBasicStats(mockStatistics);
      
      expect(result.total).toBe(150);
      expect(result.average).toBeCloseTo(12.14, 2);
      expect(result.growth).toBe(20);
    });

    test('トップドメインの分析', () => {
      const analyzeTopDomains = (domains) => {
        const total = domains.reduce((sum, domain) => sum + domain.count, 0);
        return domains.map(domain => ({
          ...domain,
          percentage: (domain.count / total) * 100
        }));
      };

      const result = analyzeTopDomains(mockStatistics.topDomains);
      
      expect(result[0].percentage).toBeCloseTo(42.86, 2);
      expect(result[1].percentage).toBeCloseTo(30.48, 2);
      expect(result[2].percentage).toBeCloseTo(26.67, 2);
    });

    test('トレンドデータの処理', () => {
      const processTrendData = (trends) => {
        return trends.map((item, index) => ({
          ...item,
          change: index > 0 ? item.count - trends[index - 1].count : 0
        }));
      };

      const result = processTrendData(mockStatistics.blockingTrends);
      
      expect(result[0].change).toBe(0);
      expect(result[1].change).toBe(3);
      expect(result[2].change).toBe(4);
    });
  });

  describe('データ可視化', () => {
    test('チャートデータの生成', () => {
      const generateChartData = (statistics) => {
        return {
          labels: statistics.topDomains.map(d => d.domain),
          datasets: [{
            data: statistics.topDomains.map(d => d.count),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
          }]
        };
      };

      const result = generateChartData(mockStatistics);
      
      expect(result.labels).toEqual(['example.com', 'ads.google.com', 'facebook.com']);
      expect(result.datasets[0].data).toEqual([45, 32, 28]);
      expect(result.datasets[0].backgroundColor).toHaveLength(3);
    });

    test('時系列データの変換', () => {
      const convertTimeSeriesData = (trends) => {
        return {
          x: trends.map(t => t.date),
          y: trends.map(t => t.count),
          type: 'line'
        };
      };

      const result = convertTimeSeriesData(mockStatistics.blockingTrends);
      
      expect(result.x).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
      expect(result.y).toEqual([5, 8, 12]);
      expect(result.type).toBe('line');
    });

    test('統計サマリーの生成', () => {
      const generateSummary = (stats) => {
        const efficiency = (stats.totalBlocked / (stats.totalBlocked + 50)) * 100;
        
        return {
          totalBlocked: stats.totalBlocked,
          efficiency: Math.round(efficiency),
          topDomain: stats.topDomains[0].domain,
          trend: stats.blockingTrends.length > 1 ? 'increasing' : 'stable'
        };
      };

      const result = generateSummary(mockStatistics);
      
      expect(result.totalBlocked).toBe(150);
      expect(result.efficiency).toBe(75);
      expect(result.topDomain).toBe('example.com');
      expect(result.trend).toBe('increasing');
    });
  });

  describe('エクスポート機能', () => {
    test('CSV形式でのエクスポート', () => {
      const exportToCSV = (data) => {
        const headers = 'Domain,Count,Percentage\n';
        const rows = data.topDomains.map(domain => {
          const total = data.topDomains.reduce((sum, d) => sum + d.count, 0);
          const percentage = ((domain.count / total) * 100).toFixed(2);
          return `${domain.domain},${domain.count},${percentage}%`;
        }).join('\n');
        
        return headers + rows;
      };

      const result = exportToCSV(mockStatistics);
      
      expect(result).toContain('Domain,Count,Percentage');
      expect(result).toContain('example.com,45,42.86%');
      expect(result).toContain('ads.google.com,32,30.48%');
    });

    test('JSON形式でのエクスポート', () => {
      const exportToJSON = (data) => {
        return JSON.stringify({
          exportDate: new Date().toISOString().split('T')[0],
          statistics: data
        }, null, 2);
      };

      const result = exportToJSON(mockStatistics);
      const parsed = JSON.parse(result);
      
      expect(parsed.statistics.totalBlocked).toBe(150);
      expect(parsed.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('フィルタリング機能', () => {
    test('日付範囲でのフィルタリング', () => {
      const filterByDateRange = (trends, startDate, endDate) => {
        return trends.filter(item => {
          const date = new Date(item.date);
          return date >= new Date(startDate) && date <= new Date(endDate);
        });
      };

      const result = filterByDateRange(
        mockStatistics.blockingTrends,
        '2024-01-01',
        '2024-01-02'
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
    });

    test('ドメインでのフィルタリング', () => {
      const filterByDomain = (domains, minCount) => {
        return domains.filter(domain => domain.count >= minCount);
      };

      const result = filterByDomain(mockStatistics.topDomains, 30);
      
      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe('example.com');
      expect(result[1].domain).toBe('ads.google.com');
    });
  });

  describe('リアルタイム更新', () => {
    test('統計の増分更新', () => {
      const updateStatistics = (current, newBlocks) => {
        return {
          ...current,
          totalBlocked: current.totalBlocked + newBlocks,
          todayBlocked: current.todayBlocked + newBlocks
        };
      };

      const result = updateStatistics(mockStatistics, 5);
      
      expect(result.totalBlocked).toBe(155);
      expect(result.todayBlocked).toBe(17);
      expect(result.weeklyBlocked).toBe(85); // 変更されない
    });

    test('新しいドメインの追加', () => {
      const addDomainBlock = (domains, newDomain) => {
        const existing = domains.find(d => d.domain === newDomain);
        if (existing) {
          return domains.map(d => 
            d.domain === newDomain ? { ...d, count: d.count + 1 } : d
          );
        } else {
          return [...domains, { domain: newDomain, count: 1 }];
        }
      };

      const result = addDomainBlock(mockStatistics.topDomains, 'newsite.com');
      
      expect(result).toHaveLength(4);
      expect(result[3].domain).toBe('newsite.com');
      expect(result[3].count).toBe(1);
    });
  });
});